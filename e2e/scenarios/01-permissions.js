'use strict';

// Step 1: per-persona agent permissions (teacher / head of school / admin).

const fs = require('fs');
const { query } = require('../harness/db');

const MONEY_TOOLS = ['finance.summary', 'finance.pnl', 'report.revenue', 'payment.record', 'payout.record', 'teacher.payout'];

const readLlmLog = (file) => (fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []);

const said = (reply) => (reply.text || '');
const refused = (reply) => /can't|cannot|don't have access/i.test(said(reply));

module.exports = {
  name: '01-permissions',
  title: 'Step 1: persona permissions in chat',

  async run({ session, llmLog, seeded }) {
    const results = [];
    const { today, yesterday } = seeded;

    // Admin: full access, including finance
    {
      const s = await session('admin');
      await s.open();
      await s.shot('admin-dashboard');
      await s.openChat();
      await s.shot('admin-chat-open');

      const fin = await s.ask('Give me this month finance summary');
      await s.shot('admin-finance-summary');
      s.check('Admin can ask for the finance summary', fin.status === 200 && fin.type !== 'error', `type=${fin.type}`);

      const overdue = await s.ask('Who has overdue payments?');
      await s.shot('admin-overdue-payments');
      s.check('Admin sees the overdue list including Neha Reddy', JSON.stringify(overdue).includes('Neha Reddy'));

      // Onboarding: admin provisions a Head of School by email from the Users screen
      await s.page.getByLabel('Close chat').click();
      await s.page.locator('nav').getByText('Users', { exact: true }).first().click();
      await s.page.getByRole('button', { name: '+ Provision User' }).click();
      await s.page.getByRole('button', { name: 'Head of School' }).first().click();
      await s.page.getByPlaceholder('user@gmail.com').fill('new.hos@local.dev');
      await s.shot('admin-provision-head-of-school-form');
      await s.page.getByRole('button', { name: 'Provision', exact: true }).click();
      await s.page.getByText('new.hos@local.dev').first().waitFor({ timeout: 15000 });
      await s.page.waitForTimeout(800);
      await s.shot('admin-head-of-school-provisioned');
      const prov = (await query(`SELECT entity_type, role, entity_id FROM provisioned_users WHERE email = 'new.hos@local.dev'`)).rows[0];
      s.check('Admin can provision a Head of School by email', prov?.role === 'head_of_school' && prov.entity_id === null, JSON.stringify(prov));
      results.push(await s.close());
    }

    // Head of School: operations and fees, no finance
    {
      const s = await session('head_of_school');
      await s.open();
      await s.shot('hos-attendance-tab');
      await s.openChat();
      await s.shot('hos-chat-open');

      const overdue = await s.ask('Who has overdue payments?');
      await s.shot('hos-overdue-payments');
      s.check('Head of School can see overdue fees (Neha Reddy listed)', JSON.stringify(overdue).includes('Neha Reddy'));

      const fin = await s.ask('Give me this month finance summary');
      await s.shot('hos-finance-refused');
      s.check('Head of School is not given finance data',
        refused(fin) && !/net income|expenses/i.test(JSON.stringify(fin)), said(fin).slice(0, 80));

      const forced = await s.ask('FORCE:payment.record');
      await s.shot('hos-forced-payment-blocked');
      s.check('A forced payment.record call is refused at execution time', /don't have access/i.test(said(forced)), said(forced).slice(0, 80));

      await s.ask('Get all students for Keyboard for date yesterday');
      const marked = await s.ask('Mark all present except Neha Reddy');
      await s.shot('hos-marked-yesterday');
      s.check('Head of School can mark attendance for a past date', /Saved \d+ change/i.test(said(marked)), said(marked).slice(0, 80));
      results.push(await s.close());
    }

    // Teacher: attendance only, today only
    {
      const s = await session('teacher');
      await s.open();
      await s.shot('teacher-profile');
      await s.openChat();
      await s.shot('teacher-chat-open');

      const fin = await s.ask('Give me this month finance summary');
      await s.shot('teacher-finance-refused');
      s.check('Teacher is not given finance data', refused(fin) && !/net income/i.test(said(fin)), said(fin).slice(0, 80));

      const overdue = await s.ask('Who has overdue payments?');
      s.check('Teacher cannot see the overdue list', !JSON.stringify(overdue).includes('Neha Reddy'));

      for (const tool of ['payment.record', 'payout.record']) {
        const forced = await s.ask(`FORCE:${tool}`);
        s.check(`A forced ${tool} call is refused for a teacher`, /don't have access/i.test(said(forced)), said(forced).slice(0, 60));
      }
      await s.shot('teacher-forced-calls-blocked');

      const list = await s.ask("Get all students for Keyboard for date today");
      await s.shot('teacher-class-list');
      s.check("Teacher can pull today's class list", /Priya Singh/.test(JSON.stringify(list)), `type=${list.type}`);

      const markToday = await s.ask('Mark all present except Neha Reddy');
      await s.shot('teacher-marked-today');
      s.check('Teacher can mark attendance for today', /Saved \d+ change/i.test(said(markToday)), said(markToday).slice(0, 80));

      await s.ask('Get all students for Keyboard for date yesterday');
      const markPast = await s.ask('Mark all present');
      await s.shot('teacher-past-date-blocked');
      s.check('Teacher is blocked from marking a past date', /only mark attendance for today/i.test(said(markPast)), said(markPast).slice(0, 80));
      results.push(await s.close());
    }

    // What the database and the model call log show
    const rows = (await query(
      `SELECT ar.session_date::text AS d, ar.status, ar.source, s.name
         FROM attendance_records ar JOIN students s ON s.id = ar.student_id
        WHERE ar.session_date IN ($1, $2) ORDER BY ar.session_date, s.name`, [today, yesterday])).rows;
    const todayRows = rows.filter(r => r.d === today);
    const yRows = rows.filter(r => r.d === yesterday);
    const payments = (await query('SELECT COUNT(*)::int AS n FROM payments')).rows[0].n;
    const payouts = (await query('SELECT COUNT(*)::int AS n FROM teacher_payouts')).rows[0].n;

    const calls = readLlmLog(llmLog);
    const offeredTo = (persona) => [...new Set(calls.filter(c => c.persona === persona).flatMap(c => c.offered))].sort();
    const teacherTools = offeredTo('teacher');
    const hosTools = offeredTo('head of school');

    const evidence = [
      `Attendance written today (${today}) by the teacher: ${todayRows.length} rows`,
      ...todayRows.map(r => `  ${r.name}: ${r.status} (${r.source})`),
      `Attendance written yesterday (${yesterday}) by Head of School: ${yRows.length} rows`,
      ...yRows.map(r => `  ${r.name}: ${r.status} (${r.source})`),
      `Payments in the database after the forced calls: ${payments} (3 were seeded); teacher payouts: ${payouts}`,
      `Tools offered to the model for a teacher (${teacherTools.length}): ${teacherTools.join(', ')}`,
      `Tools offered to the model for Head of School (${hosTools.length}); money tools among them: ${hosTools.filter(t => MONEY_TOOLS.includes(t)).join(', ') || 'none'}`,
    ];

    const extra = [
      ['A teacher is offered only attendance, roster, schedule and public tools', teacherTools.length > 0 && teacherTools.length <= 6],
      ['No finance or money tool is offered to a teacher', !teacherTools.some(t => MONEY_TOOLS.includes(t))],
      ['No finance or money tool is offered to Head of School', !hosTools.some(t => MONEY_TOOLS.includes(t))],
      ['Head of School is offered the fee tools (fee prices, overdue list, payment status)', ['fee.query', 'reminder.payment', 'payment.status', 'stats.unpaid'].every(t => hosTools.includes(t))],
      ['Teacher attendance for today was saved', todayRows.length >= 1],
      ['Head of School attendance for yesterday was saved', yRows.length >= 1],
      ['No payment or payout was created by any forced call', payments === 3 && payouts === 0],
    ];
    return { results, extra, evidence };
  },
};
