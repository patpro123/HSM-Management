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

module.exports = router;