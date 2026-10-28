import { formatNumber } from '@/lib/calc/units';
import { buildPlanSummary, planStore } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { Icon } from './ui/Icon';

/** Header button: "Start free" for new visitors, a live calorie target for people with a plan. */
export default function HeaderCta({ compact = false }: { compact?: boolean }) {
  const [profile] = useProfile();
  const [plan] = planStore.use();
  if (!plan.active) {
    return (
      <a
        href={withBase('/start/')}
        class={`btn btn-primary h-10 px-4 text-sm ${compact ? '' : 'hidden sm:inline-flex'}`}
      >
        Start free <Icon name="arrow" size={16} />
      </a>
    );
  }
  let target: number | null = null;
  try {
    target = buildPlanSummary(profile, plan).target;
  } catch {
    target = null;
  }
  return (
    <a
      href={withBase('/plan/')}
      class={`btn btn-secondary h-10 px-4 text-sm ${compact ? '' : 'hidden sm:inline-flex'}`}
      aria-label="Open my plan"
    >
      <Icon name="target" size={16} />
      {target ? `${formatNumber(target)} kcal` : 'My plan'}
    </a>
  );
}
