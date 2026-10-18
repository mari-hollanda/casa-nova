"use client";

import { useFormStatus } from "react-dom";

/** Botão de submit que pede confirmação antes de enviar (arquivar, restaurar, excluir). */
export function ConfirmButton({
  message,
  className = "btn",
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
