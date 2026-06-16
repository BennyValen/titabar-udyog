import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertBranchAccess, requireAuth } from "@/lib/auth";
import { jsonOk, handleApiError, parsePagination } from "@/lib/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const { branchId, itemId } = await params;
    assertBranchAccess(user, branchId);

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const [balance, movements, total] = await Promise.all([
      prisma.stockBalance.findUnique({
        where: { branchId_inventoryItemId: { branchId, inventoryItemId: itemId } },
        include: { inventoryItem: true, branch: true },
      }),
      prisma.stockMovement.findMany({
        where: { branchId, inventoryItemId: itemId },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where: { branchId, inventoryItemId: itemId } }),
    ]);

    return jsonOk({ balance, movements, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}
