import { useMemo, useState } from 'preact/hooks';
import { EXERCISES, type Equipment, type Pattern } from '@/lib/train/exercises';
import { trainStore } from '@/lib/train/store';
import { withBase } from '@/lib/url';
import { Figure } from './Figure';

const PATTERNS: Array<{ value: Pattern | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'squat', label: 'Squat' },
  { value: 'lunge', label: 'Lunge' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
];

const LEVEL = ['', 'Beginner', 'Easy', 'Moderate', 'Hard', 'Advanced'];

/** Every exercise as a live demo, filterable by movement and by what you have at home. */
export default function ExerciseLibrary() {
  const [pattern, setPattern] = useState<Pattern | 'all'>('all');
  const [mine, setMine] = useState(false);
  const [{ setup }] = trainStore.use();
  const have = new Set<Equipment>(['none', ...(setup?.equipment ?? [])]);
  const list = useMemo(
    () =>
      EXERCISES.filter(
        (e) =>
          (pattern === 'all' || e.pattern === pattern) &&
          (!mine || e.equipment.every((q) => have.has(q))),
      ).sort((a, b) => a.level - b.level),
    [pattern, mine, setup],
  );
  return (
    <div>
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter exercises">
        {PATTERNS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={pattern === p.value}
            class={`pressable rounded-full px-3.5 py-1.5 text-sm font-medium ${
              pattern === p.value ? 'bg-brand-600 text-white' : 'bg-muted text-muted hover:text-fg'
            }`}
            onClick={() => setPattern(p.value)}
          >
            {p.label}
          </button>
        ))}
        {setup && (
          <label class="text-muted ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="h-4 w-4 accent-[var(--color-brand-600)]"
              checked={mine}
              onChange={(e) => setMine(e.currentTarget.checked)}
            />
            Only what I have
          </label>
        )}
      </div>
      <p class="text-muted mt-3 text-sm" aria-live="polite">
        {list.length} exercises
      </p>
      <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => (
          <li key={e.id}>
            <a
              href={withBase(`/train/exercises/${e.id}/`)}
              class="surface group hover:shadow-glow flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5"
            >
              <span class="bg-muted block aspect-[11/7]">
                <Figure
                  keys={e.keys}
                  props={e.props}
                  muscles={e.muscles}
                  peak={e.peak}
                  towel={e.towel}
                  label={`${e.name}, animated demonstration`}
                  class="h-full w-full"
                />
              </span>
              <span class="flex flex-1 flex-col gap-1 p-4">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="font-bold tracking-tight">{e.name}</span>
                  <span class="text-subtle text-xs font-semibold">{LEVEL[e.level]}</span>
                </span>
                <span class="text-muted text-sm">{e.summary}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
