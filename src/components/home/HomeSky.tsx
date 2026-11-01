import { useEffect, useState } from 'preact/hooks';
import { lifeStore } from '@/lib/life';
import { prayerTimes } from '@/lib/prayer';
import { DEFAULT_EVENTS, eventsFrom, moonPhase, type SunEvents } from '@/lib/sky';
import { todayIso } from '@/lib/plan';
import { SkyScene } from '../today/SkyScene';

/**
 * The home page's sky: the same living sky as Today, behind the whole hero, at the visitor's
 * own time of day (to the minute for anyone who has set a city). Until the time is known the
 * hero shows a quiet night, and the real sky fades in over it.
 */
export default function HomeSky() {
  const [now, setNow] = useState<number | null>(null);
  const [events, setEvents] = useState<SunEvents>(DEFAULT_EVENTS);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const p = lifeStore.get().prayer;
    if (p.lat !== null && p.lon !== null) {
      const t = prayerTimes(todayIso(), p.lat, p.lon, { method: p.method, asr: p.asr });
      const m = (x: Date) => x.getHours() * 60 + x.getMinutes();
      setEvents(
        eventsFrom({
          fajr: m(t.fajr),
          sunrise: m(t.sunrise),
          dhuhr: m(t.dhuhr),
          maghrib: m(t.maghrib),
          isha: m(t.isha),
        }),
      );
    }
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (now === null) return null;
  return (
    <SkyScene
      now={now}
      events={events}
      moon={moonPhase(new Date())}
      class="sky-home"
      low={0.9}
      high={0.66}
    />
  );
}
