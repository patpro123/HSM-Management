'use strict';

// The proposal queue: create, list, approve, reject, cancel.
//
// Nothing here trusts the caller's claims. The proposer's persona comes from their roles,
// approval authority is re-checked against the permission registry on every decision, and a
// pending proposal is claimed with a single atomic UPDATE so it can only ever run once.

const pool = require('../db');
const { resolvePersona, canPropose, canApprove, canAutoApprove, getAction } = require('../auth/actionPermissions');
const { EXECUTORS } = require('./proposalExecutors');
const { ServiceError } = require('./serviceError');

const CHANNELS = ['manual', 'chat', 'whatsapp', 'scheduled'];

// When true, nobody can approve a proposal they raised themselves. Off by default so a
// one-admin school can still approve its own money entries; every self-approval is flagged.
const blockSelfApproval = () => process.env.PROPOSAL_BLOCK_SELF_APPROVAL === 'true';

const isAdmin = (user) => (user.roles || []).includes('admin');
const isHeadOfSchool = (user) => (user.roles || []).includes('head_of_school');

async function audit(db, user, action, proposal, details = {}) {
  await db.query(
    // clock_timestamp(), not the column default now(): inside one transaction now() is frozen,
    // which would give "approved" and "executed" the same time and an arbitrary order.
    'INSERT INTO audit_logs (actor_id, actor_role, action, payload, timestamp) VALUES ($1, $2, $3, $4, clock_timestamp())',
    [user?.id || null, resolvePersona(user?.roles), `proposal.${action}`,
      JSON.stringify({ proposal_id: proposal.id, action_type: proposal.action_type, is_money: proposal.is_money, ...details })]
  );
}

// Admin sees everything, Head of School everything except money, others only their own.
function canView(user, proposal) {
  if (isAdmin(user)) return true;
  if (proposal.proposed_by === user.id) return true;
  return isHeadOfSchool(user) && !proposal.is_money;
}

const SELECT_WITH_NAMES = `
  SELECT p.*, pu.name AS proposed_by_name, du.name AS decided_by_name
    FROM agent_proposals p
    LEFT JOIN users pu ON pu.id = p.proposed_by
    LEFT JOIN users du ON du.id = p.decided_by`;

async function create(user, body) {
  const { action_type, params, summary, source_channel, source_message, idempotency_key } = body || {};
  const persona = resolvePersona(user.roles);
  const action = getAction(action_type);

  if (!action || !action.write) throw new ServiceError(400, `"${action_type}" is not an action that can be proposed`);
  if (!canPropose(persona, action_type)) throw new ServiceError(403, `You cannot propose ${action_type}`);
  const executor = EXECUTORS[action_type];
  if (!executor) throw new ServiceError(400, `${action_type} proposals are not supported yet`);
  const channel = source_channel || 'manual';
  if (!CHANNELS.includes(channel)) throw new ServiceError(400, `source_channel must be one of ${CHANNELS.join(', ')}`);

  if (idempotency_key) {
    const existing = await pool.query('SELECT * FROM agent_proposals WHERE proposed_by = $1 AND idempotency_key = $2', [user.id, idempotency_key]);
    if (existing.rows[0]) return { proposal: existing.rows[0], duplicate: true };
  }

  const checked = await executor.validate(pool, user, params);
  const insert = await pool.query(
    `INSERT INTO agent_proposals
       (action_type, params, summary, is_money, source_channel, source_message, idempotency_key, proposed_by, proposed_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (proposed_by, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [action_type, JSON.stringify(checked.params), summary || checked.summary, action.money, channel,
      source_message || null, idempotency_key || null, user.id, persona]
  );
  if (!insert.rows[0]) {
    // Lost a race with an identical retry: hand back the winner.
    const winner = await pool.query('SELECT * FROM agent_proposals WHERE proposed_by = $1 AND idempotency_key = $2', [user.id, idempotency_key]);
    return { proposal: winner.rows[0], duplicate: true };
  }
  const proposal = insert.rows[0];
  await audit(pool, user, 'created', proposal, { channel, summary: proposal.summary });

  // A request that qualifies under the action's policy runs now; the proposal row and the
  // audit trail still exist, marked as auto-approved.
  if (canAutoApprove(persona, action_type) && executor.isAutoApprovable
      && await executor.isAutoApprovable(pool, user, checked.params)) {
    await run(proposal, user, { auto: true });
    return { proposal: await get(user, proposal.id), duplicate: false, auto_approved: true };
  }
  return { proposal, duplicate: false, auto_approved: false };
}

async function list(user, { status } = {}) {
  const where = [];
  const args = [];
  if (status) { args.push(status); where.push(`p.status = $${args.length}`); }
  if (!isAdmin(user)) {
    args.push(user.id);
    where.push(isHeadOfSchool(user)
      ? `(p.is_money = false OR p.proposed_by = $${args.length})`
      : `p.proposed_by = $${args.length}`);
  }
  const res = await pool.query(
    `${SELECT_WITH_NAMES} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC LIMIT 200`, args);
  return res.rows.map(p => ({ ...p, can_decide: p.status === 'pending' && canApprove(user.roles, p.action_type) }));
}

async function get(user, id) {
  const res = await pool.query(`${SELECT_WITH_NAMES} WHERE p.id = $1`, [id]);
  const proposal = res.rows[0];
  // Hidden proposals look the same as missing ones.
  if (!proposal || !canView(user, proposal)) throw new ServiceError(404, 'Proposal not found');
  const trail = await pool.query(
    `SELECT a.action, a.actor_id, a.actor_role, a.payload, a.timestamp, u.name AS actor_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.payload->>'proposal_id' = $1 AND a.action LIKE 'proposal.%'
      ORDER BY a.timestamp, a.id`, [id]);
  return { ...proposal, can_decide: proposal.status === 'pending' && canApprove(user.roles, proposal.action_type), audit: trail.rows };
}

// Shared by approve and reject: visibility, authority and self-approval checks.
async function loadForDecision(user, id) {
  const res = await pool.query('SELECT * FROM agent_proposals WHERE id = $1', [id]);
  const proposal = res.rows[0];
  if (!proposal || !canView(user, proposal)) throw new ServiceError(404, 'Proposal not found');

  if (!canApprove(user.roles, proposal.action_type)) {
    await audit(pool, user, 'decision_denied', proposal, { reason: 'role cannot approve this action type' });
    throw new ServiceError(403, proposal.is_money
      ? 'Only an Admin can approve money actions'
      : `Your role cannot approve ${proposal.action_type}`);
  }
  if (blockSelfApproval() && proposal.proposed_by === user.id) {
    await audit(pool, user, 'decision_denied', proposal, { reason: 'self-approval is blocked' });
    throw new ServiceError(403, 'You cannot decide a proposal you raised yourself');
  }
  return proposal;
}

async function approve(user, id, { note } = {}) {
  const proposal = await loadForDecision(user, id);
  await run(proposal, user, { note });
  return get(user, id);
}

// Claims a pending proposal and executes it. `auto` marks a policy approval (no human decision).
async function run(proposal, user, { note, auto = false } = {}) {
  const id = proposal.id;
  const executor = EXECUTORS[proposal.action_type];
  if (!executor) throw new ServiceError(400, `${proposal.action_type} cannot be executed`);
  const selfApproved = !auto && proposal.proposed_by === user.id;

  const client = await pool.connect();
  let result;
  let claimed;
  try {
    await client.query('BEGIN');
    // The claim: only one caller can move a proposal out of 'pending'.
    const claim = await client.query(
      `UPDATE agent_proposals
          SET status = 'executed', decided_by = $2, decided_role = $3, decided_at = now(),
              decision_note = $4, self_approved = $5, auto_approved = $6
        WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, user.id, resolvePersona(user.roles), note || null, selfApproved, auto]);
    claimed = claim.rows[0];
    if (!claimed) {
      await client.query('ROLLBACK');
      const now = await pool.query('SELECT status FROM agent_proposals WHERE id = $1', [id]);
      throw new ServiceError(409, `Proposal is already ${now.rows[0]?.status || 'decided'}`);
    }

    result = await executor.execute(client, claimed, user);
    await client.query('UPDATE agent_proposals SET result = $2 WHERE id = $1', [id, JSON.stringify(result)]);
    await audit(client, user, auto ? 'auto_approved' : 'approved', claimed,
      auto ? { reason: 'matches the expected fee' } : { self_approved: selfApproved, note: note || null });
    await audit(client, user, 'executed', claimed, { result: summariseResult(result) });
    await client.query('COMMIT');
  } catch (err) {
    if (err instanceof ServiceError && err.status === 409) throw err;
    await client.query('ROLLBACK').catch(() => {});
    // The action itself failed: nothing was written, so record why. Retrying means a new proposal.
    const message = err.message || 'Execution failed';
    await pool.query(
      `UPDATE agent_proposals SET status = 'failed', error = $2, decided_by = $3, decided_role = $4,
              decided_at = now(), decision_note = $5, self_approved = $6
        WHERE id = $1 AND status = 'pending'`,
      [id, message, user.id, resolvePersona(user.roles), note || null, selfApproved]);
    await audit(pool, user, 'failed', proposal, { error: message, self_approved: selfApproved });
    throw new ServiceError(err instanceof ServiceError ? err.status : 500, `${auto ? 'Could not run' : 'Approved but could not run'}: ${message}`);
  } finally {
    client.release();
  }

  if (executor.after) { try { executor.after(result); } catch (e) { console.warn('[proposal] after-hook failed:', e.message); } }
}

// Keep the audit payload small: ids and totals, not whole record lists.
function summariseResult(result) {
  if (!result || typeof result !== 'object') return result;
  const { records, student, from_batch, to_batch, ...rest } = result;
  return {
    ...rest,
    ...(records ? { record_count: records.length } : {}),
    ...(student ? { student_id: student.id } : {}),
    ...(to_batch ? { to_batch_id: to_batch.id } : {}),
  };
}

async function reject(user, id, { note } = {}) {
  const proposal = await loadForDecision(user, id);
  const res = await pool.query(
    `UPDATE agent_proposals
        SET status = 'rejected', decided_by = $2, decided_role = $3, decided_at = now(), decision_note = $4
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, user.id, resolvePersona(user.roles), note || null]);
  if (!res.rows[0]) {
    const now = await pool.query('SELECT status FROM agent_proposals WHERE id = $1', [id]);
    throw new ServiceError(409, `Proposal is already ${now.rows[0]?.status || 'decided'}`);
  }
  await audit(pool, user, 'rejected', proposal, { note: note || null });
  return get(user, id);
}

// The proposer (or an Admin) withdraws a proposal that has not been decided.
async function cancel(user, id) {
  const res0 = await pool.query('SELECT * FROM agent_proposals WHERE id = $1', [id]);
  const proposal = res0.rows[0];
  if (!proposal || !canView(user, proposal)) throw new ServiceError(404, 'Proposal not found');
  if (proposal.proposed_by !== user.id && !isAdmin(user)) throw new ServiceError(403, 'Only the proposer or an Admin can cancel');
  const res = await pool.query(
    `UPDATE agent_proposals SET status = 'cancelled', decided_by = $2, decided_role = $3, decided_at = now()
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, user.id, resolvePersona(user.roles)]);
  if (!res.rows[0]) {
    const now = await pool.query('SELECT status FROM agent_proposals WHERE id = $1', [id]);
    throw new ServiceError(409, `Proposal is already ${now.rows[0]?.status || 'decided'}`);
  }
  await audit(pool, user, 'cancelled', proposal);
  return get(user, id);
}

module.exports = { create, list, get, approve, reject, cancel, canView };
