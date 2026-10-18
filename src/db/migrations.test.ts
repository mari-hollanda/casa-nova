import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USER_A, USER_B, createMigratedPglite } from "@/test/test-db";

/** Executa as migrations reais em Postgres (PGlite) e verifica constraints, imutabilidade e RLS. */
let pg: PGlite;
let roomId: string;
let itemId: string;
let orderId: string;

async function asUser(userId: string, fn: () => Promise<void>) {
  await pg.exec(`set role authenticated; set request.jwt.claim.sub = '${userId}';`);
  try {
    await fn();
  } finally {
    await pg.exec("reset role;");
  }
}

beforeAll(async () => {
  pg = await createMigratedPglite();

  roomId = (await pg.query<{ id: string }>(
    `insert into rooms (user_id, name) values ('${USER_A}', 'Sala') returning id`)).rows[0].id;
  itemId = (await pg.query<{ id: string }>(
    `insert into items (user_id, room_id, name, desired_quantity, estimated_unit_price_cents)
     values ('${USER_A}', '${roomId}', 'Sofá', 1, 200000) returning id`)).rows[0].id;
  orderId = (await pg.query<{ id: string }>(
    `insert into orders (user_id, purchase_date, total_paid_cents) values ('${USER_A}', '2026-10-01', 180000) returning id`)).rows[0].id;
  await pg.exec(
    `insert into order_lines (user_id, order_id, item_id, position, quantity, unit_price_cents)
     values ('${USER_A}', '${orderId}', '${itemId}', 0, 1, 180000)`);
});

afterAll(async () => {
  await pg.close();
});

describe("constraints", () => {
  const item = (q: string) =>
    `insert into items (user_id, room_id, name, desired_quantity, estimated_unit_price_cents, product_url)
     values ('${USER_A}', '${roomId}', 'X', ${q})`;

  it("rejeita quantidade desejada < 1", async () => {
    await expect(pg.exec(item("0, 100, null"))).rejects.toThrow(/items_desired_quantity_min_1/);
  });
  it("rejeita preço estimado negativo", async () => {
    await expect(pg.exec(item("1, -1, null"))).rejects.toThrow(/items_estimated_price_non_negative/);
  });
  it("aceita apenas links http(s)", async () => {
    await expect(pg.exec(item("1, 100, 'javascript:alert(1)'"))).rejects.toThrow(/items_product_url_http/);
    await expect(pg.exec(item("1, 100, 'https://loja.example/p/1'"))).resolves.toBeDefined();
  });
  it("nome de cômodo é único sem diferenciar maiúsculas", async () => {
    await expect(pg.exec(`insert into rooms (user_id, name) values ('${USER_A}', 'SALA')`)).rejects.toThrow();
  });
  it("não permite excluir cômodo que ainda tem itens", async () => {
    await expect(pg.exec(`delete from rooms where id = '${roomId}'`)).rejects.toThrow(/foreign key/);
  });
  it("rejeita valores monetários negativos no pedido e na linha", async () => {
    await expect(pg.exec(
      `insert into orders (user_id, purchase_date, freight_cents, total_paid_cents) values ('${USER_A}', '2026-10-01', -1, 0)`,
    )).rejects.toThrow(/orders_freight_non_negative/);
    await expect(pg.exec(
      `insert into order_lines (user_id, order_id, item_id, position, quantity, unit_price_cents)
       values ('${USER_A}', '${orderId}', '${itemId}', 5, 0, 1)`,
    )).rejects.toThrow(/order_lines_quantity_min_1/);
  });
  it("posição da linha é única por pedido", async () => {
    await expect(pg.exec(
      `insert into order_lines (user_id, order_id, item_id, position, quantity, unit_price_cents)
       values ('${USER_A}', '${orderId}', '${itemId}', 0, 1, 1)`,
    )).rejects.toThrow();
  });
});

describe("imutabilidade dos registros financeiros", () => {
  it("não permite alterar valores do pedido", async () => {
    await expect(pg.exec(`update orders set total_paid_cents = 1 where id = '${orderId}'`)).rejects.toThrow(/imutáveis/);
    await expect(pg.exec(`update orders set freight_cents = 100 where id = '${orderId}'`)).rejects.toThrow(/imutáveis/);
  });
  it("não permite excluir pedido nem alterar/excluir linhas", async () => {
    await expect(pg.exec(`delete from orders where id = '${orderId}'`)).rejects.toThrow(/arquive/);
    await expect(pg.exec(`update order_lines set unit_price_cents = 1 where order_id = '${orderId}'`)).rejects.toThrow(/imutáveis/);
    await expect(pg.exec(`delete from order_lines where order_id = '${orderId}'`)).rejects.toThrow(/imutáveis/);
  });
  it("permite arquivar e restaurar sem tocar nos valores", async () => {
    await pg.exec(`update orders set archived_at = now(), archive_reason = 'lançado errado' where id = '${orderId}'`);
    await pg.exec(`update orders set archived_at = null, archive_reason = null where id = '${orderId}'`);
    const { rows } = await pg.query<{ total_paid_cents: number }>(
      `select total_paid_cents from orders where id = '${orderId}'`);
    expect(rows[0].total_paid_cents).toBe(180000);
  });
});

describe("RLS (somente o dono)", () => {
  it("o dono enxerga os próprios dados", async () => {
    await asUser(USER_A, async () => {
      const { rows } = await pg.query(`select id from items`);
      expect(rows).toHaveLength(2);
    });
  });
  it("outro usuário não enxerga nada", async () => {
    await asUser(USER_B, async () => {
      for (const table of ["rooms", "items", "orders", "order_lines"]) {
        expect((await pg.query(`select 1 from ${table}`)).rows).toHaveLength(0);
      }
    });
  });
  it("outro usuário não consegue inserir em nome do dono", async () => {
    await asUser(USER_B, async () => {
      await expect(pg.exec(`insert into rooms (user_id, name) values ('${USER_A}', 'Invasão')`)).rejects.toThrow(
        /row-level security/,
      );
    });
  });
  it("sem sessão (anon) não há acesso às tabelas", async () => {
    await pg.exec("set role anon;");
    try {
      await expect(pg.query(`select 1 from rooms`)).rejects.toThrow(/permission denied/);
    } finally {
      await pg.exec("reset role;");
    }
  });
});
