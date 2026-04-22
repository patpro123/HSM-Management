// Dynamic classes_remaining calculation.
// Formula: SUM(credits from all payments) - COUNT(present attendances)
// No carryforward — lifetime totals only.
//
// Three credit sources:
//  1. Package-based payments  (p.package_id IS NOT NULL)
//  2. Package-less payments with metadata.instrument_id  (migration tool corrections)
//  3. Package-less payments with no instrument_id  (old payments — unattributed)
//     → attributed to the single enrolled instrument when unambiguous

async function computeClassesRemaining(pool, studentId) {
  const [pkgCreditsRes, instrAttrRes, unattributedRes, attendedRes] = await Promise.all([
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

    // 2. Package-less payments with metadata.instrument_id (migration corrections)
    pool.query(`
      SELECT i.id AS instrument_id, i.name AS instrument,
        SUM((p.metadata->>'credits_bought')::int) AS credits
      FROM payments p
      JOIN instruments i ON i.id = (p.metadata->>'instrument_id')::uuid
      WHERE p.student_id = $1
        AND p.package_id IS NULL
        AND (p.metadata->>'instrument_id') IS NOT NULL
        AND (p.metadata->>'credits_bought') IS NOT NULL
        AND (p.metadata->>'credits_bought')::int > 0
      GROUP BY i.id, i.name
    `, [studentId]),

    // 3. Package-less payments with no instrument_id (old unattributed payments)
    pool.query(`
      SELECT COALESCE(SUM((p.metadata->>'credits_bought')::int), 0) AS credits
      FROM payments p
      WHERE p.student_id = $1
        AND p.package_id IS NULL
        AND (p.metadata->>'instrument_id') IS NULL
        AND (p.metadata->>'credits_bought') IS NOT NULL
        AND (p.metadata->>'credits_bought')::int > 0
    `, [studentId]),

    // 4. Present attendances per instrument
    pool.query(`
      SELECT i.id AS instrument_id, i.name AS instrument, COUNT(*) AS attended
      FROM attendance_records ar
      JOIN batches b ON ar.batch_id = b.id
      JOIN instruments i ON b.instrument_id = i.id
      WHERE ar.student_id = $1 AND ar.status = 'present'
      GROUP BY i.id, i.name
    `, [studentId]),
  ]);

  // Merge package-based and instrument-attributed credits into one map
  const creditsByInstr = {};
  pkgCreditsRes.rows.forEach(r => {
    creditsByInstr[r.instrument_id] = { name: r.instrument, credits: parseInt(r.credits) || 0 };
  });
  instrAttrRes.rows.forEach(r => {
    if (!creditsByInstr[r.instrument_id]) {
      creditsByInstr[r.instrument_id] = { name: r.instrument, credits: 0 };
    }
    creditsByInstr[r.instrument_id].credits += parseInt(r.credits) || 0;
  });

  const unattributed = parseInt(unattributedRes.rows[0]?.credits) || 0;

  const attendedByInstr = {};
  attendedRes.rows.forEach(r => {
    attendedByInstr[r.instrument_id] = { name: r.instrument, attended: parseInt(r.attended) || 0 };
  });

  const allIds = new Set([...Object.keys(creditsByInstr), ...Object.keys(attendedByInstr)]);

  const byInstrument = {};
  let totalCredits = 0;
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

  // Distribute unattributed credits
  if (unattributed > 0) {
    totalCredits += unattributed;
    const instrNames = Object.keys(byInstrument);
    const allInstrNames = [...new Set([...instrNames, ...attendedRes.rows.map(r => r.instrument)])];

    if (allInstrNames.length === 1) {
      // Single instrument — attribute there
      const name = allInstrNames[0];
      const instrId = [...allIds].find(id =>
        (creditsByInstr[id]?.name || attendedByInstr[id]?.name) === name
      );
      const existingCredits = instrId ? (creditsByInstr[instrId]?.credits || 0) : 0;
      const attended = instrId ? (attendedByInstr[instrId]?.attended || 0) : 0;
      byInstrument[name] = Math.max(0, existingCredits + unattributed - attended);
    }
    // Multiple instruments — unattributed goes into total only; can't determine split
  }

  return {
    total: Math.max(0, totalCredits - totalAttended),
    byInstrument,
  };
}

module.exports = { computeClassesRemaining };
