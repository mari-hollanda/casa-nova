"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { items, rooms } from "@/db/schema";
import { fail, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import {
  centsField,
  firstIssue,
  idField,
  nameField,
  optionalText,
  quantityField,
  urlField,
} from "@/server/validation";

const itemFields = {
  roomId: idField,
  name: nameField("Item"),
  desiredQuantity: quantityField("Quantidade desejada"),
  estimatedPrice: centsField("Preço estimado"),
  priority: z.enum(["alta", "media", "baixa"], { error: "Escolha uma prioridade." }),
  productUrl: urlField,
  notes: optionalText(2000),
};

function readItemFields(formData: FormData) {
  return {
    roomId: formData.get("roomId"),
    name: formData.get("name"),
    desiredQuantity: formData.get("desiredQuantity"),
    estimatedPrice: formData.get("estimatedPrice") ?? "",
    priority: formData.get("priority"),
    productUrl: formData.get("productUrl") ?? "",
    notes: formData.get("notes") ?? "",
  };
}

async function roomBelongsToUser(roomId: string, userId: string) {
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.userId, userId)));
  return Boolean(room);
}

export async function createItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object(itemFields).safeParse(readItemFields(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const d = parsed.data;
  if (!(await roomBelongsToUser(d.roomId, user.id))) return fail("Cômodo não encontrado.", formData);

  await db.insert(items).values({
    userId: user.id,
    roomId: d.roomId,
    name: d.name,
    desiredQuantity: d.desiredQuantity,
    estimatedUnitPriceCents: d.estimatedPrice,
    priority: d.priority,
    productUrl: d.productUrl,
    notes: d.notes,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Alterar quantidade desejada, preço estimado ou cômodo nunca toca nos pedidos já
 * registrados: o histórico financeiro é independente do planejamento.
 */
export async function updateItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({ id: idField, ...itemFields })
    .safeParse({ id: formData.get("id"), ...readItemFields(formData) });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const d = parsed.data;
  if (!(await roomBelongsToUser(d.roomId, user.id))) return fail("Cômodo não encontrado.", formData);

  const updated = await db
    .update(items)
    .set({
      roomId: d.roomId,
      name: d.name,
      desiredQuantity: d.desiredQuantity,
      estimatedUnitPriceCents: d.estimatedPrice,
      priority: d.priority,
      productUrl: d.productUrl,
      notes: d.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, d.id), eq(items.userId, user.id)))
    .returning({ id: items.id });
  if (updated.length === 0) return fail("Item não encontrado.", formData);

  revalidatePath("/", "layout");
  return { ok: true };
}

async function setItemArchived(formData: FormData, archived: boolean): Promise<void> {
  const user = await requireUser();
  const id = idField.safeParse(formData.get("id"));
  if (!id.success) return;
  await db
    .update(items)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(items.id, id.data), eq(items.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function archiveItem(formData: FormData): Promise<void> {
  await setItemArchived(formData, true);
}

export async function restoreItem(formData: FormData): Promise<void> {
  await setItemArchived(formData, false);
}
