import { useEffect, useMemo, useState } from 'preact/hooks';
import { calculateCalorieTarget } from '@/lib/calc/energy';
import {
  MACRO_PRESETS,
  macrosFromSplit,
  macrosProteinFirst,
  type MacroPresetKey,
  type MacroSplit,
} from '@/lib/calc/macros';
import { formatNumber } from '@/lib/calc/units';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { DonutChart } from '../ui/DonutChart';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { RangeField } from '../ui/RangeField';
import { ResultActions } from '../ui/ResultActions';
import { Segmented } from '../ui/Segmented';
import { SelectField } from '../ui/SelectField';
import { Stat } from '../ui/Stat';
import { withBase } from '@/lib/url';

type Mode = 'preset' | 'protein-first';

export default function MacroCalculator() {
  const [profile, update] = useProfile();
  const [useEstimate, setUseEstimate] = useState(true);
  const [calories, setCalories] = useState(1800);
  const [mode, setMode] = useState<Mode>('preset');
  const [preset, setPreset] = useState<MacroPresetKey>('high-protein');
  const [custom, setCustom] = useState<MacroSplit>({ protein: 35, carbs: 35, fat: 30 });
  const [proteinGkg, setProteinGkg] = useState(1.8);
  const [fatPct, setFatPct] = useState(30);

  const estimate = useMemo(() => {
    try {
      return calculateCalorieTarget({
        profile,
        activity: profile.activity,
        goal: 'lose',
        rateKgPerWeek: 0.5,
      }).target;
    } catch {
      return null;
    }
  }, [profile]);

  useEffect(() => {
    if (useEstimate && estimate) setCalories(estimate);
  }, [useEstimate, estimate]);

  const result = useMemo(() => {
    try {
      if (mode === 'protein-first')
        return macrosProteinFirst(calories, profile.weightKg, proteinGkg, fatPct);
      const split =
        preset === 'custom' ? custom : MACRO_PRESETS.find((p) => p.key === preset)!.split;
      return macrosFromSplit(calories, split, profile.weightKg);
    } catch {
      return null;
    }
  }, [mode, calories, profile.weightKg, proteinGkg, fatPct, preset, custom]);

  const summary = result
    ? `${result.calories} kcal/day → Protein ${result.grams.protein} g · Carbs ${result.grams.carbs} g · Fat ${result.grams.fat} g · Fibre ${result.grams.fibre} g (${result.split.protein}/${result.split.carbs}/${result.split.fat}). — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <div class="grid gap-5">
          <Segmented
            name="mac-src"
            label="Daily calories"
            options={[
              { value: 'est', label: 'Estimate for me', hint: '0.5 kg/week loss' },
              { value: 'manual', label: 'I know my target' },
            ]}
            value={useEstimate ? 'est' : 'manual'}
            onChange={(v) => setUseEstimate(v === 'est')}
          />
          {useEstimate ? (
            <ProfileFields profile={profile} update={update} idPrefix="mac" />
          ) : (
            <>
              <NumberField
                id="mac-cal"
                label="Calories per day"
                value={calories}
                min={800}
                max={6000}
                dp={0}
                inputMode="numeric"
                suffix="kcal"
                onChange={setCalories}
              />
              <ProfileFields
                profile={profile}
                update={update}
                show={['units', 'weight']}
                idPrefix="mac"
              />
            </>
          )}
          <Segmented
            name="mac-mode"
            label="Method"
            options={[
              { value: 'preset', label: 'Percentage split' },
              { value: 'protein-first', label: 'Protein first', hint: 'Coach method' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'preset' ? (
            <>
              <SelectField
                id="mac-preset"
                label="Preset"
                value={preset}
                options={MACRO_PRESETS.map((p) => ({
                  value: p.key,
                  label: `${p.label} · ${p.split.protein}/${p.split.carbs}/${p.split.fat}`,
                  description: p.description,
                }))}
                onChange={setPreset}
              />
              {preset === 'custom' && (
                <div class="grid gap-3">
                  <RangeField
                    id="mac-p"
                    label="Protein"
                    value={custom.protein}
                    min={10}
                    max={60}
                    onChange={(protein) => setCustom({ ...custom, protein })}
                    format={(v) => `${v}%`}
                  />
                  <RangeField
                    id="mac-c"
                    label="Carbs"
                    value={custom.carbs}
                    min={0}
                    max={70}
                    onChange={(carbs) => setCustom({ ...custom, carbs })}
                    format={(v) => `${v}%`}
                  />
                  <RangeField
                    id="mac-f"
                    label="Fat"
                    value={custom.fat}
                    min={10}
                    max={75}
                    onChange={(fat) => setCustom({ ...custom, fat })}
                    format={(v) => `${v}%`}
                    hint="Percentages are normalised to 100% automatically."
                  />
                </div>
              )}
            </>
          ) : (
            <div class="grid gap-3">
              <RangeField
                id="mac-gkg"
                label="Protein per kg body weight"
                value={proteinGkg}
                min={1}
                max={2.6}
                step={0.1}
                onChange={setProteinGkg}
                format={(v) => `${v.toFixed(1)} g/kg`}
                hint="1.6–2.2 g/kg for fat loss; higher if you're lean and training hard."
              />
              <RangeField
                id="mac-fat"
                label="Fat share of calories"
                value={fatPct}
                min={15}
                max={45}
                step={1}
                onChange={setFatPct}
                format={(v) => `${v}%`}
                hint="Keep fat at 20–35% for hormones and satiety. Carbs fill the rest."
              />
            </div>
          )}
        </div>
      }
      results={
        result ? (
          <div class="grid gap-6">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <Stat
                label="Daily calories"
                value={formatNumber(result.calories)}
                unit="kcal"
                size="lg"
                tone="brand"
              />
              <Stat
                label="Protein per kg"
                value={result.gramsPerKg.protein.toFixed(2)}
                unit="g/kg"
                sub={
                  result.gramsPerKg.protein < 1.6
                    ? 'Below 1.6 g/kg: consider more'
                    : 'Solid for fat loss'
                }
              />
            </div>
            <DonutChart
              centerValue={`${result.grams.protein}g`}
              centerLabel="PROTEIN"
              slices={[
                { label: 'Protein', value: result.kcal.protein, color: 'var(--color-brand-500)' },
                { label: 'Carbs', value: result.kcal.carbs, color: 'var(--color-accent-500)' },
                { label: 'Fat', value: result.kcal.fat, color: 'oklch(80% 0.15 85)' },
              ]}
            />
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Protein"
                value={result.grams.protein}
                unit="g"
                sub={`${formatNumber(result.kcal.protein)} kcal`}
              />
              <Stat
                label="Carbs"
                value={result.grams.carbs}
                unit="g"
                sub={`${formatNumber(result.kcal.carbs)} kcal`}
              />
              <Stat
                label="Fat"
                value={result.grams.fat}
                unit="g"
                sub={`${formatNumber(result.kcal.fat)} kcal`}
              />
              <Stat label="Fibre" value={result.grams.fibre} unit="g" sub="14 g per 1,000 kcal" />
            </div>
            <Callout>
              Protein and fibre are the numbers that matter most. Hit them daily, then let carbs and
              fat float with your appetite and training. Need a protein target on its own? Try the{' '}
              <a class="underline" href={withBase('/tools/protein/')}>
                protein calculator
              </a>
              .
            </Callout>
            <ResultActions summary={summary} onReset={resetProfile} />
          </div>
        ) : (
          <Callout tone="warn">Enter a valid calorie target and weight.</Callout>
        )
      }
    />
  );
}
