import { useEffect, useMemo, useState } from 'preact/hooks';
import { trendSeries } from '@/lib/calc/trend';
import { formatWeight, round } from '@/lib/calc/units';
import { haptic } from '@/lib/fx';
import {
  COMMON_SYMPTOMS,
  doctorPrompts,
  healthStore,
  LAB_TESTS,
  labFlag,
  rateSymptom,
  RED_FLAGS,
  symptomStrip,
  type LabEntry,
} from '@/lib/health';
import { lifeStore, MED_RULES, medTimes, uid } from '@/lib/life';
import { logStore } from '@/lib/log';
import { todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';
import { Layer } from '../ui/Layer';

const SEVERITY = [
  'None',
  'Barely',
  'Mild',
  'Mild',
  'Moderate',
  'Moderate',
  'Moderate',
  'Severe',
  'Severe',
  'Very severe',
  'Worst',
];
const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' });

function CheckIn({ today, names }: { today: string; names: string[] }) {
  const [{ symptoms }] = healthStore.use();
  const [open, setOpen] = useState<string | null>(null);
  const [value, setValue] = useState(4);
  const [note, setNote] = useState('');
  const [custom, setCustom] = useState('');
  const todays = symptoms.filter((s) => s.date === today);
  const pick = (name: string) => {
    const existing = todays.find((s) => s.symptom === name);
    setOpen(name);
    setValue(existing?.severity ?? 4);
    setNote(existing?.note ?? '');
  };
  return (
    <section class="surface grid gap-4 p-5 sm:p-6" aria-labelledby="checkin-h">
      <div>
        <h2 id="checkin-h" class="text-lg font-bold tracking-tight">
          How is your body today?
        </h2>
        <p class="text-muted text-sm">
          Tap anything that’s bothering you. Ten seconds a day makes the pattern clear.
        </p>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {names.map((name) => {
          const t = todays.find((s) => s.symptom === name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={!!t}
              class={`pressable rounded-full border px-3 py-1.5 text-sm ${
                open === name
                  ? 'border-brand-500 ring-brand-500/30 ring-2'
                  : t
                    ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100'
                    : 'border-line text-muted hover:text-fg'
              }`}
              onClick={() => pick(name)}
            >
              {name}
              {t && <span class="ml-1.5 font-bold">{` ${t.severity}`}</span>}
            </button>
          );
        })}
        <form
          class="flex"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) pick(custom.trim());
            setCustom('');
          }}
        >
          <input
            class="field h-9 w-36 rounded-full py-0 text-sm"
            placeholder="Something else"
            aria-label="Another symptom"
            maxLength={40}
            value={custom}
            onInput={(e) => setCustom(e.currentTarget.value)}
          />
        </form>
      </div>
      {open && (
        <div class="surface-muted grid gap-3 rounded-2xl p-4">
          <div class="flex items-baseline justify-between gap-3">
            <label for="sev" class="font-semibold">
              {open}
            </label>
            <span class="tabular text-sm">
              <strong class="text-lg">{value}</strong> · {SEVERITY[value]}
            </span>
          </div>
          <input
            id="sev"
            type="range"
            min={0}
            max={10}
            step={1}
            value={value}
            class="severity-range w-full"
            style={{ '--v': value / 10 }}
            onInput={(e) => setValue(Number(e.currentTarget.value))}
          />
          <input
            class="field h-10 py-0 text-sm"
            placeholder="Note (optional): after training, worse at night…"
            aria-label="Note"
            maxLength={200}
            value={note}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-primary h-10 text-sm"
              onClick={() => {
                rateSymptom(today, open, value, note.trim() || undefined);
                haptic(12);
                setOpen(null);
              }}
            >
              <Icon name="check" size={16} /> {value === 0 ? 'Clear for today' : 'Save for today'}
            </button>
            <button type="button" class="btn btn-ghost h-10 text-sm" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Labs({ today }: { today: string }) {
  const [{ labs }, patch] = healthStore.use();
  const [test, setTest] = useState(LAB_TESTS[0]!.test);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const spec = LAB_TESTS.find((t) => t.test === test)!;
  const tests = [...new Set(labs.map((l) => l.test))];
  const add = () => {
    const v = Number(value.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    const entry: LabEntry = { id: uid(), date, test, value: v, unit: spec.unit };
    patch({ labs: [...labs, entry].sort((a, b) => a.date.localeCompare(b.date)) });
    setValue('');
    haptic(10);
  };
  return (
    <section class="surface grid gap-4 p-5 sm:p-6" aria-labelledby="labs-h">
      <div>
        <h2 id="labs-h" class="text-lg font-bold tracking-tight">
          Lab results and readings
        </h2>
        <p class="text-muted text-sm">
          Blood tests and blood pressure, kept in one place so you can see them move.
        </p>
      </div>
      <form
        class="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <select
          class="field"
          aria-label="Test"
          value={test}
          onChange={(e) => setTest(e.currentTarget.value)}
        >
          {LAB_TESTS.map((t) => (
            <option key={t.test} value={t.test}>
              {t.test}
            </option>
          ))}
        </select>
        <input
          class="field"
          inputMode="decimal"
          aria-label={`Value in ${spec.unit}`}
          placeholder={spec.unit}
          value={value}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <input
          type="date"
          class="field"
          aria-label="Date"
          max={today}
          value={date}
          onChange={(e) => setDate(e.currentTarget.value || today)}
        />
        <button type="submit" class="btn btn-secondary" disabled={!value.trim()}>
          <Icon name="plus" size={16} /> Add
        </button>
      </form>
      <p class="text-subtle -mt-2 text-xs">
        Usual target for {spec.test.replace(/^Blood pressure, /, 'blood pressure, ')}: {spec.good}.
      </p>
      {tests.length > 0 && (
        <ul class="grid gap-2">
          {tests.map((t) => {
            const rows = labs.filter((l) => l.test === t);
            const last = rows[rows.length - 1]!;
            const prev = rows[rows.length - 2];
            const flag = labFlag(t, last.value);
            return (
              <li key={t} class="surface-muted flex items-center gap-3 rounded-2xl p-3">
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">{t}</span>
                  <span class="text-muted block text-xs">
                    {rows.map((r) => `${r.value} (${fmt(r.date)})`).join(' · ')}
                  </span>
                </span>
                <span class="text-right">
                  <span class="tabular block text-lg font-bold">
                    {last.value} <span class="text-subtle text-xs font-normal">{last.unit}</span>
                  </span>
                  <span
                    class={`block text-xs font-semibold ${flag ? 'text-amber-700 dark:text-amber-300' : 'text-brand-700 dark:text-brand-300'}`}
                  >
                    {flag ? (flag === 'high' ? 'Above range' : 'Below range') : 'In range'}
                    {prev
                      ? ` · ${last.value > prev.value ? '↑' : last.value < prev.value ? '↓' : '→'}`
                      : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Summary({ onClose }: { onClose: () => void }) {
  const [profile] = useProfile();
  const [life] = lifeStore.use();
  const [{ symptoms, labs }] = healthStore.use();
  const [log] = logStore.use();
  const today = todayIso();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 864e5).toISOString().slice(0, 10);
  const recent = symptoms.filter((s) => s.date >= since);
  const names = [...new Set(recent.map((s) => s.symptom))];
  const trend = trendSeries(log.entries);
  const now = trend.at(-1);
  const then = [...trend].reverse().find((p) => p.date <= since) ?? trend[0];
  useEffect(() => {
    document.documentElement.dataset.print = 'summary';
    return () => {
      delete document.documentElement.dataset.print;
    };
  }, []);
  return (
    <Layer>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sum-h"
        class="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-3 sm:p-6"
        data-pop
      >
        <div class="summary-sheet surface max-h-full w-full max-w-2xl overflow-y-auto p-6 sm:p-8">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="eyebrow">For your appointment</p>
              <h2 id="sum-h" class="font-display text-3xl tracking-tight">
                Health summary{life.name ? `: ${life.name}` : ''}
              </h2>
              <p class="text-muted text-sm">
                {fmt(since)} to {fmt(today)} · {profile.sex === 'male' ? 'Male' : 'Female'},{' '}
                {profile.age} · {profile.heightCm} cm
              </p>
            </div>
            <div class="no-print flex gap-2">
              <button
                type="button"
                class="btn btn-primary h-10 text-sm"
                onClick={() => window.print()}
              >
                Print or save PDF
              </button>
              <button
                type="button"
                class="btn btn-ghost h-10 w-10 p-0"
                aria-label="Close"
                onClick={onClose}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
          <div class="mt-6 grid gap-5 text-sm">
            {now && (
              <section>
                <h3 class="font-bold">Weight</h3>
                <p>
                  Trend {formatWeight(now.trendKg, profile.units, 1)}
                  {then && then.date !== now.date
                    ? `, ${now.trendKg <= then.trendKg ? 'down' : 'up'} ${formatWeight(Math.abs(now.trendKg - then.trendKg), profile.units, 1)} in the period`
                    : ''}
                  .
                </p>
              </section>
            )}
            <section>
              <h3 class="font-bold">Symptoms</h3>
              {names.length ? (
                <ul class="mt-1 grid gap-1">
                  {names.map((n) => {
                    const rows = recent.filter((s) => s.symptom === n);
                    const avg = rows.reduce((a, s) => a + s.severity, 0) / rows.length;
                    const worst = Math.max(...rows.map((s) => s.severity));
                    const notes = rows.filter((r) => r.note).map((r) => r.note);
                    return (
                      <li key={n}>
                        <strong>{n}</strong>: {rows.length} {rows.length === 1 ? 'day' : 'days'},
                        average {round(avg, 1)}/10, worst {worst}/10, first noted{' '}
                        {fmt(
                          symptoms
                            .filter((s) => s.symptom === n)
                            .map((s) => s.date)
                            .sort()[0]!,
                        )}
                        .{notes.length ? ` Notes: ${notes.slice(-3).join('; ')}.` : ''}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p class="text-muted">None logged.</p>
              )}
            </section>
            <section>
              <h3 class="font-bold">Conditions noted</h3>
              <p>{life.conditions.length ? life.conditions.join(', ') : 'None noted.'}</p>
            </section>
            <section>
              <h3 class="font-bold">Medicines and supplements</h3>
              {life.meds.length ? (
                <ul class="mt-1 grid gap-1">
                  {life.meds.map((m) => (
                    <li key={m.id}>
                      {m.name}
                      {m.dose ? `, ${m.dose}` : ''} ·{' '}
                      {MED_RULES.find((r) => r.id === m.rule)?.label.toLowerCase()} ·{' '}
                      {medTimes(m, life).join(', ')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="text-muted">None noted.</p>
              )}
            </section>
            {labs.length > 0 && (
              <section>
                <h3 class="font-bold">Results</h3>
                <ul class="mt-1 grid gap-1">
                  {[...new Set(labs.map((l) => l.test))].map((t) => {
                    const rows = labs.filter((l) => l.test === t);
                    return (
                      <li key={t}>
                        {t}: {rows.map((r) => `${r.value} ${r.unit} (${fmt(r.date)})`).join(', ')}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {life.avoid.length > 0 && (
              <section>
                <h3 class="font-bold">Foods avoided</h3>
                <p>{life.avoid.join(', ')}</p>
              </section>
            )}
            <section>
              <h3 class="font-bold">Questions to ask</h3>
              <ul class="mt-1 list-disc pl-5">
                <li>What could be causing the symptoms above, and what would rule things out?</li>
                <li>
                  Is my training plan safe for these symptoms, and is there anything I should avoid?
                </li>
                <li>
                  Are any of my medicines or supplements affected by food, timing or each other?
                </li>
              </ul>
            </section>
            <p class="text-subtle text-xs">Self-reported in Ethereal. Not a medical record.</p>
          </div>
        </div>
      </div>
    </Layer>
  );
}

function HealthHubInner() {
  const [{ symptoms }] = healthStore.use();
  const [life] = lifeStore.use();
  const [today, setToday] = useState('');
  const [summary, setSummary] = useState(false);
  useEffect(() => setToday(todayIso()), []);
  const names = useMemo(
    () => [
      ...new Set([
        ...life.conditions.filter((c) => /pain|ache|sleep|mood|anxiety|reflux|energy/i.test(c)),
        ...COMMON_SYMPTOMS,
        ...symptoms.map((s) => s.symptom),
      ]),
    ],
    [life.conditions, symptoms],
  );
  if (!today) return <div class="surface h-[40rem] animate-pulse" aria-hidden="true" />;
  const prompts = doctorPrompts(symptoms, today);
  const tracked = [
    ...new Set(
      symptoms
        .filter(
          (s) => Date.parse(`${today}T00:00:00Z`) - Date.parse(`${s.date}T00:00:00Z`) < 28 * 864e5,
        )
        .map((s) => s.symptom),
    ),
  ];

  return (
    <div class="grid grid-cols-[minmax(0,1fr)] gap-6">
      {prompts.length > 0 && (
        <section class="health-prompt" aria-labelledby="prompt-h">
          <Icon name="info" size={20} class="mt-0.5 flex-none" />
          <div>
            <h2 id="prompt-h" class="font-bold">
              Worth a word with your doctor
            </h2>
            <ul class="mt-1 grid gap-1 text-sm">
              {prompts.map((p) => (
                <li key={p.symptom}>
                  <strong>{p.symptom}</strong>: {p.reason}{' '}
                  {p.level === 'see-doctor'
                    ? 'A doctor or physio can find the cause.'
                    : 'If it keeps up, get it checked.'}
                </li>
              ))}
            </ul>
            <button
              type="button"
              class="mt-2 text-sm font-semibold underline"
              onClick={() => setSummary(true)}
            >
              Prepare a summary to take with you
            </button>
          </div>
        </section>
      )}

      <div class="grid items-start gap-6 lg:grid-cols-2">
        <div class="grid gap-6">
          <CheckIn today={today} names={names} />
          {tracked.length > 0 && (
            <section class="surface p-5 sm:p-6" aria-labelledby="pattern-h">
              <h2 id="pattern-h" class="text-lg font-bold tracking-tight">
                The last four weeks
              </h2>
              <ul class="mt-4 grid gap-3">
                {tracked.map((n) => {
                  const strip = symptomStrip(symptoms, n, today, 28);
                  const days = strip.filter((v) => v > 0).length;
                  return (
                    <li key={n}>
                      <div class="flex items-baseline justify-between text-sm">
                        <span class="font-semibold">{n}</span>
                        <span class="text-muted">
                          {days} {days === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <div
                        class="severity-strip mt-1.5"
                        role="img"
                        aria-label={`${n}: ${days} of the last 28 days`}
                      >
                        {strip.map((v, i) => (
                          <span key={i} style={{ '--v': v / 10 }} class={v ? 'on' : ''} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p class="text-subtle mt-3 text-xs">Darker means worse. Oldest on the left.</p>
            </section>
          )}
        </div>
        <div class="grid gap-6">
          <Labs today={today} />
          <section class="surface grid gap-3 p-5 sm:p-6" aria-labelledby="doc-h">
            <h2 id="doc-h" class="text-lg font-bold tracking-tight">
              Seeing a doctor?
            </h2>
            <p class="text-muted text-sm">
              One page with your symptoms, medicines, conditions, results and weight trend, plus
              questions worth asking. Print it or save it as a PDF.
            </p>
            <button
              type="button"
              class="btn btn-secondary justify-self-start"
              onClick={() => setSummary(true)}
            >
              <Icon name="list" size={16} /> Prepare a summary
            </button>
          </section>
          <details class="surface p-5 sm:p-6">
            <summary class="cursor-pointer font-bold">When not to wait</summary>
            <p class="text-muted mt-2 text-sm">Call your local emergency number for:</p>
            <ul class="mt-2 grid gap-1.5 text-sm">
              {RED_FLAGS.map((f) => (
                <li key={f} class="flex gap-2">
                  <Icon name="warn" size={16} class="mt-0.5 flex-none text-red-600" />
                  {f}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
      <p class="text-subtle text-sm">
        Medicines, conditions and foods to avoid are set on your{' '}
        <a class="underline" href={withBase('/you/#health')}>
          profile
        </a>
        . Everything here stays on this device.
      </p>
      {summary && <Summary onClose={() => setSummary(false)} />}
    </div>
  );
}

export default function HealthHub() {
  return (
    <ErrorBoundary area="your health diary">
      <HealthHubInner />
    </ErrorBoundary>
  );
}
