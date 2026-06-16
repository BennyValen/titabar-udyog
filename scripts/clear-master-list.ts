import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.orderStockReservation.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockBalance.deleteMany();
  const used = await prisma.orderItem.findMany({
    select: { inventoryItemId: true },
    distinct: ["inventoryItemId"],
  });
  const usedIds = used.map((r) => r.inventoryItemId);
  if (usedIds.length > 0) {
    const deleted = await prisma.inventoryItem.deleteMany({ where: { id: { notIn: usedIds } } });
    await prisma.inventoryItem.updateMany({
      where: { id: { in: usedIds } },
      data: { isActive: false },
    });
    console.log(`Deleted ${deleted.count} items; deactivated ${usedIds.length} linked to orders`);
  } else {
    const deleted = await prisma.inventoryItem.deleteMany();
    console.log(`Deleted ${deleted.count} items`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
