CREATE TYPE "public"."priority" AS ENUM('alta', 'media', 'baixa');--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"name" text NOT NULL,
	"desired_quantity" integer NOT NULL,
	"estimated_unit_price_cents" integer NOT NULL,
	"priority" "priority" DEFAULT 'media' NOT NULL,
	"product_url" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_name_not_blank" CHECK (length(btrim("items"."name")) > 0),
	CONSTRAINT "items_desired_quantity_min_1" CHECK ("items"."desired_quantity" >= 1),
	CONSTRAINT "items_estimated_price_non_negative" CHECK ("items"."estimated_unit_price_cents" >= 0),
	CONSTRAINT "items_product_url_http" CHECK ("items"."product_url" is null or "items"."product_url" ~* '^https?://')
);
--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	CONSTRAINT "order_lines_quantity_min_1" CHECK ("order_lines"."quantity" >= 1),
	CONSTRAINT "order_lines_unit_price_non_negative" CHECK ("order_lines"."unit_price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purchase_date" date NOT NULL,
	"store" text,
	"freight_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_paid_cents" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_freight_non_negative" CHECK ("orders"."freight_cents" >= 0),
	CONSTRAINT "orders_discount_non_negative" CHECK ("orders"."discount_cents" >= 0),
	CONSTRAINT "orders_total_paid_non_negative" CHECK ("orders"."total_paid_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_name_not_blank" CHECK (length(btrim("rooms"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_room_idx" ON "items" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_lines_order_position_uq" ON "order_lines" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "order_lines_item_idx" ON "order_lines" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "orders_user_date_idx" ON "orders" USING btree ("user_id","purchase_date");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_user_name_uq" ON "rooms" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE POLICY "items_owner_only" ON "items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "order_lines_owner_only" ON "order_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "orders_owner_only" ON "orders" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "rooms_owner_only" ON "rooms" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);