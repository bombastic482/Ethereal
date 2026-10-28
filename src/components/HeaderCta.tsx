import { summariseDay } from '@/lib/calc/nutrition';
import { formatNumber } from '@/lib/calc/units';
import { diaryStore, prefsStore } from '@/lib/food-store';
import { buildPlanSummary, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { Icon } from './ui/Icon';

/** Header button: "Start free" for new visitors; calories left today for people with a plan. */
export default function HeaderCta({ compact = false }: { compact?: boolean }) {
  const [profile] = useProfile();
  const [plan] = planStore.use();
  const [diary] = diaryStore.use();
  const [prefs] = prefsStore.use();
  const cls = `h-10 px-4 text-sm ${compact ? '' : 'hidden sm:inline-flex'}`;
  if (!plan.active) {
    return (
      <a href={withBase('/start/')} class={`btn btn-primary ${cls}`}>
        Start free <Icon name="arrow" size={16} />
      </a>
    );
  }
  let label = 'Today';
  try {
    const s = buildPlanSummary(profile, plan);
    const today = todayIso();
    const d = summariseDay(
      diary.food.filter((e) => e.date === today),
      diary.exercise.filter((e) => e.date === today),
      {
        kcal: s.target,
        protein: s.macros.grams.protein,
        carbs: s.macros.grams.carbs,
        fat: s.macros.grams.fat,
        fibre: s.macros.grams.fibre,
      },
      prefs.eatBack,
    );
    label =
      d.remaining.kcal < 0
        ? `${formatNumber(-d.remaining.kcal)} kcal over`
        : `${formatNumber(d.remaining.kcal)} kcal left`;
  } catch {
    label = 'Today';
  }
  return (
    <a href={withBase('/today/')} class={`btn btn-secondary ${cls}`} aria-label="Open today">
      <Icon name="flame" size={16} />
      {label}
    </a>
  );
}
