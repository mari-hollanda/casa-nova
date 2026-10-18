import { allocateByLargestRemainder, assertCents, type Cents } from "./money";

export interface OrderLineInput {
  itemId: string;
  quantity: number;
  /** Preço unitário original, em centavos, antes de frete/desconto/juros. */
  unitPriceCents: Cents;
}

export interface OrderInput {
  lines: readonly OrderLineInput[];
  freightCents: Cents;
  discountCents: Cents;
  /** Fonte da verdade: valor final efetivamente assumido (frete, desconto e juros incluídos). */
  totalPaidCents: Cents;
}

export type IssueCode =
  | "NO_LINES"
  | "INVALID_QUANTITY"
  | "NEGATIVE_AMOUNT"
  | "TOTAL_BEFORE_INTEREST_NEGATIVE"
  | "NEGATIVE_DIFFERENCE";

export interface OrderIssue {
  code: IssueCode;
  /** "error" bloqueia o registro; "warning" exige confirmação explícita do usuário. */
  severity: "error" | "warning";
  message: string;
}

export interface OrderLineBreakdown {
  itemId: string;
  quantity: number;
  unitPriceCents: Cents;
  subtotalCents: Cents;
  /** Parcela do frete/desconto/juros atribuída à linha (pode ser negativa). */
  allocatedAdjustmentCents: Cents;
  /** subtotal + ajuste rateado; a soma de todas as linhas é exatamente totalPaid. */
  effectiveTotalCents: Cents;
}

export interface OrderBreakdown {
  subtotalCents: Cents;
  freightCents: Cents;
  discountCents: Cents;
  /** subtotal + frete − desconto */
  totalBeforeInterestCents: Cents;
  totalPaidCents: Cents;
  /** totalPaid − totalBeforeInterest: juros/custos adicionais (negativo = desconto adicional). */
  differenceCents: Cents;
  lines: OrderLineBreakdown[];
}

export function validateOrder(order: OrderInput): OrderIssue[] {
  const issues: OrderIssue[] = [];
  const error = (code: IssueCode, message: string) =>
    issues.push({ code, severity: "error", message });

  if (order.lines.length === 0) error("NO_LINES", "O pedido precisa de ao menos um item.");

  for (const line of order.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      error("INVALID_QUANTITY", "A quantidade de cada linha deve ser um inteiro maior ou igual a 1.");
    }
    if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      error("NEGATIVE_AMOUNT", "O preço unitário não pode ser negativo.");
    }
  }
  for (const [label, value] of [
    ["frete", order.freightCents],
    ["desconto", order.discountCents],
    ["total pago", order.totalPaidCents],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      error("NEGATIVE_AMOUNT", `O valor de ${label} deve ser um inteiro não negativo em centavos.`);
    }
  }
  if (issues.length > 0) return issues;

  const subtotal = order.lines.reduce((acc, l) => acc + l.quantity * l.unitPriceCents, 0);
  const beforeInterest = subtotal + order.freightCents - order.discountCents;
  if (beforeInterest < 0) {
    error("TOTAL_BEFORE_INTEREST_NEGATIVE", "O desconto não pode ser maior que subtotal + frete.");
    return issues;
  }
  if (order.totalPaidCents < beforeInterest) {
    issues.push({
      code: "NEGATIVE_DIFFERENCE",
      severity: "warning",
      message:
        "O total pago é menor que subtotal + frete − desconto. A diferença será registrada como desconto/ajuste adicional.",
    });
  }
  return issues;
}

/** Calcula o detalhamento do pedido. Lança se houver algum erro bloqueante. */
export function computeOrderBreakdown(order: OrderInput): OrderBreakdown {
  const blocking = validateOrder(order).filter((i) => i.severity === "error");
  if (blocking.length > 0) throw new Error(blocking.map((i) => i.message).join(" "));
  assertCents(order.totalPaidCents, "total pago");

  const lineSubtotals = order.lines.map((l) => l.quantity * l.unitPriceCents);
  const subtotal = lineSubtotals.reduce((a, b) => a + b, 0);
  const totalBeforeInterest = subtotal + order.freightCents - order.discountCents;
  const difference = order.totalPaidCents - totalBeforeInterest;

  // Tudo o que separa o subtotal do total pago (frete, desconto, juros) é rateado
  // proporcionalmente ao valor original de cada linha.
  const adjustments = allocateByLargestRemainder(order.totalPaidCents - subtotal, lineSubtotals);

  return {
    subtotalCents: subtotal,
    freightCents: order.freightCents,
    discountCents: order.discountCents,
    totalBeforeInterestCents: totalBeforeInterest,
    totalPaidCents: order.totalPaidCents,
    differenceCents: difference,
    lines: order.lines.map((l, i) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      subtotalCents: lineSubtotals[i],
      allocatedAdjustmentCents: adjustments[i],
      effectiveTotalCents: lineSubtotals[i] + adjustments[i],
    })),
  };
}
