const {
  ACTIONS, resolvePersona, canUseTool, toolsForPersona, isOperationsStaff, canMarkAttendanceOn,
  canPropose, canApprove, canAutoApprove,
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
      'attendance.mark', 'attendance.mark_batch', 'attendance.rollcall', 'attendance.student_history',
      'batch.find', 'batch.move', 'batch.roster',
      'batch.schedule', 'fee.query', 'school.locations', 'student.batches',
    ]);
  });

  it.each(['payment.record', 'payout.record', 'finance.pnl', 'finance.summary', 'report.revenue',
    'teacher.payout', 'student.update', 'batch.create', 'batch.update', 'stats.unpaid', 'payment.status'])(
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
  // Proposal-only actions: Head of School may raise them, but only Admin can approve them.
  const PROPOSAL_ONLY = ['payment.submit', 'payment.dispute'];

  it('are admin only, except the proposal-only payment actions', () => {
    const money = Object.entries(ACTIONS).filter(([n, a]) => a.money && !PROPOSAL_ONLY.includes(n));
    expect(money.length).toBeGreaterThan(0);
    for (const [, a] of money) expect(a.roles).toEqual(['admin']);
  });

  it('are always approved by Admin alone, including the proposal-only ones', () => {
    for (const [, a] of Object.entries(ACTIONS).filter(([, x]) => x.money)) expect(a.approvers).toEqual(['admin']);
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

describe('proposals: who may propose and approve', () => {
  it('lets a teacher propose attendance but not approve it', () => {
    expect(canPropose('teacher', 'attendance.mark_batch')).toBe(true);
    expect(canApprove(['teacher'], 'attendance.mark_batch')).toBe(false);
  });

  it('lets Head of School approve operational actions', () => {
    expect(canApprove(['head_of_school'], 'attendance.mark_batch')).toBe(true);
    expect(canApprove(['head_of_school'], 'batch.move')).toBe(true);
  });

  it('never lets Head of School approve or propose money actions', () => {
    expect(canApprove(['head_of_school'], 'payment.record')).toBe(false);
    expect(canApprove(['head_of_school'], 'payout.record')).toBe(false);
    expect(canPropose('head_of_school', 'payment.record')).toBe(false);
  });

  it('lets Admin approve everything that writes, including money', () => {
    for (const [name, action] of Object.entries(ACTIONS).filter(([, a]) => a.write)) {
      expect([name, canApprove(['admin'], name)]).toEqual([name, true]);
    }
  });

  it('judges approval on every role held, not only the first', () => {
    expect(canApprove(['teacher', 'head_of_school'], 'batch.move')).toBe(true);
    expect(canApprove(['teacher', 'head_of_school'], 'payment.record')).toBe(false);
  });

  it('cannot approve reads or unknown actions', () => {
    expect(canApprove(['admin'], 'fee.query')).toBe(false);
    expect(canApprove(['admin'], 'does.not.exist')).toBe(false);
  });

  it('flags every money action as Admin-only to approve', () => {
    for (const [name, action] of Object.entries(ACTIONS).filter(([, a]) => a.money)) {
      expect([name, canApprove(['head_of_school'], name)]).toEqual([name, false]);
    }
  });
});
describe('payments: auto-approval and disputes', () => {
  it('lets Admin and Head of School submit payments, but not a teacher', () => {
    expect(canPropose('admin', 'payment.submit')).toBe(true);
    expect(canPropose('head_of_school', 'payment.submit')).toBe(true);
    expect(canPropose('teacher', 'payment.submit')).toBe(false);
  });

  it('allows auto-approval only for the submit action, and only for Admin and Head of School', () => {
    expect(canAutoApprove('admin', 'payment.submit')).toBe(true);
    expect(canAutoApprove('head_of_school', 'payment.submit')).toBe(true);
    expect(canAutoApprove('teacher', 'payment.submit')).toBe(false);
    for (const [name] of Object.entries(ACTIONS).filter(([n]) => n !== 'payment.submit')) {
      expect([name, canAutoApprove('admin', name)]).toEqual([name, false]);
    }
  });

  it('keeps a Head of School from approving any money action, including the new ones', () => {
    expect(canApprove(['head_of_school'], 'payment.submit')).toBe(false);
    expect(canApprove(['head_of_school'], 'payment.dispute')).toBe(false);
    expect(canApprove(['admin'], 'payment.dispute')).toBe(true);
  });

  it('lets Head of School raise a dispute', () => {
    expect(canPropose('head_of_school', 'payment.dispute')).toBe(true);
    expect(canPropose('teacher', 'payment.dispute')).toBe(false);
  });

  it('does not hand Head of School the direct payment chat tool', () => {
    expect(canUseTool('head_of_school', 'payment.record')).toBe(false);
    expect(canUseTool('head_of_school', 'payment.submit')).toBe(true);
  });
});