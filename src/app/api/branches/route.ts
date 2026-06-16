import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/stock";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const branches = await prisma.branch.findMany({
      where:
        user.role === "ADMIN"
          ? {}
          : { id: user.branchId ?? undefined, isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { users: true, orders: true } },
      },
    });
    return jsonOk({ branches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const branch = await prisma.branch.create({ data: body });
    await logAudit(admin.id, "CREATE", "Branch", branch.id, branch.id, body);
    return jsonOk({ branch }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
