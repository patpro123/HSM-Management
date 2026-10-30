'use strict';

// POST /api/chat/attendance: who may save what. Database, auth and the LLM are mocked.
jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../llm/client', () => ({ callLLM: jest.fn() }));
jest.mock('../auth/jwtMiddleware', () => ({
  authenticateJWT: (req, res, next) => { req.user = global.__user; next(); },
}));
jest.mock('../services/attendanceService', () => ({
  todayIST: () => '2026-10-30',
  getLinkedTeacherId: jest.fn(),
  buildAttendanceNotes: jest.fn(),
  saveAttendanceTransaction: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const svc = require('../services/attendanceService');
const chat = require('../routes/chat');

const app = express();
app.use(express.json());
app.use('/api/chat', chat);

const B = '11111111-1111-4111-8111-111111111111';
const S = '22222222-2222-4222-8222-222222222222';
const rec = (over = {}) => ({ batch_id: B, student_id: S, date: '2026-10-30', status: 'present', ...over });
const post = (records) => request(app).post('/api/chat/attendance').send({ records });

beforeEach(() => {
  jest.clearAllMocks();
  global.__user = { id: 'u1', name: 'Tina', roles: ['teacher'] };
  svc.getLinkedTeacherId.mockResolvedValue('t1');
  svc.buildAttendanceNotes.mockResolvedValue(new Map());
  svc.saveAttendanceTransaction.mockResolvedValue();
});

describe('POST /api/chat/attendance', () => {
  it('saves today\'s marks for a linked teacher and counts them', async () => {
    const res = await post([rec(), rec({ student_id: '33333333-3333-4333-8333-333333333333', status: 'excused' })]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: 2, present: 1, absent: 0, excused: 1 });
    expect(svc.saveAttendanceTransaction).toHaveBeenCalledTimes(1);
  });

  it('refuses a teacher marking a past date', async () => {
    const res = await post([rec({ date: '2026-10-29' })]);
    expect(res.status).toBe(403);
    expect(svc.saveAttendanceTransaction).not.toHaveBeenCalled();
  });

  it('lets Head of School mark a past date', async () => {
    global.__user = { id: 'u2', roles: ['head_of_school'] };
    const res = await post([rec({ date: '2026-10-29' })]);
    expect(res.status).toBe(200);
    expect(svc.getLinkedTeacherId).not.toHaveBeenCalled();
  });

  it('refuses a teacher without a linked profile', async () => {
    svc.getLinkedTeacherId.mockResolvedValue(null);
    expect((await post([rec()])).status).toBe(403);
  });

  it('refuses parents', async () => {
    global.__user = { id: 'u3', roles: ['parent'] };
    expect((await post([rec()])).status).toBe(403);
  });

  it('rejects bad statuses, ids and empty bodies', async () => {
    expect((await post([rec({ status: 'late' })])).status).toBe(400);
    expect((await post([rec({ batch_id: 'nope' })])).status).toBe(400);
    expect((await post([])).status).toBe(400);
  });

  it('ignores a duplicated row', async () => {
    const res = await post([rec(), rec()]);
    expect(res.body.saved).toBe(1);
  });
});
