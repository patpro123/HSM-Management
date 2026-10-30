'use strict';

// What each proposable action does. An executor has:
//   validate(db, proposer, params) -> { params, summary }   checked when the proposal is created
//   execute(client, proposal, approver) -> result           runs inside the approval transaction
//   after(result)                                           optional side effects once committed
// Executors reuse the same service functions as the buttons, so a proposal can never do
// something the UI could not.

const attendanceService = require('./attendanceService');
const { moveStudent } = require('./batchService');
const { recordPayment } = require('./paymentService');
const { ServiceError } = require('./serviceError');
const { canMarkAttendanceOn, isOperationsStaff } = require('../auth/actionPermissions');

const ATTENDANCE_STATUSES = ['present', 'absent', 'excused'];
const MAX_ATTENDANCE_RECORDS = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const requireUuids = (params, fields) => {
  for (const f of fields) {
    if (!UUID_RE.test(String(params[f] || ''))) throw new ServiceError(400, `${f} must be a valid id`);
  }
};

const attendanceMarkBatch = {
  async validate(db, proposer, params) {
    const records = params?.records;
    if (!Array.isArray(records) || records.length === 0) throw new ServiceError(400, 'No attendance records provided');
    if (records.length > MAX_ATTENDANCE_RECORDS) throw new ServiceError(400, `At most ${MAX_ATTENDANCE_RECORDS} records per proposal`);

    const today = attendanceService.todayIST();
    const clean = records.map((r) => {
      requireUuids(r, ['batch_id', 'student_id']);
      if (!DATE_RE.test(String(r.date || ''))) throw new ServiceError(400, 'Each record needs a date (YYYY-MM-DD)');
      if (!ATTENDANCE_STATUSES.includes(r.status)) throw new ServiceError(400, `status must be one of ${ATTENDANCE_STATUSES.join(', ')}`);
      if (!canMarkAttendanceOn(proposer.roles, r.date, today)) {
        throw new ServiceError(403, 'Teachers can only mark attendance for today');
      }
      return { batch_id: r.batch_id, student_id: r.student_id, date: r.date, status: r.status, is_extra: !!r.is_extra };
    });

    if (!isOperationsStaff(proposer.roles)) {
      const teacherId = await attendanceService.getLinkedTeacherId(db, proposer.id);
      if (!teacherId) throw new ServiceError(403, 'Teacher account not linked to a profile');
    }
    const batchIds = [...new Set(clean.map(r => r.batch_id))];
    const found = await db.query('SELECT id FROM batches WHERE id = ANY($1)', [batchIds]);
    if (found.rows.length !== batchIds.length) throw new ServiceError(404, 'One or more batches not found');

    const dates = [...new Set(clean.map(r => r.date))].sort();
    const count = (s) => clean.filter(r => r.status === s).length;
    const parts = ATTENDANCE_STATUSES.map(s => [s, count(s)]).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${s}`);
    return {
      params: { records: clean },
      summary: `Mark attendance for ${clean.length} student${clean.length === 1 ? '' : 's'} in ${batchIds.length} class${batchIds.length === 1 ? '' : 'es'} on ${dates.join(', ')} (${parts.join(', ')})`,
    };
  },

  async execute(client, proposal, approver) {
    const { records } = proposal.params;
    const proposerRes = await client.query('SELECT name, email FROM users WHERE id = $1', [proposal.proposed_by]);
    const proposerName = proposerRes.rows[0]?.name || proposerRes.rows[0]?.email || 'a teacher';
    const approverName = approver.name || approver.email || 'an approver';

    const notes = new Map();
    for (const batchId of new Set(records.map(r => r.batch_id))) {
      notes.set(batchId, `Proposed by ${proposerName}, approved by ${approverName}`);
    }
    await attendanceService.saveAttendanceRecords(client, records, notes);
    return { saved: records.length, records };
  },

  after(result) {
    attendanceService.notifyPresent(result.records);
  },
};

// A student attends one or two classes a week per instrument, each its own batch, so a request
// moves one or two enrollment_batches. The old flat shape (one move) is still accepted.
const batchMove = {
  async validate(db, proposer, params) {
    const moves = Array.isArray(params?.moves) ? params.moves : [params || {}];
    if (moves.length < 1 || moves.length > 2) throw new ServiceError(400, 'A move request covers one or two weekly classes');
    if (new Set(moves.map(m => m.enrollment_batch_id)).size !== moves.length) throw new ServiceError(400, 'The same class is listed twice');

    const teacherId = isOperationsStaff(proposer.roles) ? null : await attendanceService.getLinkedTeacherId(db, proposer.id);
    const clean = [];
    const parts = [];
    let studentName = null;
    let instrument = null;
    for (const m of moves) {
      requireUuids(m, ['enrollment_batch_id', 'from_batch_id', 'to_batch_id']);
      if (m.from_batch_id === m.to_batch_id) throw new ServiceError(400, 'Source and target batch are the same');

      const res = await db.query(`
        SELECT s.name AS student_name, i.name AS instrument,
               bf.recurrence AS from_recurrence, bf.teacher_id AS from_teacher_id, bt.recurrence AS to_recurrence
          FROM enrollment_batches eb
          JOIN enrollments e ON e.id = eb.enrollment_id
          JOIN students s ON s.id = e.student_id
          JOIN batches bf ON bf.id = eb.batch_id
          JOIN instruments i ON i.id = bf.instrument_id
          LEFT JOIN batches bt ON bt.id = $3
         WHERE eb.id = $1 AND eb.batch_id = $2`,
      [m.enrollment_batch_id, m.from_batch_id, m.to_batch_id]);
      const row = res.rows[0];
      if (!row) throw new ServiceError(404, 'Enrollment not found in source batch');
      if (!row.to_recurrence) throw new ServiceError(404, 'Target batch not found');
      // A teacher may only ask to move students out of their own batches.
      if (!isOperationsStaff(proposer.roles) && (!teacherId || teacherId !== row.from_teacher_id)) {
        throw new ServiceError(403, 'You can only request moves for students in your own batches');
      }
      studentName = studentName || row.student_name;
      instrument = instrument || row.instrument;
      parts.push(`${row.from_recurrence} to ${row.to_recurrence}`);
      clean.push({ enrollment_batch_id: m.enrollment_batch_id, from_batch_id: m.from_batch_id, to_batch_id: m.to_batch_id });
    }

    return {
      params: { moves: clean },
      summary: `Move ${studentName} (${instrument}): ${parts.join('; ')}`,
    };
  },

  async execute(client, proposal) {
    const moves = proposal.params.moves || [proposal.params];
    const results = [];
    for (const m of moves) results.push(await moveStudent(client, m));
    return results.length === 1 ? results[0] : { success: true, moves: results };
  },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_RE = /\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)\b/i;

function checkSchedule({ recurrence, start_time, end_time }) {
  if (recurrence !== undefined && !SLOT_RE.test(recurrence)) {
    throw new ServiceError(400, 'recurrence must name the days, e.g. "TUE 17:00-18:00, THU 17:00-18:00"');
  }
  for (const [k, v] of Object.entries({ start_time, end_time })) {
    if (v !== undefined && !TIME_RE.test(v)) throw new ServiceError(400, `${k} must be HH:MM`);
  }
  if (start_time && end_time && start_time >= end_time) throw new ServiceError(400, 'Batch must end after it starts');
}

const checkCapacity = (c) => {
  if (c !== undefined && (!Number.isInteger(c) || c < 1 || c > 50)) throw new ServiceError(400, 'capacity must be a whole number from 1 to 50');
};

const batchCreate = {
  async validate(db, proposer, params) {
    const p = params || {};
    requireUuids(p, ['instrument_id']);
    if (p.teacher_id) requireUuids(p, ['teacher_id']);
    if (!p.recurrence || !p.start_time || !p.end_time) throw new ServiceError(400, 'recurrence, start_time and end_time are required');
    checkSchedule(p);
    checkCapacity(p.capacity);

    const inst = await db.query('SELECT name FROM instruments WHERE id = $1', [p.instrument_id]);
    if (!inst.rows[0]) throw new ServiceError(404, 'Instrument not found');
    let teacherName = null;
    if (p.teacher_id) {
      const t = await db.query('SELECT name FROM teachers WHERE id = $1', [p.teacher_id]);
      if (!t.rows[0]) throw new ServiceError(404, 'Teacher not found');
      teacherName = t.rows[0].name;
    }
    const capacity = p.capacity ?? 8;
    return {
      params: {
        instrument_id: p.instrument_id, teacher_id: p.teacher_id || null, recurrence: p.recurrence,
        start_time: p.start_time, end_time: p.end_time, capacity,
      },
      summary: `Create ${inst.rows[0].name} batch ${p.recurrence}${teacherName ? ` with ${teacherName}` : ''} (capacity ${capacity})`,
    };
  },

  async execute(client, proposal) {
    const p = proposal.params;
    const res = await client.query(
      `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [p.instrument_id, p.teacher_id, p.recurrence, p.start_time, p.end_time, p.capacity]);
    return { batch_id: res.rows[0].id };
  },
};

const BATCH_EDITABLE = ['teacher_id', 'recurrence', 'start_time', 'end_time', 'capacity', 'whatsapp_group_link'];

const batchUpdate = {
  async validate(db, proposer, params) {
    const p = params || {};
    requireUuids(p, ['batch_id']);
    const changes = {};
    for (const k of BATCH_EDITABLE) if (p.changes && p.changes[k] !== undefined) changes[k] = p.changes[k];
    if (!Object.keys(changes).length) throw new ServiceError(400, 'No changes given');
    if (changes.teacher_id) requireUuids(changes, ['teacher_id']);
    checkSchedule(changes);
    checkCapacity(changes.capacity);

    const cur = await db.query(
      `SELECT i.name AS instrument, b.recurrence, b.capacity, t.name AS teacher,
              (SELECT COUNT(*) FROM enrollment_batches eb JOIN enrollments e ON e.id = eb.enrollment_id
                WHERE eb.batch_id = b.id AND e.status = 'active')::int AS students
         FROM batches b JOIN instruments i ON i.id = b.instrument_id LEFT JOIN teachers t ON t.id = b.teacher_id
        WHERE b.id = $1`, [p.batch_id]);
    const row = cur.rows[0];
    if (!row) throw new ServiceError(404, 'Batch not found');
    if (changes.capacity !== undefined && changes.capacity < row.students) {
      throw new ServiceError(400, `Capacity cannot be below the ${row.students} students already in the batch`);
    }
    const parts = [];
    if (changes.teacher_id) {
      const t = await db.query('SELECT name FROM teachers WHERE id = $1', [changes.teacher_id]);
      if (!t.rows[0]) throw new ServiceError(404, 'Teacher not found');
      parts.push(`teacher ${row.teacher || 'none'} -> ${t.rows[0].name}`);
    }
    if (changes.recurrence !== undefined) parts.push(`schedule ${row.recurrence} -> ${changes.recurrence}`);
    if (changes.capacity !== undefined) parts.push(`capacity ${row.capacity} -> ${changes.capacity}`);
    if (changes.whatsapp_group_link !== undefined) parts.push('WhatsApp group link');
    if (changes.start_time !== undefined || changes.end_time !== undefined) parts.push('class times');
    return {
      params: { batch_id: p.batch_id, changes },
      summary: `Update ${row.instrument} batch ${row.recurrence}: ${parts.join('; ')}`,
    };
  },

  async execute(client, proposal) {
    const { batch_id, changes } = proposal.params;
    const keys = Object.keys(changes).filter(k => BATCH_EDITABLE.includes(k));
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const res = await client.query(
      `UPDATE batches SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [batch_id, ...keys.map(k => changes[k])]);
    if (!res.rows[0]) throw new ServiceError(404, 'Batch not found');
    return { batch_id };
  },
};

const paymentRecord = {
  async validate(db, proposer, params) {
    requireUuids(params || {}, ['student_id']);
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ServiceError(400, 'amount must be a positive number');

    const res = await db.query('SELECT name FROM students WHERE id = $1', [params.student_id]);
    if (!res.rows[0]) throw new ServiceError(404, 'Student not found');

    const credits = params.class_credits ? parseInt(params.class_credits) : 0;
    const method = params.payment_method || 'unspecified method';
    return {
      params: {
        student_id: params.student_id,
        amount,
        payment_method: params.payment_method || null,
        payment_for: params.payment_for,
        notes: params.notes,
        class_credits: credits || undefined,
        batch_id: params.batch_id,
        package_id: params.package_id,
        payment_frequency: params.payment_frequency,
        payment_date: params.payment_date,
        location: params.location,
      },
      summary: `Record ${inr(amount)} (${method}) from ${res.rows[0].name}${credits ? `, adds ${credits} class credits` : ''}`,
    };
  },

  async execute(client, proposal, approver) {
    // Recorded under the approving admin, who is accountable for the money entry.
    const { payment } = await recordPayment(client, proposal.params, approver.id);
    return { payment_id: payment.id, receipt_number: payment.receipt_number, amount: payment.amount };
  },
};

// The fee a student is expected to pay for a package: packages.price, or fee_structures.fee_amount
// when the id came from the modern fee-structure picker. null when the package is unknown.
async function expectedFee(db, packageId) {
  if (!packageId || !UUID_RE.test(String(packageId))) return null;
  const pkg = await db.query('SELECT price::float AS fee FROM packages WHERE id = $1', [packageId]);
  if (pkg.rows[0]) return pkg.rows[0].fee;
  const fs = await db.query('SELECT fee_amount::float AS fee FROM fee_structures WHERE id = $1', [packageId]);
  return fs.rows[0] ? fs.rows[0].fee : null;
}

// Recording a payment for what the student is expected to pay needs no approval. Anything else
// (a different amount, or no package to compare against) waits for Admin.
const paymentSubmit = {
  ...paymentRecord,

  async validate(db, proposer, params) {
    const checked = await paymentRecord.validate(db, proposer, params);
    const fee = await expectedFee(db, checked.params.package_id);
    const note = fee === null
      ? 'no package given, so Admin approval is needed'
      : fee === checked.params.amount ? `matches the expected fee of ${inr(fee)}` : `expected ${inr(fee)}, so Admin approval is needed`;
    return { params: checked.params, summary: `${checked.summary} (${note})` };
  },

  async isAutoApprovable(db, proposer, params) {
    const fee = await expectedFee(db, params.package_id);
    return fee !== null && fee === Number(params.amount);
  },
};

// A dispute on an existing payment, optionally with a corrected amount. Admin decides.
// Approving changes the recorded amount only: credits and the receipt number are left alone.
const paymentDispute = {
  async validate(db, proposer, params) {
    requireUuids(params || {}, ['payment_id']);
    const reason = String(params.reason || '').trim();
    if (reason.length < 3) throw new ServiceError(400, 'A reason is required');
    let corrected = null;
    if (params.corrected_amount !== undefined && params.corrected_amount !== null && params.corrected_amount !== '') {
      corrected = Number(params.corrected_amount);
      if (!Number.isFinite(corrected) || corrected <= 0) throw new ServiceError(400, 'corrected_amount must be a positive number');
    }
    const res = await db.query(
      `SELECT p.amount::float AS amount, s.name FROM payments p JOIN students s ON s.id = p.student_id WHERE p.id = $1`,
      [params.payment_id]);
    if (!res.rows[0]) throw new ServiceError(404, 'Payment not found');
    return {
      params: { payment_id: params.payment_id, reason, ...(corrected !== null ? { corrected_amount: corrected } : {}) },
      summary: `Dispute on ${inr(res.rows[0].amount)} payment from ${res.rows[0].name}: ${reason}`
        + (corrected !== null ? ` (proposed correction to ${inr(corrected)})` : ''),
    };
  },

  async execute(client, proposal, approver) {
    const { payment_id, reason, corrected_amount } = proposal.params;
    const cur = await client.query('SELECT amount::float AS amount FROM payments WHERE id = $1 FOR UPDATE', [payment_id]);
    if (!cur.rows[0]) throw new ServiceError(404, 'Payment not found');
    const original = cur.rows[0].amount;
    const dispute = { reason, original_amount: original, proposal_id: proposal.id, resolved_by: approver.id };
    if (corrected_amount !== undefined) dispute.corrected_amount = corrected_amount;
    await client.query(
      `UPDATE payments SET amount = COALESCE($2, amount),
              metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('dispute', $3::jsonb)
        WHERE id = $1`,
      [payment_id, corrected_amount ?? null, JSON.stringify(dispute)]);
    return { payment_id, original_amount: original, new_amount: corrected_amount ?? original };
  },
};

const EXECUTORS = {
  'attendance.mark_batch': attendanceMarkBatch,
  'batch.move': batchMove,
  'batch.create': batchCreate,
  'batch.update': batchUpdate,
  'payment.record': paymentRecord,
  'payment.submit': paymentSubmit,
  'payment.dispute': paymentDispute,
};

module.exports = { EXECUTORS };
