'use strict';

// Single source of truth for which persona may use which agent tool.
//
// A persona is derived from the logged-in user's roles, never from message text.
// Tools a persona may not use are removed from the list sent to the model AND
// rejected again at execution time, so a guessed tool name still fails.
// A tool missing from ACTIONS is denied for everyone.

const ADMIN = 'admin';
const HOS = 'head_of_school';
const TEACHER = 'teacher';
const PARENT = 'parent';
const STUDENT = 'student';

// Highest authority first: a user holding several roles acts as the most privileged one.
const PERSONA_PRIORITY = [ADMIN, HOS, TEACHER, PARENT, STUDENT];

// Admin and Head of School run the school day to day; teachers are scoped to their classes.
const OPERATIONS_STAFF = [ADMIN, HOS];
const ATTENDANCE_STAFF = [ADMIN, HOS, TEACHER];
const END_USERS = [PARENT, STUDENT];

const read = (roles) => ({ roles, write: false, money: false });
const write = (roles, extra = {}) => ({ roles, write: true, money: false, ...extra });

const ACTIONS = {
  // Open to everyone, including parents and students (public information)
  'school.locations': read([ADMIN, HOS, TEACHER, PARENT, STUDENT]),
  'fee.query': read([ADMIN, HOS, TEACHER, PARENT, STUDENT]),
  'batch.schedule': read([ADMIN, HOS, TEACHER, PARENT, STUDENT]),

  // A parent or student's own record (the handler narrows it to their own children)
  'student.credits': read([ADMIN, HOS, ...END_USERS]),
  'student.profile': read([ADMIN, HOS, ...END_USERS]),
  'payment.status': read([ADMIN, HOS, ...END_USERS]),

  // Roster lookups needed to mark attendance
  'batch.roster': read(ATTENDANCE_STAFF),

  // Operations and academic reads
  'student.lookup': read(OPERATIONS_STAFF),
  'student.list': read(OPERATIONS_STAFF),
  'teacher.list': read(OPERATIONS_STAFF),
  'teacher.profile': read(OPERATIONS_STAFF),
  'teacher.students': read(OPERATIONS_STAFF),
  'report.attendance': read(OPERATIONS_STAFF),
  'stats.students': read(OPERATIONS_STAFF),
  'stats.attendance': read(OPERATIONS_STAFF),
  'stats.turnover': read(OPERATIONS_STAFF),
  'stats.turnover_by_stream': read(OPERATIONS_STAFF),
  'stats.turnover_by_teacher': read(OPERATIONS_STAFF),
  'chart.attendance': read(OPERATIONS_STAFF),
  'chart.students': read(OPERATIONS_STAFF),
  'chart.turnover': read(OPERATIONS_STAFF),
  'prospect.summary': read(OPERATIONS_STAFF),
  'prospect.list': read(OPERATIONS_STAFF),
  'prospect.aging': read(OPERATIONS_STAFF),
  'prospect.followup': read(OPERATIONS_STAFF),
  'chart.prospects': read(OPERATIONS_STAFF),

  // Fee visibility: Head of School may see what is owed, never revenue or payouts
  'reminder.payment': read(OPERATIONS_STAFF),
  'report.lowcredits': read(OPERATIONS_STAFF),
  'stats.unpaid': read(OPERATIONS_STAFF),

  // Revenue, finance and teacher pay: Admin only
  'report.revenue': read([ADMIN]),
  'chart.revenue': read([ADMIN]),
  'finance.summary': read([ADMIN]),
  'finance.revenue': read([ADMIN]),
  'finance.expenses': read([ADMIN]),
  'finance.pnl': read([ADMIN]),
  'finance.payouts': read([ADMIN]),
  'chart.finance': read([ADMIN]),
  'teacher.payout': read([ADMIN]),

  // Writes
  'attendance.mark': write(ATTENDANCE_STAFF),
  'attendance.mark_batch': write(ATTENDANCE_STAFF),
  'batch.move': write(OPERATIONS_STAFF),
  'student.update': write([ADMIN]),
  'enroll.student': write([ADMIN]),
  'notify.parent': write([ADMIN]),
  'notify.batch': read(OPERATIONS_STAFF),
  'payment.record': write([ADMIN], { money: true }),
  'payout.record': write([ADMIN], { money: true }),
};

// The persona a set of roles acts as, or null when none is recognised.
function resolvePersona(roles) {
  const held = roles || [];
  return PERSONA_PRIORITY.find(r => held.includes(r)) || null;
}

function canUseTool(persona, toolName) {
  const action = ACTIONS[toolName];
  return !!action && action.roles.includes(persona);
}

function getAction(toolName) {
  return ACTIONS[toolName] || null;
}

// Tool definitions (OpenAI function format) the persona is allowed to see.
function toolsForPersona(toolDefinitions, persona) {
  return toolDefinitions.filter(t => canUseTool(persona, t.function.name));
}

// Admin and Head of School act on any batch; teachers need a linked teacher profile.
function isOperationsStaff(roles) {
  return OPERATIONS_STAFF.some(r => (roles || []).includes(r));
}

// Teachers may only mark attendance for today; Admin and Head of School for any date.
function canMarkAttendanceOn(roles, date, today) {
  return isOperationsStaff(roles) || date === today;
}

module.exports = {
  ACTIONS,
  PERSONA_PRIORITY,
  resolvePersona,
  canUseTool,
  getAction,
  toolsForPersona,
  isOperationsStaff,
  canMarkAttendanceOn,
};
