import { z } from "zod";
import { parseBRLToCents } from "@/domain/money";

export const MAX_UNIT_PRICE_CENTS = 100_000_000; // R$ 1.000.000,00
export const MAX_TOTAL_CENTS = 2_000_000_000; // abaixo do limite do integer do Postgres
export const MAX_QUANTITY = 10_000;

/** Texto em reais ("1.234,56") → centavos. Mensagens específicas, nunca "adivinha" o valor. */
export function centsField(label: string, opts: { max?: number; optional?: boolean } = {}) {
  const max = opts.max ?? MAX_UNIT_PRICE_CENTS;
  return z
    .string()
    .trim()
    .transform((text, ctx) => {
      if (text === "" && opts.optional) return 0;
      const cents = parseBRLToCents(text);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label}: informe um valor válido, como 1.234,56.` });
        return z.NEVER;
      }
      if (cents > max) {
        ctx.addIssue({ code: "custom", message: `${label}: valor acima do limite permitido.` });
        return z.NEVER;
      }
      return cents;
    });
}

export const quantityField = (label: string) =>
  z.coerce
    .number({ error: `${label}: informe um número inteiro.` })
    .int(`${label}: use um número inteiro.`)
    .min(1, `${label}: mínimo 1.`)
    .max(MAX_QUANTITY, `${label}: máximo ${MAX_QUANTITY}.`);

/** Link opcional; só http(s). Bloqueia javascript:, data: e afins. */
export const urlField = z
  .string()
  .trim()
  .max(2000, "Link muito longo.")
  .transform((value, ctx) => {
    if (value === "") return null;
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      // cai no erro abaixo
    }
    ctx.addIssue({ code: "custom", message: "Link inválido: use um endereço http:// ou https://." });
    return z.NEVER;
  });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

export const nameField = (label: string) =>
  z.string().trim().min(1, `${label}: informe um nome.`).max(120, `${label}: máximo 120 caracteres.`);

export const idField = z.uuid("Identificador inválido.");

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Data inválida.");

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
