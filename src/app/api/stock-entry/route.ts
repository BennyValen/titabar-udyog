import { NextRequest } from "next/server";
import { assertBranchAccess, requireAuth, resolveBranchId } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/api";
import { batchStockEntry, logAudit, StockError } from "@/lib/stock";
import { resolveOrderItems } from "@/lib/orders";
import { toNumber } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { z } from "zod";

const itemSchema = z
  .object({
    inventoryItemId: z.string().optional(),
    itemName: z.string().optional(),
    category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "TRADING_ITEM"]).optional(),
    quantity: z.number().positive(),
  })
  .refine((i) => i.inventoryItemId || (i.itemName && i.itemName.trim()), {
    message: "Item ID or name required",
  });

const schema = z.object({
  branchId: z.string().optional(),
  direction: z.enum(["IN", "OUT"]),
  allowNegative: z.boolean().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = schema.parse(await req.json());
    const branchId = resolveBranchId(user, body.branchId);
    assertBranchAccess(user, branchId);

    const resolved = await resolveOrderItems(body.items);

    if (body.direction === "OUT" && !body.allowNegative) {
      const warnings = [];
      for (const { inv, quantity } of resolved) {
        const balance = await prisma.stockBalance.findUnique({
          where: { branchId_inventoryItemId: { branchId, inventoryItemId: inv.id } },
        });
        const onHand = balance ? toNumber(balance.onHandQty) : 0;
        if (onHand < quantity) {
          warnings.push({
            inventoryItemId: inv.id,
            name: inv.name,
            onHand,
            requested: quantity,
          });
        }
      }
      if (warnings.length > 0) {
        return jsonError("Stock may go negative. Continue?", 409, { warnings });
      }
    }

    const movements = await batchStockEntry(
      branchId,
      body.direction,
      resolved.map(({ inv, quantity }) => ({
        inventoryItemId: inv.id,
        category: inv.category,
        quantity,
      })),
      user.id,
      body.allowNegative
    );

    await logAudit(user.id, `STOCK_ENTRY_${body.direction}`, "StockMovement", movements[0]?.id, branchId, {
      count: movements.length,
      direction: body.direction,
    });

    return jsonOk({ movements, count: movements.length }, 201);
  } catch (error) {
    if (error instanceof StockError) return jsonError(error.message, 400);
    return handleApiError(error);
  }
}
