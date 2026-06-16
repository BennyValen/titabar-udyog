import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/stock";
import { z } from "zod";

const schema = z.object({ password: z.string().min(4) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { password } = schema.parse(await req.json());
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    await logAudit(admin.id, "RESET_PASSWORD", "User", id, user.branchId ?? undefined);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
