import { useEffect, useMemo, useState } from 'preact/hooks';
import { dayStore } from '@/lib/day';
import { diaryStore } from '@/lib/food-store';
import { logStore } from '@/lib/log';
import { mindStore } from '@/lib/mind';
import { todayIso } from '@/lib/plan';
import { HABITS, HABIT_LABEL, rhythm, showedUp, type RhythmDay } from '@/lib/rhythm';
import { trainStore } from '@/lib/train/store';
import { Icon } from '../ui/Icon';

const WEEKS = 12;
const ROWS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

const long = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/**
 * Twelve weeks of showing up. Each square is a day, shaded by how many of four everyday habits
 * it held; tap one to see which. Quiet days are lighter, never red: the picture is of the
 * whole, not of a streak to protect.
 */
export default function Rhythm() {
  const [diary] = diaryStore.use();
  const [train] = trainStore.use();
  const [mind] = mindStore.use();
  const [weights] = logStore.use();
  const [{ ticks }] = dayStore.use();
  const [today, setToday] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setToday(todayIso()), []);

  const days = useMemo(
    () =>
      today
        ? rhythm(
            {
              foodDates: diary.food.map((f) => f.date),
              exerciseDates: [
                ...diary.exercise.map((e) => e.date),
                ...train.log.map((l) => l.date),
              ],
              steps: diary.steps ?? {},
              checkinDates: mind.checkins.map((c) => c.date),
              weighDates: weights.entries.map((e) => e.date),
              ticks,
            },
            today,
            WEEKS,
          )
        : [],
    [today, diary, train.log, mind.checkins, weights.entries, ticks],
  );
  if (!today) return <div class="surface h-64 animate-pulse" aria-hidden="true" />;

  const recent = showedUp(days, 28);
  const sel: RhythmDay = days.find((d) => d.date === (pick ?? today)) ?? days.at(-1)!;
  const weeks = Array.from({ length: WEEKS }, (_, w) => days.slice(w * 7, w * 7 + 7));

  return (
    <section class="surface p-5 sm:p-6" aria-labelledby="rhythm-h">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rhythm-h" class="text-lg font-bold tracking-tight">
          Your rhythm
        </h2>
        <p class="text-muted text-sm">
          <span class="text-fg tabular font-semibold">{recent.days}</span> of the last {recent.of}{' '}
          days you showed up
        </p>
      </div>
      <p class="text-subtle mt-1 text-xs">
        Each square is a day: darker when more of food, movement, a check-in and the plan held.
      </p>

      <div class="rhythm mt-4">
        <div class="rhythm-days" aria-hidden="true">
          {ROWS.map((r, i) => (
            <span key={i}>{r}</span>
          ))}
        </div>
        <div class="rhythm-grid" role="group" aria-label={`The last ${WEEKS} weeks`}>
          {weeks.map((week, w) => (
            <div key={w} class="rhythm-week">
              {week.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  class={`rhythm-cell ${d.future ? 'is-future' : ''} ${d.date === today ? 'is-today' : ''} ${d.date === sel.date ? 'is-sel' : ''}`}
                  style={{ '--s': d.score }}
                  disabled={d.future}
                  aria-label={`${long(d.date)}: ${d.score} of 4`}
                  aria-pressed={d.date === sel.date}
                  onClick={() => setPick(d.date)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div class="rhythm-detail" aria-live="polite">
        <p class="font-semibold">
          {sel.date === today ? 'Today' : long(sel.date)}
          <span class="text-subtle font-normal"> · {sel.score} of 4</span>
        </p>
        <ul class="mt-2 flex flex-wrap gap-1.5">
          {HABITS.map((h) => (
            <li key={h} class={`rhythm-habit ${sel.habits[h] ? 'is-on' : ''}`}>
              <Icon name={sel.habits[h] ? 'check' : 'minus'} size={13} />
              {HABIT_LABEL[h]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
