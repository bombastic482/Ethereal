import { useEffect, useMemo, useState, useRef } from 'preact/hooks';
import { ACTIVITY_LEVELS, type Goal } from '@/lib/calc/energy';
import { MACRO_PRESETS } from '@/lib/calc/macros';
import { humaniseWeeks } from '@/lib/calc/timeline';
import { formatNumber, formatWeight, kgToLb, lbToKg, round } from '@/lib/calc/units';
import { readShareLink } from '@/lib/backup';
import { prefsStore } from '@/lib/food-store';
import { upsertEntry } from '@/lib/log';
import { buildPlanSummary, planStore, todayIso, DEFAULT_PLAN } from '@/lib/plan';
import { updateProfile, useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { Callout } from '../ui/Callout';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { RangeField } from '../ui/RangeField';
import { Segmented } from '../ui/Segmented';
import { SelectField } from '../ui/SelectField';
import { Stat } from '../ui/Stat';

const STEPS = ['About you', 'Your goal', 'Your plan'] as const;

function OnboardingInner() {
  const [profile, update] = useProfile();
  const [plan, patchPlan] = planStore.use();
  const [prefs, patchPrefs] = prefsStore.use();
  const [step, setStep] = useState(0);
  const [imported, setImported] = useState(false);
  const imperial = profile.units === 'imperial';
  const editing = plan.active;

  // A share link (#import=…) pre-fills everything.
  useEffect(() => {
    const shared = readShareLink();
    if (shared) {
      updateProfile(shared.profile);
      patchPlan({ ...shared.plan, active: false });
      setImported(true);
      history.replaceState(null, '', location.pathname);
    }
  }, []);

  // Sensible default goal weight the first time through.
  const goalTouched = useRef(false);
  useEffect(() => {
    if (goalTouched.current) return;
    if (
      !plan.active &&
      plan.goalWeightKg === DEFAULT_PLAN.goalWeightKg &&
      profile.weightKg !== 78
    ) {
      patchPlan({ goalWeightKg: round(profile.weightKg * 0.9, 1) });
    }
  }, [profile.weightKg]);

  const summary = useMemo(() => {
    try {
      return buildPlanSummary(profile, { ...plan, calorieOverride: null });
    } catch {
      return null;
    }
  }, [profile, plan]);

  const rateLabel = (v: number) => (imperial ? `${round(kgToLb(v), 1)} lb/week` : `${v} kg/week`);
  const goalInvalid =
    plan.goal === 'lose'
      ? plan.goalWeightKg >= profile.weightKg
      : plan.goal === 'gain'
        ? plan.goalWeightKg <= profile.weightKg
        : false;

  const start = () => {
    const today = todayIso();
    patchPlan({
      active: true,
      startedOn: editing ? plan.startedOn : today,
      startWeightKg: editing ? plan.startWeightKg : profile.weightKg,
      calorieOverride: null,
      lastAdjustedOn: null,
    });
    if (!editing) upsertEntry({ date: today, weightKg: profile.weightKg });
    location.assign(withBase('/plan/'));
  };

  return (
    <div class="mx-auto max-w-2xl">
      <ol class="mb-8 flex items-center gap-2 text-sm" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} class="flex flex-1 items-center gap-2">
            <span
              class={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-800 dark:bg-brand-400/20 dark:text-brand-100 ring-brand-500 ring-2' : 'bg-muted text-subtle'}`}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span
              class={`hidden sm:inline ${i === step ? 'text-fg font-semibold' : 'text-subtle'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span class="bg-line mx-1 h-px flex-1" style="background: var(--border)" />
            )}
          </li>
        ))}
      </ol>

      {imported && (
        <Callout tone="success" title="Plan imported from your link" class="mb-6">
          Check the details below, then start the plan on this device.
        </Callout>
      )}

      <section class="surface p-6 sm:p-8">
        {step === 0 && (
          <div class="grid gap-6">
            <header>
              <h2 class="font-display text-3xl tracking-tight">About you</h2>
              <p class="text-muted mt-1 text-sm">
                Used only to estimate your energy needs. Saved on this device, never sent anywhere.
              </p>
            </header>
            <ProfileFields
              profile={profile}
              update={update}
              show={['units', 'sex', 'age', 'height', 'weight']}
              idPrefix="ob"
            />
            <SelectField
              id="ob-activity"
              label="Typical activity"
              value={profile.activity}
              options={ACTIVITY_LEVELS.map((a) => ({
                value: a.key,
                label: a.label,
                description: a.description,
              }))}
              onChange={(activity) => update({ activity })}
              hint="Be honest: most people overestimate. Desk job plus three gym sessions is 'Lightly active'."
            />
            <Segmented
              name="ob-diet"
              label="How do you eat?"
              options={[
                { value: 'omnivore', label: 'Everything' },
                { value: 'vegetarian', label: 'Vegetarian' },
                { value: 'vegan', label: 'Vegan' },
              ]}
              value={prefs.diet}
              onChange={(diet) => patchPrefs({ diet })}
            />
            <label class="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                class="accent-brand-600 mt-0.5 h-4 w-4"
                checked={prefs.halal}
                onChange={(e) => patchPrefs({ halal: (e.target as HTMLInputElement).checked })}
              />
              <span>
                <span class="font-semibold">Halal</span>
                <span class="text-muted block text-xs">
                  No pork, gelatin sweets or alcohol anywhere on the site.
                </span>
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div class="grid gap-6">
            <header>
              <h2 class="font-display text-3xl tracking-tight">Your goal</h2>
              <p class="text-muted mt-1 text-sm">
                Pick a pace you can hold for months, not weeks. Slower almost always wins.
              </p>
            </header>
            <Segmented
              name="ob-goal"
              label="I want to"
              options={[
                { value: 'lose', label: 'Lose fat' },
                { value: 'maintain', label: 'Maintain' },
                { value: 'gain', label: 'Build muscle' },
              ]}
              value={plan.goal}
              onChange={(goal: Goal) =>
                patchPlan({
                  goal,
                  rateKgPerWeek:
                    goal === 'gain' ? Math.min(plan.rateKgPerWeek, 0.5) : plan.rateKgPerWeek,
                })
              }
            />
            {plan.goal !== 'maintain' && (
              <>
                {imperial ? (
                  <NumberField
                    id="ob-goalw"
                    label="Goal weight"
                    value={kgToLb(plan.goalWeightKg)}
                    min={55}
                    max={880}
                    step={0.5}
                    suffix="lb"
                    onChange={(lb) => {
                      goalTouched.current = true;
                      patchPlan({ goalWeightKg: lbToKg(lb) });
                    }}
                  />
                ) : (
                  <NumberField
                    id="ob-goalw"
                    label="Goal weight"
                    value={plan.goalWeightKg}
                    min={25}
                    max={400}
                    step={0.1}
                    suffix="kg"
                    onChange={(goalWeightKg) => {
                      goalTouched.current = true;
                      patchPlan({ goalWeightKg });
                    }}
                  />
                )}
                {goalInvalid && (
                  <Callout tone="warn">
                    Your goal weight should be {plan.goal === 'lose' ? 'below' : 'above'} your
                    current weight of {formatWeight(profile.weightKg, profile.units)}.
                  </Callout>
                )}
                <RangeField
                  id="ob-rate"
                  label={plan.goal === 'lose' ? 'Weekly loss' : 'Weekly gain'}
                  value={plan.rateKgPerWeek}
                  min={0.1}
                  max={plan.goal === 'lose' ? 1 : 0.5}
                  step={0.05}
                  onChange={(rateKgPerWeek) => patchPlan({ rateKgPerWeek })}
                  format={rateLabel}
                  hint={`${round((plan.rateKgPerWeek / profile.weightKg) * 100, 2)}% of body weight per week. 0.5–1% keeps muscle and sanity.`}
                />
              </>
            )}
          </div>
        )}

        {step === 2 && summary && (
          <div class="grid gap-6">
            <header>
              <h2 class="font-display text-3xl tracking-tight">Your plan</h2>
              <p class="text-muted mt-1 text-sm">
                Here is what the numbers say. You can change the macro style now or any time in
                settings.
              </p>
            </header>
            <div class="surface-muted grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
              <Stat
                label="Eat per day"
                value={formatNumber(summary.target)}
                unit="kcal"
                tone="brand"
              />
              <Stat label="Protein" value={summary.protein.target} unit="g" />
              <Stat label="Maintenance" value={formatNumber(summary.tdee)} unit="kcal" />
              <Stat
                label={plan.goal === 'maintain' ? 'Goal' : 'Goal date'}
                value={
                  plan.goal === 'maintain'
                    ? 'Hold steady'
                    : summary.timeline?.reached && summary.timeline.weeksToGoal
                      ? humaniseWeeks(summary.timeline.weeksToGoal)
                      : '—'
                }
              />
            </div>
            <SelectField
              id="ob-preset"
              label="Macro style"
              value={plan.macroPreset}
              options={MACRO_PRESETS.filter((m) => m.key !== 'custom').map((m) => ({
                value: m.key,
                label: `${m.label} · ${m.split.protein}/${m.split.carbs}/${m.split.fat}`,
                description: m.description,
              }))}
              onChange={(macroPreset) => patchPlan({ macroPreset })}
            />
            <div class="grid grid-cols-3 gap-4">
              <Stat label="Protein" value={summary.macros.grams.protein} unit="g" />
              <Stat label="Carbs" value={summary.macros.grams.carbs} unit="g" />
              <Stat label="Fat" value={summary.macros.grams.fat} unit="g" />
            </div>
            {summary.warnings.map((w) => (
              <Callout key={w} tone="warn">
                {w}
              </Callout>
            ))}
            <Callout>
              <strong>How the plan works.</strong> Eat close to {formatNumber(summary.target)} kcal,
              hit your protein, and weigh in each morning. After two weeks Ethereal compares your
              trend to the plan and tells you exactly what to change, if anything.
            </Callout>
          </div>
        )}

        <div class="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            class="btn btn-ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-disabled={step === 0}
          >
            Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              class="btn btn-primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && goalInvalid}
            >
              Continue <Icon name="arrow" size={16} />
            </button>
          ) : (
            <button type="button" class="btn btn-primary" onClick={start} disabled={!summary}>
              {editing ? 'Save changes' : 'Start my plan'} <Icon name="check" size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Onboarding() {
  return (
    <ErrorBoundary area="the plan builder">
      <OnboardingInner />
    </ErrorBoundary>
  );
}
