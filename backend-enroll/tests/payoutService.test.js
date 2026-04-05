'use strict';

const { getMonthlyPayoutReport, buildPayoutCutoffDate } = require('../services/payoutService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock pg pool that returns a predefined rows array.
 */
function mockPool(rows) {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  };
}

// ---------------------------------------------------------------------------
// buildPayoutCutoffDate
// ---------------------------------------------------------------------------

describe('buildPayoutCutoffDate', () => {
  it('returns the 20th of the given month/year', () => {
    const date = buildPayoutCutoffDate(2026, 4); // April 2026
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3); // 0-indexed
    expect(date.getDate()).toBe(20);
  });

  it('uses current month/year when called with no args', () => {
    const now = new Date();
    const date = buildPayoutCutoffDate();
    expect(date.getFullYear()).toBe(now.getFullYear());
    expect(date.getMonth()).toBe(now.getMonth());
    expect(date.getDate()).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// getMonthlyPayoutReport — report structure
// ---------------------------------------------------------------------------

describe('getMonthlyPayoutReport', () => {
  it('returns a report object with month, teachers array, and grand_total', async () => {
    const pool = mockPool([]);
    const report = await getMonthlyPayoutReport(pool, { year: 2026, month: 4 });

    expect(report).toHaveProperty('month', '2026-04');
    expect(report).toHaveProperty('teachers');
    expect(Array.isArray(report.teachers)).toBe(true);
    expect(report).toHaveProperty('grand_total', 0);
    expect(report).toHaveProperty('generated_at');
  });

  it('groups rows by teacher and lists active students', async () => {
    const rows = [
      {
        teacher_id: 'teacher-1',
        teacher_name: 'Ravi Kumar',
        rate: '500.00',
        teacher_email: 'ravi@hsm.com',
        student_id: 'student-1',
        student_name: 'Ananya',
        enrolled_on: '2026-04-05',
        classes_attended: '4',
      },
      {
        teacher_id: 'teacher-1',
        teacher_name: 'Ravi Kumar',
        rate: '500.00',
        teacher_email: 'ravi@hsm.com',
        student_id: 'student-2',
        student_name: 'Priya',
        enrolled_on: '2026-04-10',
        classes_attended: '3',
      },
      {
        teacher_id: 'teacher-2',
        teacher_name: 'Meena S',
        rate: '600.00',
        teacher_email: 'meena@hsm.com',
        student_id: 'student-3',
        student_name: 'Rohan',
        enrolled_on: '2026-04-01',
        classes_attended: '5',
      },
    ];

    const pool = mockPool(rows);
    const report = await getMonthlyPayoutReport(pool, { year: 2026, month: 4 });

    expect(report.teachers).toHaveLength(2);

    const ravi = report.teachers.find(t => t.teacher_id === 'teacher-1');
    expect(ravi.teacher_name).toBe('Ravi Kumar');
    expect(ravi.rate).toBe(500);
    expect(ravi.active_students).toHaveLength(2);
    expect(ravi.active_student_count).toBe(2);
    expect(ravi.total_payable).toBe(1000); // 500 × 2

    const meena = report.teachers.find(t => t.teacher_id === 'teacher-2');
    expect(meena.active_student_count).toBe(1);
    expect(meena.total_payable).toBe(600); // 600 × 1
  });

  it('calculates grand_total as sum of all teacher total_payable amounts', async () => {
    const rows = [
      { teacher_id: 't1', teacher_name: 'A', rate: '500.00', teacher_email: 'a@x.com', student_id: 's1', student_name: 'X', enrolled_on: '2026-04-01', classes_attended: '3' },
      { teacher_id: 't2', teacher_name: 'B', rate: '400.00', teacher_email: 'b@x.com', student_id: 's2', student_name: 'Y', enrolled_on: '2026-04-01', classes_attended: '5' },
    ];

    const pool = mockPool(rows);
    const report = await getMonthlyPayoutReport(pool, { year: 2026, month: 4 });

    expect(report.grand_total).toBe(900); // 500 + 400
  });

  it('includes student enrolled_on and classes_attended in active_students list', async () => {
    const rows = [
      { teacher_id: 't1', teacher_name: 'A', rate: '500.00', teacher_email: null, student_id: 's1', student_name: 'Kiran', enrolled_on: '2026-04-08', classes_attended: '6' },
    ];

    const pool = mockPool(rows);
    const report = await getMonthlyPayoutReport(pool, { year: 2026, month: 4 });

    const student = report.teachers[0].active_students[0];
    expect(student.student_id).toBe('s1');
    expect(student.student_name).toBe('Kiran');
    expect(student.enrolled_on).toBe('2026-04-08');
    expect(student.classes_attended).toBe(6);
  });

  it('passes the correct cutoff date ($1) to the SQL query', async () => {
    const pool = mockPool([]);
    await getMonthlyPayoutReport(pool, { year: 2026, month: 4 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [, params] = pool.query.mock.calls[0];
    const cutoff = params[0]; // first bind param
    expect(cutoff instanceof Date).toBe(true);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(3); // April = 3
    expect(cutoff.getDate()).toBe(20);
  });

  it('returns empty teachers array and grand_total 0 when no active students exist', async () => {
    const pool = mockPool([]);
    const report = await getMonthlyPayoutReport(pool, { year: 2026, month: 4 });

    expect(report.teachers).toHaveLength(0);
    expect(report.grand_total).toBe(0);
  });
});
