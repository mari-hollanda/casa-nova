/** Valores monetários são sempre inteiros em centavos (BRL). Nunca use float para dinheiro. */
export type Cents = number;

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertCents(value: number, label = "valor"): void {
  if (!Number.isSafeInteger(value)) {
    throw new DomainError(`${label} deve ser um inteiro em centavos`);
  }
}

/**
 * Distribui `total` (centavos, pode ser negativo) entre `weights` proporcionalmente,
 * usando o método do maior resto: a soma do resultado é sempre exatamente `total`.
 * Desempate pelo menor índice, para o resultado ser determinístico.
 * Se todos os pesos forem zero, divide igualmente.
 */
export function allocateByLargestRemainder(
  total: Cents,
  weights: readonly number[],
): Cents[] {
  assertCents(total, "total");
  if (weights.length === 0) {
    if (total !== 0) throw new DomainError("Não há destinatários para o rateio");
    return [];
  }
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) {
      throw new DomainError("Pesos do rateio devem ser inteiros não negativos");
    }
  }

  const effective = weights.every((w) => w === 0) ? weights.map(() => 1) : [...weights];
  const sign = total < 0 ? -1 : 1;
  const abs = BigInt(Math.abs(total));
  const sumW = effective.reduce((acc, w) => acc + BigInt(w), 0n);

  // BigInt: abs * peso pode passar de 2^53.
  const shares = effective.map((w, index) => {
    const product = abs * BigInt(w);
    return { index, floor: product / sumW, remainder: product % sumW };
  });

  const distributed = shares.reduce((acc, s) => acc + s.floor, 0n);
  const leftover = Number(abs - distributed);

  const order = [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  const extra = new Array<number>(weights.length).fill(0);
  for (let i = 0; i < leftover; i++) extra[order[i].index] = 1;

  return shares.map((s) => sign * (Number(s.floor) + extra[s.index]));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: Cents): string {
  return brl.format(cents / 100);
}

/** Centavos → texto editável ("1234,56"), aceito de volta por parseBRLToCents. */
export function centsToInput(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Converte texto digitado ("1.234,56", "12,5", "12", "R$ 9,90") em centavos.
 * Retorna null quando o texto não é um valor monetário válido (nunca "adivinha").
 */
export function parseBRLToCents(input: string): Cents | null {
  const text = input.replace(/\s|R\$/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(text)) return null;
  const [intPart, decPart = ""] = text.replace(/\./g, "").split(",");
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
