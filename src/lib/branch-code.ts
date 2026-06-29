import type { Prisma } from "@prisma/client";

export function generateBranchCode(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .substring(0, 3)
    .toUpperCase();
}

export async function generateUniqueBranchCode(
  name: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  let base = generateBranchCode(name);
  if (!base) {
    base = "BRN";
  }

  let code = base;
  let suffix = 1;

  while (await tx.branch.findUnique({ where: { code }, select: { id: true } })) {
    code = `${base}${suffix}`;
    suffix += 1;
  }

  return code;
}
