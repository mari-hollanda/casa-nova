import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { ArchivedBadge, PageHeader, formatDate } from "@/components/ui";
import { loadPlanning } from "@/server/data";
import { archiveOrder, restoreOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { orders, items } = await loadPlanning(user.id);
  const view = orders.find((o) => o.order.id === id);
  if (!view) notFound();

  const { order, breakdown, record } = view;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const diff = breakdown.differenceCents;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/orders" className="text-primary underline">← Pedidos</Link>
      </p>
      <PageHeader title={`Pedido de ${formatDate(order.purchaseDate)}`}>
        {record.archived && <ArchivedBadge label="Arquivado (fora dos totais)" />}
      </PageHeader>
      {order.store && <p className="-mt-4 mb-6 text-muted">{order.store}</p>}

      <section className="card" aria-labelledby="financial">
        <h2 id="financial" className="mb-3 text-2xl">Resumo financeiro</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
          <dt>Subtotal</dt><dd className="text-right">{formatCents(breakdown.subtotalCents)}</dd>
          <dt>Frete</dt><dd className="text-right">+ {formatCents(breakdown.freightCents)}</dd>
          <dt>Desconto</dt><dd className="text-right">− {formatCents(breakdown.discountCents)}</dd>
          <dt className="font-medium">Total sem juros</dt><dd className="text-right font-medium">{formatCents(breakdown.totalBeforeInterestCents)}</dd>
          <dt>{diff < 0 ? "Desconto / ajuste adicional" : "Juros / custos adicionais"}</dt>
          <dd className="text-right">{formatCents(diff)}</dd>
          <dt className="font-semibold">Total final pago</dt><dd className="text-right font-semibold">{formatCents(breakdown.totalPaidCents)}</dd>
        </dl>
      </section>

      <section className="mt-6" aria-labelledby="lines">
        <h2 id="lines" className="mb-3 text-2xl">Itens</h2>
        <ul className="space-y-3">
          {breakdown.lines.map((line, index) => {
            const item = itemById.get(line.itemId);
            return (
              <li key={index} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item ? (
                    <Link href={`/items/${item.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">Item removido</span>
                  )}
                  {item?.archivedAt && <ArchivedBadge label="Item arquivado" />}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm tabular-nums sm:grid-cols-4">
                  <div><dt className="text-muted">Quantidade</dt><dd className="font-medium">{line.quantity}</dd></div>
                  <div><dt className="text-muted">Preço unitário pago</dt><dd className="font-medium">{formatCents(line.unitPriceCents)}</dd></div>
                  <div><dt className="text-muted">Rateio (frete/desc./juros)</dt><dd className="font-medium">{formatCents(line.allocatedAdjustmentCents)}</dd></div>
                  <div><dt className="text-muted">Custo efetivo</dt><dd className="font-medium">{formatCents(line.effectiveTotalCents)}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8" aria-label="Arquivamento">
        {record.archived ? (
          <form action={restoreOrder} className="card flex flex-wrap items-center justify-between gap-3">
            <input type="hidden" name="id" value={order.id} />
            <div className="text-sm">
              <p className="text-muted">
                Arquivado em {order.archivedAt!.toLocaleDateString("pt-BR")}.
                {order.archiveReason ? ` Motivo: ${order.archiveReason}` : ""}
              </p>
              <p className="text-muted">Restaurar devolve os valores originais aos totais e às quantidades dos itens.</p>
            </div>
            <ConfirmButton message="Restaurar este pedido? Ele voltará a contar nos totais.">Restaurar pedido</ConfirmButton>
          </form>
        ) : (
          <form action={archiveOrder} className="card space-y-3">
            <input type="hidden" name="id" value={order.id} />
            <p className="text-sm text-muted">
              Pedidos não podem ser editados. Se houver algum erro, arquive este pedido e registre outro. O registro
              é mantido no histórico, mas deixa de contar no gasto real e nas quantidades compradas.
            </p>
            <div>
              <label htmlFor="reason" className="label">Motivo (opcional)</label>
              <input id="reason" name="reason" maxLength={300} className="input" />
            </div>
            <ConfirmButton
              className="btn btn-danger"
              message="Arquivar este pedido? Ele deixará de contar nos totais, mas continuará no histórico."
            >
              Arquivar pedido
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
