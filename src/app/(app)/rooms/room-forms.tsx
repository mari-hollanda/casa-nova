"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/confirm-button";
import type { ActionState } from "@/lib/action-state";
import { createRoom, deleteRoom, renameRoom } from "./actions";

function FormError({ state }: { state: ActionState }) {
  return state.error ? (
    <p role="alert" className="error-text mt-2">
      {state.error}
    </p>
  ) : null;
}

export function CreateRoomForm() {
  const [state, action] = useActionState<ActionState, FormData>(createRoom, {});
  return (
    <form action={action} className="card" key={state.ok ? "reset" : "keep"}>
      <label htmlFor="new-room" className="label">
        Novo cômodo
      </label>
      <div className="flex gap-2">
        <input
          id="new-room"
          name="name"
          required
          maxLength={120}
          defaultValue={state.values?.name}
          placeholder="Ex.: Cozinha"
          className="input"
        />
        <SubmitButton pendingLabel="Criando…">Criar</SubmitButton>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function RenameRoomForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<ActionState, FormData>(renameRoom, {});
  return (
    <form action={action} className="card">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="room-name" className="label">
        Nome do cômodo
      </label>
      <div className="flex gap-2">
        <input id="room-name" name="name" required maxLength={120} defaultValue={state.values?.name ?? name} className="input" />
        <SubmitButton>Renomear</SubmitButton>
      </div>
      <FormError state={state} />
      {state.ok && <p role="status" className="hint mt-2">Nome atualizado.</p>}
    </form>
  );
}

export function DeleteRoomForm({
  id,
  itemCount,
  otherRooms,
}: {
  id: string;
  itemCount: number;
  otherRooms: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(deleteRoom, {});
  const blocked = itemCount > 0 && otherRooms.length === 0;

  return (
    <form
      action={action}
      className="card space-y-3"
      onSubmit={(event) => {
        if (!window.confirm("Excluir este cômodo? Os itens serão transferidos para o cômodo escolhido.")) {
          event.preventDefault();
        }
      }}
    >
      <h2 className="text-xl">Excluir cômodo</h2>
      <input type="hidden" name="id" value={id} />
      {itemCount > 0 ? (
        blocked ? (
          <p className="hint">Este cômodo tem itens. Crie outro cômodo para transferi-los antes de excluir.</p>
        ) : (
          <div>
            <label htmlFor="target-room" className="label">
              Transferir {itemCount} item(ns) (inclusive arquivados) para
            </label>
            <select id="target-room" name="targetRoomId" required defaultValue="" className="input">
              <option value="" disabled>
                Escolha um cômodo…
              </option>
              {otherRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )
      ) : (
        <p className="hint">Este cômodo não tem itens e pode ser excluído.</p>
      )}
      <FormError state={state} />
      {!blocked && (
        <SubmitButton className="btn btn-danger" pendingLabel="Excluindo…">
          Excluir cômodo
        </SubmitButton>
      )}
    </form>
  );
}
