
import { Instrument, Teacher, Batch } from './types';

export const MOCK_INSTRUMENTS: Instrument[] = [
  { id: 'i1', name: 'Keyboard', online_supported: true, max_batch_size: 8 },
  { id: 'i2', name: 'Guitar', online_supported: true, max_batch_size: 6 },
  { id: 'i3', name: 'Piano', online_supported: false, max_batch_size: 1 },
  { id: 'i4', name: 'Drums', online_supported: false, max_batch_size: 4 },
  { id: 'i5', name: 'Tabla', online_supported: false, max_batch_size: 10 },
  { id: 'i6', name: 'Violin', online_supported: false, max_batch_size: 6 },
  { id: 'i7', name: 'Hindustani Vocals', online_supported: false, max_batch_size: 12 },
];

export const MOCK_TEACHERS: Teacher[] = [
  { id: 't1', name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@hsm.com', payout_type: 'fixed', rate: 30000 },
  { id: 't2', name: 'Priya Nair', phone: '9876543211', email: 'priya@hsm.com', payout_type: 'fixed', rate: 25000 },
  { id: 't3', name: 'Amit Singh', phone: '9876543212', email: 'amit@hsm.com', payout_type: 'per_class', rate: 500 },
  { id: 't4', name: 'Snehita Rao', phone: '9876543213', email: 'snehita@hsm.com', payout_type: 'per_class', rate: 600 },
];

export const MOCK_BATCHES: Batch[] = [
  { id: 'b1', instrument_id: 'i1', teacher_id: 't1', recurrence: 'Tue/Thu 5-6 PM', day_of_week: 'Tuesday', start_time: '17:00', end_time: '18:00', capacity: 8, is_makeup: false },
  { id: 'b2', instrument_id: 'i2', teacher_id: 't3', recurrence: 'Wed/Fri 6-7 PM', day_of_week: 'Wednesday', start_time: '18:00', end_time: '19:00', capacity: 6, is_makeup: false },
  { id: 'b3', instrument_id: 'i1', teacher_id: 't1', recurrence: 'Sat 4-5 PM', day_of_week: 'Saturday', start_time: '16:00', end_time: '17:00', capacity: 8, is_makeup: false },
  { id: 'b4', instrument_id: 'i7', teacher_id: 't4', recurrence: 'Sun 10-11 AM', day_of_week: 'Sunday', start_time: '10:00', end_time: '11:00', capacity: 12, is_makeup: false },
];
