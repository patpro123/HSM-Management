const pool = require('../db');

// For each active student and instrument: the last tuition payment, the size of the package it
// bought (its credits_bought, else the package: Monthly 8, Quarterly 24), and the classes attended
// since that payment's date. Payments are made ahead of the classes they cover, so the next one is
// due when the classes used since the last payment are close to, or past, the package size.
const UUID = "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'";
const DUES_SQL = `
  WITH single_instr AS (
    SELECT e2.student_id, MAX(b2.instrument_id::text)::uuid AS instrument_id
    FROM enrollment_batches eb2
    JOIN enrollments e2 ON e2.id = eb2.enrollment_id AND e2.status = 'active'
    JOIN batches b2 ON b2.id = eb2.batch_id
    WHERE b2.is_makeup = false
    GROUP BY e2.student_id
    HAVING COUNT(DISTINCT b2.instrument_id) = 1
  ),
  pay AS (
    SELECT p.student_id, p.timestamp, p.amount::float AS amount,
      COALESCE(pkg.instrument_id,
               CASE WHEN p.metadata->>'instrument_id' ~ ${UUID} THEN (p.metadata->>'instrument_id')::uuid END,
               bb.instrument_id, si.instrument_id) AS instrument_id,
      CASE
        WHEN p.metadata->>'credits_bought' ~ '^[0-9]+$' AND (p.metadata->>'credits_bought')::int > 0
          THEN (p.metadata->>'credits_bought')::int
        WHEN pkg.name ILIKE '%quarter%' THEN 24
        WHEN pkg.name ILIKE '%month%' THEN 8
        ELSE COALESCE(pkg.classes_count, 0) END AS credits,
      lower(COALESCE(p.metadata->>'payment_frequency', pkg.name, '')) AS freq
    FROM payments p
    LEFT JOIN packages pkg ON pkg.id = p.package_id
    LEFT JOIN batches bb ON bb.id = CASE WHEN p.metadata->>'batch_id' ~ ${UUID} THEN (p.metadata->>'batch_id')::uuid END
    LEFT JOIN single_instr si ON si.student_id = p.student_id
  ),
  last_pay AS (
    SELECT DISTINCT ON (student_id, instrument_id) *
    FROM pay
    WHERE instrument_id IS NOT NULL AND credits > 0
    ORDER BY student_id, instrument_id, timestamp DESC
  ),
  base AS (
    SELECT DISTINCT s.id AS student_id, s.name, s.phone, i.id AS instrument_id, i.name AS instrument
    FROM students s
    JOIN enrollments e ON s.id = e.student_id AND e.status = 'active'
    JOIN enrollment_batches eb ON e.id = eb.enrollment_id
    JOIN batches b ON eb.batch_id = b.id AND b.is_makeup = false
    JOIN instruments i ON b.instrument_id = i.id
    WHERE s.is_active = true
      AND ($2::uuid IS NULL OR s.id = $2::uuid)
      AND ($3::text IS NULL OR i.name ILIKE $3::text)
  ),
  calc AS (
    SELECT base.*, COALESCE(lp.credits, 0) AS allowance, lp.freq,
      to_char(lp.timestamp AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS last_paid_on,
      lp.amount AS last_paid_amount,
      -- classes attended since the last payment (all of them when there is no payment on record)
      (SELECT COUNT(*) FROM attendance_records ar JOIN batches b3 ON b3.id = ar.batch_id
        WHERE ar.student_id = base.student_id AND b3.instrument_id = base.instrument_id AND ar.status = 'present'
          AND (lp.timestamp IS NULL OR ar.session_date >= (lp.timestamp AT TIME ZONE 'Asia/Kolkata')::date))::int AS used,
      lp.timestamp AS paid_ts
    FROM base
    LEFT JOIN last_pay lp ON lp.student_id = base.student_id AND lp.instrument_id = base.instrument_id
  )
  SELECT calc.student_id, calc.name, calc.phone, calc.instrument, calc.allowance, calc.used,
    GREATEST(0, calc.allowance - calc.used) AS classes_remaining,
    GREATEST(0, calc.used - calc.allowance) AS overdue_classes,
    calc.last_paid_on, calc.last_paid_amount,
    rn.name AS package_name, rn.price AS package_price, rn.classes AS package_classes,
    -- the first class beyond what the last payment covered
    (SELECT to_char(ar.session_date, 'YYYY-MM-DD')
       FROM attendance_records ar JOIN batches b4 ON b4.id = ar.batch_id
       WHERE ar.student_id = calc.student_id AND b4.instrument_id = calc.instrument_id AND ar.status = 'present'
         AND (calc.paid_ts IS NULL OR ar.session_date >= (calc.paid_ts AT TIME ZONE 'Asia/Kolkata')::date)
       ORDER BY ar.session_date, ar.id
       OFFSET calc.allowance LIMIT 1) AS overdue_since
  FROM calc
  -- the package they would renew onto: the same kind as the last payment (quarterly or monthly)
  LEFT JOIN LATERAL (
    SELECT pk.name, pk.price::float AS price, CASE WHEN pk.name ILIKE '%quarter%' THEN 24 ELSE 8 END AS classes
    FROM packages pk
    WHERE pk.instrument_id = calc.instrument_id
      AND pk.name ILIKE CASE WHEN calc.freq LIKE '%quarter%' OR calc.allowance >= 20 THEN '%quarter%' ELSE '%month%' END
    ORDER BY pk.price LIMIT 1
  ) rn ON true
  WHERE calc.allowance - calc.used <= $1
  ORDER BY calc.instrument, (calc.used - calc.allowance) DESC, calc.name
  LIMIT 200`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'YYYY-MM-DD' -> '12 Oct 2026'
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

const money = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * Students whose paid classes are used up or nearly so, one row per student and instrument,
 * sorted by instrument. `pending_amount` is the classes taken beyond payment times the
 * per-class price of the instrument's smallest package.
 */
async function fetchDues({ maxRemaining = 2, studentId = null, instrument = null } = {}) {
  const { rows } = await pool.query(DUES_SQL, [maxRemaining, studentId, instrument]);
  // The amount due is the renewal package; it does not shrink with classes already over
  return rows.map(r => ({ ...r, pending_amount: r.package_price ? Math.round(r.package_price) : 0, has_payment: !!r.last_paid_on }));
}

const classes = n => `${n} class${n === 1 ? '' : 'es'}`;

function duesSecondary(r) {
  const due = r.pending_amount ? money(r.pending_amount) : 'Payment';
  if (!r.has_payment) return `${due} due · no payment on record · ${classes(r.used)} attended`;
  if (r.overdue_classes > 0) {
    return `${due} due · ${r.used}/${r.allowance} used${r.overdue_since ? ' · ran out ' + fmtDate(r.overdue_since) : ''}`;
  }
  return `${due} due soon · ${r.used}/${r.allowance} used · ${r.classes_remaining} left`;
}

// List rows grouped by instrument; tapping one opens payment.dues_detail
function duesItems(rows) {
  return rows.map(r => ({
    name: r.name,
    secondary: duesSecondary(r),
    group: r.instrument,
    action: {
      skill: 'payment.dues_detail',
      params: { student_id: r.student_id, instrument: r.instrument },
      label: `${r.name} · ${r.instrument} dues`,
    },
  }));
}

module.exports = { fetchDues, duesItems, fmtDate, money };
