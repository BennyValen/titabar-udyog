import type { Prisma } from "@prisma/client";

function baseCodeFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w));

  let base = "";
  if (words.length >= 2) {
    base = words.map((w) => w.replace(/[^a-zA-Z0-9]/g, "").charAt(0)).join("");
  } else if (words[0]) {
    base = words[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  }

  base = base.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (base.length < 2) {
    base = `${base || "B"}R`.slice(0, 2);
  }
  return base.slice(0, 10);
}

export async function generateUniqueBranchCode(
  name: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const base = baseCodeFromName(name);
  let code = base;
  let suffix = 1;

  while (await tx.branch.findUnique({ where: { code }, select: { id: true } })) {
    const suffixStr = String(suffix);
    code = `${base.slice(0, Math.max(2, 10 - suffixStr.length))}${suffixStr}`;
    suffix += 1;
  }

  return code;
}
