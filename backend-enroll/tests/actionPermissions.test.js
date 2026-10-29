const {
  ACTIONS, resolvePersona, canUseTool, toolsForPersona, isOperationsStaff, canMarkAttendanceOn,
} = require('../auth/actionPermissions');

jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
const { TOOL_DEFINITIONS } = require('../llm/skills');

const names = (persona) => toolsForPersona(TOOL_DEFINITIONS, persona).map(t => t.function.name);

describe('tool registry', () => {
  it('has a permission entry for every tool the model can call', () => {
    const missing = TOOL_DEFINITIONS.map(t => t.function.name).filter(n => !ACTIONS[n]);
    expect(missing).toEqual([]);
  });

  it('denies a tool that is not registered', () => {
    expect(canUseTool('admin', 'does.not.exist')).toBe(false);
  });
});

describe('teacher', () => {
  it('is limited to attendance, rosters and schedules on day one', () => {
    expect(names('teacher').sort()).toEqual([
      'attendance.mark', 'attendance.mark_batch', 'batch.roster', 'batch.schedule',
      'fee.query', 'school.locations',
    ]);
  });

  it.each(['payment.record', 'payout.record', 'finance.pnl', 'finance.summary', 'report.revenue',
    'teacher.payout', 'student.update', 'batch.move', 'stats.unpaid', 'payment.status'])(
    'cannot use %s', (tool) => expect(canUseTool('teacher', tool)).toBe(false));
});

describe('head_of_school', () => {
  it.each(['fee.query', 'reminder.payment', 'report.lowcredits', 'stats.unpaid', 'payment.status',
    'attendance.mark', 'attendance.mark_batch', 'batch.move', 'student.list', 'prospect.summary'])(
    'can use %s', (tool) => expect(canUseTool('head_of_school', tool)).toBe(true));

  it.each(['payment.record', 'payout.record', 'finance.summary', 'finance.pnl', 'finance.payouts',
    'chart.finance', 'report.revenue', 'chart.revenue', 'teacher.payout', 'student.update', 'notify.parent'])(
    'cannot use %s', (tool) => expect(canUseTool('head_of_school', tool)).toBe(false));
});

describe('admin', () => {
  it('can use every registered tool', () => {
    expect(names('admin').length).toBe(TOOL_DEFINITIONS.length);
  });
});

describe('parent and student', () => {
  it('cannot use any write tool', () => {
    const writes = Object.entries(ACTIONS).filter(([, a]) => a.write).map(([n]) => n);
    for (const persona of ['parent', 'student']) {
      expect(writes.filter(n => canUseTool(persona, n))).toEqual([]);
    }
  });

  it('cannot list students or see finance', () => {
    expect(canUseTool('parent', 'student.list')).toBe(false);
    expect(canUseTool('student', 'finance.summary')).toBe(false);
  });
});

describe('money-flagged tools', () => {
  it('are admin only', () => {
    const money = Object.entries(ACTIONS).filter(([, a]) => a.money);
    expect(money.length).toBeGreaterThan(0);
    for (const [, a] of money) expect(a.roles).toEqual(['admin']);
  });
});

describe('resolvePersona', () => {
  it('picks the most privileged role regardless of order', () => {
    expect(resolvePersona(['teacher', 'admin'])).toBe('admin');
    expect(resolvePersona(['teacher', 'head_of_school'])).toBe('head_of_school');
    expect(resolvePersona(['parent', 'teacher'])).toBe('teacher');
  });

  it('returns null for unknown or missing roles', () => {
    expect(resolvePersona(['superuser'])).toBeNull();
    expect(resolvePersona(undefined)).toBeNull();
  });
});

describe('attendance dates', () => {
  const today = '2026-10-29';
  it('limits teachers to today', () => {
    expect(canMarkAttendanceOn(['teacher'], today, today)).toBe(true);
    expect(canMarkAttendanceOn(['teacher'], '2026-10-28', today)).toBe(false);
  });

  it('lets admin and head of school mark any date', () => {
    expect(canMarkAttendanceOn(['admin'], '2026-10-01', today)).toBe(true);
    expect(canMarkAttendanceOn(['head_of_school'], '2026-10-01', today)).toBe(true);
  });

  it('treats a user who is both teacher and head of school as operations staff', () => {
    expect(isOperationsStaff(['teacher', 'head_of_school'])).toBe(true);
  });
});
