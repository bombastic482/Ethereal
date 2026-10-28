/**
 * Base-path aware URL helpers. The site can be hosted at the domain root (base "/")
 * or under a sub-path such as GitHub project pages ("/Ethereal/"). Every internal
 * link and asset reference goes through `withBase` so both work from one build.
 */
const RAW_BASE: string = import.meta.env.BASE_URL ?? '/';
/** Base path without a trailing slash: "" for the root, "/Ethereal" for a sub-path. */
export const BASE: string = RAW_BASE.replace(/\/+$/, '');

/** Prefix a root-relative path ("/tools/bmi/") with the configured base. */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  return `${BASE}${path}`;
}

/** Absolute URL for canonicals, sitemaps and JSON-LD. `site` is the deployment origin. */
export function absoluteUrl(path: string, site: URL | undefined): string {
  const origin = site ?? new URL('https://ethereal.pages.dev');
  return new URL(withBase(path), origin).toString();
}
