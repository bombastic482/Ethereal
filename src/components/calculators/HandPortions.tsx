import { useState } from 'preact/hooks';
import { scale, sum, type Nutrients } from '@/lib/calc/nutrition';
import { haptic } from '@/lib/fx';
import {
  HAND_FOODS,
  HAND_LABEL,
  handCount,
  resolveHands,
  type HandKind,
  type HandPick,
} from '@/lib/hands';
import { Icon } from '../ui/Icon';

const KINDS: HandKind[] = ['palm', 'fist-carb', 'fist-veg', 'thumb'];

/** Hand shapes for each portion, drawn simply so the size is obvious at a glance. */
function HandArt({ kind }: { kind: HandKind }) {
  const paths: Record<HandKind, string> = {
    palm: 'M7 10.5V6.5a1.5 1.5 0 0 1 3 0V10m0-4.5V4.5a1.5 1.5 0 0 1 3 0V10m0-4V5.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4 15a1.5 1.5 0 0 1 2.5-1.6L7 14',
    'fist-carb':
      'M6 10a2 2 0 0 1 2-2h8a3 3 0 0 1 3 3v3a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-6Zm2-2V7a1.5 1.5 0 0 1 3 0v1m0 0V6.5a1.5 1.5 0 0 1 3 0V8m0 0V7a1.5 1.5 0 0 1 3 0v1.5M9 12h4',
    'fist-veg':
      'M6 10a2 2 0 0 1 2-2h8a3 3 0 0 1 3 3v3a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-6Zm2-2V7a1.5 1.5 0 0 1 3 0v1m0 0V6.5a1.5 1.5 0 0 1 3 0V8m0 0V7a1.5 1.5 0 0 1 3 0v1.5M9 12h4',
    thumb:
      'M9 21v-8.5L7 9.5a2 2 0 0 1 3.3-2.2L12 9.5V4.5a1.8 1.8 0 0 1 3.6 0V12h1.4a2 2 0 0 1 2 2v1a6 6 0 0 1-6 6H9Z',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}

/** Log a plate you can't weigh, one hand portion at a time. */
export function HandPortions({
  onAdd,
}: {
  onAdd: (items: Array<{ name: string; grams: number; per100g: Nutrients }>) => void;
}) {
  const [picks, setPicks] = useState<HandPick[]>(() =>
    KINDS.map((kind) => ({ kind, foodId: HAND_FOODS[kind][0]!.id, count: 0 })),
  );
  const set = (kind: HandKind, patch: Partial<HandPick>) =>
    setPicks(picks.map((p) => (p.kind === kind ? { ...p, ...patch } : p)));
  const items = resolveHands(picks);
  const total = sum(items.map((i) => scale(i.food.per100g, i.grams)));

  return (
    <div class="grid gap-3 pt-4">
      <p class="text-muted text-sm">
        Can’t weigh it? Use your hand. It grows with you, so it is a fair measuring cup for a shared
        platter or a meal out.
      </p>
      {KINDS.map((kind) => {
        const p = picks.find((x) => x.kind === kind)!;
        const foods = HAND_FOODS[kind];
        return (
          <div key={kind} class={`hand-row ${p.count > 0 ? 'hand-on' : ''}`}>
            <span class="hand-art">
              <HandArt kind={kind} />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold">{HAND_LABEL[kind].hint}</p>
              {foods.length > 1 ? (
                <select
                  class="field mt-1 h-9 py-0 text-sm"
                  aria-label={`${HAND_LABEL[kind].hint}: what it was`}
                  value={p.foodId}
                  onChange={(e) => set(kind, { foodId: e.currentTarget.value })}
                >
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p class="text-muted mt-1 text-sm">{foods[0]!.label}</p>
              )}
            </div>
            <div class="flex flex-none items-center gap-1.5">
              <button
                type="button"
                class="hand-step"
                aria-label={`Half a ${HAND_LABEL[kind].one} less`}
                disabled={p.count <= 0}
                onClick={() => {
                  set(kind, { count: Math.max(0, p.count - 0.5) });
                  haptic(8);
                }}
              >
                <Icon name="minus" size={16} />
              </button>
              <output class="tabular w-10 text-center text-lg font-bold" aria-live="polite">
                {p.count % 1 ? `${Math.floor(p.count) || ''}½` : p.count}
              </output>
              <button
                type="button"
                class="hand-step"
                aria-label={`Half a ${HAND_LABEL[kind].one} more`}
                onClick={() => {
                  set(kind, { count: Math.min(8, p.count + 0.5) });
                  haptic(8);
                }}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        );
      })}
      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span class="text-muted text-sm">
          <strong class="text-fg tabular">{total.kcal}</strong> kcal · P {total.protein} · C{' '}
          {total.carbs} · F {total.fat}
        </span>
        <button
          type="button"
          class="btn btn-primary h-10 px-4 text-sm"
          disabled={items.length === 0}
          onClick={() =>
            onAdd(
              items.map((i) => ({
                name: `${i.food.label.replace(/ \(.*\)$/, '')}, ${handCount(i.pick.count, i.pick.kind)}`,
                grams: i.grams,
                per100g: i.food.per100g,
              })),
            )
          }
        >
          <Icon name="check" size={16} /> Log the plate
        </button>
      </div>
    </div>
  );
}
