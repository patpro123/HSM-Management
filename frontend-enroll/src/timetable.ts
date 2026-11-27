// The public timetable. Exact batch timings are not final, so the public pages show
// this general availability instead of reading individual batch records.
// Keep in step with frontend-landing/lib/timetable.ts.

const MON_TO_SAT = 'MON, TUE, WED, THU, FRI, SAT';

/** Days with an evening class (5–8 PM). */
const EVENING_DAYS: Record<string, string> = {
  'Bass Guitar': MON_TO_SAT,
  'Guitar': MON_TO_SAT,
  'Keyboard': MON_TO_SAT,
  'Octopad': MON_TO_SAT,
  'Piano': MON_TO_SAT,
  'Violin': MON_TO_SAT,
  'Drums': 'THU, SAT',
  'Tabla': 'THU, SAT',
  'Carnatic Vocals': 'FRI',
  'Hindustani Vocals': 'SAT',
};

/** Vocals also run on Sunday morning (11 AM – 1 PM). */
const SUNDAY_MORNING = ['Carnatic Vocals', 'Hindustani Vocals'];

/** Batch-shaped rows for the weekly overview grid. */
export const TIMETABLE = [
  ...Object.entries(EVENING_DAYS).map(([name, days]) => ({
    instrument_name: name, recurrence: days, start_time: '17:00:00',
  })),
  ...SUNDAY_MORNING.map(name => ({
    instrument_name: name, recurrence: 'SUN', start_time: '11:00:00',
  })),
];
