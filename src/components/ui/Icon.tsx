import type { SVGAttributes } from 'preact';

export type IconName =
  | 'scale'
  | 'flame'
  | 'pie'
  | 'target'
  | 'ruler'
  | 'calendar'
  | 'drop'
  | 'egg'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'close'
  | 'arrow'
  | 'check'
  | 'copy'
  | 'reset'
  | 'info'
  | 'warn'
  | 'spark'
  | 'shield'
  | 'bolt'
  | 'lock';

const PATHS: Record<IconName, string> = {
  scale: 'M12 3v18M5 7l7-4 7 4M3 15l2-8 2 8a2.5 2.5 0 0 1-4 0Zm14 0 2-8 2 8a2.5 2.5 0 0 1-4 0Z',
  flame:
    'M12 22c4.4 0 7-2.9 7-6.6 0-3.2-1.9-5.2-3.4-7.1-.5 1.4-1.3 2.4-2.6 3.1.4-3-.8-6.5-3.5-8.4.2 2.7-1.1 4.3-2.6 6C5.5 10.6 5 12.5 5 15.4 5 19.1 7.6 22 12 22Z',
  pie: 'M12 3a9 9 0 1 0 9 9h-9V3ZM14 2.5a9 9 0 0 1 7.5 7.5H14V2.5Z',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  ruler: 'M3 16l13-13 5 5L8 21l-5-5Zm4-4 2 2m1-5 2 2m1-5 2 2',
  calendar:
    'M4 8h16M8 3v4m8-4v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h2m3 0h2m-7 4h2m3 0h2',
  drop: 'M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z',
  egg: 'M12 3c3.5 0 7 5.4 7 10.3S15.9 21 12 21s-7-2.8-7-7.7S8.5 3 12 3Z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'M5 12.5 9.5 17 19 7',
  copy: 'M9 9h10v11H9V9Zm-4 6V4h11',
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v5m0-8h.01',
  warn: 'M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  spark:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 11 .9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14Z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Zm-3 9 2 2 4-4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  lock: 'M6 11h12v10H6V11Zm3 0V7a3 3 0 0 1 6 0v4',
};

interface Props extends Omit<SVGAttributes<SVGSVGElement>, 'name' | 'size'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, class: cls, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={cls}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
