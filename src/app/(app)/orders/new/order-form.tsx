"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { SubmitButton } from "@/components/confirm-button";
import { centsToInput, formatCents, parseBRLToCents } from "@/domain/money";
import { computeOrderBreakdown, validateOrder, type OrderInput } from "@/domain/order";
import type { ActionState } from "@/lib/action-state";
import { createOrder } from "../actions";

export interface ItemOption {
  id: string;
  name: string;
  roomName: string;
  estimatedPrice: string;
}

interface LineState {
  key: number;
  itemId: string;
  quantity: string;
  unitPrice: string;
}

const emptyLine = (key: number): LineState => ({ key, itemId: "", quantity: "1", unitPrice: "" });

/** Texto → centavos; vazio vale 0 quando `emptyIsZero`. null = inválido. */
function toCents(text: string, emptyIsZero: boolean): number | null {
  if (text.trim() === "") return emptyIsZero ? 0 : null;
  return parseBRLToCents(text);
}

export function OrderForm({ itemOptions }: { itemOptions: ItemOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createOrder, {});

  const [purchaseDate, setPurchaseDate] = useState("");
  const [store, setStore] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [freight, setFreight] = useState("");
  const [discount, setDiscount] = useState("");
  const [totalPaid, setTotalPaid] = useState("");
  const [totalTouched, setTotalTouched] = useState(false);
  const [confirmNegative, setConfirmNegative] = useState(false);

  // Data local do navegador (evita divergência de fuso entre servidor e usuário).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialização única após a montagem
    setPurchaseDate((d) => d || new Date().toLocaleDateString("sv-SE"));
  }, []);

  const preview = useMemo(() => {
    const parsedLines = lines.map((l) => ({
      itemId: l.itemId,
      quantity: Number(l.quantity),
      unitPriceCents: toCents(l.unitPrice, false),
    }));
    const freightCents = toCents(freight, true);
    const discountCents = toCents(discount, true);
    if (parsedLines.some((l) => !l.itemId || l.unitPriceCents === null) || freightCents === null || discountCents === null) {
      return null;
    }
    const subtotal = parsedLines.reduce((a, l) => a + (Number.isInteger(l.quantity) ? l.quantity : 0) * l.unitPriceCents!, 0);
    const beforeInterest = subtotal + freightCents - discountCents;
    const paid = totalTouched ? toCents(totalPaid, false) : beforeInterest;
    if (paid === null) return null;

    const input: OrderInput = {
      lines: parsedLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPriceCents: l.unitPriceCents! })),
      freightCents,
      discountCents,
      totalPaidCents: paid,
    };
    const issues = validateOrder(input);
    const breakdown = issues.some((i) => i.severity === "error") ? null : computeOrderBreakdown(input);
    return { issues, breakdown };
  }, [lines, freight, discount, totalPaid, totalTouched]);

  const needsConfirm = preview?.issues.some((i) => i.code === "NEGATIVE_DIFFERENCE") ?? false;
  const effectiveTotalPaid = totalTouched
    ? totalPaid
    : preview?.breakdown
      ? centsToInput(preview.breakdown.totalPaidCents)
      : "";

  const payload = JSON.stringify({
    purchaseDate,
    store,
    freight,
    discount,
    totalPaid: effectiveTotalPaid,
    confirmNegativeDifference: confirmNegative && needsConfirm,
    lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice })),
  });

  const updateLine = (key: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const differenceLabel = (cents: number) =>
    cents > 0 ? "Juros / custos adicionais" : cents < 0 ? "Desconto / ajuste adicional" : "Juros / custos adicionais";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      <section className="card grid gap-4 sm:grid-cols-2" aria-label="Dados do pedido">
        <div>
          <label htmlFor="purchaseDate" className="label">Data da compra</label>
          <input id="purchaseDate" type="date" required value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="store" className="label">Loja (opcional)</label>
          <input id="store" maxLength={120} value={store} onChange={(e) => setStore(e.target.value)} className="input" />
        </div>
      </section>

      <section aria-labelledby="lines-heading" className="space-y-3">
        <h2 id="lines-heading" className="text-2xl">Itens comprados</h2>
        {lines.map((line, index) => (
          <fieldset key={line.key} className="card grid gap-3 sm:grid-cols-[1fr_6rem_9rem_auto] sm:items-end">
            <legend className="sr-only">Linha {index + 1}</legend>
            <div>
              <label htmlFor={`item-${line.key}`} className="label">Item</label>
              <select
                id={`item-${line.key}`}
                required
                value={line.itemId}
                onChange={(e) => {
                  const option = itemOptions.find((o) => o.id === e.target.value);
                  updateLine(line.key, {
                    itemId: e.target.value,
                    unitPrice: line.unitPrice || option?.estimatedPrice || "",
                  });
                }}
                className="input"
              >
                <option value="" disabled>Escolha um item…</option>
                {[...new Set(itemOptions.map((o) => o.roomName))].map((room) => (
                  <optgroup key={room} label={room}>
                    {itemOptions.filter((o) => o.roomName === room).map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`qty-${line.key}`} className="label">Qtd.</label>
              <input
                id={`qty-${line.key}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor={`price-${line.key}`} className="label">Preço unit. pago (R$)</label>
              <input
                id={`price-${line.key}`}
                inputMode="decimal"
                required
                placeholder="0,00"
                value={line.unitPrice}
                onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                className="input"
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={lines.length === 1}
              onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
              aria-label={`Remover linha ${index + 1}`}
            >
              Remover
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn"
          disabled={lines.length >= 100}
          onClick={() => {
            setLines((ls) => [...ls, emptyLine(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        >
          + Adicionar item
        </button>
      </section>

      <section className="card grid gap-4 sm:grid-cols-3" aria-label="Frete, desconto e total">
        <div>
          <label htmlFor="freight" className="label">Frete (R$)</label>
          <input id="freight" inputMode="decimal" placeholder="0,00" value={freight} onChange={(e) => setFreight(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="discount" className="label">Desconto (R$)</label>
          <input id="discount" inputMode="decimal" placeholder="0,00" value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="totalPaid" className="label">Total efetivamente pago (R$)</label>
          <input
            id="totalPaid"
            inputMode="decimal"
            required
            placeholder="0,00"
            value={effectiveTotalPaid}
            onChange={(e) => {
              setTotalTouched(true);
              setTotalPaid(e.target.value);
            }}
            aria-describedby="totalPaid-hint"
            className="input"
          />
          <p id="totalPaid-hint" className="hint mt-1">
            Informe o total real, com juros se houver parcelamento. Por padrão é subtotal + frete − desconto.
          </p>
        </div>
      </section>

      <section aria-labelledby="preview-heading" className="card" aria-live="polite">
        <h2 id="preview-heading" className="mb-3 text-2xl">Prévia do pedido</h2>
        {!preview ? (
          <p className="hint">Preencha os itens e valores com números válidos (ex.: 1.234,56) para ver o cálculo.</p>
        ) : (
          <>
            {preview.issues.filter((i) => i.severity === "error").map((i) => (
              <p key={i.message} role="alert" className="error-text">{i.message}</p>
            ))}
            {preview.breakdown && (
              <>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
                  <dt>Subtotal</dt><dd className="text-right">{formatCents(preview.breakdown.subtotalCents)}</dd>
                  <dt>Frete</dt><dd className="text-right">+ {formatCents(preview.breakdown.freightCents)}</dd>
                  <dt>Desconto</dt><dd className="text-right">− {formatCents(preview.breakdown.discountCents)}</dd>
                  <dt className="font-medium">Total sem juros</dt><dd className="text-right font-medium">{formatCents(preview.breakdown.totalBeforeInterestCents)}</dd>
                  <dt>{differenceLabel(preview.breakdown.differenceCents)}</dt>
                  <dd className="text-right">{formatCents(preview.breakdown.differenceCents)}</dd>
                  <dt className="font-semibold">Total final</dt><dd className="text-right font-semibold">{formatCents(preview.breakdown.totalPaidCents)}</dd>
                </dl>
                <h3 className="mb-1 mt-4 text-sm font-semibold">Custo efetivo por linha (com rateio)</h3>
                <ul className="space-y-1 text-sm tabular-nums">
                  {preview.breakdown.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>{itemOptions.find((o) => o.id === l.itemId)?.name ?? "Item"} ({l.quantity}×)</span>
                      <span>{formatCents(l.subtotalCents)} → {formatCents(l.effectiveTotalCents)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {needsConfirm && (
              <div className="mt-4 rounded-lg bg-warning-bg p-3 text-warning-fg" role="alert">
                <p className="text-sm font-medium">{preview.issues.find((i) => i.code === "NEGATIVE_DIFFERENCE")?.message}</p>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={confirmNegative} onChange={(e) => setConfirmNegative(e.target.checked)} />
                  Confirmo que o total pago está correto.
                </label>
              </div>
            )}
          </>
        )}
      </section>

      {state.error && (
        <p role="alert" className="error-text">
          {state.error}
        </p>
      )}
      <SubmitButton pendingLabel="Registrando…">Registrar pedido</SubmitButton>
      <p className="hint">Depois de registrado, o pedido não pode ser editado. Para corrigir, arquive-o e crie outro.</p>
    </form>
  );
}
