import { useEffect, useRef, useState } from 'preact/hooks';
import { countUp } from '@/lib/fx';

interface Props {
  value: number;
  format?: (v: number) => string;
  class?: string;
}

/** Renders a number that eases from its previous value to the new one. */
export function CountUp({
  value,
  format = (v) => Math.round(v).toLocaleString('en-US'),
  class: cls,
}: Props) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const stop = countUp(prev.current, value, setShown, 600);
    prev.current = value;
    return stop;
  }, [value]);
  return <span class={cls}>{format(shown)}</span>;
}
