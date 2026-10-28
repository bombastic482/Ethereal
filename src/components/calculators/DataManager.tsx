import { useEffect, useState } from 'preact/hooks';
import { MACRO_PRESETS } from '@/lib/calc/macros';
import { buildShareLink, clearAllData, createBackup, logToCsv, restoreBackup } from '@/lib/backup';
import { diaryStore, foodCsv, prefsStore } from '@/lib/food-store';
import { logStore } from '@/lib/log';
import { planStore } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { Callout } from '../ui/Callout';
import { Icon } from '../ui/Icon';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { Segmented } from '../ui/Segmented';
import { SelectField } from '../ui/SelectField';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DataManager() {
  const [profile, update] = useProfile();
  const [plan, patchPlan] = planStore.use();
  const [log] = logStore.use();
  const [diary] = diaryStore.use();
  const [prefs, patchPrefs] = prefsStore.use();
  const [msg, setMsg] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [install, setInstall] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const say = (tone: 'success' | 'warn', text: string) => {
    setMsg({ tone, text });
    setTimeout(() => setMsg(null), 4000);
  };
  const stamp = new Date().toISOString().slice(0, 10);

  const importFile = (file: File | undefined) => {
    if (!file) return;
    file
      .text()
      .then((t) => {
        const ok = restoreBackup(JSON.parse(t));
        say(
          ok ? 'success' : 'warn',
          ok ? 'Backup restored.' : 'That file is not an Ethereal backup.',
        );
      })
      .catch(() => say('warn', 'Could not read that file.'));
  };

  const share = async () => {
    const link = buildShareLink(new URL(withBase('/start/'), location.origin).toString());
    try {
      if (navigator.share) await navigator.share({ title: 'My Ethereal plan', url: link });
      else {
        await navigator.clipboard.writeText(link);
        say('success', 'Link copied. Open it on your other device to import your plan.');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div class="grid gap-6 lg:grid-cols-2">
      <section class="surface grid gap-5 p-5 sm:p-6" aria-label="Profile">
        <h2 class="text-lg font-bold tracking-tight">Profile</h2>
        <ProfileFields profile={profile} update={update} idPrefix="st" />
        <NumberField
          id="st-bf"
          label="Body fat (optional)"
          value={profile.bodyFatPercent ?? 25}
          min={3}
          max={70}
          suffix="%"
          onChange={(bodyFatPercent) => update({ bodyFatPercent })}
          hint="Unlocks the Katch-McArdle formula and lean-mass protein targets."
        />
      </section>

      <section class="surface grid gap-5 p-5 sm:p-6" aria-label="Plan settings">
        <h2 class="text-lg font-bold tracking-tight">Plan</h2>
        {plan.active ? (
          <>
            <SelectField
              id="st-preset"
              label="Macro style"
              value={plan.macroPreset}
              options={MACRO_PRESETS.filter((m) => m.key !== 'custom').map((m) => ({
                value: m.key,
                label: `${m.label} · ${m.split.protein}/${m.split.carbs}/${m.split.fat}`,
                description: m.description,
              }))}
              onChange={(macroPreset) => patchPlan({ macroPreset })}
            />
            <Segmented
              name="st-formula"
              label="BMR formula"
              columns={3}
              options={[
                { value: 'mifflin', label: 'Mifflin-St Jeor' },
                { value: 'harris', label: 'Harris-Benedict' },
                { value: 'katch', label: 'Katch-McArdle' },
              ]}
              value={plan.formula}
              onChange={(formula) => patchPlan({ formula })}
            />
            <p class="text-subtle text-xs">
              Goal, pace and starting point are edited from the plan page.
            </p>
            <a href={withBase('/start/')} class="btn btn-secondary justify-self-start text-sm">
              Edit goal and pace
            </a>
          </>
        ) : (
          <Callout>
            No active plan.{' '}
            <a class="underline" href={withBase('/start/')}>
              Build one in a minute
            </a>
            .
          </Callout>
        )}
      </section>

      <section class="surface grid gap-5 p-5 sm:p-6" aria-label="Food diary">
        <h2 class="text-lg font-bold tracking-tight">Food diary</h2>
        <Segmented
          name="st-diet"
          label="Diet (for suggestions)"
          options={[
            { value: 'omnivore', label: 'Omnivore' },
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
            checked={prefs.eatBack}
            onChange={(e) => patchPrefs({ eatBack: (e.target as HTMLInputElement).checked })}
          />
          <span>
            <span class="font-semibold">Add exercise calories to my daily target</span>
            <span class="text-muted block text-xs">
              Off by default. MET estimates and watches run 20–40% high, and your activity level
              already covers routine training.
            </span>
          </span>
        </label>
        <NumberField
          id="st-water"
          label="Water goal"
          value={prefs.waterGoalGlasses}
          min={2}
          max={20}
          dp={0}
          suffix="glasses"
          onChange={(waterGoalGlasses) => patchPrefs({ waterGoalGlasses })}
          hint="250 ml glasses. 8 is a sensible default for most adults."
        />
      </section>

      <section class="surface grid gap-4 p-5 sm:p-6" aria-label="Your data">
        <h2 class="text-lg font-bold tracking-tight">Your data</h2>
        <p class="text-muted text-sm">
          {log.entries.length} weigh-in{log.entries.length === 1 ? '' : 's'} and {diary.food.length}{' '}
          food entr{diary.food.length === 1 ? 'y' : 'ies'} stored on this device. Nothing is
          uploaded anywhere, which also means <strong>we cannot recover it for you</strong>: export
          a backup now and then.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-secondary text-sm"
            onClick={() =>
              download(
                `ethereal-backup-${stamp}.json`,
                JSON.stringify(createBackup(), null, 2),
                'application/json',
              )
            }
          >
            <Icon name="copy" size={16} /> Export backup (JSON)
          </button>
          <button
            type="button"
            class="btn btn-secondary text-sm"
            onClick={() => download(`ethereal-weights-${stamp}.csv`, logToCsv(log), 'text/csv')}
            disabled={log.entries.length === 0}
          >
            Export weigh-ins (CSV)
          </button>
          <button
            type="button"
            class="btn btn-secondary text-sm"
            onClick={() => download(`ethereal-food-${stamp}.csv`, foodCsv(diary.food), 'text/csv')}
            disabled={diary.food.length === 0}
          >
            Export food diary (CSV)
          </button>
          <label class="btn btn-secondary cursor-pointer text-sm">
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              class="sr-only"
              onChange={(e) => importFile((e.target as HTMLInputElement).files?.[0])}
            />
          </label>
          <button type="button" class="btn btn-secondary text-sm" onClick={share}>
            <Icon name="spark" size={16} /> Share plan to another device
          </button>
        </div>
        {msg && <Callout tone={msg.tone}>{msg.text}</Callout>}
      </section>

      <section class="surface grid gap-4 p-5 sm:p-6" aria-label="App">
        <h2 class="text-lg font-bold tracking-tight">Install as an app</h2>
        <p class="text-muted text-sm">
          Ethereal works offline and can sit on your home screen like any app, with no app store and
          no account.
        </p>
        {installed ? (
          <Callout tone="success">Installed. Open it from your home screen or app list.</Callout>
        ) : install ? (
          <button
            type="button"
            class="btn btn-primary justify-self-start"
            onClick={() => install.prompt()}
          >
            <Icon name="bolt" size={16} /> Install Ethereal
          </button>
        ) : (
          <p class="text-subtle text-xs">
            On iPhone: Share → "Add to Home Screen". On Android and desktop Chrome: the install icon
            in the address bar.
          </p>
        )}
        <div class="border-line mt-2 border-t pt-4">
          <h3 class="font-semibold">Delete everything</h3>
          <p class="text-muted mt-1 text-sm">
            Removes your profile, plan and all weigh-ins from this browser.
          </p>
          {confirmDelete ? (
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                class="btn bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => {
                  clearAllData();
                  setConfirmDelete(false);
                  say('success', 'All data deleted.');
                }}
              >
                Yes, delete all my data
              </button>
              <button type="button" class="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              class="btn btn-ghost mt-3 text-sm text-rose-700 dark:text-rose-300"
              onClick={() => setConfirmDelete(true)}
            >
              Delete all data…
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
