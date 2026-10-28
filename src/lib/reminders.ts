/**
 * Calendar reminders without a server: a downloadable .ics with daily recurring events.
 * Works with Apple Calendar, Google Calendar, Outlook and every phone.
 */
export interface ReminderSpec {
  weighInTime?: string; // "07:30"
  logMealsTime?: string; // "20:30"
  startDate: string; // YYYY-MM-DD
  url: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

function event(
  uid: string,
  date: string,
  time: string,
  summary: string,
  description: string,
  url: string,
): string {
  // RFC 5545 TEXT: backslash, semicolon and comma must be escaped; newlines become \\n.
  const text = (v: string) =>
    v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const [h, m] = time.split(':').map(Number);
  const dt = `${date.replace(/-/g, '')}T${pad(h!)}${pad(m!)}00`;
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@ethereal`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${dt}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${text(summary)}`,
    `DESCRIPTION:${text(description)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(summary)}`,
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

export function buildReminderIcs(spec: ReminderSpec): string {
  const events: string[] = [];
  if (spec.weighInTime)
    events.push(
      event(
        'weigh-in',
        spec.startDate,
        spec.weighInTime,
        'Weigh in · Ethereal',
        'Morning, after the bathroom, before food. Log it in Ethereal.',
        `${spec.url}track/`,
      ),
    );
  if (spec.logMealsTime)
    events.push(
      event(
        'log-meals',
        spec.startDate,
        spec.logMealsTime,
        'Log today’s meals · Ethereal',
        'Two minutes to close the day. Protein hit? Anything missing?',
        `${spec.url}today/`,
      ),
    );
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ethereal//Reminders//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  );
}
