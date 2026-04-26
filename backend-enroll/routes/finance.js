const express = require('express');
const router = express.Router();
const pool = require('../db');

// --- Expenses Endpoints ---

// GET /api/finance/expenses
router.get('/expenses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses ORDER BY date DESC');
    res.json({ expenses: result.rows });
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/finance/expenses
router.post('/expenses', async (req, res) => {
  const { category, amount, date, notes } = req.body;
  if (!category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO expenses (category, amount, date, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [category, amount, date, notes]
    );
    res.status(201).json({ expense: result.rows[0] });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// DELETE /api/finance/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// --- Budgets Endpoints ---

// GET /api/finance/budgets
router.get('/budgets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM monthly_budgets ORDER BY month DESC');
    // Map snake_case DB fields to camelCase for frontend
    const budgets = result.rows.map(row => ({
      month: row.month,
      revenueTarget: parseFloat(row.revenue_target),
      expenseLimits: row.expense_limits
    }));
    res.json({ budgets });
  } catch (err) {
    console.error('Get budgets error:', err);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// POST /api/finance/budgets
router.post('/budgets', async (req, res) => {
  const { month, revenueTarget, expenseLimits } = req.body;
  if (!month) return res.status(400).json({ error: 'Month is required' });

  try {
    const result = await pool.query(
      `INSERT INTO monthly_budgets (month, revenue_target, expense_limits)
       VALUES ($1, $2, $3)
       ON CONFLICT (month)
       DO UPDATE SET 
         revenue_target = EXCLUDED.revenue_target, 
         expense_limits = EXCLUDED.expense_limits, 
         updated_at = NOW()
       RETURNING *`,
      [month, revenueTarget || 0, JSON.stringify(expenseLimits || {})]
    );
    
    const row = result.rows[0];
    res.json({
      budget: {
        month: row.month,
        revenueTarget: parseFloat(row.revenue_target),
        expenseLimits: row.expense_limits
      }
    });
  } catch (err) {
    console.error('Save budget error:', err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

// --- Fee Structure Endpoints ---

// GET /api/finance/fees
router.get('/fees', async (req, res) => {
  try {
    // We store fees in the 'packages' table.
    // We assume package names contain 'Monthly' or 'Quarterly'.
    const result = await pool.query('SELECT instrument_id, name, price FROM packages');
    const fees = {};
    
    result.rows.forEach(pkg => {
      if (!fees[pkg.instrument_id]) {
        fees[pkg.instrument_id] = { monthly: 0, quarterly: 0 };
      }
      if (pkg.name.toLowerCase().includes('monthly')) {
        fees[pkg.instrument_id].monthly = parseFloat(pkg.price);
      } else if (pkg.name.toLowerCase().includes('quarterly')) {
        fees[pkg.instrument_id].quarterly = parseFloat(pkg.price);
      }
    });
    
    res.json({ fees });
  } catch (err) {
    console.error('Get fees error:', err);
    res.status(500).json({ error: 'Failed to fetch fees' });
  }
});

// POST /api/finance/fees
router.post('/fees', async (req, res) => {
  const { fees } = req.body; // Expected: { [instId]: { monthly: 1000, quarterly: 3000 } }
  if (!fees) return res.status(400).json({ error: 'Fees data required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const [instId, rates] of Object.entries(fees)) {
      // 1. Upsert Monthly Package
      const checkMonthly = await client.query(
        'SELECT id FROM packages WHERE instrument_id = $1 AND name = $2',
        [instId, 'Monthly']
      );
      
      if (checkMonthly.rows.length > 0) {
        await client.query('UPDATE packages SET price = $1 WHERE id = $2', [rates.monthly, checkMonthly.rows[0].id]);
      } else {
        await client.query(
          'INSERT INTO packages (instrument_id, name, classes_count, price) VALUES ($1, $2, $3, $4)',
          [instId, 'Monthly', 8, rates.monthly]
        );
      }

      // 2. Upsert Quarterly Package
      const checkQuarterly = await client.query(
        'SELECT id FROM packages WHERE instrument_id = $1 AND name = $2',
        [instId, 'Quarterly']
      );
      
      if (checkQuarterly.rows.length > 0) {
        await client.query('UPDATE packages SET price = $1 WHERE id = $2', [rates.quarterly, checkQuarterly.rows[0].id]);
      } else {
        await client.query(
          'INSERT INTO packages (instrument_id, name, classes_count, price) VALUES ($1, $2, $3, $4)',
          [instId, 'Quarterly', 24, rates.quarterly]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Fees updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save fees error:', err);
    res.status(500).json({ error: 'Failed to save fees' });
  } finally {
    client.release();
  }
});

// ── GRADE RATES ENDPOINTS ─────────────────────────────────────────────────────

const VOCAL_INSTRUMENTS = ['hindustani vocals', 'carnatic vocals'];
const TRINITY_GRADES = ['Initial','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8'];

// GET /api/finance/grade-rates
// Returns all instrument_grade_rates joined with instrument names
router.get('/grade-rates', async (req, res) => {
  try {
    const ratesRes = await pool.query(
      `SELECT igr.id, igr.instrument_id, i.name AS instrument_name,
              igr.trinity_grade, igr.rate_per_student
       FROM instrument_grade_rates igr
       JOIN instruments i ON i.id = igr.instrument_id
       ORDER BY i.name, igr.trinity_grade`
    );
    const instrumentsRes = await pool.query('SELECT id, name FROM instruments ORDER BY name');
    res.json({ rates: ratesRes.rows, instruments: instrumentsRes.rows });
  } catch (err) {
    console.error('Get grade rates error:', err);
    res.status(500).json({ error: 'Failed to fetch grade rates' });
  }
});

// POST /api/finance/grade-rates
// Upsert a rate for instrument + grade
router.post('/grade-rates', async (req, res) => {
  const { instrument_id, trinity_grade, rate_per_student } = req.body;
  if (!instrument_id || !trinity_grade || rate_per_student == null) {
    return res.status(400).json({ error: 'instrument_id, trinity_grade and rate_per_student required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO instrument_grade_rates (instrument_id, trinity_grade, rate_per_student)
       VALUES ($1, $2, $3)
       ON CONFLICT (instrument_id, trinity_grade)
       DO UPDATE SET rate_per_student = EXCLUDED.rate_per_student, updated_at = now()
       RETURNING *`,
      [instrument_id, trinity_grade, rate_per_student]
    );
    res.json({ rate: result.rows[0] });
  } catch (err) {
    console.error('Save grade rate error:', err);
    res.status(500).json({ error: 'Failed to save grade rate' });
  }
});

// GET /api/finance/grade-rates/overrides/:teacherId
// Returns all overrides for a teacher
router.get('/grade-rates/overrides/:teacherId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tgro.id, tgro.instrument_id, i.name AS instrument_name,
              tgro.trinity_grade, tgro.rate_per_student
       FROM teacher_grade_rate_overrides tgro
       JOIN instruments i ON i.id = tgro.instrument_id
       WHERE tgro.teacher_id = $1
       ORDER BY i.name, tgro.trinity_grade`,
      [req.params.teacherId]
    );
    res.json({ overrides: result.rows });
  } catch (err) {
    console.error('Get overrides error:', err);
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

// POST /api/finance/grade-rates/overrides/:teacherId
// Upsert a teacher-level rate override
router.post('/grade-rates/overrides/:teacherId', async (req, res) => {
  const { instrument_id, trinity_grade, rate_per_student } = req.body;
  if (!instrument_id || !trinity_grade || rate_per_student == null) {
    return res.status(400).json({ error: 'instrument_id, trinity_grade and rate_per_student required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO teacher_grade_rate_overrides (teacher_id, instrument_id, trinity_grade, rate_per_student)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (teacher_id, instrument_id, trinity_grade)
       DO UPDATE SET rate_per_student = EXCLUDED.rate_per_student, updated_at = now()
       RETURNING *`,
      [req.params.teacherId, instrument_id, trinity_grade, rate_per_student]
    );
    res.json({ override: result.rows[0] });
  } catch (err) {
    console.error('Save override error:', err);
    res.status(500).json({ error: 'Failed to save override' });
  }
});

// DELETE /api/finance/grade-rates/overrides/:teacherId/:overrideId
router.delete('/grade-rates/overrides/:teacherId/:overrideId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM teacher_grade_rate_overrides WHERE id = $1 AND teacher_id = $2',
      [req.params.overrideId, req.params.teacherId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete override error:', err);
    res.status(500).json({ error: 'Failed to delete override' });
  }
});

// ── PAYOUT PARAMS ─────────────────────────────────────────────────────────────

// GET /api/finance/payout-params/:teacherId
router.get('/payout-params/:teacherId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(per_student_rate_type, 'percentage') AS rate_type,
              COALESCE(per_student_fixed_rate, 0)           AS fixed_rate,
              COALESCE(maintenance_amount, 1200)            AS maintenance_amount,
              COALESCE(payout_percentage,  0.70)            AS payout_percentage
       FROM teachers WHERE id = $1`,
      [req.params.teacherId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    const r = result.rows[0];
    res.json({
      rate_type:          r.rate_type,
      fixed_rate:         parseFloat(r.fixed_rate),
      maintenance_amount: parseFloat(r.maintenance_amount),
      payout_percentage:  parseFloat(r.payout_percentage)
    });
  } catch (err) {
    console.error('Get payout params error:', err);
    res.status(500).json({ error: 'Failed to fetch payout params' });
  }
});

// PUT /api/finance/payout-params/:teacherId
router.put('/payout-params/:teacherId', async (req, res) => {
  const { rate_type, fixed_rate, maintenance_amount, payout_percentage } = req.body;
  if (!rate_type || !['fixed', 'percentage'].includes(rate_type)) {
    return res.status(400).json({ error: 'rate_type must be "fixed" or "percentage"' });
  }
  try {
    if (rate_type === 'fixed') {
      const fr = parseFloat(fixed_rate);
      if (isNaN(fr) || fr < 0) return res.status(400).json({ error: 'fixed_rate must be >= 0' });
      await pool.query(
        `UPDATE teachers SET per_student_rate_type = 'fixed', per_student_fixed_rate = $1 WHERE id = $2`,
        [fr, req.params.teacherId]
      );
      res.json({ rate_type: 'fixed', fixed_rate: fr });
    } else {
      const ma = parseFloat(maintenance_amount);
      const pp = parseFloat(payout_percentage);
      if (isNaN(ma) || ma < 0 || isNaN(pp) || pp < 0 || pp > 1) {
        return res.status(400).json({ error: 'maintenance_amount >= 0; payout_percentage 0–1' });
      }
      await pool.query(
        `UPDATE teachers SET per_student_rate_type = 'percentage',
                             maintenance_amount = $1, payout_percentage = $2
         WHERE id = $3`,
        [ma, pp, req.params.teacherId]
      );
      res.json({ rate_type: 'percentage', maintenance_amount: ma, payout_percentage: pp });
    }
  } catch (err) {
    console.error('Update payout params error:', err);
    res.status(500).json({ error: 'Failed to update payout params' });
  }
});

// ── PAYSLIP ENDPOINT ──────────────────────────────────────────────────────────

// GET /api/finance/payslip/:teacherId?month=YYYY-MM
router.get('/payslip/:teacherId', async (req, res) => {
  const { teacherId } = req.params;
  const monthStr = req.query.month || new Date().toISOString().slice(0, 7);
  const [year, month] = monthStr.split('-').map(Number);

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd   = new Date(year, month, 0); // last day of month
  const deferralCutoff = 20; // students enrolled after this day deferred to next month

  try {
    // 1. Teacher profile
    const teacherRes = await pool.query(
      `SELECT id, name, phone, payout_type, rate,
              COALESCE(per_student_rate_type, 'percentage') AS per_student_rate_type,
              COALESCE(per_student_fixed_rate, 0)           AS per_student_fixed_rate,
              COALESCE(maintenance_amount, 1200)            AS maintenance_amount,
              COALESCE(payout_percentage,  0.70)            AS payout_percentage,
              COALESCE(metadata->>'email', '') AS email
       FROM teachers WHERE id = $1`,
      [teacherId]
    );
    if (teacherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const teacher = teacherRes.rows[0];
    const perStudentRateType  = teacher.per_student_rate_type;
    const perStudentFixedRate = parseFloat(teacher.per_student_fixed_rate);
    const maintenanceAmount   = parseFloat(teacher.maintenance_amount);
    const payoutPercentage    = parseFloat(teacher.payout_percentage);

    // 2. Batches for this teacher (non-makeup)
    const batchesRes = await pool.query(
      `SELECT b.id, b.recurrence, b.start_time, b.end_time,
              i.id AS instrument_id, i.name AS instrument_name
       FROM batches b
       JOIN instruments i ON i.id = b.instrument_id
       WHERE b.teacher_id = $1 AND b.is_makeup = false
       ORDER BY i.name, b.start_time`,
      [teacherId]
    );
    const batches = batchesRes.rows;
    const batchIds = batches.map(b => b.id);

    if (batchIds.length === 0) {
      return res.json({
        teacher: { id: teacher.id, name: teacher.name, phone: teacher.phone,
                   email: teacher.email, payout_type: teacher.payout_type, rate: parseFloat(teacher.rate) },
        period: { month: monthStr, start: periodStart.toISOString().slice(0,10),
                  end: periodEnd.toISOString().slice(0,10) },
        instruments: [], summary: { total_payable: 0, fixed_salary: null, per_student_total: null, deferred_count: 0, excluded_count: 0, billable_count: 0 }
      });
    }

    // 3. Teacher attendance for the month
    const taRes = await pool.query(
      `SELECT batch_id, status, session_date FROM teacher_attendance
       WHERE batch_id = ANY($1)
         AND session_date >= $2 AND session_date <= $3`,
      [batchIds, periodStart.toISOString().slice(0,10), periodEnd.toISOString().slice(0,10)]
    );
    const taByBatch = {};
    taRes.rows.forEach(r => {
      if (!taByBatch[r.batch_id]) taByBatch[r.batch_id] = { conducted: 0, not_conducted: 0 };
      if (r.status === 'conducted') taByBatch[r.batch_id].conducted++;
      else taByBatch[r.batch_id].not_conducted++;
    });

    // Also count implicit sessions from student attendance where teacher_attendance not marked
    const implicitRes = await pool.query(
      `SELECT ar.batch_id, COUNT(DISTINCT ar.session_date) AS implicit_conducted
       FROM attendance_records ar
       LEFT JOIN teacher_attendance ta
         ON ta.batch_id = ar.batch_id AND ta.session_date = ar.session_date
       WHERE ar.batch_id = ANY($1)
         AND ar.session_date >= $2 AND ar.session_date <= $3
         AND ta.id IS NULL
       GROUP BY ar.batch_id`,
      [batchIds, periodStart.toISOString().slice(0,10), periodEnd.toISOString().slice(0,10)]
    );
    implicitRes.rows.forEach(r => {
      if (!taByBatch[r.batch_id]) taByBatch[r.batch_id] = { conducted: 0, not_conducted: 0 };
      taByBatch[r.batch_id].conducted += parseInt(r.implicit_conducted);
    });

    // 4. Students per instrument — attendance counted across ANY batch of the same instrument
    //    (handles cases where a student was moved to a different batch mid-month)
    const studentsRes = await pool.query(
      `SELECT
         s.id AS student_id, s.name AS student_name,
         i.id AS instrument_id, i.name AS instrument_name,
         MIN(eb.trinity_grade) AS trinity_grade,
         MIN(COALESCE(e.enrolled_on, e.created_at::date)) AS enrollment_date,
         MIN(e.created_at) AS enrollment_created_at,
         MIN(eb.payment_frequency::text) AS payment_frequency,
         MIN(eb.fee_structure_id::text) AS fee_structure_id,
         COALESCE((
           SELECT COUNT(DISTINCT ar.id)
           FROM attendance_records ar
           JOIN batches ab ON ab.id = ar.batch_id
           WHERE ar.student_id = s.id
             AND ab.instrument_id = i.id
             AND ar.status = 'present'
             AND ar.session_date >= $2 AND ar.session_date <= $3
         ), 0) AS classes_attended_month
       FROM enrollment_batches eb
       JOIN enrollments e ON e.id = eb.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN batches b ON b.id = eb.batch_id
       JOIN instruments i ON i.id = b.instrument_id
       WHERE b.teacher_id = $1
         AND b.is_makeup = false
         AND e.status = 'active'
       GROUP BY s.id, s.name, i.id, i.name
       ORDER BY i.name, s.name`,
      [teacherId, periodStart.toISOString().slice(0,10), periodEnd.toISOString().slice(0,10)]
    );

    const instrumentIds = [...new Set(batches.map(b => b.instrument_id))];

    // 5. Fee structures for students who have a locked rate (post-2026 enrollments)
    const feeStructureIds = [...new Set(
      studentsRes.rows.map(r => r.fee_structure_id).filter(Boolean)
    )];
    const feeStructureMap = {};

    if (feeStructureIds.length > 0) {
      const fsRes = await pool.query(
        `SELECT id, fee_amount, classes_count, is_trial
         FROM fee_structures WHERE id = ANY($1)`,
        [feeStructureIds]
      );
      fsRes.rows.forEach(r => {
        feeStructureMap[r.id] = {
          fee_amount: parseFloat(r.fee_amount),
          classes_count: parseInt(r.classes_count),
          is_trial: r.is_trial
        };
      });
    }

    // 6. Legacy package prices (fallback for students without fee_structure_id)
    const legacyPkgRes = await pool.query(
      `SELECT instrument_id, LOWER(name) AS freq_key, price, classes_count
       FROM packages WHERE instrument_id = ANY($1)`,
      [instrumentIds]
    );
    const legacyPackageMap = {};
    legacyPkgRes.rows.forEach(p => {
      legacyPackageMap[`${p.instrument_id}::${p.freq_key}`] = {
        price: parseFloat(p.price),
        classes_count: parseInt(p.classes_count)
      };
    });

    // 7. Classify each student: billable / deferred / excluded
    const batchMap = {};
    batches.forEach(b => { batchMap[b.id] = b; });

    const studentResults = studentsRes.rows.map(s => {
      const classesAttended = parseInt(s.classes_attended_month) || 0;

      // Enrollment date for deferral check — use earliest of enrollment dates
      const enrollDate = new Date(s.enrollment_date || s.enrollment_created_at);
      const enrollDay = enrollDate.getDate();
      const enrollMonth = enrollDate.getMonth() + 1;
      const enrollYear = enrollDate.getFullYear();
      const isNewThisMonth = enrollYear === year && enrollMonth === month;
      const isDeferred = isNewThisMonth && enrollDay > deferralCutoff;

      // Excluded: first class is free — only >1 class counts
      const isExcluded = !isDeferred && classesAttended <= 1;

      // Compute R: monthly-equivalent fee the student pays
      // trial:        R = fee_amount * 2
      // quarterly:    R = fee_amount / 3
      // monthly/pbel: R = fee_amount
      let packageMonthlyRate = 0;
      const fs = feeStructureMap[s.fee_structure_id];
      if (fs) {
        if (fs.is_trial) {
          packageMonthlyRate = fs.fee_amount * 2;
        } else if (fs.classes_count >= 24) {
          packageMonthlyRate = fs.fee_amount / 3;
        } else {
          packageMonthlyRate = fs.fee_amount;
        }
      } else {
        // Legacy fallback: look up from packages table
        const freq = (s.payment_frequency || 'monthly').toLowerCase();
        const pkg = legacyPackageMap[`${s.instrument_id}::${freq}`]
                 || legacyPackageMap[`${s.instrument_id}::monthly`];
        if (pkg) {
          packageMonthlyRate = pkg.classes_count >= 24 ? pkg.price / 3 : pkg.price;
        }
      }
      const isFourClassOrTrial = fs?.is_trial || s.payment_frequency === 'pbel_4';
      const effectiveRate = (!isFourClassOrTrial && perStudentRateType === 'fixed')
        ? perStudentFixedRate
        : Math.max(0, (packageMonthlyRate - maintenanceAmount) * payoutPercentage);

      let status = 'billable';
      if (isDeferred) status = 'deferred';
      else if (isExcluded) status = 'excluded';

      return {
        student_id: s.student_id,
        student_name: s.student_name,
        instrument_id: s.instrument_id,
        instrument_name: s.instrument_name,
        trinity_grade: s.trinity_grade,
        enrollment_date: enrollDate.toISOString().slice(0, 10),
        classes_attended: classesAttended,
        status,
        package_monthly_rate: Math.round(packageMonthlyRate),
        rate: Math.round(effectiveRate),
        subtotal: status === 'billable' ? Math.round(effectiveRate) : 0
      };
    });

    // 8. Build per-instrument summaries (unique students per instrument, attendance per batch)
    const uniqueInstrumentIds = [...new Set(batches.map(b => b.instrument_id))];
    const instrumentSummaries = uniqueInstrumentIds.map(instId => {
      const instBatches = batches.filter(b => b.instrument_id === instId);
      const instName = instBatches[0].instrument_name;
      const isVocal = VOCAL_INSTRUMENTS.includes(instName.toLowerCase());
      const instStudents = studentResults.filter(s => s.instrument_id === instId);
      const billableStudents = instStudents.filter(s => s.status === 'billable');
      const instSubtotal = billableStudents.reduce((sum, s) => sum + s.subtotal, 0);

      return {
        instrument_id: instId,
        instrument_name: instName,
        is_vocal: isVocal,
        batches: instBatches.map(b => ({
          batch_id: b.id,
          recurrence: b.recurrence,
          attendance: taByBatch[b.id] || { conducted: 0, not_conducted: 0 }
        })),
        students: instStudents,
        billable_count: billableStudents.length,
        instrument_subtotal: instSubtotal
      };
    });

    // 9. Overall summary
    const billableTotal = instrumentSummaries.reduce((sum, i) => sum + i.instrument_subtotal, 0);
    const totalPayable = teacher.payout_type === 'fixed' ? parseFloat(teacher.rate) : billableTotal;

    res.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        phone: teacher.phone || '',
        email: teacher.email || '',
        payout_type: teacher.payout_type,
        rate: parseFloat(teacher.rate),
        per_student_rate_type: perStudentRateType,
        per_student_fixed_rate: perStudentFixedRate,
        maintenance_amount: maintenanceAmount,
        payout_percentage: payoutPercentage
      },
      period: {
        month: monthStr,
        start: periodStart.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10)
      },
      instruments: instrumentSummaries,
      summary: {
        total_payable: totalPayable,
        fixed_salary: teacher.payout_type === 'fixed' ? parseFloat(teacher.rate) : null,
        per_student_total: teacher.payout_type === 'per_student_monthly' ? billableTotal : null,
        deferred_count: studentResults.filter(s => s.status === 'deferred').length,
        excluded_count: studentResults.filter(s => s.status === 'excluded').length,
        billable_count: studentResults.filter(s => s.status === 'billable').length
      }
    });
  } catch (err) {
    console.error('Payslip error:', err);
    res.status(500).json({ error: 'Failed to generate payslip' });
  }
});

module.exports = router;