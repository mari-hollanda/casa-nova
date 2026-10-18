import { describe, expect, it } from "vitest";
import { computeOrderBreakdown, validateOrder, type OrderInput } from "./order";
import { itemStatus, remainingQuantity, summarize, type OrderRecord, type PlannedItem } from "./planning";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("computeOrderBreakdown", () => {
  const base: OrderInput = {
    lines: [
      { itemId: "a", quantity: 1, unitPriceCents: 10000 },
      { itemId: "b", quantity: 2, unitPriceCents: 5000 },
    ],
    freightCents: 1500,
    discountCents: 500,
    totalPaidCents: 21000,
  };

  it("calcula subtotal, total sem juros, total final e diferença", () => {
    const r = computeOrderBreakdown(base);
    expect(r.subtotalCents).toBe(20000);
    expect(r.totalBeforeInterestCents).toBe(21000);
    expect(r.totalPaidCents).toBe(21000);
    expect(r.differenceCents).toBe(0);
  });

  it("registra juros como diferença quando total pago excede o total sem juros", () => {
    const r = computeOrderBreakdown({ ...base, totalPaidCents: 23100 });
    expect(r.differenceCents).toBe(2100);
  });

  it("rateia o ajuste proporcionalmente e a soma das linhas é o total pago", () => {
    const r = computeOrderBreakdown({
      lines: [
        { itemId: "a", quantity: 1, unitPriceCents: 3333 },
        { itemId: "b", quantity: 1, unitPriceCents: 3333 },
        { itemId: "c", quantity: 1, unitPriceCents: 3334 },
      ],
      freightCents: 1000,
      discountCents: 0,
      totalPaidCents: 11000,
    });
    expect(sum(r.lines.map((l) => l.effectiveTotalCents))).toBe(11000);
    expect(sum(r.lines.map((l) => l.allocatedAdjustmentCents))).toBe(1000);
  });

  it("preserva o preço original das linhas", () => {
    const r = computeOrderBreakdown(base);
    expect(r.lines.map((l) => l.unitPriceCents)).toEqual([10000, 5000]);
  });

  it("desconto à vista (total pago menor) gera diferença negativa com aviso", () => {
    const order = { ...base, totalPaidCents: 19000 };
    expect(computeOrderBreakdown(order).differenceCents).toBe(-2000);
    const issues = validateOrder(order);
    expect(issues).toEqual([expect.objectContaining({ code: "NEGATIVE_DIFFERENCE", severity: "warning" })]);
  });

  it("bloqueia entradas inválidas em vez de corrigi-las", () => {
    expect(validateOrder({ ...base, lines: [] }).some((i) => i.code === "NO_LINES")).toBe(true);
    expect(validateOrder({ ...base, freightCents: -1 })[0].severity).toBe("error");
    expect(
      validateOrder({ ...base, lines: [{ itemId: "a", quantity: 0, unitPriceCents: 1 }] })[0].code,
    ).toBe("INVALID_QUANTITY");
    expect(validateOrder({ ...base, discountCents: 30000 })[0].code).toBe("TOTAL_BEFORE_INTEREST_NEGATIVE");
    expect(() => computeOrderBreakdown({ ...base, freightCents: -1 })).toThrow();
  });
});

describe("status e quantidade restante", () => {
  it("restante nunca fica negativo", () => {
    expect(remainingQuantity(3, 5)).toBe(0);
    expect(remainingQuantity(3, 1)).toBe(2);
  });

  it("distingue não comprado, parcial e concluído", () => {
    expect(itemStatus(3, 0)).toBe("NAO_COMPRADO");
    expect(itemStatus(3, 2)).toBe("PARCIAL");
    expect(itemStatus(3, 3)).toBe("CONCLUIDO");
    expect(itemStatus(3, 5)).toBe("CONCLUIDO");
  });
});

describe("summarize (totais, pendente e arquivamento)", () => {
  const items: PlannedItem[] = [
    { id: "sofa", desiredQuantity: 1, estimatedUnitPriceCents: 200000, archived: false },
    { id: "copo", desiredQuantity: 6, estimatedUnitPriceCents: 1000, archived: false },
    { id: "velho", desiredQuantity: 2, estimatedUnitPriceCents: 5000, archived: true },
  ];
  const orders: OrderRecord[] = [
    {
      id: "o1",
      archived: false,
      lines: [{ itemId: "copo", quantity: 2, unitPriceCents: 900 }],
      freightCents: 0,
      discountCents: 0,
      totalPaidCents: 1800,
    },
    {
      id: "o2",
      archived: false,
      lines: [
        { itemId: "copo", quantity: 1, unitPriceCents: 1200 },
        { itemId: "sofa", quantity: 1, unitPriceCents: 190000 },
      ],
      freightCents: 3000,
      discountCents: 0,
      totalPaidCents: 194200,
    },
  ];

  it("soma compras parciais com preços unitários diferentes", () => {
    const { items: s, totals } = summarize(items, orders);
    expect(s.get("copo")).toMatchObject({ purchasedQuantity: 3, remainingQuantity: 3, status: "PARCIAL" });
    expect(s.get("sofa")?.status).toBe("CONCLUIDO");
    expect(totals.spentCents).toBe(196000);
    expect(totals.plannedCents).toBe(200000 + 6000);
    expect(totals.pendingCents).toBe(3000);
  });

  it("arquivar um pedido o remove dos totais e reabre a quantidade restante", () => {
    const archived = orders.map((o) => (o.id === "o2" ? { ...o, archived: true } : o));
    const { items: s, totals } = summarize(items, archived);
    expect(s.get("sofa")).toMatchObject({ purchasedQuantity: 0, status: "NAO_COMPRADO", spentCents: 0 });
    expect(s.get("copo")).toMatchObject({ purchasedQuantity: 2, remainingQuantity: 4 });
    expect(totals.spentCents).toBe(1800);
    expect(totals.pendingCents).toBe(200000 + 4000);
  });

  it("arquivar não altera os valores do pedido nem o rateio dos demais", () => {
    const before = computeOrderBreakdown(orders[0]);
    const archived = orders.map((o) => (o.id === "o2" ? { ...o, archived: true } : o));
    expect(computeOrderBreakdown(archived[0])).toEqual(before);
    expect(computeOrderBreakdown(archived[1]).totalPaidCents).toBe(194200);
  });

  it("restaurar o pedido arquivado devolve exatamente os totais anteriores", () => {
    const archived = orders.map((o) => (o.id === "o2" ? { ...o, archived: true } : o));
    const restored = archived.map((o) => ({ ...o, archived: false }));
    expect(summarize(items, restored)).toEqual(summarize(items, orders));
  });

  it("compra acima da quantidade desejada preserva histórico e restante fica zero", () => {
    const lowered = items.map((i) => (i.id === "copo" ? { ...i, desiredQuantity: 2 } : i));
    const { items: s, totals } = summarize(lowered, orders);
    expect(s.get("copo")).toMatchObject({ purchasedQuantity: 3, remainingQuantity: 0, status: "CONCLUIDO" });
    expect(totals.spentCents).toBe(196000);
  });

  it("item arquivado sai do planejado e pendente, mas o gasto do pedido ativo permanece", () => {
    const archivedSofa = items.map((i) => (i.id === "sofa" ? { ...i, archived: true } : i));
    const { totals } = summarize(archivedSofa, orders);
    expect(totals.plannedCents).toBe(6000);
    expect(totals.spentCents).toBe(196000);
  });

  it("alterar o preço estimado muda a estimativa, mas nunca o gasto histórico", () => {
    const repriced = items.map((i) => (i.id === "copo" ? { ...i, estimatedUnitPriceCents: 2000 } : i));
    const { totals } = summarize(repriced, orders);
    expect(totals.spentCents).toBe(196000);
    expect(totals.pendingCents).toBe(6000);
  });
});
