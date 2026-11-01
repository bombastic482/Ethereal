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
  | 'lock'
  | 'dumbbell'
  | 'utensils'
  | 'chart'
  | 'user'
  | 'clock'
  | 'pill'
  | 'heart'
  | 'book'
  | 'play'
  | 'pause'
  | 'plus'
  | 'minus'
  | 'chevron'
  | 'leaf'
  | 'edit'
  | 'bell'
  | 'timer'
  | 'volume'
  | 'mute'
  | 'skip'
  | 'list'
  | 'home'
  | 'mind'
  | 'speak'
  | 'camera'
  | 'bed'
  | 'walk'
  | 'mic';

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
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  utensils: 'M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2.2 1.3-3.5 3.8-3.5 7v3H17',
  chart: 'M4 20h16M6 16l4-5 3 3 5-7m0 0h-3.5M18 7v3.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 9a7.5 7.5 0 0 1 15 0',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7l-6 6ZM7 10.5l6.5 6.5',
  heart:
    'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z',
  play: 'M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z',
  pause: 'M8 5v14M16 5v14',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-4 6-6.5 9.5-8.5',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 8l3 3',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4.5a2 2 0 0 0 4 0',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-8V9.5M10 2.5h4M19 6l1.5-1.5',
  volume: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM16 9.5l5 5m0-5-5 5',
  skip: 'M6 5.5v13l9-6.5-9-6.5ZM18 5v14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z',
  camera:
    'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bed: 'M3 18V6m0 8h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 2.5 2.5V21M8.5 11.5 10.5 8h3l2 4 2.5 1M10.5 8 9 14',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 18v3m-3 0h6',
  speak:
    'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5v-9ZM8 9h8M8 12h5',
  mind: 'M12 21v-5M8.5 16a4.5 4.5 0 0 1-2-8.5 4 4 0 0 1 5.5-3.8 4 4 0 0 1 5.5 3.8 4.5 4.5 0 0 1-2 8.5h-7Z',
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
