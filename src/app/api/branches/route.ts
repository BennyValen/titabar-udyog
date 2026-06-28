import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin, requireAuth } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { branchCreateSchema } from "@/lib/branch-validation";
import { generateUniqueBranchCode } from "@/lib/branch-code";
import { logAudit } from "@/lib/stock";

function mapBranchWithUser<T extends { users: Array<{ id: string; name: string; phone: string; isActive: boolean }> }>(
  branch: T
) {
  const { users, ...rest } = branch;
  return { ...rest, branchUser: users[0] ?? null };
}

export async function GET() {
  try {
    const user = await requireAuth();
    const branches = await prisma.branch.findMany({
      where:
        user.role === "ADMIN"
          ? {}
          : { id: user.branchId ?? undefined, isActive: true },
      orderBy: { name: "asc" },
      include: {
        users: {
          where: { role: "BRANCH_USER" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, name: true, phone: true, isActive: true },
        },
      },
    });
    return jsonOk({
      branches: branches.map(mapBranchWithUser),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = branchCreateSchema.parse(await req.json());
    const username = body.username?.trim() || body.name.trim();

    const branch = await prisma.$transaction(async (tx) => {
      const code =
        body.code?.toUpperCase() ??
        (await generateUniqueBranchCode(body.name.trim(), tx));

      const created = await tx.branch.create({
        data: {
          name: body.name.trim(),
          code,
          phone: body.phone,
        },
      });

      const passwordHash = await hashPassword(body.password);
      await tx.user.create({
        data: {
          name: username,
          phone: body.phone,
          passwordHash,
          role: "BRANCH_USER",
          branchId: created.id,
        },
      });

      return created;
    });

    await logAudit(admin.id, "CREATE", "Branch", branch.id, branch.id, {
      name: body.name,
      code: branch.code,
      username,
    });
    return jsonOk({ branch }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
