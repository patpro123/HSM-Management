const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hsm-management.onrender.com';

export interface Teacher {
  id: number | string;
  name: string;
  specialty?: string;
  [key: string]: unknown;
}

export interface Batch {
  instrument_name: string;
  recurrence?: string;
  start_time?: string;
  end_time?: string;
  teacher_name?: string;
  is_makeup?: boolean;
  [key: string]: unknown;
}

const FALLBACK_TEACHERS: Teacher[] = [
  { id: 1, name: 'Josva', specialty: 'Keyboard · Guitar' },
  { id: 2, name: 'Mriganko', specialty: 'Piano' },
  { id: 3, name: 'Subroto Bhaduri', specialty: 'Drums · Tabla · Octopad' },
  { id: 4, name: 'Issac Lawrence', specialty: 'Violin' },
  { id: 5, name: 'Sangeeta', specialty: 'Hindustani Classical · Carnatic Classical' },
];

const FALLBACK_BATCHES: Batch[] = [
  { instrument_name: 'Guitar', recurrence: 'TUE 17:00-18:00, THU 17:00-18:00', start_time: '17:00:00' },
  { instrument_name: 'Tabla', recurrence: 'SAT 10:00-11:00, SUN 10:00-11:00', start_time: '10:00:00' },
  { instrument_name: 'Hindustani Vocals', recurrence: 'TUE 17:00-18:00, THU 17:00-18:00, SAT 17:00-18:00', start_time: '17:00:00' },
  { instrument_name: 'Piano', recurrence: 'MON 16:00-17:00, WED 16:00-17:00', start_time: '16:00:00' },
];

export async function getTeachers(): Promise<Teacher[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/teachers`, { next: { revalidate: 3600 } });
    if (!res.ok) return FALLBACK_TEACHERS;
    const data = await res.json();
    return data.teachers ?? FALLBACK_TEACHERS;
  } catch {
    return FALLBACK_TEACHERS;
  }
}

export async function getBatches(): Promise<Batch[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/batches`, { next: { revalidate: 3600 } });
    if (!res.ok) return FALLBACK_BATCHES;
    const data = await res.json();
    return data.batches ?? FALLBACK_BATCHES;
  } catch {
    return FALLBACK_BATCHES;
  }
}
