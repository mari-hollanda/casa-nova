import Link from "next/link";
import { notFound } from "next/navigation";
import { centsToInput, formatCents } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { ArchivedBadge, ExternalLink, PageHeader, PriorityBadge, Stat, StatusBadge, formatDate } from "@/components/ui";
import { loadPlanning } from "@/server/data";
import { archiveItem, restoreItem } from "../actions";
import { ItemForm } from "../item-form";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { rooms, items, orders, summary } = await loadPlanning(user.id);
  const item = items.find((i) => i.id === id);
  if (!item) notFound();

  const s = summary.items.get(id)!;
  const room = rooms.find((r) => r.id === item.roomId);

  // Histórico do item: todas as linhas, inclusive de pedidos arquivados (marcados como tal).
  const history = orders.flatMap((o) =>
    o.breakdown.lines
      .map((line, index) => ({ line, index, view: o }))
      .filter(({ line }) => line.itemId === id),
  );

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={room ? `/rooms/${room.id}` : "/rooms"} className="text-primary underline">
          ← {room?.name ?? "Cômodos"}
        </Link>
      </p>
      <PageHeader title={item.name}>
        <span className="flex flex-wrap items-center gap-2">
          {item.archivedAt && <ArchivedBadge />}
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={s.status} />
        </span>
      </PageHeader>

      <section aria-label="Situação do item" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Comprado / desejado" value={`${s.purchasedQuantity} / ${item.desiredQuantity}`} hint={`Restante: ${s.remainingQuantity}`} />
        <Stat label="Gasto real" value={formatCents(s.spentCents)} hint="Inclui o rateio de frete, desconto e juros" />
        <Stat label="Custo pendente" value={formatCents(s.pendingCents)} hint={`Estimado: ${formatCents(item.estimatedUnitPriceCents)} / un.`} />
      </section>

      {item.productUrl && (
        <p className="mt-4 text-sm">
          <ExternalLink href={item.productUrl}>Abrir link do produto</ExternalLink>
        </p>
      )}

      <section className="mt-8" aria-labelledby="history">
        <h2 id="history" className="mb-3 text-2xl">Histórico de compras</h2>
        {history.length === 0 ? (
          <p className="card text-muted">Nenhuma compra registrada para este item.</p>
        ) : (
          <ul className="space-y-2">
            {history.map(({ line, index, view }) => (
              <li key={`${view.order.id}-${index}`} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/orders/${view.order.id}`} className="font-medium underline-offset-2 hover:underline">
                    Pedido de {formatDate(view.order.purchaseDate)}
                    {view.order.store ? ` · ${view.order.store}` : ""}
                  </Link>
                  {view.record.archived && <ArchivedBadge label="Pedido arquivado (fora dos totais)" />}
                </div>
                <p className="mt-1 text-sm tabular-nums">
                  {line.quantity} × {formatCents(line.unitPriceCents)} = {formatCents(line.subtotalCents)}
                  <span className="text-muted">
                    {" "}· com rateio: {formatCents(line.effectiveTotalCents)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="edit">
        <h2 id="edit" className="mb-3 text-2xl">Editar item</h2>
        <ItemForm
          mode="edit"
          rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
          initial={{
            id: item.id,
            roomId: item.roomId,
            name: item.name,
            desiredQuantity: String(item.desiredQuantity),
            estimatedPrice: centsToInput(item.estimatedUnitPriceCents),
            priority: item.priority,
            productUrl: item.productUrl ?? "",
            notes: item.notes ?? "",
          }}
        />
      </section>

      <section className="mt-8" aria-label="Arquivamento">
        <form action={item.archivedAt ? restoreItem : archiveItem} className="card flex flex-wrap items-center justify-between gap-3">
          <input type="hidden" name="id" value={item.id} />
          <p className="text-sm text-muted">
            {item.archivedAt
              ? "Item arquivado: fora das estimativas e do pendente. Compras já registradas continuam no histórico."
              : "Arquivar tira o item das estimativas e do pendente, sem apagar compras já registradas."}
          </p>
          <ConfirmButton
            className="btn"
            message={item.archivedAt ? "Restaurar este item?" : "Arquivar este item? As compras registradas serão mantidas."}
          >
            {item.archivedAt ? "Restaurar item" : "Arquivar item"}
          </ConfirmButton>
        </form>
      </section>
    </>
  );
}
