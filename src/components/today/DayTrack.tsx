import type { DayItem } from '@/lib/day';
import { toMinutes } from '@/lib/life';
import { clock } from './kinds';

/**
 * Your waking day as one fine line, from the first thing to lights out. The part already lived
 * is filled; every step is a small dot in its colour (filled once done, a ring until then, a
 * little larger when it is next), and busy blocks sit behind the line as a faint band. Tap a dot
 * to see it below, with what you can do about it.
 */
export function DayTrack({
  items,
  now,
  nextId,
  selected,
  onSelect,
  detail,
}: {
  items: readonly DayItem[];
  /** Minutes since midnight. */
  now: number;
  /** The step the Now card is about. */
  nextId: string | null;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Shown under the line for the selected step. */
  detail?: preact.ComponentChildren;
}) {
  if (!items.length) return null;
  // The day runs from just before its first step to just after its last, across midnight if
  // lights out is after it.
  const start = toMinutes(items[0]!.time) - 15;
  const rel = (m: number) => (((m - start) % 1440) + 1440) % 1440;
  const last = items[items.length - 1]!;
  const span = Math.max(240, rel(toMinutes(last.end ?? last.time)) + 15);
  const pct = (m: number) => (100 * Math.min(span, rel(m))) / span;
  const nowPct = rel(now) <= span ? pct(now) : 100;
  const steps = items.filter((i) => !i.passive);
  const done = steps.filter((i) => i.done).length;

  // Keep dots that fall close together from sitting on top of each other.
  // At least a dot and a bit apart, so each one keeps its own tap area.
  const GAP = 4.8;
  const placed: Array<{ item: DayItem; x: number }> = [];
  for (const item of steps) {
    let x = pct(toMinutes(item.time));
    const prev = placed[placed.length - 1];
    if (prev && x - prev.x < GAP) x = prev.x + GAP;
    placed.push({ item, x });
  }
  // ...and pull back any that the spreading pushed past the end of the line.
  let limit = 100;
  for (let i = placed.length - 1; i >= 0; i--) {
    placed[i]!.x = Math.min(placed[i]!.x, limit);
    limit = placed[i]!.x - GAP;
  }
  // A few hour marks, every three hours, away from the ends.
  const hours: number[] = [];
  for (let m = Math.ceil(start / 180) * 180; m - start <= span; m += 180) {
    const x = pct(m);
    if (x > 6 && x < 94) hours.push(m);
  }

  return (
    <div class="track" role="group" aria-label={`Your day: ${done} of ${steps.length} done`}>
      <div class="track-head">
        <span>{clock(items[0]!.time)}</span>
        <span class="track-count tabular">
          {done} of {steps.length} done
        </span>
        <span>{clock(last.end ?? last.time)}</span>
      </div>
      <div class="track-line">
        <span class="track-rail" aria-hidden="true" />
        {items
          .filter((i) => i.passive && i.end)
          .map((b) => (
            <span
              key={b.id}
              class="track-busy"
              style={{
                left: `${pct(toMinutes(b.time))}%`,
                width: `${Math.max(1, pct(toMinutes(b.end!)) - pct(toMinutes(b.time)))}%`,
              }}
              title={`${b.title}, ${clock(b.time)} to ${clock(b.end!)}`}
              aria-hidden="true"
            />
          ))}
        <span class="track-fill" style={{ width: `${nowPct}%` }} aria-hidden="true" />
        {nowPct < 100 && (
          <span class="track-now" style={{ left: `${nowPct}%` }} aria-hidden="true" />
        )}
        {placed.map(({ item, x }) => (
          <button
            key={item.id}
            type="button"
            class={`track-dot kind-${item.kind} ${item.done ? 'is-done' : ''} ${item.id === nextId ? 'is-next' : ''} ${item.id === selected ? 'is-sel' : ''}`}
            style={{ left: `${x}%` }}
            aria-pressed={item.id === selected}
            aria-label={`${clock(item.time)} ${item.title}${item.done ? ', done' : ''}`}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
      <div class="track-hours" aria-hidden="true">
        {hours.map((m) => (
          <span key={m} style={{ left: `${pct(m)}%` }}>
            {new Date(2000, 0, 1, (m / 60) % 24).toLocaleTimeString([], { hour: 'numeric' })}
          </span>
        ))}
      </div>
      {detail && <div class="track-detail">{detail}</div>}
    </div>
  );
}
