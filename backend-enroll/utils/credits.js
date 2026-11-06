// Dynamic classes_remaining calculation.
// Formula: SUM(credits from all payments) - classes attended
// No carryforward — lifetime totals only.
//
// A class attended is a present mark, except that a student marked present in two different
// batches of the same instrument on the same date counts once (see CLASSES_ATTENDED_BY_DAY).
//
// Credit sources:
//  1. Package-based payments  (p.package_id IS NOT NULL)
//  2. Package-less payments, attributed to an instrument by the first of:
//       metadata.instrument_id  (migration tool corrections)
//       metadata.batch_id       (payment form: the batch the payment was made for)
//       metadata.fee_structure_id → fee_structures.instrument_id
//  3. Package-less payments that still have no instrument
//     → attributed to the student's single actively enrolled instrument, whether or not
//       they have attended a class yet. With several instruments the split can't be
//       determined, so they count toward the total only.

// One row per student, instrument and date: how many classes were attended that day. Present
// marks are counted per batch, and the busiest batch of the day wins, so:
//   - two regular marks in different batches of one instrument on one date count once;
//   - a regular mark plus an extra-class mark in the same batch count twice;
//   - the migrated history (many present rows in one batch on one date) counts in full.
// Embed as a derived table: `FROM ${CLASSES_ATTENDED_BY_DAY} d`, then SUM(d.classes).
const CLASSES_ATTENDED_BY_DAY = `(
  SELECT x.student_id, x.instrument_id, x.session_date, MAX(x.marks) AS classes
  FROM (
    SELECT ar.student_id, b.instrument_id, ar.batch_id, ar.session_date, COUNT(*) AS marks
    FROM attendance_records ar
    JOIN batches b ON b.id = ar.batch_id
    WHERE ar.status = 'present'
    GROUP BY ar.student_id, b.instrument_id, ar.batch_id, ar.session_date
  ) x
  GROUP BY x.student_id, x.instrument_id, x.session_date
)`;

async function computeClassesRemaining(pool, studentId) {
  const [pkgCreditsRes, instrAttrRes, attendedRes, enrolledRes] = await Promise.all([
    // 1. Package-based payments grouped by instrument
    pool.query(`
      SELECT i.id AS instrument_id, i.name AS instrument,
        SUM(
          CASE
            WHEN (p.metadata->>'credits_bought') IS NOT NULL
                 AND (p.metadata->>'credits_bought')::int > 0
              THEN (p.metadata->>'credits_bought')::int
            WHEN pkg.classes_count IS NOT NULL
              THEN pkg.classes_count
            ELSE 0
          END
        ) AS credits
      FROM payments p
      JOIN packages pkg ON p.package_id = pkg.id
      JOIN instruments i ON pkg.instrument_id = i.id
      WHERE p.student_id = $1
      GROUP BY i.id, i.name
    `, [studentId]),

    // 2. Package-less payments grouped by the instrument they can be traced to.
    //    instrument_id is NULL for payments that can't be traced (unattributed).
    //    Ids are compared as text so a malformed metadata value can't fail the query.
    pool.query(`
      SELECT i.id AS instrument_id, i.name AS instrument, SUM(r.credits) AS credits
      FROM (
        SELECT COALESCE(mi.id, b.instrument_id, f.instrument_id) AS instrument_id,
               (p.metadata->>'credits_bought')::int AS credits
        FROM payments p
        LEFT JOIN instruments mi ON mi.id::text = p.metadata->>'instrument_id'
        LEFT JOIN batches b ON b.id::text = p.metadata->>'batch_id'
        LEFT JOIN fee_structures f ON f.id::text = p.metadata->>'fee_structure_id'
        WHERE p.student_id = $1
          AND p.package_id IS NULL
          AND (p.metadata->>'credits_bought') IS NOT NULL
          AND (p.metadata->>'credits_bought')::int > 0
      ) r
      LEFT JOIN instruments i ON i.id = r.instrument_id
      GROUP BY i.id, i.name
    `, [studentId]),

    // 3. Classes attended per instrument, one per day
    pool.query(`
      SELECT i.id AS instrument_id, i.name AS instrument, SUM(d.classes) AS attended
      FROM ${CLASSES_ATTENDED_BY_DAY} d
      JOIN instruments i ON i.id = d.instrument_id
      WHERE d.student_id = $1
      GROUP BY i.id, i.name
    `, [studentId]),

    // 4. Instruments the student is actively enrolled in
    pool.query(`
      SELECT DISTINCT i.id AS instrument_id, i.name AS instrument
      FROM enrollments e
      JOIN enrollment_batches eb ON eb.enrollment_id = e.id
      JOIN batches b ON b.id = eb.batch_id
      JOIN instruments i ON i.id = b.instrument_id
      WHERE e.student_id = $1 AND e.status = 'active'
    `, [studentId]),
  ]);

  // Merge package-based and instrument-attributed credits into one map
  const creditsByInstr = {};
  let unattributed = 0;
  pkgCreditsRes.rows.forEach(r => {
    creditsByInstr[r.instrument_id] = { name: r.instrument, credits: parseInt(r.credits) || 0 };
  });
  instrAttrRes.rows.forEach(r => {
    if (!r.instrument_id) {
      unattributed += parseInt(r.credits) || 0;
      return;
    }
    if (!creditsByInstr[r.instrument_id]) {
      creditsByInstr[r.instrument_id] = { name: r.instrument, credits: 0 };
    }
    creditsByInstr[r.instrument_id].credits += parseInt(r.credits) || 0;
  });

  const attendedByInstr = {};
  attendedRes.rows.forEach(r => {
    attendedByInstr[r.instrument_id] = { name: r.instrument, attended: parseInt(r.attended) || 0 };
  });

  // Unattributed credits go to the one instrument the student is involved in, if there is one.
  // Enrollment counts as involvement, so a new student who hasn't attended yet still gets them.
  const knownInstr = {};
  enrolledRes.rows.forEach(r => { knownInstr[r.instrument_id] = r.instrument; });
  Object.entries(creditsByInstr).forEach(([id, v]) => { knownInstr[id] = v.name; });
  Object.entries(attendedByInstr).forEach(([id, v]) => { knownInstr[id] = v.name; });
  const knownIds = Object.keys(knownInstr);

  if (unattributed > 0 && knownIds.length === 1) {
    const id = knownIds[0];
    if (!creditsByInstr[id]) creditsByInstr[id] = { name: knownInstr[id], credits: 0 };
    creditsByInstr[id].credits += unattributed;
    unattributed = 0;
  }

  const allIds = new Set([...Object.keys(creditsByInstr), ...Object.keys(attendedByInstr)]);

  const byInstrument = {};
  let totalCredits = unattributed;
  let totalAttended = 0;

  allIds.forEach(instrId => {
    const credInfo = creditsByInstr[instrId];
    const attInfo = attendedByInstr[instrId];
    const name = credInfo?.name || attInfo?.name;
    if (!name) return;

    const credits = credInfo?.credits || 0;
    const attended = attInfo?.attended || 0;
    totalCredits += credits;
    totalAttended += attended;
    byInstrument[name] = Math.max(0, credits - attended);
  });

  return {
    total: Math.max(0, totalCredits - totalAttended),
    byInstrument,
  };
}

module.exports = { computeClassesRemaining, CLASSES_ATTENDED_BY_DAY };
