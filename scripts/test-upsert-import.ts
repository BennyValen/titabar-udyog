import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const inactive = await prisma.inventoryItem.findFirst({ where: { isActive: false } });
  if (!inactive) {
    console.log("No inactive item to test");
    return;
  }
  console.log("Testing upsert on inactive:", inactive.name);
  const existing = await prisma.inventoryItem.findFirst({
    where: { name: inactive.name, category: inactive.category },
  });
  if (existing) {
    await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { subHeading: "TEST", unit: null, moq: 0, isActive: true },
    });
    console.log("upsert ok");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
