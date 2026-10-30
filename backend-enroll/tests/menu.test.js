'use strict';

// The chat menu: structure, role filtering and per-area tool narrowing. No database needed.
jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));

const { buildMenu, toolsForAreaId } = require('../llm/menu');
const { TOOL_DEFINITIONS, skills } = require('../llm/skills');
const { canUseTool } = require('../auth/actionPermissions');

const PERSONAS = ['admin', 'head_of_school', 'teacher', 'parent', 'student'];
const toolNames = new Set(TOOL_DEFINITIONS.map(t => t.function.name));
const itemsOf = (persona) => buildMenu(persona).flatMap(a => a.items.map(i => ({ area: a.id, ...i })));
const labels = (persona) => buildMenu(persona).map(a => a.label);

describe('menu structure', () => {
  it.each(PERSONAS)('every %s option points at a real skill the persona may use', (persona) => {
    for (const item of itemsOf(persona)) {
      expect(toolNames.has(item.skill)).toBe(true);
      expect(typeof skills[item.skill]).toBe('function');
      expect(canUseTool(persona, item.skill)).toBe(true);
    }
  });

  it('gives every step a unique id, a kind, and choices with a label and value', () => {
    for (const item of itemsOf('admin')) {
      const ids = new Set();
      for (const step of item.ask || []) {
        expect(ids.has(step.id)).toBe(false);
        ids.add(step.id);
        expect(['choice', 'date', 'instrument', 'teacher', 'student', 'text']).toContain(step.kind);
        if (step.kind === 'choice') {
          expect(step.options.length).toBeGreaterThan(0);
          step.options.forEach(o => { expect(o.label).toBeTruthy(); expect(typeof o.value).toBe('string'); });
        }
        // A step may only depend on an answer given earlier in the same option
        Object.keys(step.when || {}).forEach(dep => expect(ids.has(dep)).toBe(true));
      }
    }
  });

  it('never leaks role bookkeeping to the client', () => {
    const json = JSON.stringify(buildMenu('admin'));
    expect(json).not.toContain('skipFor');
    expect(json).not.toContain('"roles"');
  });

  it('uses the same state and ids on repeated builds', () => {
    expect(JSON.stringify(buildMenu('admin'))).toBe(JSON.stringify(buildMenu('admin')));
  });
});

describe('menu by persona', () => {
  it('shows admin every area', () => {
    expect(labels('admin')).toEqual(['Attendance', 'Batches', 'Students', 'Payments', 'Finance', 'Growth', 'More']);
  });

  it('keeps Finance away from Head of School and teachers', () => {
    expect(labels('head_of_school')).not.toContain('Finance');
    expect(labels('teacher')).not.toContain('Finance');
  });

  it('lets Head of School see payments but not record or pay out', () => {
    const ids = itemsOf('head_of_school').map(i => i.skill);
    expect(ids).toContain('payment.status');
    expect(ids).not.toContain('payment.record');
    expect(ids).not.toContain('payout.record');
  });

  it('shows parents and students only their own areas, relabelled', () => {
    for (const p of ['parent', 'student']) {
      const areas = buildMenu(p).map(a => a.id);
      expect(areas).not.toContain('attendance');
      expect(areas).not.toContain('finance');
      expect(areas).not.toContain('growth');
    }
    expect(labels('parent')).toContain('My child');
    expect(labels('student')).toContain('My classes');
  });

  it("does not ask a parent or student which student, because it is always their own", () => {
    const credits = itemsOf('parent').find(i => i.skill === 'student.credits');
    expect(credits.ask.some(s => s.kind === 'student')).toBe(false);
    const adminCredits = itemsOf('admin').find(i => i.skill === 'student.credits');
    expect(adminCredits.ask.some(s => s.kind === 'student')).toBe(true);
  });

  it("offers a teacher 'My students' but not 'All classes' in the roll-call", () => {
    const scope = (p) => itemsOf(p).find(i => i.skill === 'attendance.rollcall').ask.find(s => s.id === 'scope').options.map(o => o.label);
    expect(scope('teacher')).toContain('My students');
    expect(scope('teacher')).not.toContain('All classes');
    expect(scope('admin')).toContain('All classes');
    expect(scope('admin')).not.toContain('My students');
  });

  it("sends 'me' for a teacher's own students", () => {
    const mine = itemsOf('teacher').find(i => i.skill === 'attendance.rollcall').ask.find(s => s.id === 'scope').options.find(o => o.value === 'mine');
    expect(mine.params).toEqual({ teacher: 'me' });
  });

  it('puts last month as YYYY-MM on the finance month pickers', () => {
    const summary = itemsOf('admin').find(i => i.skill === 'finance.summary');
    const last = summary.ask[0].options.find(o => o.value === 'last');
    expect(last.params.month).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('tools narrowed by area', () => {
  it("keeps a teacher's attendance area to attendance tools", () => {
    const names = toolsForAreaId('attendance', 'teacher');
    expect(names.has('attendance.rollcall')).toBe(true);
    expect(names.has('attendance.mark_batch')).toBe(true);
    expect(names.has('payment.record')).toBe(false);
    expect(names.has('finance.summary')).toBe(false);
  });

  it('keeps the core lookups available in every area', () => {
    for (const area of ['attendance', 'batches', 'payments', 'finance']) {
      const names = toolsForAreaId(area, 'admin');
      expect(names.has('student.lookup')).toBe(true);
      expect(names.has('school.locations')).toBe(true);
    }
  });

  it('never grants a tool the persona may not use', () => {
    const names = toolsForAreaId('payments', 'head_of_school');
    expect(names.has('payment.record')).toBe(false);
    expect(names.has('payment.status')).toBe(true);
  });

  it('does not narrow for an unknown area', () => {
    expect(toolsForAreaId('nope', 'admin')).toBeNull();
  });
});
