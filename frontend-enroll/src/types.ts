
export type PayoutType = 'fixed' | 'per_class';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface Teacher {
  id: number | string;
  name: string;
  phone: string;
  email: string;
  payout_type: PayoutType;
  rate: number;
  batch_count?: number;
}

export interface Instrument {
  id: number | string;
  name: string;
  online_supported: boolean;
  max_batch_size: number;
}

export interface Batch {
  id: number | string;
  instrument_id: number | string;
  teacher_id: number | string;
  recurrence: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  is_makeup: boolean;
  instrument_name?: string;
  teacher_name?: string;
}

export interface Student {
  id: number | string;
  name?: string; // Backend uses single name field
  first_name?: string;
  last_name?: string;
  email?: string;
  date_of_birth?: string;
  dob?: string; // Backend uses 'dob'
  address?: string;
  guardian_name?: string;
  guardian_contact?: string; // Backend uses this
  phone?: string;
  guardian_phone?: string;
  telephone?: string;
  date_of_joining?: string;
  metadata?: any;
  enrollments?: Array<{
    enrollment_id: string;
    status: string;
    classes_remaining: number;
    enrolled_on: string;
    batch_id?: string;
    payment_frequency?: PaymentFrequency;
  }>;
}

export interface BatchAssignment {
  id: number | string;
  enrollment_id: number | string;
  batch_id: number | string;
  payment_frequency: PaymentFrequency;
  classes_remaining: number;
}

export interface AttendanceRecord {
  id: number | string;
  date: string;
  batch_id: number | string;
  student_id: number | string;
  status: AttendanceStatus;
  source?: 'dashboard' | 'whatsapp';
  finalized_at?: string;
}

export interface PaymentRecord {
  id: number | string;
  student_id: number | string;
  amount: number | string;
  classes_count?: number;
  method?: string;
  payment_method?: string;
  payment_for?: string;
  notes?: string;
  timestamp: string;
}
