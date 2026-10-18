"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { items, rooms } from "@/db/schema";
import { fail, pgErrorCode, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { firstIssue, idField, nameField } from "@/server/validation";

const DUPLICATE_ROOM = "Já existe um cômodo com esse nome.";

export async function createRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ name: nameField("Cômodo") }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);

  try {
    await db.insert(rooms).values({ userId: user.id, name: parsed.data.name });
  } catch (e) {
    if (pgErrorCode(e) === "23505") return fail(DUPLICATE_ROOM, formData);
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({ id: idField, name: nameField("Cômodo") })
    .safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);

  try {
    await db
      .update(rooms)
      .set({ name: parsed.data.name })
      .where(and(eq(rooms.id, parsed.data.id), eq(rooms.userId, user.id)));
  } catch (e) {
    if (pgErrorCode(e) === "23505") return fail(DUPLICATE_ROOM, formData);
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Excluir um cômodo exige transferir todos os seus itens (inclusive arquivados) para outro
 * cômodo. A transferência e a exclusão acontecem na mesma transação.
 */
export async function deleteRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({ id: idField, targetRoomId: z.string().trim() })
    .safeParse({ id: formData.get("id"), targetRoomId: formData.get("targetRoomId") ?? "" });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const { id, targetRoomId } = parsed.data;

  const result = await db.transaction(async (tx): Promise<string | null> => {
    const [room] = await tx
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.userId, user.id)));
    if (!room) return "Cômodo não encontrado.";

    const roomItems = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.roomId, id), eq(items.userId, user.id)));

    if (roomItems.length > 0) {
      if (!targetRoomId) return "Escolha para qual cômodo os itens serão transferidos.";
      const [target] = await tx
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.id, targetRoomId), eq(rooms.userId, user.id), ne(rooms.id, id)));
      if (!target) return "Cômodo de destino inválido.";
      await tx
        .update(items)
        .set({ roomId: target.id, updatedAt: new Date() })
        .where(and(eq(items.roomId, id), eq(items.userId, user.id)));
    }

    await tx.delete(rooms).where(and(eq(rooms.id, id), eq(rooms.userId, user.id)));
    return null;
  });

  if (result) return fail(result, formData);
  revalidatePath("/", "layout");
  redirect("/rooms");
}
