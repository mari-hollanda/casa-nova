/** Estado devolvido pelas Server Actions que alimentam formulários (useActionState). */
export interface ActionState {
  error?: string;
  ok?: boolean;
  /** Valores enviados, para o formulário não perder o que foi digitado quando há erro. */
  values?: Record<string, string>;
}

export function fail(error: string, formData?: FormData): ActionState {
  const values: Record<string, string> = {};
  if (formData) {
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") values[key] = value;
    }
  }
  return { error, values };
}

/** Extrai o código SQLSTATE de um erro do postgres-js, mesmo embrulhado pelo Drizzle. */
export function pgErrorCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}
