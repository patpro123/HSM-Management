import type { Batch } from './data';

export function getInstrumentTeacherNames(batches: Batch[], dbNames: string[]): string[] {
  const names = new Set<string>();
  for (const batch of batches) {
    if (batch.is_makeup || !dbNames.includes(batch.instrument_name)) continue;
    if (batch.teacher_name) names.add(batch.teacher_name);
  }
  return Array.from(names);
}
