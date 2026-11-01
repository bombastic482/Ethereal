import type { DayItem, DayKind } from '@/lib/day';
import { toMinutes } from '@/lib/life';
import { Icon, type IconName } from '../ui/Icon';

/**
 * Your waking day as a dial: an arc from the first thing to lights out, filled up to now, with
 * every step placed at its time. Tap a step to bring it to the centre. Busy blocks sit on a
 * quiet inner arc so the free stretches are easy to see.
 */

const SIZE = 300;
const C = SIZE / 2;
const R = 122;
const R_BUSY = 100;
const SWEEP = 290; // degrees of the arc; the gap sits at the bottom
const START = -SWEEP / 2;

export const KIND_ICON: Record<DayKind, IconName> = {
  wake: 'sun',
  meal: 'utensils',
  med: 'pill',
  prayer: 'moon',
  workout: 'dumbbell',
  walk: 'walk',
  weigh: 'scale',
  photo: 'camera',
  measure: 'ruler',
  wind: 'leaf',
  sleep: 'bed',
  busy: 'clock',
};

const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const arc = (from: number, to: number, r: number) => {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
};

export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function DayDial({
  items,
  now,
  selected,
  onSelect,
  center,
}: {
  items: readonly DayItem[];
  /** Minutes since midnight. */
  now: number;
  selected: string | null;
  onSelect: (id: string) => void;
  center: preact.ComponentChildren;
}) {
  if (!items.length) return null;
  // The day runs from just before its first item to just after its last, across midnight if
  // lights out is after it.
  const start = toMinutes(items[0]!.time) - 20;
  const rel = (m: number) => (((m - start) % 1440) + 1440) % 1440;
  const lastItem = items[items.length - 1]!;
  const span = Math.max(240, rel(toMinutes(lastItem.end ?? lastItem.time)) + 20);
  const angle = (m: number) => START + (SWEEP * Math.min(span, rel(m))) / span;
  const nowRel = rel(now);
  const inDay = nowRel <= span;
  const nowAngle = inDay ? angle(now) : START + SWEEP;
  const done = items.filter((i) => !i.passive && i.done).length;
  const total = items.filter((i) => !i.passive).length;

  // Spread markers that would sit on top of each other.
  const placed: Array<{ item: DayItem; a: number }> = [];
  for (const item of items.filter((i) => !i.passive)) {
    let a = angle(toMinutes(item.time));
    const prev = placed[placed.length - 1];
    if (prev && a - prev.a < 9) a = prev.a + 9;
    placed.push({ item, a });
  }
  const hourTicks: number[] = [];
  for (let h = Math.ceil(start / 60); h * 60 - start <= span; h++) hourTicks.push(h * 60);

  return (
    <div class="dial">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        class="dial-svg"
        role="group"
        aria-label={`Your day: ${done} of ${total} done`}
      >
        <defs>
          <linearGradient id="dial-fill" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stop-color="var(--color-brand-300)" />
            <stop offset="1" stop-color="var(--color-brand-600)" />
          </linearGradient>
        </defs>
        {hourTicks.map((m) => {
          const a = angle(m);
          const [x1, y1] = polar(a, R + 15);
          const [x2, y2] = polar(a, R + (m % 360 === 0 ? 22 : 18));
          return (
            <line
              key={m}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              class={m % 360 === 0 ? 'dial-tick-major' : 'dial-tick'}
            />
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const m = h * 60;
          if (rel(m) > span) return null;
          const [x, y] = polar(angle(m), R + 32);
          return (
            <text key={h} x={x} y={y + 4} text-anchor="middle" class="dial-hour">
              {h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
            </text>
          );
        })}
        <path d={arc(START, START + SWEEP, R)} class="dial-track" />
        {nowAngle > START + 0.5 && <path d={arc(START, nowAngle, R)} class="dial-progress" />}
        {items
          .filter((i) => i.passive && i.end)
          .map((b) => (
            <path
              key={b.id}
              d={arc(angle(toMinutes(b.time)), angle(toMinutes(b.end!)), R_BUSY)}
              class="dial-busy"
            >
              <title>
                {b.title}, {clock(b.time)} to {clock(b.end!)}
              </title>
            </path>
          ))}
        {placed.map(({ item, a }) => {
          const [x, y] = polar(a, R);
          const sel = item.id === selected;
          return (
            <g
              key={item.id}
              class={`dial-mark dial-${item.kind} ${item.done ? 'dial-done' : ''} ${sel ? 'dial-sel' : ''}`}
              transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={`${clock(item.time)} ${item.title}${item.done ? ', done' : ''}`}
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(item.id);
                }
              }}
            >
              <circle r={sel ? 13 : 9.5} class="dial-dot" />
              {item.done ? (
                <path d="M-4,0.5 L-1.2,3.2 L4.2,-2.6" class="dial-check" />
              ) : (
                <circle r={sel ? 4 : 3} class="dial-core" />
              )}
            </g>
          );
        })}
        {inDay && (
          <g
            transform={`translate(${polar(nowAngle, R)
              .map((n) => n.toFixed(2))
              .join(',')})`}
            class="dial-now"
            aria-hidden="true"
          >
            <circle r="15" class="dial-now-halo" />
            <circle r="6.5" class="dial-now-dot" />
          </g>
        )}
      </svg>
      <div class="dial-center">{center}</div>
      <span class="sr-only">
        {done} of {total} done
      </span>
    </div>
  );
}

export function KindIcon({ kind, size = 18 }: { kind: DayKind; size?: number }) {
  return <Icon name={KIND_ICON[kind]} size={size} />;
}
