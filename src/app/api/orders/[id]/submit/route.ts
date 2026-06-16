import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertBranchAccess, requireAuth } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/api";
import {
  consumeOrderReservations,
  deductStockForOrderSubmit,
  logAudit,
  logOrderStatus,
  StockError,
} from "@/lib/stock";
import { toNumber } from "@/lib/utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: { reservations: true, items: true },
    });

    assertBranchAccess(user, order.branchId);

    if (order.status !== "PENDING") {
      return jsonError("Only pending orders can be submitted", 400);
    }

    const activeReservations = order.reservations.filter((r) => r.status === "ACTIVE");

    const updated = await prisma.$transaction(async (tx) => {
      if (activeReservations.length > 0) {
        if (activeReservations.length !== order.items.length) {
          throw new StockError("Reserved quantities do not match order items. Cannot submit.");
        }

        for (const item of order.items) {
          const res = activeReservations.find((r) => r.orderItemId === item.id);
          if (!res || toNumber(res.quantity) !== toNumber(item.quantity)) {
            throw new StockError("Stock reservation mismatch. Please edit the order first.");
          }
        }

        await consumeOrderReservations(tx, id, user.id);
      } else {
        await deductStockForOrderSubmit(
          tx,
          id,
          order.branchId,
          order.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            category: item.category,
            quantity: toNumber(item.quantity),
          })),
          user.id,
          true
        );
      }

      const submitted = await tx.order.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedByUserId: user.id,
          submittedAt: new Date(),
        },
        include: {
          branch: true,
          items: true,
          reservations: true,
          submittedBy: { select: { id: true, name: true } },
        },
      });

      await logOrderStatus(tx, id, "PENDING", "SUBMITTED", user.id, "Order submitted");
      return submitted;
    });

    await logAudit(user.id, "SUBMIT", "Order", id, order.branchId);
    return jsonOk({ order: updated });
  } catch (error) {
    if (error instanceof StockError) return jsonError(error.message, 400);
    return handleApiError(error);
  }
}
