'use strict';

// Step 2 change: a payment that matches the expected fee is recorded at once. A different
// amount, or a dispute, is raised by Head of School and waits for Admin.

const { query } = require('../harness/db');

const card = (page, text) => page.locator('[data-testid=proposal]', { hasText: text });
const openApprovals = async (s) => {
  await s.page.locator('nav').getByText('Approvals', { exact: true }).first().click();
  await s.page.waitForTimeout(1000);
};

module.exports = {
  name: '02b-auto-approved-payments',
  title: 'Step 2 change: regular payments auto-approved, amount changes and disputes need Admin',

  async run({ session, seeded }) {
    const results = [];
    const { students, packages } = seeded;
    const count = async (sql, args) => (await query(sql, args)).rows[0].n;
    const amountOf = async (id) => Number((await query('SELECT amount::float AS a FROM payments WHERE id = $1', [id])).rows[0].a);
    const priyaPayment = (await query(`SELECT id FROM payments WHERE student_id = $1`, [students['Priya Singh']])).rows[0].id;
    const seededPayments = await count('SELECT COUNT(*)::int AS n FROM payments');

    const regular = {
      action_type: 'payment.submit',
      params: { student_id: students['Rohit Desai'], amount: 4800, payment_method: 'UPI', package_id: packages.guitarPkg, class_credits: 24 },
      source_message: 'Rohit paid the guitar quarterly fee',
    };
    const different = {
      action_type: 'payment.submit',
      params: { student_id: students['Aisha Khan'], amount: 5000, payment_method: 'Cash', package_id: packages.keyboardPkg, class_credits: 24 },
    };
    let pendingId;
    let disputeId;

    // Head of School: regular payment runs at once, the others wait
    {
      const s = await session('head_of_school', '1-head-of-school');
      const reg = await s.call('POST', '/api/proposals', regular, { 'Idempotency-Key': 'rohit-q4' });
      s.check('A payment matching the expected fee is recorded immediately', reg.status === 201 && reg.auto_approved === true && reg.proposal.status === 'executed', reg.proposal?.summary);
      s.check('It is marked auto-approved, not self-approved', reg.proposal?.auto_approved === true && reg.proposal?.self_approved === false);

      const retry = await s.call('POST', '/api/proposals', regular, { 'Idempotency-Key': 'rohit-q4' });
      s.check('A retried request does not record the payment twice', retry.duplicate === true && await count(`SELECT COUNT(*)::int AS n FROM payments WHERE student_id = $1`, [students['Rohit Desai']]) === 2);
      const rohit = (await query(`SELECT eb.classes_remaining FROM enrollment_batches eb JOIN enrollments e ON e.id = eb.enrollment_id WHERE e.student_id = $1`, [students['Rohit Desai']])).rows[0];
      s.check("Rohit's 24 class credits were added (1 + 24)", rohit.classes_remaining === 25, `remaining=${rohit.classes_remaining}`);

      const diff = await s.call('POST', '/api/proposals', different);
      pendingId = diff.proposal?.id;
      s.check('A payment with a different amount waits for approval', diff.status === 201 && diff.auto_approved === false && diff.proposal.status === 'pending', diff.proposal?.summary);
      s.check('Nothing was recorded for the different amount', await count(`SELECT COUNT(*)::int AS n FROM payments`) === seededPayments + 1);

      const noPkg = await s.call('POST', '/api/proposals', { action_type: 'payment.submit', params: { student_id: students['Aisha Khan'], amount: 5400, payment_method: 'UPI' } });
      s.check('A payment with no package to compare against waits for approval', noPkg.proposal?.status === 'pending' && noPkg.auto_approved === false);

      const disp = await s.call('POST', '/api/proposals', {
        action_type: 'payment.dispute',
        params: { payment_id: priyaPayment, reason: 'Parent paid 5000 after the sibling discount', corrected_amount: 5000 },
      });
      disputeId = disp.proposal?.id;
      s.check('Head of School can raise a dispute with a corrected amount', disp.status === 201 && disp.proposal.status === 'pending', disp.proposal?.summary);
      s.check('The disputed payment is unchanged until Admin decides', await amountOf(priyaPayment) === 5400);

      const noReason = await s.call('POST', '/api/proposals', { action_type: 'payment.dispute', params: { payment_id: priyaPayment } });
      s.check('A dispute without a reason is refused', noReason.status === 400, noReason.error);

      const approve = await s.call('POST', `/api/proposals/${pendingId}/approve`, {});
      s.check('Head of School cannot approve the different-amount payment', approve.status === 403, approve.error);
      const approveDisp = await s.call('POST', `/api/proposals/${disputeId}/approve`, {});
      s.check('Head of School cannot approve the dispute', approveDisp.status === 403, approveDisp.error);

      await s.open();
      await openApprovals(s);
      await s.shot('pending-for-admin');
      await s.page.getByRole('button', { name: 'All', exact: true }).click();
      await s.page.waitForTimeout(900);
      await s.shot('all-including-auto-approved');
      s.check('The auto-approved payment shows its badge', await s.page.getByText('Auto-approved · expected fee').first().isVisible());
      results.push(await s.close());
    }

    // Teacher cannot use either action
    {
      const s = await session('teacher', '2-teacher');
      const a = await s.call('POST', '/api/proposals', regular);
      const b = await s.call('POST', '/api/proposals', { action_type: 'payment.dispute', params: { payment_id: priyaPayment, reason: 'test' } });
      s.check('A teacher cannot submit a payment or raise a dispute', a.status === 403 && b.status === 403, `${a.status}/${b.status}`);
      results.push(await s.close());
    }

    // Admin decides the two that waited
    {
      const s = await session('admin', '3-admin');
      await s.open();
      await openApprovals(s);
      await s.shot('admin-queue');
      await card(s.page, '₹5,000 (Cash)').getByRole('button', { name: 'Approve' }).click();
      await s.page.waitForTimeout(1500);
      const decided = (await query(`SELECT status FROM agent_proposals WHERE id = $1`, [pendingId])).rows[0];
      s.check('Admin approves the different-amount payment', decided.status === 'executed');
      await s.shot('admin-dispute-before');
      await card(s.page, 'Dispute on').getByRole('button', { name: 'Approve' }).click();
      await s.page.waitForTimeout(1500);
      await s.shot('admin-dispute-approved');

      s.check('The disputed payment now shows the corrected amount', await amountOf(priyaPayment) === 5000);
      const meta = (await query(`SELECT metadata->'dispute' AS d FROM payments WHERE id = $1`, [priyaPayment])).rows[0].d;
      s.check('The dispute reason and original amount are kept on the payment', meta?.original_amount === 5400 && /sibling discount/.test(meta.reason), JSON.stringify(meta));
      s.check('The different-amount payment is now recorded', await count(`SELECT COUNT(*)::int AS n FROM payments WHERE student_id = $1`, [students['Aisha Khan']]) === 2);

      await s.page.getByRole('button', { name: 'All', exact: true }).click();
      await s.page.waitForTimeout(900);
      await s.shot('admin-all-final');
      results.push(await s.close());
    }

    const audit = (await query(`SELECT action, actor_role, payload->>'action_type' AS t FROM audit_logs WHERE action LIKE 'proposal.%' ORDER BY timestamp, id`)).rows;
    const tally = audit.reduce((m, r) => ({ ...m, [r.action]: (m[r.action] || 0) + 1 }), {});
    const extra = [
      ['The auto-approval is in the audit log, once', tally['proposal.auto_approved'] === 1, JSON.stringify(tally)],
      ['Auto-approved and approved payments are both audited as executed', tally['proposal.executed'] === 3],
    ];
    const evidence = [
      'Audit log (proposal.* entries, in order):',
      ...audit.map(r => `  ${r.action.padEnd(26)} ${String(r.actor_role).padEnd(15)} ${r.t}`),
    ];
    return { results, extra, evidence };
  },
};
