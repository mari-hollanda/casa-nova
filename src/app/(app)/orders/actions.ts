"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { items, orderLines, orders } from "@/db/schema";
import { fail, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { validateOrder } from "@/domain/order";
import {
  MAX_TOTAL_CENTS,
  centsField,
  firstIssue,
  idField,
  isoDate,
  optionalText,
  quantityField,
} from "@/server/validation";

const orderSchema = z.object({
  purchaseDate: isoDate,
  store: optionalText(120),
  freight: centsField("Frete", { max: MAX_TOTAL_CENTS, optional: true }),
  discount: centsField("Desconto", { max: MAX_TOTAL_CENTS, optional: true }),
  totalPaid: centsField("Total pago", { max: MAX_TOTAL_CENTS }),
  confirmNegativeDifference: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        itemId: idField,
        quantity: quantityField("Quantidade"),
        unitPrice: centsField("Preço unitário"),
      }),
    )
    .min(1, "Adicione ao menos um item ao pedido.")
    .max(100, "Um pedido pode ter no máximo 100 linhas."),
});

/**
 * Recebe o pedido como JSON (as linhas são dinâmicas). O servidor revalida tudo: o cálculo
 * mostrado no navegador é só uma prévia.
 */
export async function createOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return fail("Não foi possível ler o pedido enviado.");
  }
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;

  const itemIds = [...new Set(d.lines.map((l) => l.itemId))];
  const found = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.userId, user.id), inArray(items.id, itemIds), isNull(items.archivedAt)));
  if (found.length !== itemIds.length) {
    return fail("Algum item do pedido não existe mais ou está arquivado.");
  }

  const issues = validateOrder({
    lines: d.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPriceCents: l.unitPrice })),
    freightCents: d.freight,
    discountCents: d.discount,
    totalPaidCents: d.totalPaid,
  });
  const blocking = issues.find((i) => i.severity === "error");
  if (blocking) return fail(blocking.message);
  const warning = issues.find((i) => i.severity === "warning");
  if (warning && !d.confirmNegativeDifference) return fail(`${warning.message} Confirme para continuar.`);

  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        userId: user.id,
        purchaseDate: d.purchaseDate,
        store: d.store,
        freightCents: d.freight,
        discountCents: d.discount,
        totalPaidCents: d.totalPaid,
      })
      .returning({ id: orders.id });
    await tx.insert(orderLines).values(
      d.lines.map((l, position) => ({
        userId: user.id,
        orderId: order.id,
        itemId: l.itemId,
        position,
        quantity: l.quantity,
        unitPriceCents: l.unitPrice,
      })),
    );
    return order.id;
  });

  revalidatePath("/", "layout");
  redirect(`/orders/${orderId}`);
}

/** Arquivar não apaga nada: o pedido e suas linhas ficam no histórico e saem dos totais ativos. */
export async function archiveOrder(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = z
    .object({ id: idField, reason: optionalText(300) })
    .safeParse({ id: formData.get("id"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return;

  await db
    .update(orders)
    .set({ archivedAt: new Date(), archiveReason: parsed.data.reason })
    .where(and(eq(orders.id, parsed.data.id), eq(orders.userId, user.id), isNull(orders.archivedAt)));
  revalidatePath("/", "layout");
}

export async function restoreOrder(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idField.safeParse(formData.get("id"));
  if (!id.success) return;

  await db
    .update(orders)
    .set({ archivedAt: null, archiveReason: null })
    .where(and(eq(orders.id, id.data), eq(orders.userId, user.id)));
  revalidatePath("/", "layout");
}
