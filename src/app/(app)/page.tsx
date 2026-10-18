import Link from "next/link";
import { formatCents } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { LampIllustration, PriorityBadge, SectionTitle, Sparkle, Stat, TINTS } from "@/components/ui";
import { loadPlanning } from "@/server/data";

export const metadata = { title: "Resumo" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const { rooms, items, summary, orders } = await loadPlanning(user.id);
  const { totals } = summary;

  const activeItems = items.filter((i) => !i.archivedAt);
  const activeOrders = orders.filter((o) => !o.record.archived);
  const archivedOrders = orders.length - activeOrders.length;

  const perRoom = rooms.map((room) => {
    const roomItems = activeItems.filter((i) => i.roomId === room.id);
    const sums = roomItems.map((i) => summary.items.get(i.id)!);
    return {
      room,
      count: roomItems.length,
      done: sums.filter((s) => s.status === "CONCLUIDO").length,
      planned: sums.reduce((a, s) => a + s.plannedCents, 0),
      pending: sums.reduce((a, s) => a + s.pendingCents, 0),
    };
  });

  const nextUp = activeItems
    .filter((i) => i.priority === "alta" && summary.items.get(i.id)!.remainingQuantity > 0)
    .slice(0, 8);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2" aria-label="Boas-vindas">
        <div className="card tint-pink relative flex flex-col justify-between gap-8 p-6 sm:p-8">
          <Sparkle className="absolute right-6 top-6 h-6 w-6 text-primary" />
          <div>
            <h1 className="text-5xl leading-[1.05] sm:text-6xl">
              Monte sua <br /> casa nova
            </h1>
            <p className="mt-4 max-w-xs text-lg text-foreground/80">
              Cada cômodo, cada item e cada compra em um só lugar.
            </p>
          </div>
          <div>
            <Link href="/orders/new" className="btn btn-primary">
              Registrar pedido <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="card tint-peach flex items-end justify-center overflow-hidden p-6">
          <LampIllustration className="h-56 w-auto sm:h-64" />
        </div>
      </section>

      <section aria-label="Totais" className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat tint="tint-pink" label="Estimativa planejada" value={formatCents(totals.plannedCents)} hint="Quantidade desejada × preço estimado" />
        <Stat
          tint="tint-blue"
          label="Gasto real"
          value={formatCents(totals.spentCents)}
          hint={`${activeOrders.length} pedido(s) ativo(s)${archivedOrders ? ` · ${archivedOrders} arquivado(s) fora do total` : ""}`}
        />
        <Stat tint="tint-peach" label="Custo estimado pendente" value={formatCents(totals.pendingCents)} hint="Quantidade restante × preço estimado" />
      </section>

      <section className="mt-10" aria-labelledby="rooms-heading">
        <SectionTitle id="rooms-heading">Por cômodo</SectionTitle>
        {perRoom.length === 0 ? (
          <div className="card">
            <p>
              Nenhum cômodo ainda.{" "}
              <Link href="/rooms" className="font-medium text-primary underline">
                Crie o primeiro
              </Link>{" "}
              para começar a cadastrar itens.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perRoom.map(({ room, count, done, planned, pending }, index) => (
              <li key={room.id} className={`card ${TINTS[index % TINTS.length]}`}>
                <Link href={`/rooms/${room.id}`} className="font-display text-2xl text-primary underline-offset-2 hover:underline">
                  {room.name}
                </Link>
                <p className="mt-1 text-sm text-foreground/70">
                  {count} item(ns) · {done} concluído(s)
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-foreground/70">Planejado</dt>
                    <dd className="font-semibold tabular-nums">{formatCents(planned)}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground/70">Pendente</dt>
                    <dd className="font-semibold tabular-nums">{formatCents(pending)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {nextUp.length > 0 && (
        <section className="mt-10" aria-labelledby="next-heading">
          <SectionTitle id="next-heading">Prioridade alta pendente</SectionTitle>
          <ul className="card divide-y divide-line p-0">
            {nextUp.map((item) => {
              const s = summary.items.get(item.id)!;
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <Link href={`/items/${item.id}`} className="font-medium underline-offset-2 hover:underline">
                    {item.name}
                  </Link>
                  <span className="flex items-center gap-3 text-sm text-muted">
                    <PriorityBadge priority={item.priority} />
                    faltam {s.remainingQuantity} · {formatCents(s.pendingCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
