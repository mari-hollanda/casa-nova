import type { Cents } from "./money";
import { computeOrderBreakdown, type OrderInput } from "./order";

export type ItemStatus = "NAO_COMPRADO" | "PARCIAL" | "CONCLUIDO";

export interface PlannedItem {
  id: string;
  desiredQuantity: number;
  estimatedUnitPriceCents: Cents;
  archived: boolean;
}

export interface OrderRecord extends OrderInput {
  id: string;
  archived: boolean;
}

export const remainingQuantity = (desired: number, purchased: number): number =>
  Math.max(0, desired - purchased);

export function itemStatus(desired: number, purchased: number): ItemStatus {
  if (purchased <= 0) return "NAO_COMPRADO";
  return purchased >= desired ? "CONCLUIDO" : "PARCIAL";
}

export interface ItemSummary {
  itemId: string;
  purchasedQuantity: number;
  remainingQuantity: number;
  status: ItemStatus;
  plannedCents: Cents;
  pendingCents: Cents;
  /** Gasto real do item: linhas de pedidos ativos + rateio de frete/desconto/juros. */
  spentCents: Cents;
}

export interface Totals {
  /** Σ desejada × estimado dos itens ativos (muda junto com o planejamento). */
  plannedCents: Cents;
  /** Σ total pago dos pedidos ativos. */
  spentCents: Cents;
  /** Σ restante × estimado dos itens ativos. */
  pendingCents: Cents;
}

/** Só pedidos não arquivados entram nos cálculos; pedidos arquivados são apenas histórico. */
export function summarize(items: readonly PlannedItem[], orders: readonly OrderRecord[]) {
  const purchased = new Map<string, number>();
  const spent = new Map<string, Cents>();
  let spentTotal = 0;

  for (const order of orders) {
    if (order.archived) continue;
    const breakdown = computeOrderBreakdown(order);
    spentTotal += breakdown.totalPaidCents;
    for (const line of breakdown.lines) {
      purchased.set(line.itemId, (purchased.get(line.itemId) ?? 0) + line.quantity);
      spent.set(line.itemId, (spent.get(line.itemId) ?? 0) + line.effectiveTotalCents);
    }
  }

  const summaries = new Map<string, ItemSummary>();
  const totals: Totals = { plannedCents: 0, spentCents: spentTotal, pendingCents: 0 };

  for (const item of items) {
    const bought = purchased.get(item.id) ?? 0;
    const remaining = remainingQuantity(item.desiredQuantity, bought);
    const summary: ItemSummary = {
      itemId: item.id,
      purchasedQuantity: bought,
      remainingQuantity: remaining,
      status: itemStatus(item.desiredQuantity, bought),
      plannedCents: item.desiredQuantity * item.estimatedUnitPriceCents,
      pendingCents: remaining * item.estimatedUnitPriceCents,
      spentCents: spent.get(item.id) ?? 0,
    };
    summaries.set(item.id, summary);
    if (!item.archived) {
      totals.plannedCents += summary.plannedCents;
      totals.pendingCents += summary.pendingCents;
    }
  }

  return { items: summaries, totals };
}
