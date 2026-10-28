import { describe, expect, it } from 'vitest';
import { buildReminderIcs } from '../reminders';

describe('reminder ics', () => {
  it('emits daily recurring events with alarms', () => {
    const ics = buildReminderIcs({
      weighInTime: '07:30',
      logMealsTime: '20:00',
      startDate: '2026-11-01',
      url: 'https://example.com/',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART:20261101T073000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('URL:https://example.com/track/');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('omits events that are not requested', () => {
    const ics = buildReminderIcs({
      weighInTime: '07:00',
      startDate: '2026-11-01',
      url: 'https://example.com/',
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
