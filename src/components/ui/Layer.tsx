import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';

/**
 * Renders overlay content on <body>. Page regions carry a view-transition-name, which makes
 * them stacking contexts, so a fixed overlay inside one would paint under the header and tab
 * bar whatever its z-index. Portalling out of the region sidesteps that for every modal.
 */
export function Layer({ children }: { children: ComponentChildren }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
