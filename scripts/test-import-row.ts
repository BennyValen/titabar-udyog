import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const r = await prisma.inventoryItem.create({
      data: {
        name: "TEST_ITEM_XYZ_" + Date.now(),
        category: "TRADING_ITEM",
        subHeading: "GENERAL",
        unit: null,
        moq: 0,
      },
    });
    console.log("ok", r.id);
    await prisma.inventoryItem.delete({ where: { id: r.id } });
  } catch (e) {
    console.error("ERR", e instanceof Error ? e.message : e);
  }
}

main().finally(() => prisma.$disconnect());
