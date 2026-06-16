import { prisma } from "@/lib/db";

const MAX_SEARCH = 10;
const MAX_ORDERS = 7;

type OrderRow = {
  id: string;
  customerPhone: string;
  customerName: string;
  customerAddress: string | null;
  createdAt: Date;
};

export async function searchCustomers(q: string) {
  const term = q.trim();
  if (term.length < 1) return [];

  const isSqlite = process.env.DATABASE_URL?.startsWith("file:");
  let orders: OrderRow[];

  if (isSqlite) {
    const like = `%${term}%`;
    orders = await prisma.$queryRaw<OrderRow[]>`
      SELECT id, customerPhone, customerName, customerAddress, createdAt
      FROM "Order"
      WHERE customerPhone LIKE ${like}
         OR lower(customerName) LIKE lower(${like})
      ORDER BY createdAt DESC
      LIMIT 50
    `;
  } else {
    orders = await prisma.order.findMany({
      where: {
        OR: [
          { customerPhone: { contains: term } },
          { customerName: { contains: term, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        customerPhone: true,
        customerName: true,
        customerAddress: true,
        createdAt: true,
      },
    });
  }

  const seen = new Set<string>();
  const results: Array<{
    id: string;
    name: string;
    phone: string;
    address: string;
    lastOrderDate: string;
  }> = [];

  for (const o of orders) {
    if (seen.has(o.customerPhone)) continue;
    seen.add(o.customerPhone);
    results.push({
      id: o.customerPhone,
      name: o.customerName,
      phone: o.customerPhone,
      address: o.customerAddress || "",
      lastOrderDate: o.createdAt.toISOString(),
    });
    if (results.length >= MAX_SEARCH) break;
  }

  return results;
}

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function getCustomerByPhone(phone: string) {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return null;

  const isSqlite = process.env.DATABASE_URL?.startsWith("file:");
  const tail = digits.slice(-10);
  let orders;

  if (isSqlite) {
    const like = `%${tail}%`;
    orders = await prisma.$queryRaw<
      Array<{
        id: string;
        customerPhone: string;
        customerName: string;
        customerAddress: string | null;
        createdAt: Date;
      }>
    >`
      SELECT id, customerPhone, customerName, customerAddress, createdAt
      FROM "Order"
      WHERE customerPhone LIKE ${like}
      ORDER BY createdAt DESC
      LIMIT ${MAX_ORDERS}
    `;
  } else {
    orders = await prisma.order.findMany({
      where: { customerPhone: { contains: tail } },
      orderBy: { createdAt: "desc" },
      take: MAX_ORDERS,
      select: {
        id: true,
        customerPhone: true,
        customerName: true,
        customerAddress: true,
        createdAt: true,
      },
    });
  }

  if (orders.length === 0) return null;

  const orderIds = orders.map((o) => o.id);
  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: {
      orderId: true,
      inventoryItemId: true,
      itemNameSnapshot: true,
      unitSnapshot: true,
      category: true,
      quantity: true,
    },
  });

  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const latest = orders[0];
  return {
    customer: {
      name: latest.customerName,
      phone: latest.customerPhone,
      address: latest.customerAddress || "",
    },
    orders: orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      items: (itemsByOrder.get(o.id) || []).map((i) => ({
        itemId: i.inventoryItemId,
        itemName: i.itemNameSnapshot,
        unit: i.unitSnapshot,
        category: i.category,
        qty: Number(i.quantity),
      })),
    })),
  };
}
