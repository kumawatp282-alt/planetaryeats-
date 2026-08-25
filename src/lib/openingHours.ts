// Opening-hours helpers — admin-editable (see supabase/professional_schema.sql's
// app_settings.opening_hours), used to show "Open now"/"Closed" and to
// block checkout outside hours, same as any real delivery platform.

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  open: string; // "HH:MM", 24h
  close: string; // "HH:MM", 24h
  closed: boolean;
}

export type OpeningHours = Record<Weekday, DayHours>;

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const JS_DAY_TO_WEEKDAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export interface OpenStatus {
  isOpen: boolean;
  // Human-readable "opens Tue at 11:00" / "closes at 21:30" message.
  message: string;
}

export function getOpenStatus(hours: OpeningHours, now: Date = new Date()): OpenStatus {
  const today = JS_DAY_TO_WEEKDAY[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayHours = hours[today];

  if (!todayHours.closed) {
    const openMin = minutesSinceMidnight(todayHours.open);
    const closeMin = minutesSinceMidnight(todayHours.close);
    if (nowMinutes >= openMin && nowMinutes < closeMin) {
      return { isOpen: true, message: `Open now · closes at ${todayHours.close}` };
    }
    if (nowMinutes < openMin) {
      return { isOpen: false, message: `Closed · opens today at ${todayHours.open}` };
    }
  }

  // Find the next open day (starting tomorrow, wrapping around the week).
  const todayIndex = WEEKDAYS.indexOf(today);
  for (let offset = 1; offset <= 7; offset++) {
    const day = WEEKDAYS[(todayIndex + offset) % 7];
    const dayHours = hours[day];
    if (!dayHours.closed) {
      const label = offset === 1 ? 'tomorrow' : WEEKDAY_LABELS[day];
      return { isOpen: false, message: `Closed · opens ${label} at ${dayHours.open}` };
    }
  }
  return { isOpen: false, message: 'Closed' };
}
