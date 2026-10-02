import type { DayType, TimeBucket } from '@ecotransit/contracts';

export interface IClock {
  now(): Date;
  epochSeconds(): number;
  bucket(date?: Date): TimeBucket;
}

const IST_TIMEZONE = 'Asia/Kolkata';

export function getIstParts(date: Date = new Date()): { hour: number; dayOfWeek: number } {
  // Use Intl to get exact time in Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let hour = 0;
  let weekdayStr = 'Mon';

  for (const part of parts) {
    if (part.type === 'hour') {
      hour = parseInt(part.value, 10);
      if (hour === 24) hour = 0; // Handle 24h edge cases
    } else if (part.type === 'weekday') {
      weekdayStr = part.value;
    }
  }

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    hour,
    dayOfWeek: dayMap[weekdayStr] ?? 1,
  };
}

export function hourOfDay(date: Date = new Date()): number {
  return getIstParts(date).hour;
}

export function dayType(date: Date = new Date()): DayType {
  const { dayOfWeek } = getIstParts(date);
  if (dayOfWeek === 0) return 'sunday';
  if (dayOfWeek === 6) return 'saturday';
  return 'weekday';
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }

  epochSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  bucket(date: Date = this.now()): TimeBucket {
    return {
      hourOfDay: hourOfDay(date),
      dayType: dayType(date),
    };
  }
}
