import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";

const MAX_RESULTS = 10;

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const allowed = searchParams.get("categories")?.split(",").filter(Boolean);

    if (q.length < 1) {
      return jsonOk({ results: [] });
    }

    const isSqlite = process.env.DATABASE_URL?.startsWith("file:");

    let results: Array<{ id: string; name: string; category: string; unit: string | null }>;

    if (isSqlite) {
      const term = `%${q}%`;
      results = await prisma.$queryRaw<
        Array<{ id: string; name: string; category: string; unit: string | null }>
      >`
        SELECT id, name, category, unit
        FROM InventoryItem
        WHERE isActive = 1 AND lower(name) LIKE lower(${term})
        ORDER BY name ASC
        LIMIT ${MAX_RESULTS}
      `;
    } else {
      results = await prisma.inventoryItem.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: "insensitive" },
        },
        select: { id: true, name: true, category: true, unit: true },
        orderBy: { name: "asc" },
        take: MAX_RESULTS,
      });
    }

    const filtered = allowed?.length
      ? results.filter((r) => allowed.includes(r.category))
      : results;

    return jsonOk({ results: filtered });
  } catch (error) {
    return handleApiError(error);
  }
}
