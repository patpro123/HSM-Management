'use strict';

// Executors for the two Head-of-School proposals: validation and what they write.
jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/studentService', () => ({ createStudentWithEnrollment: jest.fn() }));

const { EXECUTORS } = require('../services/proposalExecutors');
const { createStudentWithEnrollment } = require('../services/studentService');
const { proposalResponse } = require('../llm/proposalCard');

const S = '11111111-1111-4111-8111-111111111111';
const B1 = '22222222-2222-4222-8222-222222222222';
const B2 = '33333333-3333-4333-8333-333333333333';
const hos = { id: 'u1', roles: ['head_of_school'] };
const db = { query: jest.fn() };

beforeEach(() => { jest.clearAllMocks(); db.query.mockReset(); });

describe('student.update', () => {
  const ex = EXECUTORS['student.update'];

  it('summarises the change from the current values', async () => {
    db.query.mockResolvedValue({ rows: [{ name: 'Riya', phone: '111', guardian_contact: null, email: null }] });
    const out = await ex.validate(db, hos, { student_id: S, changes: { phone: ' 222 ', other: 'x' } });
    expect(out.params).toEqual({ student_id: S, changes: { phone: '222' } });
    expect(out.summary).toBe('Update Riya: phone 111 -> 222');
  });

  it('rejects an empty change, a bad email and an unknown student', async () => {
    await expect(ex.validate(db, hos, { student_id: S, changes: {} })).rejects.toThrow('No changes');
    await expect(ex.validate(db, hos, { student_id: S, changes: { email: 'nope' } })).rejects.toThrow('email');
    db.query.mockResolvedValue({ rows: [] });
    await expect(ex.validate(db, hos, { student_id: S, changes: { phone: '1' } })).rejects.toThrow('not found');
  });

  it('writes only the approved fields', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: S }] }) };
    await ex.execute(client, { params: { student_id: S, changes: { phone: '222', email: 'a@b.co' } } });
    const [sql, values] = client.query.mock.calls[0];
    expect(sql).toContain('phone = $2');
    expect(sql).toContain("'{email}'");
    expect(values).toEqual([S, '222', 'a@b.co']);
  });
});

describe('enroll.student', () => {
  const ex = EXECUTORS['enroll.student'];
  const body = { first_name: 'Anu', last_name: 'Rao', batches: [{ batch_id: B1 }] };
  const found = (rows) => db.query.mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [] });

  it('needs a name and between one and six classes', async () => {
    await expect(ex.validate(db, hos, { ...body, last_name: '' })).rejects.toThrow('name');
    await expect(ex.validate(db, hos, { ...body, batches: [] })).rejects.toThrow('one and six');
  });

  it('rejects a third class on one instrument', async () => {
    const batches = [B1, B2, S].map(batch_id => ({ batch_id }));
    found([1, 2, 3].map(n => ({ id: n, instrument_id: 'i1', recurrence: 'TUE', instrument: 'Guitar' })));
    await expect(ex.validate(db, hos, { ...body, batches })).rejects.toThrow('at most 2');
  });

  it('summarises the classes and defaults to monthly', async () => {
    found([{ id: B1, instrument_id: 'i1', recurrence: 'TUE 17:00-18:00', instrument: 'Guitar' }]);
    const out = await ex.validate(db, hos, body);
    expect(out.summary).toBe('Enroll Anu Rao in Guitar TUE 17:00-18:00');
    expect(out.params.batches).toEqual([{ batch_id: B1, payment_frequency: 'monthly' }]);
  });

  it('flags a name that already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: B1, instrument_id: 'i1', recurrence: 'TUE', instrument: 'Guitar' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect((await ex.validate(db, hos, body)).summary).toContain('already exists');
  });

  it('creates the student through the shared service', async () => {
    createStudentWithEnrollment.mockResolvedValue({ student: { id: 's1' }, enrollment: { id: 'e1' } });
    const out = await ex.execute({}, { params: body });
    expect(out).toEqual({ student_id: 's1', enrollment_id: 'e1' });
  });
});

describe('proposal chat card', () => {
  const p = { id: 'p1', action_type: 'student.update', summary: 'x', status: 'pending', is_money: false };
  it('offers Approve/Reject to Admin only', () => {
    expect(proposalResponse(p, { roles: ['admin'] }, 't').card.proposal.can_decide).toBe(true);
    expect(proposalResponse(p, hos, 't').card.proposal.can_decide).toBe(false);
    expect(proposalResponse({ ...p, status: 'executed' }, { roles: ['admin'] }, 't').card.proposal.can_decide).toBe(false);
  });
});
