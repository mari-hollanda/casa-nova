import Link from "next/link";
import { formatCents } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { PageHeader, TINTS } from "@/components/ui";
import { loadPlanning } from "@/server/data";
import { CreateRoomForm } from "./room-forms";

export const metadata = { title: "Cômodos" };
export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const user = await requireUser();
  const { rooms, items, summary } = await loadPlanning(user.id);

  return (
    <>
      <PageHeader title="Cômodos" />
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <section aria-label="Lista de cômodos">
          {rooms.length === 0 ? (
            <p className="card text-muted">Nenhum cômodo cadastrado ainda.</p>
          ) : (
            <ul className="space-y-3">
              {rooms.map((room, index) => {
                const active = items.filter((i) => i.roomId === room.id && !i.archivedAt);
                const pending = active.reduce((a, i) => a + summary.items.get(i.id)!.pendingCents, 0);
                return (
                  <li key={room.id}>
                    <Link href={`/rooms/${room.id}`} className={`card block ${TINTS[index % TINTS.length]}`}>
                      <span className="font-display text-2xl text-primary">{room.name}</span>
                      <span className="mt-1 block text-sm text-foreground/70">
                        {active.length} item(ns) · pendente {formatCents(pending)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside>
          <CreateRoomForm />
        </aside>
      </div>
    </>
  );
}
