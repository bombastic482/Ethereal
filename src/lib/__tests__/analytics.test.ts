import { describe, expect, it } from 'vitest';
import { countUrl, mayCount, sitePath, type CountContext } from '../analytics';

const live: CountContext = {
  code: 'ethereal',
  enabled: true,
  hostname: 'bombastic482.github.io',
  siteHostname: 'bombastic482.github.io',
  webdriver: false,
  doNotTrack: false,
};

describe('mayCount', () => {
  it('counts on the live site with a code set', () => {
    expect(mayCount(live)).toBe(true);
  });

  it('never counts without a code, off the site, for automated browsers, or when asked not to', () => {
    expect(mayCount({ ...live, code: '' })).toBe(false);
    expect(mayCount({ ...live, hostname: 'localhost' })).toBe(false);
    expect(mayCount({ ...live, hostname: 'someone-else.github.io' })).toBe(false);
    expect(mayCount({ ...live, webdriver: true })).toBe(false);
    expect(mayCount({ ...live, doNotTrack: true })).toBe(false);
    expect(mayCount({ ...live, enabled: false })).toBe(false);
  });
});

describe('countUrl', () => {
  const view = {
    path: '/today/',
    title: 'Today · Ethereal',
    referrer: '',
    origin: 'https://bombastic482.github.io',
    screen: '390,844,3',
  };

  it('sends only the path, title, screen size and an outside referrer origin', () => {
    const url = new URL(
      countUrl('ethereal', { ...view, referrer: 'https://www.google.com/search?q=diet' }),
    );
    expect(url.origin).toBe('https://ethereal.goatcounter.com');
    expect(url.pathname).toBe('/count');
    expect(url.searchParams.get('p')).toBe('/today/');
    expect(url.searchParams.get('t')).toBe('Today · Ethereal');
    expect(url.searchParams.get('s')).toBe('390,844,3');
    // The referring site's origin only: never its path or search terms.
    expect(url.searchParams.get('r')).toBe('https://www.google.com');
    expect([...url.searchParams.keys()].sort()).toEqual(['p', 'r', 'rnd', 's', 't']);
  });

  it('drops same-site and missing referrers', () => {
    const same = new URL(countUrl('ethereal', { ...view, referrer: `${view.origin}/plan/` }));
    expect(same.searchParams.has('r')).toBe(false);
    expect(new URL(countUrl('ethereal', view)).searchParams.has('r')).toBe(false);
  });
});

describe('sitePath', () => {
  it('strips the deployment base path', () => {
    expect(sitePath('/Ethereal/today/', '/Ethereal/')).toBe('/today/');
    expect(sitePath('/Ethereal/', '/Ethereal/')).toBe('/');
    expect(sitePath('/today/', '/')).toBe('/today/');
  });
});
