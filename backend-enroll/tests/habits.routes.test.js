'use strict';

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock DB pool
jest.mock('../db', () => ({ query: jest.fn() }));

// Mock auth & RBAC middleware — bypass for tests
jest.mock('../auth/jwtMiddleware', () => (req, _res, next) => {
  req.user = { id: 'teacher-id', roles: ['teacher'] };
  next();
});
jest.mock('../auth/rbacMiddleware', () => ({
  authorizeRole: () => (_req, _res, next) => next(),
  filterTeacherData: (_req, _res, next) => next(),
}));

function buildApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../routes/habits'));
  return app;
}

describe('GET /api/practice-items', () => {
  it('returns 200 and all practice items when no instrument query param is provided', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/practice-items');

    expect(res.status).toBe(200);
    expect(res.body.piano_keyboard).toBeDefined();
    expect(res.body.guitar).toBeDefined();
    expect(res.body.piano_keyboard.length).toBeGreaterThan(0);
  });

  it('filters and returns piano_keyboard items for instrument=Keyboard', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/practice-items?instrument=Keyboard');

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items[0].id).toMatch(/^pk_/);
  });

  it('filters and returns guitar items for instrument=Guitar', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/practice-items?instrument=Guitar');

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items[0].id).toMatch(/^gt_/);
  });

  it('filters and returns vocals_classical items for instrument=Hindustani Vocals', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/practice-items?instrument=Hindustani%20Vocals');

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items[0].id).toMatch(/^vc_/);
  });

  it('returns empty items for an unknown instrument', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/practice-items?instrument=Sitar');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

describe('POST /api/habits/archive-bulk', () => {
  it('archives multiple habits and returns 200', async () => {
    const db = require('../db');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'h1' }, { id: 'h2' }] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/habits/archive-bulk')
      .send({ habit_ids: ['h1', 'h2'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.archived).toBe(2);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE habits SET archived_at = NOW()'),
      [['h1', 'h2']]
    );
  });

  it('returns 400 if habit_ids is missing or not an array', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/habits/archive-bulk')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/habits/update-bulk', () => {
  it('updates multiple habits and returns 200', async () => {
    const db = require('../db');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'h1' }, { id: 'h2' }] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/habits/update-bulk')
      .send({ habit_ids: ['h1', 'h2'], title: 'Updated Scales', icon: '🎹' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updated).toBe(2);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE habits SET title = $1'),
      ['Updated Scales', '🎹', ['h1', 'h2']]
    );
  });

  it('returns 400 if title is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/habits/update-bulk')
      .send({ habit_ids: ['h1', 'h2'] });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/habits/by-students', () => {
  it('returns list of active habits for students', async () => {
    const db = require('../db');
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'h1', student_id: 's1', title: 'Practice 1', icon: '🎹', student_name: 'Alice' },
        { id: 'h2', student_id: 's2', title: 'Practice 2', icon: '🎸', student_name: 'Bob' },
      ],
    });

    const app = buildApp();
    const res = await request(app).get('/api/habits/by-students?student_ids=s1,s2');

    expect(res.status).toBe(200);
    expect(res.body.habits).toBeDefined();
    expect(res.body.habits.length).toBe(2);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT h.id, h.student_id, h.title, h.icon'),
      [['s1', 's2']]
    );
  });

  it('returns empty array if student_ids parameter is missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/habits/by-students');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ habits: [] });
  });
});

