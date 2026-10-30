'use strict';

// The menu that drives Cleff conversations: areas (Attendance, Batches, ...) with options, and
// for each option the questions to ask before its skill runs. It is defined once here and
// filtered per user from the permissions registry, so the phone never decides who may see what.
//
// An option is either
//   - runnable: `skill` + fixed `params` + `ask` steps. The phone collects each step's answer
//     (chips, or typed text) and posts { skill, params } to POST /api/chat/action, no LLM, or
//   - a guide (`type: 'guide'`): a prompt that tells the user how to phrase the request, for
//     actions that need free text (create a batch, record a payment).
//
// Step kinds: choice (options), date, day, instrument, teacher, student, text.
// A step with `param` sets that skill parameter to the answer; without one it is virtual (it
// only steers later steps through `when`). A choice option may add `params` of its own.

const { canUseTool } = require('../auth/actionPermissions');

const OPS = ['admin', 'head_of_school'];
const STAFF = [...OPS, 'teacher'];

const opt = (label, value, extra = {}) => ({ label, value, ...extra });

// Step builders
const choice = (id, param, prompt, options, extra = {}) => ({ id, kind: 'choice', param, prompt, options, ...extra });
const date = (extra = {}) => ({ id: 'date', kind: 'date', param: 'date', prompt: 'Which day?', ...extra });
const instrument = (param = 'instrument', extra = {}) => ({ id: 'instrument', kind: 'instrument', param, prompt: 'Which instrument?', ...extra });
const teacher = (param = 'teacher', extra = {}) => ({ id: 'teacher', kind: 'teacher', param, prompt: 'Which teacher?', ...extra });
// A student's own record needs no question for parents and students
const student = (param = 'student_id') => ({ id: 'student', kind: 'student', param, prompt: 'Which student? Type their name.', skipFor: ['parent', 'student'] });
const text = (id, param, prompt) => ({ id, kind: 'text', param, prompt });

const DAYS = ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayStep = (extra = {}) => choice('day', 'day', 'Which day?', DAYS.map(d => opt(d.slice(0, 3), d)), extra);

const run = (id, label, skill, extra = {}) => ({ id, label, skill, ...extra });
const guide = (id, label, skill, say, extra = {}) => ({ id, label, skill, type: 'guide', guide: say, ...extra });

// "last month" as YYYY-MM for the finance month pickers
function lastMonth(now) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function definition(now) {
  const lm = lastMonth(now);
  const thisOrLast = (id = 'month') => choice(id, null, 'Which month?', [opt('This month', 'this'), opt('Last month', 'last', { params: { month: lm } })]);
  const periods = (id, values) => choice(id, 'period', 'Which period?', values);

  return [
    {
      id: 'attendance', label: 'Attendance', icon: '📋',
      // The tools the LLM sees while this area is active, besides the options' own skills
      tools: ['attendance.mark_batch', 'attendance.mark'],
      items: [
        run('rollcall', 'Roll-call', 'attendance.rollcall', {
          ask: [
            date(),
            choice('scope', null, 'Whose students?', [
              opt('My students', 'mine', { params: { teacher: 'me' }, roles: ['teacher'] }),
              opt('All classes', 'all', { roles: OPS }),
              opt('One instrument', 'instrument'),
              opt("A teacher's students", 'teacher'),
            ]),
            instrument('instrument', { when: { scope: 'instrument' } }),
            teacher('teacher', { when: { scope: 'teacher' } }),
          ],
        }),
        run('history', "A student's history", 'attendance.student_history', {
          ask: [student(), choice('range', 'days', 'How far back?', [opt('Last 7 days', '7'), opt('Last 14 days', '14'), opt('Last 30 days', '30')])],
        }),
        run('summary', 'Summary', 'stats.attendance', {
          ask: [periods('period', [opt('Today', 'today'), opt('This week', 'week'), opt('This month', 'month')])],
        }),
        run('chart', 'Chart', 'chart.attendance', {
          ask: [periods('period', [opt('This week', 'week'), opt('This month', 'month')])],
        }),
      ],
    },
    {
      id: 'batches', label: 'Batches', icon: '🎸',
      labels: { parent: 'Class schedule', student: 'Class schedule' },
      tools: ['batch.find', 'batch.roster', 'batch.schedule', 'student.batches', 'batch.move', 'batch.create', 'batch.update'],
      items: [
        run('find', 'Find batches', 'batch.find', {
          ask: [
            choice('by', null, 'Find by…', [opt('Day', 'day'), opt('Instrument', 'instrument'), opt('Teacher', 'teacher', { roles: OPS })]),
            dayStep({ when: { by: 'day' } }),
            instrument('instrument', { when: { by: 'instrument' } }),
            teacher('teacher', { when: { by: 'teacher' } }),
          ],
        }),
        run('roster', 'Who is in a batch', 'batch.roster', { ask: [instrument('batch_id')] }),
        run('schedule', 'Schedule', 'batch.schedule', { ask: [instrument('batch_id')] }),
        run('student_batches', "A student's batches", 'student.batches', { ask: [student()] }),
        run('move', 'Move a student', 'batch.move', { ask: [student()] }),
        guide('create', 'Create a batch', 'batch.create',
          'Tell me the instrument, the day and time, and the teacher (optional). For example: "Create a Guitar batch on Tuesday 5:00-6:00 with Josva".'),
        guide('update', 'Edit a batch', 'batch.update',
          'Tell me which batch and what should change. For example: "Change the Guitar Tuesday 5pm batch to teacher Josva" or "Set capacity of the Keyboard Friday 5pm batch to 7".'),
      ],
    },
    {
      id: 'students', label: 'Students', icon: '👥',
      labels: { parent: 'My child', student: 'My classes' },
      tools: ['student.lookup', 'student.profile', 'student.credits', 'student.list', 'student.update', 'enroll.student'],
      items: [
        run('lookup', 'Find a student', 'student.lookup', { ask: [text('query', 'query', 'Type a name or phone number.')] }),
        run('profile', 'Profile', 'student.profile', { ask: [student()] }),
        run('credits', 'Classes left', 'student.credits', { ask: [student()] }),
        run('list', 'All active students', 'student.list'),
        run('count', 'Counts', 'stats.students'),
        run('turnover', 'Turnover', 'stats.turnover'),
        run('turnover_stream', 'Turnover by instrument', 'stats.turnover_by_stream', {
          ask: [periods('period', [opt('This month', 'this_month'), opt('Last month', 'last_month')])],
        }),
        run('turnover_teacher', 'Turnover by teacher', 'stats.turnover_by_teacher', {
          ask: [periods('period', [opt('This month', 'this_month'), opt('Last month', 'last_month')])],
        }),
        run('turnover_chart', 'Turnover chart', 'chart.turnover', {
          ask: [choice('group_by', 'group_by', 'Break it down by…', [opt('Month', 'month'), opt('Instrument', 'stream'), opt('Teacher', 'teacher')])],
        }),
        guide('update', 'Update contact details', 'student.update',
          'Tell me the student and what to change. For example: "Update Riya\'s phone to 98765 43210".'),
      ],
    },
    {
      id: 'payments', label: 'Payments', icon: '💳',
      tools: ['payment.status', 'payment.followup', 'payment.record', 'reminder.payment', 'report.lowcredits', 'stats.unpaid', 'fee.query'],
      items: [
        run('status', 'A student\'s payments', 'payment.status', { ask: [student()] }),
        run('overdue', 'Overdue and renewals', 'reminder.payment'),
        run('lowcredits', 'Low classes left', 'report.lowcredits'),
        run('unpaid', 'Out of classes', 'stats.unpaid'),
        run('followup', 'Payment reminder on WhatsApp', 'payment.followup', { ask: [student()] }),
        run('fees', 'Fees for an instrument', 'fee.query', { ask: [instrument('instrument')] }),
        guide('record', 'Record a payment', 'payment.record',
          'Tell me the student, amount and how they paid. For example: "Record 3000 UPI payment from Riya".'),
      ],
    },
    {
      id: 'finance', label: 'Finance', icon: '💰',
      tools: ['report.revenue'],
      items: [
        run('summary', 'Summary', 'finance.summary', { ask: [thisOrLast()] }),
        run('pnl', 'Profit & loss', 'finance.pnl', { ask: [thisOrLast()] }),
        run('revenue', 'Revenue', 'finance.revenue', {
          ask: [periods('period', [opt('This month', 'this_month'), opt('Last month', 'last_month'), opt('Last 3 months', 'last_3_months'), opt('This year', 'this_year')])],
        }),
        run('expenses', 'Expenses', 'finance.expenses', {
          ask: [periods('period', [opt('This month', 'this_month'), opt('Last month', 'last_month'), opt('This year', 'this_year')])],
        }),
        run('payouts', 'Teacher payouts', 'finance.payouts', {
          ask: [periods('period', [opt('This month', 'this_month'), opt('Last month', 'last_month'), opt('This year', 'this_year')])],
        }),
        run('payout_estimate', 'Payout estimate', 'teacher.payout', { ask: [teacher('teacher_id')] }),
        run('chart', 'Chart', 'chart.finance', {
          ask: [choice('view', 'view', 'Which chart?', [
            opt('Revenue vs expenses', 'revenue_vs_expenses'), opt('Expenses by category', 'expenses_by_category'), opt('Revenue by instrument', 'revenue_by_instrument'),
          ])],
        }),
        run('revenue_chart', 'Revenue trend', 'chart.revenue'),
        guide('payout_record', 'Record a payout', 'payout.record',
          'Tell me the teacher, amount, method and period. For example: "Record 12000 bank payout for Josva for 1 Oct to 31 Oct".'),
      ],
    },
    {
      id: 'growth', label: 'Growth', icon: '📣',
      tools: [],
      items: [
        run('summary', 'Prospects overview', 'prospect.summary'),
        run('list', 'Prospect list', 'prospect.list', {
          ask: [choice('status', 'status', 'Which status?', [opt('New', 'new'), opt('Contacted', 'contacted'), opt('Enrolled', 'enrolled')])],
        }),
        run('aging', 'How old are the leads', 'prospect.aging'),
        run('followup', 'Follow-ups', 'prospect.followup', {
          ask: [choice('mode', 'mode', 'Which ones?', [opt('Not followed up', 'pending'), opt('Followed up', 'done')])],
        }),
        run('chart', 'Chart', 'chart.prospects', {
          ask: [choice('by', 'by', 'Break it down by…', [opt('Age', 'aging'), opt('Instrument', 'instrument'), opt('Status', 'status')])],
        }),
      ],
    },
    {
      id: 'more', label: 'More', icon: '⋯',
      tools: [],
      items: [
        run('teachers', 'All teachers', 'teacher.list', { group: 'Teachers' }),
        run('teacher_profile', 'Teacher profile', 'teacher.profile', { group: 'Teachers', ask: [teacher('teacher_id')] }),
        run('teacher_students', "A teacher's students", 'teacher.students', { group: 'Teachers', ask: [teacher('teacher_id')] }),
        run('locations', 'Locations', 'school.locations', { group: 'School info' }),
        run('fees', 'Fees', 'fee.query', { group: 'School info', ask: [instrument('instrument')] }),
      ],
    },
  ];
}

// Tools that stay available in every area, so asking about a student or fees never dead-ends
const CORE_TOOLS = ['student.lookup', 'school.locations', 'fee.query'];

// The areas and options this persona may use. Options whose skill the persona can't use are
// dropped, choice options and steps are narrowed to the persona, and an area left with no
// options disappears. `options` carries the pick-lists (instruments, teachers) for the steps.
function buildMenu(persona, now = new Date()) {
  const areas = [];
  for (const area of definition(now)) {
    const items = [];
    for (const item of area.items) {
      if (!canUseTool(persona, item.skill)) continue;
      const ask = (item.ask || [])
        .filter(step => !(step.skipFor || []).includes(persona))
        .map(step => {
          const { skipFor, ...rest } = step; // eslint-disable-line no-unused-vars
          if (!rest.options) return rest;
          return { ...rest, options: rest.options.filter(o => !o.roles || o.roles.includes(persona)).map(({ roles, ...o }) => o) }; // eslint-disable-line no-unused-vars
        });
      // A "Teacher" choice only makes sense for people who can see other teachers' data
      items.push({ ...item, ask });
    }
    if (!items.length) continue;
    areas.push({
      id: area.id,
      label: (area.labels && area.labels[persona]) || area.label,
      icon: area.icon,
      items,
    });
  }
  return areas;
}

// Tool names the LLM may use while `areaId` is active, or null when the area is unknown
// (meaning: no narrowing).
function toolsForAreaId(areaId, persona, now = new Date()) {
  const area = definition(now).find(a => a.id === areaId);
  if (!area) return null;
  const names = new Set([...CORE_TOOLS, ...(area.tools || []), ...area.items.map(i => i.skill)]);
  return new Set([...names].filter(n => canUseTool(persona, n)));
}

module.exports = { buildMenu, toolsForAreaId, STAFF };
