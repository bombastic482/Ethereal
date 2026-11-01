import { GOALS, type Goal } from '@/lib/life';

/** Pick-several goals; the order you tap them in is the order they matter. */
export function GoalGrid({ value, onChange }: { value: Goal[]; onChange: (v: Goal[]) => void }) {
  const toggle = (g: Goal) =>
    onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);
  return (
    <div class="grid gap-2 sm:grid-cols-2">
      {GOALS.map((g) => {
        const i = value.indexOf(g.id);
        const on = i >= 0;
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={on}
            class={`pressable flex items-center gap-3 rounded-2xl border p-3 text-left ${
              on
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-400/10'
                : 'border-line hover:bg-muted'
            }`}
            onClick={() => toggle(g.id)}
          >
            <span
              class={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${
                on ? 'bg-brand-600 text-white' : 'border-line-strong border'
              }`}
              aria-hidden="true"
            >
              {on ? i + 1 : ''}
            </span>
            <span>
              <span class="block text-sm font-semibold">{g.label}</span>
              <span class="text-muted block text-xs">{g.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
