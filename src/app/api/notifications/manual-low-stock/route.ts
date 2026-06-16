import { NextRequest } from "next/server";
import { z } from "zod";
import { assertBranchAccess, requireAuth, resolveBranchId } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import {
  createManualLowStockAlert,
  deleteManualLowStockAlert,
  StockError,
} from "@/lib/stock"; // StockError used in DELETE
import { StockCategory } from "@prisma/client";

const createSchema = z.object({
  branchId: z.string().optional(),
  itemName: z.string().min(1),
  inventoryItemId: z.string().optional(),
  category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "TRADING_ITEM"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = createSchema.parse(await req.json());
    const branchId = resolveBranchId(user, body.branchId);
    assertBranchAccess(user, branchId);

    const alert = await createManualLowStockAlert({
      branchId,
      itemName: body.itemName,
      inventoryItemId: body.inventoryItemId,
      category: body.category as StockCategory | undefined,
      createdByUserId: user.id,
    });

    return jsonOk({ alert });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const id = new URL(req.url).searchParams.get("id");
    const branchIdParam = new URL(req.url).searchParams.get("branchId");
    if (!id) throw new StockError("Alert id is required");

    const branchId = resolveBranchId(user, branchIdParam);
    assertBranchAccess(user, branchId);
    await deleteManualLowStockAlert(id, branchId);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
