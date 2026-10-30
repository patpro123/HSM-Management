'use strict';

// Step 2: proposal queue, approvals and audit log.
// Teacher proposes attendance, Head of School proposes and approves class moves, Admin
// approves money. Nothing changes until a person with the right role approves.

const { query } = require('../harness/db');

const card = (page, text) => page.locator('[data-testid=proposal]', { hasText: text });
const openApprovals = async (s) => {
  await s.page.locator('nav').getByText('Approvals', { exact: true }).first().click();
  await s.page.waitForTimeout(1000);
};

module.exports = {
  name: '02-proposal-queue',
  title: 'Step 2: proposal queue, approvals and audit log',

  async run({ session, seeded }) {
    const results = [];
    const { today, students, batches } = seeded;
    const ebOf = async (name) => (await query(
      `SELECT eb.id FROM enrollment_batches eb JOIN enrollments e ON e.id = eb.enrollment_id
        JOIN students s ON s.id = e.student_id WHERE s.name = $1`, [name])).rows[0].id;
    const priyaEb = await ebOf('Priya Singh');
    const aishaEb = await ebOf('Aisha Khan');
    const count = async (sql, args) => (await query(sql, args)).rows[0].n;

    const payment = {
      action_type: 'payment.record',
      params: { student_id: students['Neha Reddy'], amount: 5400, payment_method: 'UPI', class_credits: 24, payment_for: 'Keyboard Quarterly (24)' },
      source_message: 'Neha paid 5400 by UPI today',
    };
    const moveOf = (eb) => ({ action_type: 'batch.move', params: { enrollment_batch_id: eb, from_batch_id: batches.keyboardBatch, to_batch_id: batches.keyboardBatch2 } });
    let paymentId;

    // Admin raises a money proposal and sees the empty queue first
    {
      const s = await session('admin', '1-admin-raises');
      await s.open();
      await openApprovals(s);
      await s.shot('queue-empty');
      s.check('Admin sees an empty queue to start', await s.page.getByText('Nothing is waiting for approval.').isVisible());

      const bad = await s.call('POST', '/api/proposals', { ...payment, params: { ...payment.params, amount: -5 } });
      s.check('A proposal with an invalid amount is refused when raised', bad.status === 400, bad.error);

      const first = await s.call('POST', '/api/proposals', payment, { 'Idempotency-Key': 'pay-neha-oct' });
      paymentId = first.proposal?.id;
      const retry = await s.call('POST', '/api/proposals', payment, { 'Idempotency-Key': 'pay-neha-oct' });
      s.check('A money proposal is created as pending', first.status === 201 && first.proposal.status === 'pending' && first.proposal.is_money === true, first.proposal?.summary);
      s.check('A retried request with the same key returns the same proposal', retry.status === 200 && retry.duplicate === true && retry.proposal.id === paymentId);
      s.check('Only one proposal row exists after the retry', await count('SELECT COUNT(*)::int AS n FROM agent_proposals') === 1);
      s.check('No payment exists yet: proposing changes nothing', await count('SELECT COUNT(*)::int AS n FROM payments') === 3);

      await s.page.reload({ waitUntil: 'domcontentloaded' });
      await s.page.getByLabel('Open chat').waitFor({ timeout: 30000 });
      await openApprovals(s);
      await s.shot('admin-money-proposal-pending');
      results.push(await s.close());
    }

    // Teacher proposes attendance; cannot approve, cannot propose money
    {
      const s = await session('teacher', '2-teacher');
      await s.open();
      await s.shot('teacher-profile');

      const att = await s.call('POST', '/api/proposals', {
        action_type: 'attendance.mark_batch',
        params: { records: [
          { batch_id: batches.keyboardBatch, student_id: students['Priya Singh'], date: today, status: 'present' },
          { batch_id: batches.keyboardBatch, student_id: students['Neha Reddy'], date: today, status: 'absent' },
          { batch_id: batches.keyboardBatch, student_id: students['Aisha Khan'], date: today, status: 'present' },
        ] },
        source_channel: 'manual',
      });
      s.check('A teacher can propose attendance for today', att.status === 201, att.proposal?.summary);
      s.check('Attendance was not written by proposing', await count('SELECT COUNT(*)::int AS n FROM attendance_records WHERE session_date = $1', [today]) === 0);

      const past = await s.call('POST', '/api/proposals', {
        action_type: 'attendance.mark_batch',
        params: { records: [{ batch_id: batches.keyboardBatch, student_id: students['Priya Singh'], date: seeded.yesterday, status: 'present' }] },
      });
      s.check('A teacher cannot propose attendance for a past date', past.status === 403, past.error);

      const money = await s.call('POST', '/api/proposals', payment);
      s.check('A teacher cannot propose a payment', money.status === 403, money.error);

      const own = await s.call('POST', `/api/proposals/${att.proposal.id}/approve`, {});
      s.check('A teacher cannot approve their own proposal', own.status === 403, own.error);
      const peek = await s.call('POST', `/api/proposals/${paymentId}/approve`, {});
      s.check("A teacher cannot see or approve someone else's money proposal", peek.status === 404, peek.error);

      const mine = await s.call('GET', '/api/proposals');
      s.check('A teacher only lists their own proposals', mine.proposals.length === 1 && mine.proposals[0].id === att.proposal.id);
      results.push(await s.close());
    }

    // Head of School: sees operational proposals, never money; approves, and a stale one fails safely
    {
      const s = await session('head_of_school', '3-head-of-school');
      const a = await s.call('POST', '/api/proposals', moveOf(priyaEb));
      const b1 = await s.call('POST', '/api/proposals', moveOf(aishaEb));
      const b2 = await s.call('POST', '/api/proposals', moveOf(aishaEb));
      s.check('Head of School can propose moving a student between classes', a.status === 201 && b1.status === 201 && b2.status === 201, a.proposal?.summary);
      const pay = await s.call('POST', '/api/proposals', payment);
      s.check('Head of School cannot propose a payment', pay.status === 403, pay.error);

      await s.open();
      await openApprovals(s);
      await s.shot('hos-queue-operational-only');
      const visible = await s.page.locator('[data-testid=proposal]').count();
      s.check('Head of School sees the 4 operational proposals and no money proposal',
        visible === 4 && !(await s.page.getByText('5,400').count()), `cards=${visible}`);

      const moneyTry = await s.call('POST', `/api/proposals/${paymentId}/approve`, {});
      s.check('Head of School cannot approve the money proposal', moneyTry.status === 404 || moneyTry.status === 403, `${moneyTry.status} ${moneyTry.error}`);

      await card(s.page, 'Mark attendance').getByRole('button', { name: 'Approve' }).click();
      await s.page.waitForTimeout(1200);
      await s.shot('hos-attendance-approved');
      const rows = (await query(`SELECT s.name, ar.status, ar.notes FROM attendance_records ar JOIN students s ON s.id = ar.student_id WHERE ar.session_date = $1 ORDER BY s.name`, [today])).rows;
      s.check('Approving the attendance proposal wrote 3 records', rows.length === 3, rows.map(r => `${r.name}:${r.status}`).join(', '));
      s.check('Each record notes who proposed and who approved', rows.every(r => /Proposed by Local Teacher, approved by Local Head of School/.test(r.notes || '')), rows[0]?.notes);

      await card(s.page, 'Priya Singh').getByRole('button', { name: 'Approve' }).click();
      await s.page.waitForTimeout(1200);
      const moved = (await query(`SELECT batch_id FROM enrollment_batches WHERE id = $1`, [priyaEb])).rows[0];
      s.check('Approving the move put Priya in the second Keyboard class', moved.batch_id === batches.keyboardBatch2);

      // Two proposals for Aisha: the first succeeds, the second is stale by then
      await card(s.page, 'Aisha Khan').first().getByRole('button', { name: 'Approve' }).click();
      await s.page.waitForTimeout(1200);
      await card(s.page, 'Aisha Khan').first().getByRole('button', { name: 'Approve' }).click();
      await s.page.getByRole('alert').waitFor({ timeout: 10000 });
      await s.page.waitForTimeout(600);
      await s.shot('hos-stale-proposal-failed');
      // The queue lists newest first, so b2 ran first and b1 is the stale one.
      const failed = (await query(`SELECT status, error FROM agent_proposals WHERE id = $1`, [b1.proposal.id])).rows[0];
      s.check('A proposal that can no longer run is marked failed with the reason', failed.status === 'failed' && /not found in source batch/i.test(failed.error), failed.error);

      const again = await s.call('POST', `/api/proposals/${a.proposal.id}/approve`, {});
      s.check('Approving an already-executed proposal is refused (no double execution)', again.status === 409, again.error);

      await s.page.getByRole('button', { name: 'All', exact: true }).click();
      await s.page.waitForTimeout(900);
      await card(s.page, 'Mark attendance').getByRole('button', { name: 'History' }).click();
      await s.page.waitForTimeout(700);
      await s.shot('hos-all-with-history');
      results.push(await s.close());
    }

    // Admin approves the money proposal, rejects another, and the audit trail is checked
    {
      const s = await session('admin', '4-admin-approves');
      const rejectMe = await s.call('POST', '/api/proposals', { ...payment, params: { ...payment.params, amount: 100, class_credits: 0 } }, { 'Idempotency-Key': 'pay-small' });
      await s.open();
      await openApprovals(s);
      await s.shot('admin-sees-money-proposals');

      await card(s.page, '₹100').getByRole('button', { name: 'Reject' }).click();
      await s.page.waitForTimeout(1000);
      await card(s.page, 'Neha Reddy').getByRole('button', { name: 'Approve' }).click();
      await s.page.waitForTimeout(1500);
      await s.shot('admin-money-approved');

      const pay = (await query(`SELECT amount::float AS amount, recorded_by, metadata FROM payments WHERE student_id = $1`, [students['Neha Reddy']])).rows;
      s.check('Approving the money proposal recorded exactly one payment of 5400', pay.length === 1 && pay[0].amount === 5400, JSON.stringify(pay.map(p => p.amount)));
      s.check('The payment is recorded under the approving admin', pay[0]?.recorded_by === '11111111-1111-1111-1111-111111111111');
      const credits = (await query(`SELECT eb.classes_remaining FROM enrollment_batches eb JOIN enrollments e ON e.id = eb.enrollment_id WHERE e.student_id = $1`, [students['Neha Reddy']])).rows[0];
      s.check('Neha got her 24 class credits', credits.classes_remaining === 24, `remaining=${credits.classes_remaining}`);
      s.check('The rejected proposal created no payment', await count(`SELECT COUNT(*)::int AS n FROM payments`) === 4);
      const rej = (await query(`SELECT status FROM agent_proposals WHERE id = $1`, [rejectMe.proposal.id])).rows[0];
      s.check('The rejected proposal is marked rejected', rej.status === 'rejected');
      const selfFlag = (await query(`SELECT self_approved FROM agent_proposals WHERE id = $1`, [paymentId])).rows[0];
      s.check('Admin approving their own proposal is flagged self-approved', selfFlag.self_approved === true);

      await s.page.getByRole('button', { name: 'All', exact: true }).click();
      await s.page.waitForTimeout(900);
      await card(s.page, '₹5,400').getByRole('button', { name: 'History' }).click();
      await s.page.waitForTimeout(700);
      await s.shot('admin-all-with-audit-history');
      results.push(await s.close());
    }

    // Audit log
    const audit = (await query(`SELECT action, actor_role, payload->>'action_type' AS t FROM audit_logs WHERE action LIKE 'proposal.%' ORDER BY timestamp, id`)).rows;
    const tally = audit.reduce((m, r) => ({ ...m, [r.action]: (m[r.action] || 0) + 1 }), {});
    const tamper = async (sql) => { try { await query(sql); return false; } catch (e) { return /append-only/.test(e.message); } };
    const extra = [
      ['Every proposal has a created entry in the audit log', tally['proposal.created'] === 6, JSON.stringify(tally)],
      ['Approvals and executions are audited', tally['proposal.approved'] === 4 && tally['proposal.executed'] === 4],
      ['The failed execution and the rejection are audited', tally['proposal.failed'] === 1 && tally['proposal.rejected'] === 1],
      ['Refused decisions are audited too', (tally['proposal.decision_denied'] || 0) >= 1],
      ['Audit rows cannot be edited', await tamper(`UPDATE audit_logs SET action = 'x' WHERE action LIKE 'proposal.%'`)],
      ['Audit rows cannot be deleted', await tamper(`DELETE FROM audit_logs WHERE action LIKE 'proposal.%'`)],
    ].map(([label, ok]) => [label, ok]);

    const evidence = [
      'Audit log (proposal.* entries, in order):',
      ...audit.map(r => `  ${r.action.padEnd(26)} ${String(r.actor_role).padEnd(15)} ${r.t}`),
      `Tally: ${JSON.stringify(tally)}`,
    ];
    return { results, extra, evidence };
  },
};
