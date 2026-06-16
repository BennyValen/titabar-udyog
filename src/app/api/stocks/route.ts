import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertBranchAccess, requireAuth, resolveBranchId } from "@/lib/auth";
import { jsonOk, handleApiError, parsePagination } from "@/lib/api";
import { StockCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const branchId = resolveBranchId(user, searchParams.get("branchId"));
    assertBranchAccess(user, branchId);

    const category = searchParams.get("category") as StockCategory | null;
    const itemId = searchParams.get("itemId");
    const search = searchParams.get("search") || "";
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const isSqlite = process.env.DATABASE_URL?.startsWith("file:");
    const searchFilter = search
      ? isSqlite
        ? {
            OR: [
              { name: { contains: search } },
              { subHeading: { contains: search } },
            ],
          }
        : {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { subHeading: { contains: search, mode: "insensitive" as const } },
            ],
          }
      : {};

    const itemWhere = {
      isActive: true,
      ...(category ? { category } : {}),
      ...(itemId ? { id: itemId } : {}),
      ...searchFilter,
    };

    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { id: true, name: true, code: true },
    });

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: itemWhere,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where: itemWhere }),
    ]);

    const balances = await prisma.stockBalance.findMany({
      where: {
        branchId,
        inventoryItemId: { in: items.map((i) => i.id) },
      },
    });
    const balanceMap = new Map(balances.map((b) => [b.inventoryItemId, b]));
    const pendingReservedRows = await prisma.orderItem.groupBy({
      by: ["inventoryItemId"],
      where: {
        inventoryItemId: { in: items.map((i) => i.id) },
        order: {
          branchId,
          status: "PENDING",
        },
      },
      _sum: { quantity: true },
    });
    const pendingReservedMap = new Map(
      pendingReservedRows.map((row) => [row.inventoryItemId, Number(row._sum.quantity ?? 0)])
    );

    const mergedBalances = items.map((item) => {
      const bal = balanceMap.get(item.id);
      const onHandQty = Number(bal?.onHandQty ?? 0);
      const reservedQty = pendingReservedMap.get(item.id) ?? 0;
      return {
        id: bal?.id ?? item.id,
        branchId,
        inventoryItemId: item.id,
        category: item.category,
        onHandQty,
        reservedQty,
        availableQty: onHandQty - reservedQty,
        moq: item.moq,
        inventoryItem: item,
        branch,
      };
    });

    const movementFilter: Record<string, unknown> = { branchId };
    if (category) movementFilter.category = category;
    if (itemId) movementFilter.inventoryItemId = itemId;
    if (search) {
      movementFilter.inventoryItem = searchFilter;
    }

    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      movementFilter.createdAt = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      };
    } else if (year) {
      const y = parseInt(year, 10);
      if (!Number.isNaN(y)) {
        movementFilter.createdAt = {
          gte: new Date(y, 0, 1),
          lt: new Date(y + 1, 0, 1),
        };
      }
    } else if (dateFrom || dateTo) {
      movementFilter.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const recentMovements = await prisma.stockMovement.findMany({
      where: movementFilter,
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jsonOk({ balances: mergedBalances, total, page, limit, recentMovements });
  } catch (error) {
    return handleApiError(error);
  }
}
