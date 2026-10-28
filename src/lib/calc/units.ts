/**
 * Unit conversion and formatting helpers.
 * All internal calculations are metric (kg, cm). Convert at the edges.
 */

export type UnitSystem = 'metric' | 'imperial';
export type Sex = 'male' | 'female';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const inToCm = (inches: number): number => inches * CM_PER_IN;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const feetInchesToCm = (feet: number, inches: number): number => inToCm(feet * 12 + inches);

/** Split centimetres into whole feet and inches to the nearest half inch, carrying 12in over. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = Math.round(cmToIn(cm) * 10) / 10;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round((totalIn - feet * 12) * 2) / 2;
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

/** Round to `dp` decimal places, avoiding floating-point artefacts such as 1.005 -> 1.00. */
export function round(value: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/** Format a weight in the chosen unit system, e.g. "72.5 kg" or "160 lb". */
export function formatWeight(kg: number, units: UnitSystem, dp = 1): string {
  return units === 'metric' ? `${round(kg, dp)} kg` : `${round(kgToLb(kg), dp)} lb`;
}

/** Format a height in the chosen unit system, e.g. "178 cm" or "5 ft 10 in". */
export function formatHeight(cm: number, units: UnitSystem): string {
  if (units === 'metric') return `${round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet} ft ${inches} in`;
}

export function formatNumber(value: number, dp = 0): string {
  return round(value, dp).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
