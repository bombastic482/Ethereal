import type { ComponentChildren } from 'preact';

interface Props {
  /** 0–1; values above 1 render a second, warning-coloured lap. */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  children?: ComponentChildren;
  tone?: 'brand' | 'accent' | 'warn';
}

/** Activity-style progress ring with gradient stroke and an overflow lap. */
export function Ring({ value, size = 180, stroke = 14, label, children, tone = 'brand' }: Props) {
  const r = (100 - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, value);
  const first = Math.min(1, v);
  const over = Math.max(0, Math.min(1, v - 1));
  const id = `ring-${tone}`;
  return (
    <div
      class="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(v * 100)}%`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} class="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            {tone === 'warn' ? (
              <>
                <stop offset="0" stop-color="oklch(75% 0.17 50)" />
                <stop offset="1" stop-color="oklch(62% 0.2 25)" />
              </>
            ) : tone === 'accent' ? (
              <>
                <stop offset="0" stop-color="var(--color-accent-400)" />
                <stop offset="1" stop-color="var(--color-accent-600)" />
              </>
            ) : (
              <>
                <stop offset="0" stop-color="var(--color-brand-400)" />
                <stop offset="1" stop-color="var(--color-brand-600)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-muted)" stroke-width={stroke} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={`${first * c} ${c}`}
          style="transition: stroke-dasharray .6s cubic-bezier(.22,1,.36,1)"
        />
        {over > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="oklch(62% 0.2 25)"
            stroke-width={stroke}
            stroke-linecap="round"
            stroke-dasharray={`${over * c} ${c}`}
            opacity="0.9"
          />
        )}
      </svg>
      <div class="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
