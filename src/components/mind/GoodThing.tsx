import { useEffect, useState } from 'preact/hooks';
import { haptic } from '@/lib/fx';
import { GOOD_MAX, mindStore, saveGood } from '@/lib/mind';
import { Icon } from '../ui/Icon';

/**
 * One good thing from today, in a line, as the day winds down. Tomorrow morning Today shows it
 * back. It is never required, never scored and never streaked: it is there for the remembering.
 */
export function GoodThing({ date }: { date: string }) {
  const [{ goods }] = mindStore.use();
  const saved = goods[date] ?? '';
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(!saved);
  useEffect(() => {
    setText(saved);
    setEditing(!saved);
  }, [date]);

  if (!editing && saved)
    return (
      <div class="good-saved">
        <Icon name="spark" size={16} />
        <p class="min-w-0 flex-1">
          <span class="text-subtle block text-xs">Today's good thing</span>“{saved}”
        </p>
        <button
          type="button"
          class="btn btn-ghost h-9 px-3 text-sm"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      </div>
    );

  return (
    <form
      class="good-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        saveGood(date, text);
        setEditing(false);
        haptic([10, 30, 10]);
      }}
    >
      <label class="label mb-1" for={`good-${date}`}>
        One good thing from today
      </label>
      <div class="flex gap-2">
        <input
          id={`good-${date}`}
          class="field h-11"
          value={text}
          maxLength={GOOD_MAX}
          placeholder="Small counts: a walk, a call, a good meal"
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button type="submit" class="btn btn-secondary h-11 px-4" disabled={!text.trim()}>
          Keep
        </button>
      </div>
      <p class="text-subtle mt-1.5 text-xs">You'll see it again tomorrow morning.</p>
    </form>
  );
}
