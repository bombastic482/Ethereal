import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/**
 * Shows `fallback` until the browser has taken over, then the real thing.
 *
 * Everything personal lives in this browser, so the server can only render an empty profile. For
 * screens about your own data that empty render would be a lie ("You don't have a plan yet",
 * "Nothing logged") flashed at people who do; a quiet placeholder of about the right size is
 * shown instead. Calculators skip this on purpose: their server render with sample numbers is
 * what search engines read.
 */
export function Hydrated({
  fallback,
  children,
}: {
  fallback: ComponentChildren;
  children: ComponentChildren;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <>{ready ? children : fallback}</>;
}

/** A calm placeholder card while personal data loads. */
export function Placeholder({ height, class: cls = '' }: { height: string; class?: string }) {
  return (
    <div class={`surface placeholder ${cls}`} style={{ height }} role="status">
      <span class="sr-only">Loading</span>
    </div>
  );
}
