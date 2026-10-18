import Link from "next/link";
import { centsToInput } from "@/domain/money";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { loadPlanning } from "@/server/data";
import { OrderForm } from "./order-form";

export const metadata = { title: "Novo pedido" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const user = await requireUser();
  const { rooms, items } = await loadPlanning(user.id);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));

  const options = items
    .filter((i) => !i.archivedAt)
    .map((i) => ({
      id: i.id,
      name: i.name,
      roomName: roomName.get(i.roomId) ?? "Sem cômodo",
      estimatedPrice: centsToInput(i.estimatedUnitPriceCents),
    }))
    .sort((a, b) => a.roomName.localeCompare(b.roomName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/orders" className="text-primary underline">← Pedidos</Link>
      </p>
      <PageHeader title="Novo pedido" />
      {options.length === 0 ? (
        <p className="card">
          Cadastre itens em algum <Link href="/rooms" className="font-medium text-primary underline">cômodo</Link> antes de
          registrar um pedido.
        </p>
      ) : (
        <OrderForm itemOptions={options} />
      )}
    </>
  );
}
