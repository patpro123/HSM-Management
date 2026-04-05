'use strict';

const request = require('supertest');

// Mock DB pool before requiring routes
jest.mock('../db', () => ({ query: jest.fn() }));

// Mock the payout service
jest.mock('../services/payoutService', () => ({
  getMonthlyPayoutReport: jest.fn(),
  buildPayoutCutoffDate: jest.fn(),
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
  }),
}));

// Mock auth middleware — disable for all tests
jest.mock('../auth/jwtMiddleware', () => (req, _res, next) => {
  req.user = { id: 'admin-id', roles: ['admin'] };
  next();
});
jest.mock('../auth/rbacMiddleware', () => ({
  authorizeRole: () => (_req, _res, next) => next(),
  filterTeacherData: (_req, _res, next) => next(),
}));

const { getMonthlyPayoutReport } = require('../services/payoutService');

// Build a minimal express app with just the payout router
function buildApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/finance', require('../routes/payouts'));
  return app;
}

// ---------------------------------------------------------------------------
// GET /api/finance/payout-report
// ---------------------------------------------------------------------------

describe('GET /api/finance/payout-report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with the payout report', async () => {
    const mockReport = {
      month: '2026-04',
      generated_at: new Date().toISOString(),
      teachers: [],
      grand_total: 0,
    };
    getMonthlyPayoutReport.mockResolvedValue(mockReport);

    const app = buildApp();
    const res = await request(app).get('/api/finance/payout-report');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report).toMatchObject({ month: '2026-04', grand_total: 0 });
  });

  it('accepts year and month query params', async () => {
    getMonthlyPayoutReport.mockResolvedValue({
      month: '2025-12',
      generated_at: new Date().toISOString(),
      teachers: [],
      grand_total: 0,
    });

    const app = buildApp();
    const res = await request(app).get('/api/finance/payout-report?year=2025&month=12');

    expect(res.status).toBe(200);
    expect(getMonthlyPayoutReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ year: 2025, month: 12 })
    );
  });

  it('returns 500 when service throws', async () => {
    getMonthlyPayoutReport.mockRejectedValue(new Error('DB error'));

    const app = buildApp();
    const res = await request(app).get('/api/finance/payout-report');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/finance/payout-report/send-email
// ---------------------------------------------------------------------------

describe('POST /api/finance/payout-report/send-email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_USER = 'test@hsm.com';
    process.env.SMTP_PASS = 'test-pass';
  });

  it('returns 200 and email_sent: true when recipients provided', async () => {
    const mockReport = {
      month: '2026-04',
      generated_at: new Date().toISOString(),
      teachers: [
        {
          teacher_id: 't1',
          teacher_name: 'Ravi',
          rate: 500,
          teacher_email: 'ravi@hsm.com',
          active_students: [{ student_id: 's1', student_name: 'Ananya', enrolled_on: '2026-04-05', classes_attended: 4 }],
          active_student_count: 1,
          total_payable: 500,
        },
      ],
      grand_total: 500,
    };
    getMonthlyPayoutReport.mockResolvedValue(mockReport);

    const app = buildApp();
    const res = await request(app)
      .post('/api/finance/payout-report/send-email')
      .send({ recipients: ['finance@hsm.com', 'admin@hsm.com'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email_sent).toBe(true);
    expect(res.body.report).toBeDefined();
  });

  it('returns 400 when no recipients provided', async () => {
    getMonthlyPayoutReport.mockResolvedValue({ month: '2026-04', teachers: [], grand_total: 0 });

    const app = buildApp();
    const res = await request(app)
      .post('/api/finance/payout-report/send-email')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recipient/i);
  });

  it('returns 400 when recipients is an empty array', async () => {
    getMonthlyPayoutReport.mockResolvedValue({ month: '2026-04', teachers: [], grand_total: 0 });

    const app = buildApp();
    const res = await request(app)
      .post('/api/finance/payout-report/send-email')
      .send({ recipients: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recipient/i);
  });
});
