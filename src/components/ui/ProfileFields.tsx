import { ACTIVITY_LEVELS } from '@/lib/calc/energy';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, type UnitSystem } from '@/lib/calc/units';
import type { Profile } from '@/lib/profile';
import { NumberField } from './NumberField';
import { Segmented } from './Segmented';
import { SelectField } from './SelectField';

interface Props {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  show?: Array<'units' | 'sex' | 'age' | 'height' | 'weight' | 'activity'>;
  /** Prefix for input ids so several calculators can coexist on one page. */
  idPrefix?: string;
}

const UNIT_OPTS = [
  { value: 'metric', label: 'Metric', hint: 'kg · cm' },
  { value: 'imperial', label: 'Imperial', hint: 'lb · ft/in' },
] as const satisfies ReadonlyArray<{ value: UnitSystem; label: string; hint: string }>;

const SEX_OPTS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;

/** Shared inputs backed by the persisted profile. Every calculator uses this so stats are typed once. */
export function ProfileFields({
  profile,
  update,
  show = ['units', 'sex', 'age', 'height', 'weight', 'activity'],
  idPrefix = 'p',
}: Props) {
  const has = (k: (typeof show)[number]) => show.includes(k);
  const imperial = profile.units === 'imperial';
  const { feet, inches } = cmToFeetInches(profile.heightCm);
  return (
    <div class="grid gap-5">
      {has('units') && (
        <Segmented
          name={`${idPrefix}-units`}
          label="Units"
          options={UNIT_OPTS}
          value={profile.units}
          onChange={(units) => update({ units })}
        />
      )}
      {has('sex') && (
        <Segmented
          name={`${idPrefix}-sex`}
          label="Sex"
          options={SEX_OPTS}
          value={profile.sex}
          onChange={(sex) => update({ sex })}
        />
      )}
      <div class="grid grid-cols-2 gap-4">
        {has('age') && (
          <NumberField
            id={`${idPrefix}-age`}
            label="Age"
            value={profile.age}
            min={13}
            max={120}
            dp={0}
            inputMode="numeric"
            suffix="years"
            onChange={(age) => update({ age })}
          />
        )}
        {has('weight') &&
          (imperial ? (
            <NumberField
              id={`${idPrefix}-weight`}
              label="Weight"
              value={kgToLb(profile.weightKg)}
              min={55}
              max={880}
              step={0.5}
              suffix="lb"
              onChange={(lb) => update({ weightKg: lbToKg(lb) })}
            />
          ) : (
            <NumberField
              id={`${idPrefix}-weight`}
              label="Weight"
              value={profile.weightKg}
              min={25}
              max={400}
              step={0.1}
              suffix="kg"
              onChange={(weightKg) => update({ weightKg })}
            />
          ))}
      </div>
      {has('height') &&
        (imperial ? (
          <div class="grid grid-cols-2 gap-4">
            <NumberField
              id={`${idPrefix}-ft`}
              label="Height"
              value={feet}
              min={3}
              max={8}
              dp={0}
              inputMode="numeric"
              suffix="ft"
              onChange={(f) => update({ heightCm: feetInchesToCm(f, inches) })}
            />
            <NumberField
              id={`${idPrefix}-in`}
              label="&nbsp;"
              value={inches}
              min={0}
              max={11.9}
              step={0.5}
              suffix="in"
              onChange={(i) => update({ heightCm: feetInchesToCm(feet, i) })}
            />
          </div>
        ) : (
          <NumberField
            id={`${idPrefix}-height`}
            label="Height"
            value={profile.heightCm}
            min={100}
            max={260}
            dp={0}
            inputMode="numeric"
            suffix="cm"
            onChange={(heightCm) => update({ heightCm })}
          />
        ))}
      {has('activity') && (
        <SelectField
          id={`${idPrefix}-activity`}
          label="Activity level"
          value={profile.activity}
          options={ACTIVITY_LEVELS.map((a) => ({
            value: a.key,
            label: `${a.label} (×${a.multiplier})`,
            description: a.description,
          }))}
          onChange={(activity) => update({ activity })}
        />
      )}
    </div>
  );
}
