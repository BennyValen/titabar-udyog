import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { userUpdateSchema } from "@/lib/branch-validation";
import { logAudit } from "@/lib/stock";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = userUpdateSchema.parse(await req.json());

    const data: Record<string, unknown> = { ...body };
    if (body.password) {
      data.passwordHash = await hashPassword(body.password);
      delete data.password;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { branch: true },
    });

    await logAudit(admin.id, "UPDATE", "User", id, user.branchId ?? undefined);
    const { passwordHash: _hash, ...safe } = user;
    void _hash;
    return jsonOk({ user: safe });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    await logAudit(admin.id, "DEACTIVATE", "User", id, user.branchId ?? undefined);
    return jsonOk({ user: { id: user.id, isActive: user.isActive } });
  } catch (error) {
    return handleApiError(error);
  }
}
