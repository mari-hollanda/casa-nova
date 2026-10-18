"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/confirm-button";
import { PRIORITY_LABEL } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { createItem, updateItem } from "./actions";

export interface ItemFormValues {
  id?: string;
  roomId: string;
  name: string;
  desiredQuantity: string;
  estimatedPrice: string;
  priority: "alta" | "media" | "baixa";
  productUrl: string;
  notes: string;
}

export function ItemForm({
  mode,
  rooms,
  initial,
}: {
  mode: "create" | "edit";
  rooms: { id: string; name: string }[];
  initial: ItemFormValues;
}) {
  const [state, action] = useActionState<ActionState, FormData>(mode === "create" ? createItem : updateItem, {});
  const v = (key: keyof ItemFormValues) => state.values?.[key] ?? initial[key] ?? "";
  const prefix = `${mode}-item`;

  return (
    // Em "create", a chave muda após o sucesso para limpar o formulário; em erro os valores são mantidos.
    <form action={action} className="card space-y-4" key={mode === "create" && state.ok ? "reset" : "keep"}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-name`} className="label">Nome</label>
          <input id={`${prefix}-name`} name="name" required maxLength={120} defaultValue={v("name")} className="input" />
        </div>
        <div>
          <label htmlFor={`${prefix}-room`} className="label">Cômodo</label>
          <select id={`${prefix}-room`} name="roomId" required defaultValue={v("roomId")} className="input">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-priority`} className="label">Prioridade</label>
          <select id={`${prefix}-priority`} name="priority" required defaultValue={v("priority")} className="input">
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-qty`} className="label">Quantidade desejada</label>
          <input
            id={`${prefix}-qty`}
            name="desiredQuantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={v("desiredQuantity")}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-price`} className="label">Preço estimado por unidade (R$)</label>
          <input
            id={`${prefix}-price`}
            name="estimatedPrice"
            inputMode="decimal"
            required
            placeholder="0,00"
            defaultValue={v("estimatedPrice")}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-url`} className="label">Link do produto (opcional)</label>
          <input
            id={`${prefix}-url`}
            name="productUrl"
            type="url"
            maxLength={2000}
            placeholder="https://…"
            defaultValue={v("productUrl")}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-notes`} className="label">Observações (opcional)</label>
          <textarea id={`${prefix}-notes`} name="notes" rows={2} maxLength={2000} defaultValue={v("notes")} className="input" />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="error-text">
          {state.error}
        </p>
      )}
      {state.ok && mode === "edit" && (
        <p role="status" className="hint">
          Alterações salvas. Pedidos já registrados não foram afetados.
        </p>
      )}
      <SubmitButton>{mode === "create" ? "Adicionar item" : "Salvar alterações"}</SubmitButton>
    </form>
  );
}
