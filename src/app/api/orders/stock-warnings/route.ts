import { NextRequest } from "next/server";
import { assertBranchAccess, requireAuth, resolveBranchId } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { checkOrderStockWarnings, getItemsAvailableStock } from "@/lib/stock";
import { z } from "zod";

const schema = z.object({
  branchId: z.string().optional(),
  orderId: z.string().optional(),
  items: z.array(
    z.object({
      inventoryItemId: z.string(),
      quantity: z.number().positive(),
      itemName: z.string().optional(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = schema.parse(await req.json());
    const branchId = resolveBranchId(user, body.branchId);
    assertBranchAccess(user, branchId);

    const itemIds = body.items.map((i) => i.inventoryItemId);
    const [warnings, availability] = await Promise.all([
      checkOrderStockWarnings(branchId, body.items, body.orderId),
      getItemsAvailableStock(branchId, itemIds, body.orderId),
    ]);
    return jsonOk({ warnings, availability, hasWarnings: warnings.length > 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
