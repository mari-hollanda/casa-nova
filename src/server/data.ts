import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, orderLines, orders, rooms, type Item, type Order, type Room } from "@/db/schema";
import { computeOrderBreakdown, type OrderBreakdown } from "@/domain/order";
import { summarize, type OrderRecord, type PlannedItem } from "@/domain/planning";

export interface OrderView {
  order: Order;
  record: OrderRecord;
  breakdown: OrderBreakdown;
}

/**
 * Carrega o planejamento completo do usuário. É uma aplicação pessoal (centenas de linhas,
 * não milhões), então calcular tudo em memória com o domínio puro mantém uma única fonte
 * de verdade para as regras, sem duplicá-las em SQL.
 */
export async function loadPlanning(userId: string) {
  const [roomRows, itemRows, orderRows, lineRows] = await Promise.all([
    db.select().from(rooms).where(eq(rooms.userId, userId)).orderBy(asc(rooms.name)),
    db.select().from(items).where(eq(items.userId, userId)).orderBy(asc(items.name)),
    db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.purchaseDate), desc(orders.createdAt)),
    db
      .select()
      .from(orderLines)
      .where(eq(orderLines.userId, userId))
      .orderBy(asc(orderLines.orderId), asc(orderLines.position)),
  ]);

  const linesByOrder = Map.groupBy(lineRows, (l) => l.orderId);

  const orderViews: OrderView[] = orderRows.map((order) => {
    const record: OrderRecord = {
      id: order.id,
      archived: order.archivedAt !== null,
      freightCents: order.freightCents,
      discountCents: order.discountCents,
      totalPaidCents: order.totalPaidCents,
      lines: (linesByOrder.get(order.id) ?? []).map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
    };
    return { order, record, breakdown: computeOrderBreakdown(record) };
  });

  const plannedItems: PlannedItem[] = itemRows.map((i) => ({
    id: i.id,
    desiredQuantity: i.desiredQuantity,
    estimatedUnitPriceCents: i.estimatedUnitPriceCents,
    archived: i.archivedAt !== null,
  }));

  const summary = summarize(plannedItems, orderViews.map((o) => o.record));

  return {
    rooms: roomRows as Room[],
    items: itemRows as Item[],
    orders: orderViews,
    summary,
  };
}

export type Planning = Awaited<ReturnType<typeof loadPlanning>>;
