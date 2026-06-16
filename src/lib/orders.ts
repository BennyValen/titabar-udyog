import { StockCategory } from "@prisma/client";
import { prisma } from "./db";
import { StockError } from "./stock";

export interface OrderItemInput {
  inventoryItemId?: string;
  itemName?: string;
  category?: StockCategory;
  quantity: number;
}

export async function resolveOrderItems(items: OrderItemInput[]) {
  const resolved: Array<{
    inv: { id: string; name: string; unit: string | null; category: StockCategory };
    quantity: number;
  }> = [];

  for (const item of items) {
    let inv;
    if (item.inventoryItemId) {
      inv = await prisma.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
      if (!inv) throw new StockError(`Item ${item.inventoryItemId} not found`);
    } else if (item.itemName?.trim()) {
      const name = item.itemName.trim();
      inv = await prisma.inventoryItem.findFirst({
        where: { name },
      });
      if (!inv) {
        inv = await prisma.inventoryItem.create({
          data: {
            name,
            category: item.category || "TRADING_ITEM",
            unit: null,
            subHeading: "GENERAL",
          },
        });
      }
    } else {
      throw new StockError("Each line needs an item from inventory or a name");
    }

    resolved.push({ inv, quantity: item.quantity });
  }

  return resolved;
}
