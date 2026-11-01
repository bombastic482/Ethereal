import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  COMMON_AVOID,
  COMMON_CONDITIONS,
  lifeStore,
  MED_RULES,
  medTimes,
  uid,
  type Busy,
  type Life,
  type Med,
  type MedRule,
} from '@/lib/life';
import { todayIso } from '@/lib/plan';
import {
  CITIES,
  METHODS,
  PRAYER_LABEL,
  prayerTimes,
  suggestMethod,
  type PrayerMethod,
  type PrayerName,
} from '@/lib/prayer';
import { trainStore } from '@/lib/train/store';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon, type IconName } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { GoalGrid } from './GoalGrid';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function Card({
  id,
  icon,
  title,
  lede,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  lede: string;
  children: preact.ComponentChildren;
}) {
  return (
    <section
      id={id}
      class="surface grid scroll-mt-24 content-start gap-5 p-5 sm:p-6"
      aria-labelledby={`${id}-h`}
    >
      <div class="flex items-start gap-3">
        <span class="bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200 grid h-10 w-10 flex-none place-items-center rounded-2xl">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h2 id={`${id}-h`} class="text-lg font-bold tracking-tight">
            {title}
          </h2>
          <p class="text-muted text-sm">{lede}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function TimeField({
  id,
  label,
  value,
  onChange,
  row = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Label and field side by side, for a list of times. */
  row?: boolean;
}) {
  if (row)
    return (
      <div class="flex items-center justify-between gap-3 px-4 py-2.5">
        <label class="font-semibold" for={id}>
          {label}
        </label>
        <input
          id={id}
          type="time"
          class="field h-10 w-36 py-0"
          value={value}
          onChange={(e) => e.currentTarget.value && onChange(e.currentTarget.value)}
        />
      </div>
    );
  return (
    <div>
      <label class="label" for={id}>
        {label}
      </label>
      <input
        id={id}
        type="time"
        class="field"
        value={value}
        onChange={(e) => e.currentTarget.value && onChange(e.currentTarget.value)}
      />
    </div>
  );
}

/** A set of toggle chips with a box to add your own. */
function ChipSet({
  label,
  common,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  common: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState('');
  const all = [...new Set([...common, ...value])];
  const add = () => {
    const t = text.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText('');
  };
  return (
    <fieldset>
      <legend class="label">{label}</legend>
      <div class="flex flex-wrap gap-1.5">
        {all.map((c) => {
          const on = value.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              class={`pressable rounded-full border px-3 py-1.5 text-sm ${
                on
                  ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-400/15 dark:text-brand-100'
                  : 'border-line text-muted hover:text-fg'
              }`}
              onClick={() => onChange(on ? value.filter((v) => v !== c) : [...value, c])}
            >
              {on && <Icon name="check" size={14} class="mr-1 -ml-0.5 inline" />}
              {c}
            </button>
          );
        })}
      </div>
      <form
        class="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          class="field h-10 py-0"
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={40}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button
          type="submit"
          class="btn btn-secondary h-10 px-3"
          disabled={!text.trim()}
          aria-label="Add"
        >
          <Icon name="plus" size={18} />
        </button>
      </form>
    </fieldset>
  );
}

function Goals({ life, patch }: { life: Life; patch: (p: Partial<Life>) => void }) {
  return (
    <Card
      id="goals"
      icon="spark"
      title="Who you're becoming"
      lede="Pick what matters now. Your first pick leads; Today is shaped around these."
    >
      <div>
        <label class="label" for="you-name">
          What should we call you?
        </label>
        <input
          id="you-name"
          class="field"
          value={life.name}
          maxLength={40}
          autocomplete="given-name"
          placeholder="Optional"
          onInput={(e) => patch({ name: e.currentTarget.value })}
        />
      </div>
      <fieldset>
        <legend class="label">What are you working on?</legend>
        <GoalGrid value={life.goals} onChange={(goals) => patch({ goals })} />
      </fieldset>
      <div>
        <label class="label" for="you-why">
          Why does it matter to you?
        </label>
        <textarea
          id="you-why"
          class="field min-h-20"
          maxLength={280}
          value={life.why}
          placeholder="For example: I want to keep up with my kids, and feel good in photos again."
          onInput={(e) => patch({ why: e.currentTarget.value })}
        />
        <p class="text-subtle mt-1 text-xs">Shown back to you on the days it's hard.</p>
      </div>
    </Card>
  );
}

function Day({ life, patch }: { life: Life; patch: (p: Partial<Life>) => void }) {
  const setBusy = (id: string, p: Partial<Busy>) =>
    patch({ busy: life.busy.map((b) => (b.id === id ? { ...b, ...p } : b)) });
  return (
    <Card
      id="day"
      icon="clock"
      title="Your day"
      lede="Roughly is fine. Today uses this to put each thing at a time that actually works."
    >
      <div class="grid grid-cols-2 gap-3">
        <TimeField
          id="you-wake"
          label="Wake up"
          value={life.wake}
          onChange={(wake) => patch({ wake })}
        />
        <TimeField
          id="you-sleep"
          label="Lights out"
          value={life.sleep}
          onChange={(sleep) => patch({ sleep })}
        />
      </div>
      <div>
        <p class="label">Meals</p>
        <div class="surface-muted divide-y divide-[var(--border)] rounded-2xl">
          <TimeField
            row
            id="you-breakfast"
            label="Breakfast"
            value={life.meals.breakfast}
            onChange={(breakfast) => patch({ meals: { ...life.meals, breakfast } })}
          />
          <TimeField
            row
            id="you-lunch"
            label="Lunch"
            value={life.meals.lunch}
            onChange={(lunch) => patch({ meals: { ...life.meals, lunch } })}
          />
          <TimeField
            row
            id="you-dinner"
            label="Dinner"
            value={life.meals.dinner}
            onChange={(dinner) => patch({ meals: { ...life.meals, dinner } })}
          />
        </div>
      </div>
      <div>
        <p class="label">Busy blocks (work, study, commute)</p>
        <ul class="grid gap-3">
          {life.busy.map((b) => (
            <li key={b.id} class="surface-muted grid gap-3 rounded-2xl p-3">
              <div class="flex gap-2">
                <input
                  class="field h-10 py-0"
                  value={b.label}
                  maxLength={30}
                  aria-label="What it is"
                  onInput={(e) => setBusy(b.id, { label: e.currentTarget.value })}
                />
                <button
                  type="button"
                  class="btn btn-ghost h-10 w-10 flex-none p-0"
                  aria-label={`Remove ${b.label}`}
                  onClick={() => patch({ busy: life.busy.filter((x) => x.id !== b.id) })}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  class="field h-10 py-0"
                  value={b.start}
                  aria-label={`${b.label} starts`}
                  onChange={(e) => setBusy(b.id, { start: e.currentTarget.value })}
                />
                <input
                  type="time"
                  class="field h-10 py-0"
                  value={b.end}
                  aria-label={`${b.label} ends`}
                  onChange={(e) => setBusy(b.id, { end: e.currentTarget.value })}
                />
              </div>
              <div class="grid grid-cols-7 gap-1" role="group" aria-label={`${b.label} days`}>
                {DAY_NAMES.map((n, d) => {
                  const on = b.days.includes(d);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      class={`h-9 rounded-lg text-xs font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-elevated text-muted'}`}
                      onClick={() =>
                        setBusy(b.id, {
                          days: on ? b.days.filter((x) => x !== d) : [...b.days, d].sort(),
                        })
                      }
                    >
                      {n}
                      <span class="sr-only">{DAY_LONG[d]!.slice(3)}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          class="btn btn-secondary mt-2 h-10 text-sm"
          onClick={() =>
            patch({
              busy: [
                ...life.busy,
                {
                  id: uid(),
                  label: life.busy.length ? 'Commute' : 'Work',
                  start: '08:00',
                  end: '16:00',
                  days: [0, 1, 2, 3, 4],
                },
              ],
            })
          }
        >
          <Icon name="plus" size={16} /> Add a block
        </button>
      </div>
    </Card>
  );
}

function Health({ life, patch }: { life: Life; patch: (p: Partial<Life>) => void }) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [rule, setRule] = useState<MedRule>('any');
  const [time, setTime] = useState('');
  const addMed = () => {
    if (!name.trim()) return;
    const med: Med = {
      id: uid(),
      name: name.trim(),
      dose: dose.trim(),
      rule,
      times: time ? [time] : [],
    };
    patch({ meds: [...life.meds, med] });
    setName('');
    setDose('');
    setTime('');
    setRule('any');
  };
  return (
    <Card
      id="health"
      icon="heart"
      title="Health"
      lede="So workouts, food ideas and reminders fit you. Stays on this device."
    >
      <ChipSet
        label="Anything to work around?"
        common={COMMON_CONDITIONS}
        value={life.conditions}
        onChange={(conditions) => patch({ conditions })}
        placeholder="Add your own"
      />
      <div>
        <p class="label">Medicines and supplements</p>
        {life.meds.length > 0 && (
          <ul class="mb-3 grid gap-2">
            {life.meds.map((m) => (
              <li key={m.id} class="surface-muted flex items-center gap-3 rounded-2xl p-3">
                <Icon name="pill" size={18} class="text-brand-600 flex-none" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold">
                    {m.name}
                    {m.dose && <span class="text-muted font-normal"> · {m.dose}</span>}
                  </span>
                  <span class="text-muted block text-xs">
                    {MED_RULES.find((r) => r.id === m.rule)?.label} · {medTimes(m, life).join(', ')}
                  </span>
                </span>
                <button
                  type="button"
                  class="btn btn-ghost h-9 w-9 flex-none p-0"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => patch({ meds: life.meds.filter((x) => x.id !== m.id) })}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          class="surface-muted grid gap-2 rounded-2xl p-3"
          onSubmit={(e) => {
            e.preventDefault();
            addMed();
          }}
        >
          <div class="grid grid-cols-[1fr_7rem] gap-2">
            <input
              class="field h-10 py-0"
              placeholder="Name, e.g. Vitamin D"
              aria-label="Medicine or supplement name"
              value={name}
              maxLength={40}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <input
              class="field h-10 py-0"
              placeholder="Dose"
              aria-label="Dose"
              value={dose}
              maxLength={20}
              onInput={(e) => setDose(e.currentTarget.value)}
            />
          </div>
          <div class="grid grid-cols-[1fr_7rem] gap-2">
            <select
              class="field h-10 py-0"
              aria-label="When to take it"
              value={rule}
              onChange={(e) => setRule(e.currentTarget.value as MedRule)}
            >
              {MED_RULES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              type="time"
              class="field h-10 py-0"
              aria-label="Time (optional)"
              value={time}
              onChange={(e) => setTime(e.currentTarget.value)}
            />
          </div>
          <button type="submit" class="btn btn-secondary h-10 text-sm" disabled={!name.trim()}>
            <Icon name="plus" size={16} /> Add
          </button>
          <p class="text-subtle text-xs">
            Leave the time empty and it follows your day: with food goes with breakfast, empty
            stomach 30 minutes before it, bedtime 30 minutes before lights out. Always follow what
            your doctor or pharmacist told you.
          </p>
        </form>
      </div>
      <ChipSet
        label="Foods to avoid"
        common={COMMON_AVOID}
        value={life.avoid}
        onChange={(avoid) => patch({ avoid })}
        placeholder="Add a food"
      />
    </Card>
  );
}

function Faith({ life, patch }: { life: Life; patch: (p: Partial<Life>) => void }) {
  const p = life.prayer;
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [today, setToday] = useState('');
  useEffect(() => setToday(todayIso()), []);
  const times = useMemo(
    () =>
      p.on && p.lat !== null && p.lon !== null && today
        ? prayerTimes(today, p.lat, p.lon, { method: p.method, asr: p.asr, ramadan: life.fasting })
        : null,
    [p.on, p.lat, p.lon, p.method, p.asr, life.fasting, today],
  );
  const setPlace = (city: string, lat: number, lon: number) =>
    patch({ prayer: { ...p, on: true, city, lat, lon, method: suggestMethod(lat, lon) } });
  const locate = () => {
    setError('');
    if (!('geolocation' in navigator))
      return setError('This browser cannot share a location. Pick a city instead.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // Two decimals is about a kilometre: plenty for prayer times, and all we keep.
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        setPlace('My location', lat, lon);
      },
      () => {
        setLocating(false);
        setError('No location shared. Pick a city instead.');
      },
      { maximumAge: 864e5, timeout: 15000 },
    );
  };
  return (
    <Card
      id="faith"
      icon="moon"
      title="Prayer and fasting"
      lede="Optional. Prayer times are worked out on this device and slot into Today."
    >
      <label class="flex items-center gap-3">
        <input
          type="checkbox"
          class="h-5 w-5 accent-[var(--color-brand-600)]"
          checked={p.on}
          onChange={(e) => patch({ prayer: { ...p, on: e.currentTarget.checked } })}
        />
        <span class="font-semibold">Show prayer times in my day</span>
      </label>
      {p.on && (
        <>
          <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              class="field"
              aria-label="City"
              value={CITIES.some((c) => c.name === p.city) ? p.city : ''}
              onChange={(e) => {
                const c = CITIES.find((x) => x.name === e.currentTarget.value);
                if (c) setPlace(c.name, c.lat, c.lon);
              }}
            >
              <option value="" disabled>
                {p.city === 'My location' ? 'Using my location' : 'Pick your city'}
              </option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" class="btn btn-secondary" onClick={locate} disabled={locating}>
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
          </div>
          {error && <p class="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="label" for="you-method">
                Calculation method
              </label>
              <select
                id="you-method"
                class="field"
                value={p.method}
                onChange={(e) =>
                  patch({ prayer: { ...p, method: e.currentTarget.value as PrayerMethod } })
                }
              >
                {(Object.keys(METHODS) as PrayerMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHODS[m].label}
                  </option>
                ))}
              </select>
            </div>
            <Segmented
              label="Asr"
              name="you-asr"
              value={p.asr}
              onChange={(asr) => patch({ prayer: { ...p, asr } })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'hanafi', label: 'Hanafi' },
              ]}
            />
          </div>
          {times && (
            <ol class="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Today's prayer times">
              {(Object.keys(PRAYER_LABEL) as PrayerName[]).map((k) => (
                <li key={k} class="surface-muted rounded-xl p-2 text-center">
                  <span class="text-subtle block text-[11px] font-semibold uppercase">
                    {PRAYER_LABEL[k]}
                  </span>
                  <span class="tabular block font-semibold">{clock(times[k])}</span>
                </li>
              ))}
            </ol>
          )}
          <p class="text-subtle text-xs">
            Calculated times can differ from your local mosque by a few minutes. When they do, the
            mosque is right.
          </p>
        </>
      )}
      <label class="flex items-start gap-3">
        <input
          type="checkbox"
          class="mt-0.5 h-5 w-5 accent-[var(--color-brand-600)]"
          checked={life.fasting}
          onChange={(e) => patch({ fasting: e.currentTarget.checked })}
        />
        <span>
          <span class="block font-semibold">I'm fasting (Ramadan mode)</span>
          <span class="text-muted block text-sm">
            Meals move to suhoor and iftar, training to after iftar, water to the evening.
          </span>
        </span>
      </label>
    </Card>
  );
}

function CheckIns({ life, patch }: { life: Life; patch: (p: Partial<Life>) => void }) {
  return (
    <Card
      id="checkins"
      icon="calendar"
      title="Check-ins"
      lede="One weigh-in a week is enough to see the trend. Photos show what the scale can't."
    >
      <div>
        <p class="label">Weekly weigh-in</p>
        <div class="grid grid-cols-7 gap-1" role="group" aria-label="Weigh-in day">
          {DAY_NAMES.map((n, d) => (
            <button
              key={n}
              type="button"
              aria-pressed={life.weighDay === d}
              class={`h-10 rounded-xl text-sm font-semibold ${
                life.weighDay === d
                  ? 'bg-brand-600 text-white'
                  : 'bg-muted text-muted hover:text-fg'
              }`}
              onClick={() => patch({ weighDay: d })}
            >
              {n}
              <span class="sr-only">{DAY_LONG[d]!.slice(3)}</span>
            </button>
          ))}
        </div>
      </div>
      <TimeField
        id="you-weigh"
        label="Weigh-in time"
        value={life.weighTime}
        onChange={(weighTime) => patch({ weighTime })}
      />
      <Segmented
        label="Progress photos"
        name="you-photos"
        value={String(life.photoWeeks) as '2' | '4' | '8'}
        onChange={(v) => patch({ photoWeeks: Number(v) })}
        options={[
          { value: '2', label: 'Every 2 weeks' },
          { value: '4', label: 'Every 4 weeks' },
          { value: '8', label: 'Every 8 weeks' },
        ]}
      />
      <p class="text-muted text-sm">
        Same time, same light, after the toilet and before food. Daily weigh-ins are fine too: the
        trend line on{' '}
        <a class="underline" href={withBase('/track/')}>
          Weight &amp; photos
        </a>{' '}
        smooths out the noise.
      </p>
    </Card>
  );
}

function Links() {
  const [{ setup }] = trainStore.use();
  const items: Array<{ href: string; icon: IconName; title: string; text: string }> = [
    {
      href: '/settings/',
      icon: 'scale',
      title: 'Body and calorie plan',
      text: 'Height, weight, activity and your daily target.',
    },
    {
      href: '/train/',
      icon: 'dumbbell',
      title: 'Training setup',
      text: setup
        ? `${setup.weekdays.length} days a week, ${setup.minutes} minutes.`
        : 'Not set up yet.',
    },
    {
      href: '/settings/#data',
      icon: 'shield',
      title: 'Your data',
      text: 'Back up, move to another device, or delete everything.',
    },
  ];
  return (
    <div class="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <a
          key={i.href}
          href={withBase(i.href)}
          class="surface pressable flex items-start gap-3 p-4"
        >
          <Icon
            name={i.icon}
            size={20}
            class="text-brand-600 dark:text-brand-300 mt-0.5 flex-none"
          />
          <span>
            <span class="block font-semibold">{i.title}</span>
            <span class="text-muted block text-sm">{i.text}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function YouProfileInner() {
  const [life, patch] = lifeStore.use();
  return (
    <div class="grid gap-6">
      <Links />
      <div class="grid items-start gap-6 lg:grid-cols-2">
        <div class="grid gap-6">
          <Goals life={life} patch={patch} />
          <Health life={life} patch={patch} />
        </div>
        <div class="grid gap-6">
          <Day life={life} patch={patch} />
          <Faith life={life} patch={patch} />
          <CheckIns life={life} patch={patch} />
        </div>
      </div>
      <p class="text-subtle text-center text-sm">
        <Icon name="lock" size={14} class="mr-1 inline" />
        Saved as you type, on this device only.
      </p>
    </div>
  );
}

export default function YouProfile() {
  return (
    <ErrorBoundary area="your profile">
      <YouProfileInner />
    </ErrorBoundary>
  );
}
