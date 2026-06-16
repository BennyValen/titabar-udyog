import { NextRequest } from "next/server";
import { assertBranchAccess, requireAuth, resolveBranchId } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { stockOut, logAudit, StockError } from "@/lib/stock";
import { StockCategory } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  branchId: z.string().optional(),
  inventoryItemId: z.string(),
  category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "TRADING_ITEM"]),
  quantity: z.number().positive(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = schema.parse(await req.json());
    const branchId = resolveBranchId(user, body.branchId);
    assertBranchAccess(user, branchId);

    const movement = await stockOut(
      branchId,
      body.inventoryItemId,
      body.category as StockCategory,
      body.quantity,
      user.id,
      body.note
    );

    await logAudit(user.id, "STOCK_OUT", "StockMovement", movement.id, branchId, body);
    return jsonOk({ movement }, 201);
  } catch (error) {
    if (error instanceof StockError) {
      return handleApiError(new Error(error.message));
    }
    return handleApiError(error);
  }
}
