import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mealForTime, scale } from '@/lib/calc/nutrition';
import { addFood } from '@/lib/food-store';
import { loadFoods, searchFoods, type Food } from '@/lib/foods';
import { haptic } from '@/lib/fx';
import { todayIso } from '@/lib/plan';
import { withBase } from '@/lib/url';
import { TOOLS } from '@/lib/tools';
import { Icon, type IconName } from './ui/Icon';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

const PAGES: Array<{ label: string; href: string; icon: IconName; hint: string }> = [
  { label: 'Today', href: '/today/', icon: 'flame', hint: 'Log food, exercise, water' },
  { label: 'My plan', href: '/plan/', icon: 'target', hint: 'Targets, progress, two-week check' },
  { label: 'Weight tracker', href: '/track/', icon: 'scale', hint: 'Weigh-ins, trend, photos' },
  { label: 'Weekly review', href: '/review/', icon: 'calendar', hint: 'The week in five minutes' },
  { label: 'Settings & data', href: '/settings/', icon: 'shield', hint: 'Backup, share, install' },
  { label: 'Guides', href: '/guides/', icon: 'spark', hint: 'Evidence-based reading' },
  {
    label: 'Compare with other apps',
    href: '/compare/',
    icon: 'check',
    hint: 'Honest feature table',
  },
];

/** ⌘K / Ctrl+K launcher: jump anywhere, or type a food and log it to today without leaving the page. */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [foods, setFoods] = useState<Food[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener('ethereal:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ethereal:palette', onOpen);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    setQ('');
    setSel(0);
    setTimeout(() => input.current?.focus(), 20);
    loadFoods().then(() => setFoods(searchFoods('', 0)));
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    location.assign(withBase(href));
  };
  const commands = useMemo<Cmd[]>(() => {
    const n = q.trim().toLowerCase();
    const pages: Cmd[] = PAGES.filter(
      (p) => !n || `${p.label} ${p.hint}`.toLowerCase().includes(n),
    ).map((p) => ({
      id: `p-${p.href}`,
      label: p.label,
      ...(p.hint ? { hint: p.hint } : {}),
      icon: p.icon,
      run: () => go(p.href),
    }));
    const tools: Cmd[] = TOOLS.filter(
      (t) => !n || `${t.name} ${t.keywords.join(' ')}`.toLowerCase().includes(n),
    ).map((t) => ({
      id: `t-${t.slug}`,
      label: t.name,
      hint: t.short,
      icon: t.icon,
      run: () => go(`/tools/${t.slug}/`),
    }));
    const foodCmds: Cmd[] =
      n.length >= 2
        ? searchFoods(q, 6).map((f) => {
            const s = f.servings[0] ?? { label: '100 g', grams: 100 };
            const k = scale(f.per100g, s.grams).kcal;
            return {
              id: `f-${f.id}`,
              label: `Log ${f.name}`,
              hint: `${s.label} · ${k} kcal → today`,
              icon: 'flame',
              run: () => {
                addFood({
                  date: todayIso(),
                  meal: mealForTime(new Date().getHours()),
                  name: f.name,
                  grams: s.grams,
                  per100g: f.per100g,
                  source: 'local',
                  foodId: f.id,
                  time: new Date().getHours() * 60 + new Date().getMinutes(),
                });
                haptic();
                setOpen(false);
                if (!location.pathname.endsWith('/today/')) location.assign(withBase('/today/'));
              },
            };
          })
        : [];
    const theme: Cmd[] =
      !n || 'dark light theme'.includes(n)
        ? [
            {
              id: 'theme',
              label: 'Toggle dark mode',
              icon: 'moon',
              run: () => {
                const root = document.documentElement;
                const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
                root.dataset.theme = next;
                try {
                  localStorage.setItem('ethereal:theme', next);
                } catch {
                  /* ignore */
                }
                setOpen(false);
              },
            },
          ]
        : [];
    return [
      ...foodCmds,
      ...pages.slice(0, n ? 7 : 5),
      ...tools.slice(0, n ? 8 : 3),
      ...theme,
    ].slice(0, 14);
  }, [q, foods]);

  useEffect(() => setSel(0), [q]);
  if (!open) return null;
  return (
    <div
      class="fixed inset-0 z-[60] grid place-items-start justify-items-center bg-black/35 p-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Quick launcher"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div class="bg-elevated w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl">
        <div class="border-line flex items-center gap-3 border-b px-4">
          <Icon name="spark" size={18} class="text-subtle" />
          <input
            ref={input}
            class="h-14 w-full bg-transparent text-base outline-none"
            placeholder="Jump to a page, or type a food to log it…"
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(commands.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                commands[sel]?.run();
              }
            }}
            aria-label="Search pages and foods"
            aria-activedescendant={commands[sel] ? `cmd-${commands[sel].id}` : undefined}
            aria-controls="cmd-list"
            role="combobox"
            aria-expanded="true"
          />
          <kbd
            class="text-subtle hidden rounded-md border px-1.5 py-0.5 text-[10px] sm:inline"
            style="border-color: var(--border)"
          >
            esc
          </kbd>
        </div>
        <ul id="cmd-list" role="listbox" class="max-h-[50vh] overflow-y-auto p-2">
          {commands.length === 0 && <li class="text-subtle px-3 py-4 text-sm">No matches.</li>}
          {commands.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === sel}>
              <button
                type="button"
                class={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${i === sel ? 'bg-muted' : 'hover:bg-muted'}`}
                onMouseEnter={() => setSel(i)}
                onClick={c.run}
              >
                <span class="bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                  <Icon name={c.icon} size={16} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{c.label}</span>
                  {c.hint && <span class="text-subtle block truncate text-xs">{c.hint}</span>}
                </span>
                {i === sel && <Icon name="arrow" size={14} class="text-subtle" />}
              </button>
            </li>
          ))}
        </ul>
        <div class="border-line text-subtle flex items-center justify-between border-t px-4 py-2 text-[11px]">
          <span>↑↓ to move · ↵ to open · type a food to log it</span>
          <span>⌘K</span>
        </div>
      </div>
    </div>
  );
}
