import Link from "next/link";
import { notFound } from "next/navigation";
import { centsToInput, formatCents } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { ArchivedBadge, ExternalLink, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";
import { loadPlanning } from "@/server/data";
import { ItemForm } from "../../items/item-form";
import { DeleteRoomForm, RenameRoomForm } from "../room-forms";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params, searchParams }: PageProps<"/rooms/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const showArchived = (await searchParams).arquivados === "1";

  const { rooms, items, summary } = await loadPlanning(user.id);
  const room = rooms.find((r) => r.id === id);
  if (!room) notFound();

  const roomItems = items.filter((i) => i.roomId === id);
  const visible = roomItems.filter((i) => showArchived || !i.archivedAt);
  const archivedCount = roomItems.filter((i) => i.archivedAt).length;
  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/rooms" className="text-primary underline">← Cômodos</Link>
      </p>
      <PageHeader title={room.name} />

      <section aria-label="Itens do cômodo" className="space-y-3">
        {visible.length === 0 ? (
          <p className="card text-muted">Nenhum item neste cômodo ainda. Use o formulário abaixo para adicionar.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => {
              const s = summary.items.get(item.id)!;
              return (
                <li key={item.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/items/${item.id}`} className="text-base font-semibold underline-offset-2 hover:underline">
                      {item.name}
                    </Link>
                    <span className="flex flex-wrap items-center gap-2">
                      {item.archivedAt && <ArchivedBadge />}
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={s.status} />
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-muted">Comprado / desejado</dt>
                      <dd className="font-medium tabular-nums">
                        {s.purchasedQuantity} / {item.desiredQuantity}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Preço estimado</dt>
                      <dd className="font-medium tabular-nums">{formatCents(item.estimatedUnitPriceCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Pendente</dt>
                      <dd className="font-medium tabular-nums">{formatCents(s.pendingCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Gasto real</dt>
                      <dd className="font-medium tabular-nums">{formatCents(s.spentCents)}</dd>
                    </div>
                  </dl>
                  {item.productUrl && (
                    <p className="mt-2 text-sm">
                      <ExternalLink href={item.productUrl}>Ver produto</ExternalLink>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {archivedCount > 0 && (
          <p className="text-sm">
            <Link
              href={showArchived ? `/rooms/${id}` : `/rooms/${id}?arquivados=1`}
              className="text-primary underline"
            >
              {showArchived ? "Ocultar itens arquivados" : `Mostrar ${archivedCount} item(ns) arquivado(s)`}
            </Link>
          </p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="add-item">
        <h2 id="add-item" className="mb-3 text-2xl">Adicionar item</h2>
        <ItemForm
          mode="create"
          rooms={roomOptions}
          initial={{
            roomId: id,
            name: "",
            desiredQuantity: "1",
            estimatedPrice: centsToInput(0),
            priority: "media",
            productUrl: "",
            notes: "",
          }}
        />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Gerenciar cômodo">
        <RenameRoomForm id={room.id} name={room.name} />
        <DeleteRoomForm
          id={room.id}
          itemCount={roomItems.length}
          otherRooms={roomOptions.filter((r) => r.id !== id)}
        />
      </section>
    </>
  );
}
