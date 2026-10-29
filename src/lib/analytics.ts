/**
 * Anonymous page counts, sent to GoatCounter (open source, no cookies, stores no IP addresses).
 *
 * One ping per page view carries the page path, the page title, the referring site when it is
 * another site, and the screen size. Nothing anyone types, logs or weighs ever leaves the browser,
 * and there is no identifier to follow a visitor from one page or day to the next.
 *
 * Counting is off unless a GoatCounter code is set, and it never runs off the site's own host
 * (local builds, previews, forks), in automated browsers, when the browser sends Do Not Track or
 * Global Privacy Control, or when the visitor turns it off in Settings.
 */
import { createStore } from './store';

/** The GoatCounter site code, as in https://<code>.goatcounter.com. Empty turns counting off. */
export const GOATCOUNTER_CODE: string = 'ethereal';

export const analyticsStore = createStore<{ enabled: boolean }>('ethereal:analytics:v1', {
  enabled: true,
});

export interface CountContext {
  code: string;
  enabled: boolean;
  hostname: string;
  siteHostname: string;
  webdriver: boolean;
  doNotTrack: boolean;
}

/** Whether this page view may be counted at all. */
export function mayCount(c: CountContext): boolean {
  return (
    c.code !== '' && c.enabled && !c.webdriver && !c.doNotTrack && c.hostname === c.siteHostname
  );
}

export interface PageView {
  /** Path within the site, without the base path, query or hash: "/today/". */
  path: string;
  title: string;
  /** The referring page; only another site's origin is kept. */
  referrer: string;
  origin: string;
  screen: string;
}

/** The GoatCounter count URL for one page view. */
export function countUrl(code: string, view: PageView): string {
  const params = new URLSearchParams({ p: view.path, t: view.title, s: view.screen });
  try {
    const ref = new URL(view.referrer);
    if (ref.origin !== view.origin) params.set('r', ref.origin);
  } catch {
    /* no referrer */
  }
  params.set('rnd', Math.random().toString(36).slice(2, 7));
  return `https://${code}.goatcounter.com/count?${params}`;
}

/** The current page's path without the deployment's base path: "/Ethereal/today/" → "/today/". */
export function sitePath(pathname: string, base: string): string {
  const prefix = base.replace(/\/$/, '');
  const path = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return path || '/';
}

function context(): CountContext {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return {
    code: GOATCOUNTER_CODE,
    enabled: analyticsStore.get().enabled,
    hostname: location.hostname,
    siteHostname: new URL(import.meta.env.SITE ?? location.href).hostname,
    webdriver: nav.webdriver === true,
    doNotTrack: nav.doNotTrack === '1' || nav.globalPrivacyControl === true,
  };
}

let lastReferrer = '';

function countPage(): void {
  const ctx = context();
  if (!mayCount(ctx)) return;
  const url = countUrl(ctx.code, {
    path: sitePath(location.pathname, import.meta.env.BASE_URL),
    title: document.title,
    // Only the first page of a visit has an outside referrer; later pages are in-app navigations.
    referrer: lastReferrer === '' ? document.referrer : '',
    origin: location.origin,
    screen: `${screen.width},${screen.height},${window.devicePixelRatio || 1}`,
  });
  lastReferrer = location.href;
  if (!navigator.sendBeacon?.(url)) new Image().src = url;
}

/** Counts the first page and every page the client router navigates to. */
export function startCounting(): void {
  document.addEventListener('astro:page-load', () => {
    // After the page has painted and gone idle, so counting never competes with the page.
    const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1));
    idle(countPage);
  });
}
