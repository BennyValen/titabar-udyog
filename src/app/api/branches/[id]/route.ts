import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/stock";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(2).max(10).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await req.json());
    const branch = await prisma.branch.update({ where: { id }, data: body });
    await logAudit(admin.id, "UPDATE", "Branch", id, id, body);
    return jsonOk({ branch });
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
    const branch = await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
    await logAudit(admin.id, "DEACTIVATE", "Branch", id, id);
    return jsonOk({ branch });
  } catch (error) {
    return handleApiError(error);
  }
}
