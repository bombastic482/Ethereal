import { useMemo, useState } from 'preact/hooks';
import { daysBetween, trendSeries } from '@/lib/calc/trend';
import { humaniseWeeks } from '@/lib/calc/timeline';
import { kgToLb, round } from '@/lib/calc/units';
import { haptic } from '@/lib/fx';
import { logStore } from '@/lib/log';
import { planStore } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { renderShareCard, shareCanvas } from '@/lib/share-card';
import { Icon } from '../ui/Icon';

/** "Share my progress": renders a card on a canvas and hands it to the share sheet (or downloads it). */
export default function ShareProgress() {
  const [profile] = useProfile();
  const [plan] = planStore.use();
  const [log] = logStore.use();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const imperial = profile.units === 'imperial';
  const trend = useMemo(() => trendSeries(log.entries), [log.entries]);

  if (trend.length < 2) return null;
  const first = trend[0]!;
  const last = trend[trend.length - 1]!;
  const changeKg = round(last.trendKg - first.trendKg, 1);
  const days = daysBetween(first.date, last.date);
  const unit = imperial ? 'lb' : 'kg';
  const fmt = (kg: number) => (imperial ? round(kgToLb(kg), 1) : round(kg, 1));
  const title = `${Math.abs(fmt(changeKg))} ${unit} ${changeKg <= 0 ? 'down' : 'up'}`;
  const subtitle = `in ${humaniseWeeks(Math.max(1, Math.round(days / 7)))} · ${log.entries.length} weigh-ins`;

  const build = () =>
    renderShareCard({
      title,
      subtitle,
      points: imperial
        ? trend.map((p) => ({ ...p, trendKg: kgToLb(p.trendKg), weightKg: kgToLb(p.weightKg) }))
        : trend,
      unit,
      dark: document.documentElement.dataset.theme === 'dark',
      stats: [
        ['Start', `${fmt(first.trendKg)} ${unit}`],
        ['Now', `${fmt(last.trendKg)} ${unit}`],
        [
          plan.active && plan.goal !== 'maintain' ? 'Goal' : 'Days',
          plan.active && plan.goal !== 'maintain'
            ? `${fmt(plan.goalWeightKg)} ${unit}`
            : String(days),
        ],
      ],
    });

  const share = async () => {
    setState('busy');
    try {
      await document.fonts?.ready;
      const canvas = build();
      setPreview(canvas.toDataURL('image/png'));
      await shareCanvas(canvas);
      haptic();
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('idle');
    }
  };

  return (
    <section class="surface p-5 sm:p-6" aria-label="Share progress">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-bold tracking-tight">Share your progress</h3>
          <p class="text-subtle text-xs">
            A clean card with your trend, generated on your device. Nothing is uploaded unless you
            share it.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-primary text-sm"
          onClick={share}
          disabled={state === 'busy'}
        >
          <Icon name={state === 'done' ? 'check' : 'spark'} size={16} />{' '}
          {state === 'busy' ? 'Rendering…' : state === 'done' ? 'Ready' : 'Create card'}
        </button>
      </div>
      {preview && (
        <img
          src={preview}
          alt="Preview of your progress card"
          class="mx-auto mt-4 w-full max-w-xs rounded-2xl shadow-lg"
        />
      )}
    </section>
  );
}
