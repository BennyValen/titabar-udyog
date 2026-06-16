import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const test = await prisma.inventoryItem.create({
    data: {
      name: "_SCHEMA_VERIFY_" + Date.now(),
      category: "TRADING_ITEM",
      subHeading: "TEST",
      unit: null,
      moq: 0,
    },
    select: { id: true, subHeading: true, unit: true },
  });
  console.log("Create OK:", test);
  await prisma.inventoryItem.delete({ where: { id: test.id } });
}

main().catch((e) => console.error("FAIL:", e.message)).finally(() => prisma.$disconnect());
