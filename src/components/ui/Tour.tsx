import { useEffect, useState } from 'preact/hooks';
import { withBase } from '@/lib/url';
import { Icon, type IconName } from './Icon';

const KEY = 'ethereal:tour:v1';
const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'flame',
    title: 'Log in seconds',
    text: 'Type what you ate in plain words, scan a barcode, or search 1,500+ foods that work offline. The ring shows what is left.',
  },
  {
    icon: 'scale',
    title: 'Weigh in, ignore the noise',
    text: 'Daily weigh-ins are smoothed into a trend. A salty dinner will never look like failure again.',
  },
  {
    icon: 'target',
    title: 'Every two weeks, a decision',
    text: 'Ethereal compares your real trend with the plan and tells you the exact calorie change, capped and safe. On Sundays, the weekly review does it in five minutes.',
  },
];

/** Three-card first-run tour, shown once. Dismissible, keyboard accessible, no overlay tricks. */
export default function Tour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  const step = STEPS[i]!;
  return (
    <div
      class="fixed inset-0 z-50 grid place-items-end bg-black/30 p-3 backdrop-blur-sm sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div class="bg-elevated w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <div class="flex items-center justify-between">
          <span class="bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200 grid h-11 w-11 place-items-center rounded-2xl">
            <Icon name={step.icon} size={22} />
          </span>
          <button
            type="button"
            class="btn btn-ghost h-9 w-9 rounded-full p-0"
            onClick={close}
            aria-label="Skip tour"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <h2 id="tour-title" class="font-display mt-4 text-3xl tracking-tight">
          {step.title}
        </h2>
        <p class="text-muted mt-2 leading-relaxed">{step.text}</p>
        <div class="mt-6 flex items-center justify-between">
          <div class="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, k) => (
              <span
                key={k}
                class={`h-1.5 rounded-full transition-all ${k === i ? 'bg-brand-600 w-6' : 'bg-muted w-1.5'}`}
              />
            ))}
          </div>
          <div class="flex gap-2">
            {i < STEPS.length - 1 ? (
              <button type="button" class="btn btn-primary" onClick={() => setI(i + 1)}>
                Next <Icon name="arrow" size={16} />
              </button>
            ) : (
              <a href={withBase('/start/')} class="btn btn-primary" onClick={close}>
                Build my plan <Icon name="arrow" size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
