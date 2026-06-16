import { NextRequest } from "next/server";
import { assertBranchAccess, requireAuth, resolveBranchId } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { getLowStockItems, getLowStockItemsAllBranches } from "@/lib/stock";
import { StockCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const branchIdParam = searchParams.get("branchId");
    const category = searchParams.get("category") as StockCategory | null;

    if (user.role === "ADMIN" && !branchIdParam) {
      const result = await getLowStockItemsAllBranches(category ?? undefined);
      return jsonOk(result);
    }

    const branchId = resolveBranchId(user, branchIdParam);
    assertBranchAccess(user, branchId);
    const result = await getLowStockItems(branchId, category ?? undefined);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
