import { NextRequest } from "next/server";
import { assertBranchAccess, requireAdmin } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { stockAdjustment, logAudit, StockError } from "@/lib/stock";
import { StockCategory } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  branchId: z.string(),
  inventoryItemId: z.string(),
  category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "TRADING_ITEM"]),
  newOnHandQty: z.number().min(0),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await req.json());
    assertBranchAccess(admin, body.branchId);

    const balance = await stockAdjustment(
      body.branchId,
      body.inventoryItemId,
      body.category as StockCategory,
      body.newOnHandQty,
      admin.id,
      body.note
    );

    await logAudit(admin.id, "STOCK_ADJUSTMENT", "StockBalance", balance.id, body.branchId, body);
    return jsonOk({ balance });
  } catch (error) {
    if (error instanceof StockError) {
      return handleApiError(new Error(error.message));
    }
    return handleApiError(error);
  }
}
