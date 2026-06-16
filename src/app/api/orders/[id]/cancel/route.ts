import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertBranchAccess, requireAuth } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/api";
import { logAudit, logOrderStatus, releaseOrderReservations } from "@/lib/stock";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUniqueOrThrow({ where: { id } });
    assertBranchAccess(user, order.branchId);

    if (!["DRAFT", "PENDING"].includes(order.status)) {
      return jsonError("Only draft or pending orders can be cancelled", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (order.status === "PENDING") {
        await releaseOrderReservations(tx, id, user.id);
      }

      const cancelled = await tx.order.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: { items: true, reservations: true, branch: true },
      });

      await logOrderStatus(tx, id, order.status, "CANCELLED", user.id, "Order cancelled");
      return cancelled;
    });

    await logAudit(user.id, "CANCEL", "Order", id, order.branchId);
    return jsonOk({ order: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
