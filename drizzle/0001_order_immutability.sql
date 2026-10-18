-- Pedidos e linhas são registros financeiros imutáveis: nada é editado nem apagado.
-- Única mudança permitida: arquivar/restaurar um pedido (archived_at, archive_reason).

CREATE FUNCTION public.orders_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pedidos não podem ser excluídos; arquive-os.';
  END IF;

  IF (to_jsonb(NEW) - 'archived_at' - 'archive_reason')
     IS DISTINCT FROM (to_jsonb(OLD) - 'archived_at' - 'archive_reason') THEN
    RAISE EXCEPTION 'Pedidos são imutáveis; apenas o arquivamento pode ser alterado.';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER orders_guard
BEFORE UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_guard();--> statement-breakpoint

CREATE FUNCTION public.order_lines_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Linhas de pedido são imutáveis e não podem ser alteradas nem excluídas.';
END;
$$;--> statement-breakpoint

CREATE TRIGGER order_lines_guard
BEFORE UPDATE OR DELETE ON public.order_lines
FOR EACH ROW EXECUTE FUNCTION public.order_lines_guard();
