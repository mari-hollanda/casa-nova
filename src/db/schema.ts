import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

/**
 * Convenções:
 * - Dinheiro sempre em centavos (integer). Postgres integer cobre até ~R$ 21 milhões por valor.
 * - Toda tabela tem user_id (dono) + RLS "somente o dono" como rede de segurança: o acesso
 *   pelo servidor (Drizzle) já filtra por usuário, mas a RLS protege a API de dados do Supabase.
 * - Pedidos e linhas são imutáveis (trigger na migration 0001); só archived_at/archive_reason mudam.
 */

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "restrict" });

const ownerPolicy = (name: string) =>
  pgPolicy(`${name}_owner_only`, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  });

export const priorityEnum = pgEnum("priority", ["alta", "media", "baixa"]);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rooms_user_name_uq").on(t.userId, sql`lower(${t.name})`),
    check("rooms_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    ownerPolicy("rooms"),
  ],
).enableRLS();

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    desiredQuantity: integer("desired_quantity").notNull(),
    estimatedUnitPriceCents: integer("estimated_unit_price_cents").notNull(),
    priority: priorityEnum("priority").notNull().default("media"),
    productUrl: text("product_url"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("items_room_idx").on(t.roomId),
    check("items_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    check("items_desired_quantity_min_1", sql`${t.desiredQuantity} >= 1`),
    check("items_estimated_price_non_negative", sql`${t.estimatedUnitPriceCents} >= 0`),
    check("items_product_url_http", sql`${t.productUrl} is null or ${t.productUrl} ~* '^https?://'`),
    ownerPolicy("items"),
  ],
).enableRLS();

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    store: text("store"),
    freightCents: integer("freight_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    /** Fonte da verdade do valor final do pedido (frete, desconto e juros já incluídos). */
    totalPaidCents: integer("total_paid_cents").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: text("archive_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_user_date_idx").on(t.userId, t.purchaseDate),
    check("orders_freight_non_negative", sql`${t.freightCents} >= 0`),
    check("orders_discount_non_negative", sql`${t.discountCents} >= 0`),
    check("orders_total_paid_non_negative", sql`${t.totalPaidCents} >= 0`),
    ownerPolicy("orders"),
  ],
).enableRLS();

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    /** Ordem estável da linha no pedido: o desempate do maior resto depende dela. */
    position: smallint("position").notNull(),
    quantity: integer("quantity").notNull(),
    /** Preço unitário original pago, antes do rateio. Nunca é alterado. */
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [
    uniqueIndex("order_lines_order_position_uq").on(t.orderId, t.position),
    index("order_lines_item_idx").on(t.itemId),
    check("order_lines_quantity_min_1", sql`${t.quantity} >= 1`),
    check("order_lines_unit_price_non_negative", sql`${t.unitPriceCents} >= 0`),
    ownerPolicy("order_lines"),
  ],
).enableRLS();

export type Room = typeof rooms.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
