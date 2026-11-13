jest.mock('../db', () => ({ query: jest.fn() }));
const pool = require('../db');
const { composeMessage, prepareAbsenceMessage } = require('../services/whatsappMessages');

describe('absence nudge message', () => {
  const one = { instrument: 'Guitar', teacher: 'Josva', days: ['Tue', 'Thu', 'Sat'] };
  const words = t => t.split(/\s+/).filter(Boolean).length;

  it('is short, nudges attendance, offers the teacher\'s days and says no compensation class', () => {
    const text = composeMessage('absence_nudge', { studentName: 'Asha Rao', date: '2026-11-11', classes: [one] });
    expect(text).toContain('We missed Asha at Guitar class on Wed, 11 Nov');
    expect(text).toMatch(/Regular attendance/);
    expect(text).toContain('extra session with Josva on Tue, Thu or Sat');
    expect(text).toMatch(/can't arrange separate compensation classes/);
    expect(text.trim().endsWith('- HSM Team')).toBe(true);
    expect(words(text)).toBeLessThanOrEqual(100);
  });

  it('lists each instrument when the student missed more than one class', () => {
    const text = composeMessage('absence_nudge', { studentName: 'Asha', date: '2026-11-11', classes: [
      one, { instrument: 'Keyboard', teacher: 'Mina', days: ['Fri'] },
    ] });
    expect(text).toContain('Guitar and Keyboard classes');
    expect(text).toContain('• Guitar (Josva): Tue, Thu or Sat');
    expect(text).toContain('• Keyboard (Mina): Fri');
  });

  it('still works with no teacher or days on record', () => {
    const text = composeMessage('absence_nudge', { studentName: 'Asha', date: '2026-11-11', classes: [{ instrument: 'Tabla', teacher: null, days: [] }] });
    expect(text).toContain('any day the teacher is available');
    expect(text).toMatch(/compensation/);
  });
});

describe('prepareAbsenceMessage', () => {
  beforeEach(() => pool.query.mockReset());

  it('returns null when the student was not absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await prepareAbsenceMessage({ studentId: 's1', date: '2026-11-11' })).toBeNull();
  });

  it('gathers the teacher\'s days for the instrument, Monday first, and links the family number', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ student_name: 'Asha Rao', instrument: 'Guitar', instrument_id: 'i1', teacher_id: 't1', teacher_name: 'Josva' }] })
      .mockResolvedValueOnce({ rows: [
        { teacher_id: 't1', instrument_id: 'i1', recurrence: 'SAT 10:00-11:00' },
        { teacher_id: 't1', instrument_id: 'i1', recurrence: 'TUE 17:00-18:00, THU 17:00-18:00' },
        { teacher_id: 't2', instrument_id: 'i1', recurrence: 'MON 17:00-18:00' },
      ] })
      .mockResolvedValueOnce({ rows: [{ guardian: '9876543210', phone: null }] });
    const msg = await prepareAbsenceMessage({ studentId: 's1', batchId: 'b1', date: '2026-11-11' });
    expect(msg.kind).toBe('absence_nudge');
    expect(msg.text).toContain('with Josva on Tue, Thu or Sat');
    expect(msg.text).not.toContain('Mon');
    expect(msg.to).toMatch(/9876543210$/);
    expect(msg.link).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });
});
