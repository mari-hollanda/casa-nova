import type { ItemStatus } from "@/domain/planning";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  NAO_COMPRADO: "Não comprado",
  PARCIAL: "Parcial",
  CONCLUIDO: "Concluído",
};

const STATUS_STYLE: Record<ItemStatus, string> = {
  NAO_COMPRADO: "border-line bg-white/50 text-muted",
  PARCIAL: "border-amber-600/40 bg-amber-100 text-amber-900",
  CONCLUIDO: "border-success/30 bg-success/10 text-success",
};

const BADGE = "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`${BADGE} ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export const PRIORITY_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

const PRIORITY_STYLE = {
  alta: "border-primary/40 bg-primary/10 text-primary",
  media: "border-line bg-white/50 text-foreground",
  baixa: "border-line bg-white/50 text-muted",
} as const;

export function PriorityBadge({ priority }: { priority: keyof typeof PRIORITY_LABEL }) {
  return <span className={`${BADGE} ${PRIORITY_STYLE[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function ArchivedBadge({ label = "Arquivado" }: { label?: string }) {
  return <span className={`${BADGE} border-line bg-background text-muted`}>{label}</span>;
}

/** Cores pastel dos cards, em rodízio (rosa, azul, pêssego), como na referência. */
export const TINTS = ["tint-pink", "tint-blue", "tint-peach"] as const;

export function Stat({
  label,
  value,
  hint,
  tint = "tint-pink",
}: {
  label: string;
  value: string;
  hint?: string;
  tint?: (typeof TINTS)[number];
}) {
  return (
    <div className={`card ${tint}`}>
      <p className="text-sm font-medium text-foreground/80">{label}</p>
      <p className="mt-1 font-display text-3xl text-primary tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-foreground/70">{hint}</p>}
    </div>
  );
}

export function Sparkle({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 1c.6 5.2 2.4 8.4 5.4 9.6C20.2 11.2 22 11.8 23 12c-1 .2-2.8.8-5.6 1.4C14.4 14.6 12.6 17.8 12 23c-.6-5.2-2.4-8.4-5.4-9.6C3.8 12.8 2 12.2 1 12c1-.2 2.8-.8 5.6-1.4C9.6 9.4 11.4 6.2 12 1z" />
    </svg>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-4xl leading-tight">
        {title}
        <Sparkle className="h-4 w-4 self-start text-primary" />
      </h1>
      {children}
    </div>
  );
}

/** Título de seção com o brilho decorativo vermelho, no estilo "New Favorites". */
export function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 flex items-center gap-2 text-2xl">
      <Sparkle className="h-4 w-4 text-primary" />
      {children}
    </h2>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="M10 19.5v-5h4v5" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-xl font-semibold uppercase tracking-wide">Casa Nova</span>
        <span className="mt-1 block text-[0.6rem] uppercase tracking-[0.25em] text-muted">Compras da casa</span>
      </span>
    </span>
  );
}

/** Ilustração decorativa (luminária em arco), sem significado para leitores de tela. */
export function LampIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="62" cy="206" rx="40" ry="8" fill="#d3241b" />
      <path d="M62 204 C 56 90, 70 24, 150 28" fill="none" stroke="#d3241b" strokeWidth="6" strokeLinecap="round" />
      <path d="M118 36 C 124 14, 176 14, 182 36 Z" fill="#d3241b" />
      <path d="M126 40 C 140 58, 168 58, 178 40 Z" fill="#fde8b0" opacity="0.9" />
    </svg>
  );
}

/** Link externo seguro: só http(s), nova aba sem acesso a window.opener nem envio de referrer. */
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  let safe = false;
  try {
    const { protocol } = new URL(href);
    safe = protocol === "http:" || protocol === "https:";
  } catch {
    safe = false;
  }
  if (!safe) return <span className="text-muted">{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow external"
      referrerPolicy="no-referrer"
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
