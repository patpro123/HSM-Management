// Dynamic classes_remaining calculation.
// Formula: SUM(credits from all payments) - COUNT(present attendances)
// No carryforward — lifetime totals only.

async function computeClassesRemaining(pool, studentId) {
  const [creditsRes, unattributedRes, attendedRes] = await Promise.all([
    // Credits from package-based payments, grouped by instrument
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

    // Credits from package-less payments that carry a metadata.instrument_id (migration corrections)
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

    // Attendances per instrument
    pool.query(`
      SELECT i.id AS instrument_id, i.name AS instrument, COUNT(*) AS attended
      FROM attendance_records ar
      JOIN batches b ON ar.batch_id = b.id
      JOIN instruments i ON b.instrument_id = i.id
      WHERE ar.student_id = $1 AND ar.status = 'present'
      GROUP BY i.id, i.name
    `, [studentId]),
  ]);

  // creditsRes: package-based, has instrument name
  const creditsMap = {};
  creditsRes.rows.forEach(r => {
    creditsMap[r.instrument_id] = { name: r.instrument, credits: parseInt(r.credits) || 0 };
  });

  // unattributedRes: package-less but instrument-attributed (migration corrections)
  // Has instrument name from the JOIN — safe to use even with zero attendance.
  const instrumentAttrMap = {};
  unattributedRes.rows.forEach(r => {
    if (r.instrument_id) {
      instrumentAttrMap[r.instrument_id] = { name: r.instrument, credits: parseInt(r.credits) || 0 };
    }
  });

  const attendedMap = {};
  attendedRes.rows.forEach(r => {
    attendedMap[r.instrument_id] = { name: r.instrument, attended: parseInt(r.attended) || 0 };
  });

  const allInstrumentIds = new Set([
    ...Object.keys(creditsMap),
    ...Object.keys(instrumentAttrMap),
    ...Object.keys(attendedMap),
  ]);

  const byInstrument = {};
  let totalCredits = 0;
  let totalAttended = 0;

  allInstrumentIds.forEach(instrId => {
    const pkgInfo = creditsMap[instrId];
    const attrInfo2 = instrumentAttrMap[instrId];
    const attrInfo = attendedMap[instrId];
    const name = pkgInfo?.name || attrInfo2?.name || attrInfo?.name;
    if (!name) return;

    const credits = (pkgInfo?.credits || 0) + (attrInfo2?.credits || 0);
    const attended = attrInfo?.attended || 0;
    totalCredits += credits;
    totalAttended += attended;
    byInstrument[name] = Math.max(0, credits - attended);
  });

  return {
    total: Math.max(0, totalCredits - totalAttended),
    byInstrument,
  };
}

module.exports = { computeClassesRemaining };
