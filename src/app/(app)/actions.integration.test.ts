import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { USER_A, USER_B, createMigratedPglite } from "@/test/test-db";

/**
 * Executa as Server Actions reais contra Postgres (PGlite) com as migrations do projeto.
 * Só o que é específico do Next/Supabase é substituído: sessão, cache e redirect.
 */
const holder = vi.hoisted(() => ({ db: null as unknown, userId: "" }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: holder.userId, email: "dono@example.com" }),
}));

import { createItem, updateItem } from "./items/actions";
import { archiveOrder, createOrder, restoreOrder } from "./orders/actions";
import { createRoom, deleteRoom } from "./rooms/actions";
import { loadPlanning } from "@/server/data";

let pg: PGlite;
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const db = () => holder.db as ReturnType<typeof drizzle<typeof schema>>;

async function addRoom(name: string) {
  expect(await createRoom({}, form({ name }))).toEqual({ ok: true });
  return (await db().select().from(schema.rooms).where(eq(schema.rooms.name, name)))[0].id;
}

async function addItem(roomId: string, name: string, qty = "1", price = "100,00", extra: Record<string, string> = {}) {
  const result = await createItem(
    {},
    form({ roomId, name, desiredQuantity: qty, estimatedPrice: price, priority: "media", ...extra }),
  );
  expect(result.error).toBeUndefined();
  return (await db().select().from(schema.items).where(eq(schema.items.name, name)))[0].id;
}

const orderForm = (payload: object) => form({ payload: JSON.stringify(payload) });
const basePayload = (lines: object[], over: object = {}) => ({
  purchaseDate: "2026-10-01",
  store: "Loja X",
  freight: "",
  discount: "",
  totalPaid: "0,00",
  confirmNegativeDifference: false,
  lines,
  ...over,
});

async function placeOrder(payload: object): Promise<string> {
  await expect(createOrder({}, orderForm(payload))).rejects.toThrow(/^REDIRECT:\/orders\//);
  const rows = await db().select().from(schema.orders);
  return rows[rows.length - 1].id;
}

beforeAll(async () => {
  pg = await createMigratedPglite();
  holder.db = drizzle(pg, { schema });
});
afterAll(async () => {
  await pg.close();
});
beforeEach(async () => {
  holder.userId = USER_A;
  // Limpa respeitando os gatilhos de imutabilidade.
  await pg.exec(`
    alter table order_lines disable trigger order_lines_guard;
    alter table orders disable trigger orders_guard;
    delete from order_lines; delete from orders; delete from items; delete from rooms;
    alter table order_lines enable trigger order_lines_guard;
    alter table orders enable trigger orders_guard;
  `);
});

describe("cômodos e itens", () => {
  it("rejeita cômodo duplicado sem diferenciar maiúsculas", async () => {
    await addRoom("Sala");
    const result = await createRoom({}, form({ name: "SALA" }));
    expect(result.error).toMatch(/Já existe/);
  });

  it("valida item: quantidade, preço e link inseguro", async () => {
    const roomId = await addRoom("Sala");
    const base = { roomId, name: "Sofá", priority: "alta", estimatedPrice: "10,00", desiredQuantity: "1" };
    expect((await createItem({}, form({ ...base, desiredQuantity: "0" }))).error).toBeDefined();
    expect((await createItem({}, form({ ...base, estimatedPrice: "abc" }))).error).toBeDefined();
    expect((await createItem({}, form({ ...base, productUrl: "javascript:alert(1)" }))).error).toMatch(/Link inválido/);
    expect((await createItem({}, form({ ...base, productUrl: "https://loja.example/p" }))).ok).toBe(true);
    expect(await db().select().from(schema.items)).toHaveLength(1);
  });

  it("não deixa criar item em cômodo de outro usuário", async () => {
    const roomId = await addRoom("Sala");
    holder.userId = USER_B;
    const result = await createItem(
      {},
      form({ roomId, name: "X", desiredQuantity: "1", estimatedPrice: "1,00", priority: "baixa" }),
    );
    expect(result.error).toMatch(/não encontrado/);
  });

  it("excluir cômodo com itens exige destino e transfere inclusive os arquivados", async () => {
    const sala = await addRoom("Sala");
    const quarto = await addRoom("Quarto");
    const item1 = await addItem(sala, "Sofá");
    const item2 = await addItem(sala, "Tapete");
    await db().update(schema.items).set({ archivedAt: new Date() }).where(eq(schema.items.id, item2));

    expect((await deleteRoom({}, form({ id: sala, targetRoomId: "" }))).error).toMatch(/Escolha/);
    expect((await deleteRoom({}, form({ id: sala, targetRoomId: sala }))).error).toMatch(/destino inválido/);

    await expect(deleteRoom({}, form({ id: sala, targetRoomId: quarto }))).rejects.toThrow("REDIRECT:/rooms");
    const items = await db().select().from(schema.items);
    expect(items.map((i) => i.roomId)).toEqual([quarto, quarto]);
    expect(items.map((i) => i.id).sort()).toEqual([item1, item2].sort());
    expect(await db().select().from(schema.rooms)).toHaveLength(1);
  });

  it("cômodo vazio pode ser excluído sem destino", async () => {
    const sala = await addRoom("Sala");
    await expect(deleteRoom({}, form({ id: sala, targetRoomId: "" }))).rejects.toThrow("REDIRECT:/rooms");
    expect(await db().select().from(schema.rooms)).toHaveLength(0);
  });
});

describe("pedidos", () => {
  it("registra pedido multi-linha com frete e desconto e fecha totais exatos", async () => {
    const sala = await addRoom("Sala");
    const sofa = await addItem(sala, "Sofá", "1", "2000,00");
    const copo = await addItem(sala, "Copo", "6", "10,00");

    await placeOrder(
      basePayload(
        [
          { itemId: sofa, quantity: "1", unitPrice: "1900,00" },
          { itemId: copo, quantity: "2", unitPrice: "9,90" },
        ],
        { freight: "30,00", discount: "10,00", totalPaid: "1939,80" },
      ),
    );

    const planning = await loadPlanning(USER_A);
    expect(planning.summary.totals.spentCents).toBe(193980);
    const [view] = planning.orders;
    expect(view.breakdown.subtotalCents).toBe(190000 + 1980);
    expect(view.breakdown.totalBeforeInterestCents).toBe(193980);
    expect(view.breakdown.differenceCents).toBe(0);
    expect(view.breakdown.lines.reduce((a, l) => a + l.effectiveTotalCents, 0)).toBe(193980);
    expect(planning.summary.items.get(sofa)?.status).toBe("CONCLUIDO");
    expect(planning.summary.items.get(copo)).toMatchObject({ purchasedQuantity: 2, remainingQuantity: 4, status: "PARCIAL" });
  });

  it("guarda juros como diferença e os preços originais", async () => {
    const sala = await addRoom("Sala");
    const sofa = await addItem(sala, "Sofá", "1", "1000,00");
    await placeOrder(basePayload([{ itemId: sofa, quantity: "1", unitPrice: "1000,00" }], { totalPaid: "1100,00" }));
    const [view] = (await loadPlanning(USER_A)).orders;
    expect(view.breakdown.differenceCents).toBe(10000);
    expect(view.order.totalPaidCents).toBe(110000);
    expect(view.record.lines[0].unitPriceCents).toBe(100000);
  });

  it("exige confirmação quando o total pago é menor que o total sem juros", async () => {
    const sala = await addRoom("Sala");
    const sofa = await addItem(sala, "Sofá", "1", "1000,00");
    const payload = basePayload([{ itemId: sofa, quantity: "1", unitPrice: "1000,00" }], { totalPaid: "950,00" });

    expect((await createOrder({}, orderForm(payload))).error).toMatch(/Confirme/);
    expect(await db().select().from(schema.orders)).toHaveLength(0);

    await placeOrder({ ...payload, confirmNegativeDifference: true });
    expect((await loadPlanning(USER_A)).orders[0].breakdown.differenceCents).toBe(-5000);
  });

  it("bloqueia entradas inválidas e itens arquivados, sem gravar nada", async () => {
    const sala = await addRoom("Sala");
    const sofa = await addItem(sala, "Sofá", "1", "1000,00");
    const line = { itemId: sofa, quantity: "1", unitPrice: "1000,00" };

    const invalid = [
      basePayload([{ ...line, quantity: "0" }], { totalPaid: "1000,00" }),
      basePayload([{ ...line, unitPrice: "-5" }], { totalPaid: "1000,00" }),
      basePayload([], { totalPaid: "1000,00" }),
      basePayload([line], { totalPaid: "1000,00", purchaseDate: "2026-02-31" }),
      basePayload([line], { totalPaid: "1000,00", discount: "5000,00" }),
      basePayload([{ ...line, itemId: "00000000-0000-4000-8000-000000000000" }], { totalPaid: "1000,00" }),
    ];
    for (const payload of invalid) {
      expect((await createOrder({}, orderForm(payload))).error).toBeDefined();
    }
    expect((await createOrder({}, form({ payload: "não é json" }))).error).toBeDefined();

    await db().update(schema.items).set({ archivedAt: new Date() }).where(eq(schema.items.id, sofa));
    expect((await createOrder({}, orderForm(basePayload([line], { totalPaid: "1000,00" })))).error).toMatch(/arquivado/);

    expect(await db().select().from(schema.orders)).toHaveLength(0);
    expect(await db().select().from(schema.orderLines)).toHaveLength(0);
  });

  it("arquivar remove dos totais, preserva o registro e restaurar devolve os mesmos valores", async () => {
    const sala = await addRoom("Sala");
    const copo = await addItem(sala, "Copo", "4", "10,00");
    const orderId = await placeOrder(
      basePayload([{ itemId: copo, quantity: "3", unitPrice: "9,00" }], { freight: "5,00", totalPaid: "32,00" }),
    );
    const before = await loadPlanning(USER_A);
    expect(before.summary.totals.spentCents).toBe(3200);
    expect(before.summary.items.get(copo)?.remainingQuantity).toBe(1);

    await archiveOrder(form({ id: orderId, reason: "lançado errado" }));
    const archived = await loadPlanning(USER_A);
    expect(archived.summary.totals.spentCents).toBe(0);
    expect(archived.summary.totals.pendingCents).toBe(4000);
    expect(archived.summary.items.get(copo)).toMatchObject({ purchasedQuantity: 0, status: "NAO_COMPRADO" });
    expect(archived.orders[0].order).toMatchObject({ totalPaidCents: 3200, archiveReason: "lançado errado" });
    expect(await db().select().from(schema.orderLines)).toHaveLength(1);

    await restoreOrder(form({ id: orderId }));
    const restored = await loadPlanning(USER_A);
    expect(restored.summary).toEqual(before.summary);
    expect(restored.orders[0].order.archiveReason).toBeNull();
  });

  it("outro usuário não consegue arquivar nem restaurar pedidos alheios", async () => {
    const sala = await addRoom("Sala");
    const copo = await addItem(sala, "Copo", "1", "10,00");
    const orderId = await placeOrder(basePayload([{ itemId: copo, quantity: "1", unitPrice: "10,00" }], { totalPaid: "10,00" }));

    holder.userId = USER_B;
    await archiveOrder(form({ id: orderId }));
    holder.userId = USER_A;
    expect((await loadPlanning(USER_A)).orders[0].record.archived).toBe(false);
    expect((await loadPlanning(USER_B)).orders).toHaveLength(0);
  });
});

describe("mudança de planejamento", () => {
  it("reduzir a quantidade desejada preserva compras e o restante nunca fica negativo", async () => {
    const sala = await addRoom("Sala");
    const copo = await addItem(sala, "Copo", "6", "10,00");
    await placeOrder(basePayload([{ itemId: copo, quantity: "5", unitPrice: "9,00" }], { totalPaid: "45,00" }));

    const result = await updateItem(
      {},
      form({ id: copo, roomId: sala, name: "Copo", desiredQuantity: "2", estimatedPrice: "12,00", priority: "media" }),
    );
    expect(result.ok).toBe(true);

    const planning = await loadPlanning(USER_A);
    expect(planning.summary.items.get(copo)).toMatchObject({ purchasedQuantity: 5, remainingQuantity: 0, status: "CONCLUIDO" });
    expect(planning.summary.totals).toMatchObject({ plannedCents: 2400, pendingCents: 0, spentCents: 4500 });
    expect(planning.orders[0].record.lines[0].unitPriceCents).toBe(900);
  });
});
