import { useMemo, useState } from 'preact/hooks';
import { daysBetween, trendSeries, weeklyAverages } from '@/lib/calc/trend';
import { cmToIn, formatWeight, inToCm, kgToLb, lbToKg, round } from '@/lib/calc/units';
import { logStore, removeEntry, upsertEntry } from '@/lib/log';
import { toast } from '@/lib/toast';
import { planStore, todayIso } from '@/lib/plan';
import { confetti, haptic } from '@/lib/fx';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { Callout } from '../ui/Callout';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Hydrated, Placeholder } from '../ui/Hydrated';
import { Icon } from '../ui/Icon';
import { LineChart } from '../ui/LineChart';
import { NumberField } from '../ui/NumberField';
import { TapeScrubber } from '../ui/TapeScrubber';
import { Segmented } from '../ui/Segmented';
import { Stat } from '../ui/Stat';

type Range = '30' | '90' | 'all';

function WeightTrackerInner() {
  const [profile] = useProfile();
  const [plan] = planStore.use();
  const [log] = logStore.use();
  const imperial = profile.units === 'imperial';
  const today = todayIso();
  const [shown, setShown] = useState(7);

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState<number | null>(null);
  const [waist, setWaist] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [hips, setHips] = useState<number | null>(null);
  const [chest, setChest] = useState<number | null>(null);
  const [arm, setArm] = useState<number | null>(null);
  const [thigh, setThigh] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [scale, setScale] = useState(false);
  const [bodyFat, setBodyFat] = useState<number | null>(null);
  const [muscle, setMuscle] = useState<number | null>(null);
  const [water, setWater] = useState<number | null>(null);
  const [visceral, setVisceral] = useState<number | null>(null);
  const [range, setRange] = useState<Range>('90');
  const [flash, setFlash] = useState<string | null>(null);

  const entries = useMemo(
    () => [...log.entries].sort((a, b) => a.date.localeCompare(b.date)),
    [log.entries],
  );
  const trend = useMemo(() => trendSeries(entries), [entries]);
  const latest = entries[entries.length - 1] ?? null;
  const latestTrend = trend[trend.length - 1]?.trendKg ?? null;
  const w = (kg: number) => formatWeight(kg, profile.units, 1);
  const toUnit = (kg: number) => (imperial ? kgToLb(kg) : kg);

  const changeOver = (days: number): number | null => {
    if (!latestTrend || !latest) return null;
    const past = [...trend].reverse().find((p) => daysBetween(p.date, latest.date) >= days);
    return past ? round(latestTrend - past.trendKg, 2) : null;
  };
  const d7 = changeOver(7);
  const d30 = changeOver(30);
  const sinceStart =
    entries.length > 1 && latestTrend ? round(latestTrend - entries[0]!.weightKg, 2) : null;
  const spanDays = entries.length > 1 ? daysBetween(entries[0]!.date, latest!.date) : 0;
  const avgRate =
    sinceStart !== null && spanDays >= 7 ? round((sinceStart / spanDays) * 7, 2) : null;

  const visible = useMemo(() => {
    if (range === 'all' || !latest) return trend;
    const n = Number(range);
    return trend.filter((p) => daysBetween(p.date, latest.date) < n);
  }, [trend, range, latest]);
  const origin = visible[0]?.date ?? today;
  const points = visible.map((p) => ({
    x: daysBetween(origin, p.date),
    y: imperial ? kgToLb(p.trendKg) : p.trendKg,
  }));
  const dots = visible.map((p) => ({
    x: daysBetween(origin, p.date),
    y: imperial ? kgToLb(p.weightKg) : p.weightKg,
  }));

  const save = () => {
    // Same fallback as the field shows: last entry, else the profile weight.
    const shown = latest ? latest.weightKg : profile.weightKg;
    const kgRaw = weight ?? (imperial ? kgToLb(shown) : shown);
    const weightKg = round(imperial ? lbToKg(kgRaw) : kgRaw, 2);
    const waistCm = waist === null ? undefined : round(imperial ? inToCm(waist) : waist, 1);
    const cm = (v: number | null) => (v === null ? undefined : round(imperial ? inToCm(v) : v, 1));
    const extras = { hipsCm: cm(hips), chestCm: cm(chest), armCm: cm(arm), thighCm: cm(thigh) };
    const scaleReadings = {
      bodyFatPct: bodyFat ?? undefined,
      muscleKg: muscle === null ? undefined : round(imperial ? lbToKg(muscle) : muscle, 1),
      waterPct: water ?? undefined,
      visceral: visceral ?? undefined,
    };
    const extraEntries = Object.fromEntries(
      Object.entries({ ...extras, ...scaleReadings }).filter(([, v]) => v !== undefined),
    );
    upsertEntry({
      date,
      weightKg,
      ...(waistCm !== undefined ? { waistCm } : {}),
      ...extraEntries,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    // A new lowest trend is the number that matters, so it gets the fuss, not a single low day.
    const after = trendSeries(
      [...logStore.get().entries].sort((a, b) => a.date.localeCompare(b.date)),
    );
    const newest = after[after.length - 1];
    const before = after.slice(0, -1);
    const lowest = before.length >= 2 ? Math.min(...before.map((p) => p.trendKg)) : null;
    if (newest && newest.date === date && lowest !== null && newest.trendKg < lowest - 0.05) {
      setFlash(`New low: your trend is ${w(newest.trendKg)}, the lowest yet.`);
      confetti({ x: 0.5, y: 0.3 }, 90);
      haptic([12, 50, 12, 50, 20]);
    } else setFlash(`Saved ${w(weightKg)} for ${date}`);
    setNote('');
    setWaist(null);
    setBodyFat(null);
    setMuscle(null);
    setWater(null);
    setVisceral(null);
    setTimeout(() => setFlash(null), 4000);
  };

  const fmtChange = (v: number | null) =>
    v === null ? '—' : `${v > 0 ? '+' : ''}${imperial ? `${round(kgToLb(v), 1)} lb` : `${v} kg`}`;
  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  return (
    <div class="grid gap-6">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section class="surface grid content-start gap-4 p-5 sm:p-6" aria-label="Log a weigh-in">
          <h2 class="text-lg font-bold tracking-tight">Log a weigh-in</h2>
          <div>
            <label class="label" for="tr-date">
              Date
            </label>
            <input
              id="tr-date"
              type="date"
              class="field"
              value={date}
              max={today}
              onChange={(e) => setDate((e.target as HTMLInputElement).value || today)}
            />
          </div>
          <TapeScrubber
            id="tr-weight"
            label="Weight"
            value={round(weight ?? toUnit(latest?.weightKg ?? profile.weightKg), 1)}
            min={imperial ? 55 : 25}
            max={imperial ? 880 : 400}
            step={0.1}
            unit={imperial ? 'lb' : 'kg'}
            pxPerUnit={imperial ? 28 : 60}
            labelEvery={imperial ? 5 : 1}
            onChange={setWeight}
            {...(latest ? { marker: round(toUnit(latest.weightKg), 1), markerLabel: 'last' } : {})}
          />
          <div class="grid grid-cols-2 gap-4">
            <NumberField
              id="tr-waist"
              label="Waist (optional)"
              value={waist}
              placeholder={imperial ? '34' : '86'}
              onClear={() => setWaist(null)}
              min={imperial ? 15 : 40}
              max={imperial ? 100 : 250}
              step={0.5}
              suffix={imperial ? 'in' : 'cm'}
              onChange={setWaist}
              hint="At the navel, relaxed"
            />
          </div>
          <button
            type="button"
            class="text-brand-700 dark:text-brand-300 justify-self-start text-sm font-semibold"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
          >
            {more ? 'Hide' : 'Add'} more measurements
          </button>
          {more && (
            <div class="grid grid-cols-2 gap-4">
              <NumberField
                id="tr-hips"
                label="Hips"
                value={hips}
                placeholder={imperial ? '36' : '92'}
                onClear={() => setHips(null)}
                min={imperial ? 5 : 15}
                max={imperial ? 100 : 250}
                step={0.5}
                suffix={imperial ? 'in' : 'cm'}
                onChange={setHips}
              />
              <NumberField
                id="tr-chest"
                label="Chest"
                value={chest}
                placeholder={imperial ? '36' : '92'}
                onClear={() => setChest(null)}
                min={imperial ? 5 : 15}
                max={imperial ? 100 : 250}
                step={0.5}
                suffix={imperial ? 'in' : 'cm'}
                onChange={setChest}
              />
              <NumberField
                id="tr-arm"
                label="Upper arm"
                value={arm}
                placeholder={imperial ? '12' : '30'}
                onClear={() => setArm(null)}
                min={imperial ? 5 : 15}
                max={imperial ? 100 : 250}
                step={0.5}
                suffix={imperial ? 'in' : 'cm'}
                onChange={setArm}
              />
              <NumberField
                id="tr-thigh"
                label="Thigh"
                value={thigh}
                placeholder={imperial ? '22' : '55'}
                onClear={() => setThigh(null)}
                min={imperial ? 5 : 15}
                max={imperial ? 100 : 250}
                step={0.5}
                suffix={imperial ? 'in' : 'cm'}
                onChange={setThigh}
              />
            </div>
          )}
          <button
            type="button"
            class="text-brand-700 dark:text-brand-300 justify-self-start text-sm font-semibold"
            onClick={() => setScale((v) => !v)}
            aria-expanded={scale}
          >
            {scale ? 'Hide' : 'Add'} smart scale readings
          </button>
          {scale && (
            <div class="grid grid-cols-2 gap-4">
              <NumberField
                id="tr-bf"
                label="Body fat"
                value={bodyFat}
                placeholder="28"
                onClear={() => setBodyFat(null)}
                min={3}
                max={70}
                step={0.1}
                suffix="%"
                onChange={setBodyFat}
              />
              <NumberField
                id="tr-muscle"
                label="Muscle mass"
                value={muscle}
                placeholder={imperial ? '140' : '62'}
                onClear={() => setMuscle(null)}
                min={imperial ? 20 : 10}
                max={imperial ? 400 : 180}
                step={0.1}
                suffix={imperial ? 'lb' : 'kg'}
                onChange={setMuscle}
              />
              <NumberField
                id="tr-water"
                label="Body water"
                value={water}
                placeholder="52"
                onClear={() => setWater(null)}
                min={20}
                max={80}
                step={0.1}
                suffix="%"
                onChange={setWater}
              />
              <NumberField
                id="tr-visceral"
                label="Visceral fat"
                value={visceral}
                placeholder="10"
                onClear={() => setVisceral(null)}
                min={1}
                max={60}
                step={1}
                inputMode="numeric"
                onChange={setVisceral}
                hint="The scale's rating"
              />
              <p class="text-subtle col-span-2 text-xs">
                Home scales guess body fat from a tiny current, and read high or low for a given
                person. Weigh in the same way each time and watch the direction, not the number.
              </p>
            </div>
          )}
          <div>
            <label class="label" for="tr-note">
              Note (optional)
            </label>
            <input
              id="tr-note"
              type="text"
              class="field"
              placeholder="Salty dinner, poor sleep, period…"
              value={note}
              maxLength={120}
              onInput={(e) => setNote((e.target as HTMLInputElement).value)}
            />
          </div>
          <button type="button" class="btn btn-primary" onClick={save}>
            <Icon name="check" size={16} /> Save entry
          </button>
          {flash && (
            <p class="text-brand-700 dark:text-brand-300 text-sm font-medium" role="status">
              {flash}
            </p>
          )}
          {!plan.active && (
            <Callout>
              Tracking works on its own, but it gets smart with a plan: Ethereal compares your trend
              to your target and tells you what to change.{' '}
              <a class="underline" href={withBase('/start/')}>
                Build a plan
              </a>
              .
            </Callout>
          )}
        </section>

        <section class="surface grid content-start gap-5 p-5 sm:p-6" aria-label="Summary">
          {latest ? (
            <>
              <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Trend weight"
                  value={w(latestTrend ?? latest.weightKg)}
                  tone="brand"
                  sub={`Latest ${w(latest.weightKg)}, ${latest.date === today ? 'today' : fmtDate(latest.date)}`}
                />
                <Stat label="7 days" value={fmtChange(d7)} />
                <Stat label="30 days" value={fmtChange(d30)} />
                <Stat
                  label="Since start"
                  value={fmtChange(sinceStart)}
                  sub={
                    avgRate !== null
                      ? `${fmtChange(avgRate)}/week average`
                      : `${entries.length} entries`
                  }
                />
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="font-bold tracking-tight">Trend</h3>
                <Segmented
                  name="tr-range"
                  options={[
                    { value: '30', label: '30 days' },
                    { value: '90', label: '90 days' },
                    { value: 'all', label: 'All' },
                  ]}
                  value={range}
                  onChange={setRange}
                  class="w-64"
                />
              </div>
              {points.length > 1 ? (
                <LineChart
                  ariaLabel="Trend weight over time"
                  points={points}
                  dots={dots}
                  goal={
                    plan.active && plan.goal !== 'maintain'
                      ? imperial
                        ? kgToLb(plan.goalWeightKg)
                        : plan.goalWeightKg
                      : undefined
                  }
                  xLabel={(x) => (x === 0 ? fmtDate(origin).replace(/^\w+,\s*/, '') : `+${x}d`)}
                  yLabel={(y) => `${round(y, 1)} ${imperial ? 'lb' : 'kg'}`}
                  pointLabel={(p) =>
                    `${fmtDate(new Date(Date.parse(`${origin}T12:00:00`) + p.x * 864e5).toISOString().slice(0, 10))} · ${round(p.y, 1)} ${imperial ? 'lb' : 'kg'}`
                  }
                />
              ) : (
                <p class="text-subtle text-sm">
                  Add a few more days and the trend line appears here.
                </p>
              )}
            </>
          ) : (
            <div class="text-muted text-sm">
              <p class="text-fg text-lg font-bold tracking-tight">No weigh-ins yet</p>
              <p class="mt-2">
                Log today's weight to start. Daily entries plus a smoothed trend are the only honest
                way to see what the scale is really doing.
              </p>
            </div>
          )}
        </section>
      </div>

      {entries.some((e) => e.waistCm || e.hipsCm || e.chestCm || e.armCm || e.thighCm) && (
        <section class="surface p-5 sm:p-6" aria-label="Measurements">
          <h3 class="font-bold tracking-tight">Measurements</h3>

          <p class="text-subtle text-xs">
            Tape measurements catch fat loss the scale hides, especially when you lift. Measure
            relaxed, same spot, every two weeks.
          </p>

          <div class="mt-3 overflow-x-auto">
            <table class="tabular w-full text-sm">
              <thead>
                <tr class="text-subtle text-left text-xs">
                  <th class="pb-2 font-semibold">Date</th>

                  {['Waist', 'Hips', 'Chest', 'Arm', 'Thigh'].map((h) => (
                    <th key={h} class="pb-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {[...entries]

                  .filter((e) => e.waistCm || e.hipsCm || e.chestCm || e.armCm || e.thighCm)

                  .reverse()

                  .slice(0, 12)

                  .map((e) => (
                    <tr key={e.date} class="border-line border-t">
                      <td class="py-1.5">{fmtDate(e.date)}</td>

                      {[e.waistCm, e.hipsCm, e.chestCm, e.armCm, e.thighCm].map((v, i) => (
                        <td key={i} class="py-1.5">
                          {v === undefined
                            ? '—'
                            : imperial
                              ? `${round(cmToIn(v), 1)} in`
                              : `${v} cm`}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {entries.length > 0 && (
        <div class="grid gap-6 lg:grid-cols-2">
          <section class="surface p-5 sm:p-6" aria-label="Weekly averages">
            <h3 class="font-bold tracking-tight">Weekly averages</h3>
            <table class="tabular mt-3 w-full text-sm">
              <thead>
                <tr class="text-subtle text-left text-xs">
                  <th class="pb-2 font-semibold">Week of</th>
                  <th class="pb-2 font-semibold">Average</th>
                  <th class="pb-2 font-semibold">Change</th>
                  <th class="pb-2 text-right font-semibold">Entries</th>
                </tr>
              </thead>
              <tbody>
                {weeklyAverages(entries)
                  .slice(0, 12)
                  .map((r) => (
                    <tr key={r.weekStart} class="border-line border-t">
                      <td class="py-1.5">{fmtDate(r.weekStart).replace(/^\w+,\s*/, '')}</td>
                      <td class="py-1.5 font-semibold">{w(r.avgKg)}</td>
                      <td
                        class={`py-1.5 ${r.changeKg !== null && r.changeKg < 0 ? 'text-brand-700 dark:text-brand-300' : ''}`}
                      >
                        {fmtChange(r.changeKg)}
                      </td>
                      <td class="py-1.5 text-right">{r.count}/7</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
          <section class="surface p-5 sm:p-6" aria-label="Recent entries">
            <h3 class="font-bold tracking-tight">Recent entries</h3>
            <ul class="mt-3 grid gap-1 text-sm">
              {[...entries]
                .reverse()
                .slice(0, shown)
                .map((e) => (
                  <li key={e.date} class="border-line flex items-center gap-3 border-t py-2">
                    <span class="text-subtle w-28 shrink-0">{fmtDate(e.date)}</span>
                    <span class="tabular font-semibold">{w(e.weightKg)}</span>
                    {e.waistCm !== undefined && (
                      <span class="text-subtle">
                        · {imperial ? `${round(cmToIn(e.waistCm), 1)} in` : `${e.waistCm} cm`}
                      </span>
                    )}
                    {e.note && <span class="text-subtle truncate">· {e.note}</span>}
                    <button
                      type="button"
                      class="btn btn-ghost ml-auto h-8 px-2 text-xs"
                      onClick={() => {
                        removeEntry(e.date);
                        toast(`Removed the weigh-in for ${fmtDate(e.date)}.`, {
                          undo: () => upsertEntry(e),
                        });
                      }}
                      aria-label={`Delete entry for ${e.date}`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
            </ul>
            {entries.length > shown && (
              <button
                type="button"
                class="btn btn-ghost mt-2 w-full text-sm"
                onClick={() => setShown((n) => n + 21)}
              >
                Show more ({entries.length - shown} older)
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function WeightTracker() {
  return (
    <ErrorBoundary area="the tracker">
      <Hydrated fallback={<Placeholder height="36rem" />}>
        <WeightTrackerInner />
      </Hydrated>
    </ErrorBoundary>
  );
}
