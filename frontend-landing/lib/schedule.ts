import type { Batch } from './data';

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS: Record<string, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

export interface ScheduleSlot {
  day: string;
  time: string;
  teacherName?: string;
}

/** Parses a recurrence string like "TUE 17:00-18:00, THU 17:00-18:00" into per-day slots. */
function parseRecurrence(recurrence: string): { day: string; time: string }[] {
  return recurrence
    .split(',')
    .map(part => part.trim())
    .map(part => {
      const match = part.match(/^([A-Z]{3})\s+(.+)$/i);
      if (!match) return null;
      const day = match[1].toUpperCase();
      if (!DAY_ORDER.includes(day)) return null;
      return { day, time: match[2] };
    })
    .filter((v): v is { day: string; time: string } => v !== null);
}

export function getInstrumentSchedule(batches: Batch[], dbNames: string[]): ScheduleSlot[] {
  if (dbNames.length === 0) return [];

  const slots: ScheduleSlot[] = [];
  for (const batch of batches) {
    if (batch.is_makeup || !batch.recurrence) continue;
    if (!dbNames.includes(batch.instrument_name)) continue;
    for (const { day, time } of parseRecurrence(batch.recurrence)) {
      slots.push({ day, time, teacherName: batch.teacher_name });
    }
  }

  return slots.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

export function dayLabel(day: string): string {
  return DAY_LABELS[day] || day;
}

export function getInstrumentTeacherNames(batches: Batch[], dbNames: string[]): string[] {
  const names = new Set<string>();
  for (const batch of batches) {
    if (batch.is_makeup || !dbNames.includes(batch.instrument_name)) continue;
    if (batch.teacher_name) names.add(batch.teacher_name);
  }
  return Array.from(names);
}
