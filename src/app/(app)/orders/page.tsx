import Link from "next/link";
import { formatCents } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { ArchivedBadge, PageHeader, formatDate } from "@/components/ui";
import { loadPlanning, type OrderView } from "@/server/data";

export const metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

function OrderList({ list }: { list: OrderView[] }) {
  return (
    <ul className="space-y-3">
      {list.map(({ order, breakdown, record }) => (
        <li key={order.id}>
          <Link href={`/orders/${order.id}`} className="card block hover:border-primary">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                {formatDate(order.purchaseDate)}
                {order.store ? ` · ${order.store}` : ""}
              </span>
              <span className="flex items-center gap-2">
                {record.archived && <ArchivedBadge />}
                <span className="font-semibold tabular-nums">{formatCents(breakdown.totalPaidCents)}</span>
              </span>
            </span>
            <span className="hint mt-1 block">{record.lines.length} linha(s)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function OrdersPage() {
  const user = await requireUser();
  const { orders } = await loadPlanning(user.id);
  const active = orders.filter((o) => !o.record.archived);
  const archived = orders.filter((o) => o.record.archived);

  return (
    <>
      <PageHeader title="Pedidos">
        <Link href="/orders/new" className="btn btn-primary">
          Novo pedido
        </Link>
      </PageHeader>

      <section aria-label="Pedidos ativos">
        {active.length === 0 ? <p className="card text-muted">Nenhum pedido ativo.</p> : <OrderList list={active} />}
      </section>

      {archived.length > 0 && (
        <section className="mt-8" aria-labelledby="archived-orders">
          <h2 id="archived-orders" className="mb-1 text-2xl">Arquivados</h2>
          <p className="hint mb-3">Ficam no histórico, mas não entram nos totais.</p>
          <OrderList list={archived} />
        </section>
      )}
    </>
  );
}
