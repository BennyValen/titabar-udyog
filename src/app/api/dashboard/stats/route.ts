import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertBranchAccess, requireAuth } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { toNumber } from "@/lib/utils";

const LOW_STOCK_THRESHOLD = 10;

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);

    const branchIdParam = searchParams.get("branchId");
    const branchFilter =
      user.role === "ADMIN"
        ? branchIdParam
          ? { id: branchIdParam }
          : {}
        : { id: user.branchId! };

    if (branchIdParam && user.role === "ADMIN") {
      assertBranchAccess(user, branchIdParam);
    } else if (user.role === "BRANCH_USER" && user.branchId) {
      assertBranchAccess(user, user.branchId);
    }

    const branchWhere = user.role === "ADMIN" && !branchIdParam ? {} : { branchId: branchIdParam || user.branchId! };

    const [
      branches,
      totalItems,
      pendingOrders,
      submittedOrders,
      recentMovements,
      lowStockItems,
      branchSummaries,
    ] = await Promise.all([
      prisma.branch.count({ where: { isActive: true, ...branchFilter } }),
      prisma.inventoryItem.count({ where: { isActive: true } }),
      prisma.order.count({ where: { ...branchWhere, status: "PENDING" } }),
      prisma.order.count({ where: { ...branchWhere, status: "SUBMITTED" } }),
      prisma.stockMovement.findMany({
        where: user.role === "ADMIN" && !branchIdParam ? {} : branchWhere,
        include: {
          inventoryItem: { select: { name: true } },
          branch: { select: { name: true, code: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.stockBalance.findMany({
        where: {
          ...(user.role === "ADMIN" && !branchIdParam ? {} : branchWhere),
          availableQty: { lte: LOW_STOCK_THRESHOLD },
        },
        include: {
          inventoryItem: true,
          branch: { select: { name: true, code: true } },
        },
        take: 20,
      }),
      user.role === "ADMIN"
        ? prisma.branch.findMany({
            where: { isActive: true },
            include: {
              _count: {
                select: {
                  orders: { where: { status: "PENDING" } },
                  stockBalances: true,
                },
              },
              stockBalances: {
                select: { onHandQty: true, reservedQty: true, availableQty: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const summaries = branchSummaries.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      pendingOrders: b._count.orders,
      stockItems: b._count.stockBalances,
      totalOnHand: b.stockBalances.reduce((s, x) => s + toNumber(x.onHandQty), 0),
      totalReserved: b.stockBalances.reduce((s, x) => s + toNumber(x.reservedQty), 0),
      totalAvailable: b.stockBalances.reduce((s, x) => s + toNumber(x.availableQty), 0),
    }));

    return jsonOk({
      branches,
      totalItems,
      pendingOrders,
      submittedOrders,
      recentMovements,
      lowStockItems: lowStockItems.map((s) => ({
        ...s,
        onHandQty: toNumber(s.onHandQty),
        reservedQty: toNumber(s.reservedQty),
        availableQty: toNumber(s.availableQty),
      })),
      branchSummaries: summaries,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
