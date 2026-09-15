// Financial-year scoped receipt numbering (FY = Apr-Mar), e.g. HSM/2026-27/0001

function getFiscalYear(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() // 0-indexed; 3 = April
  const startYear = month >= 3 ? year : year - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

// Assigns a receipt number to a payment if it doesn't already have one.
// Idempotent — returns the existing number if already assigned.
// `client` must be a pg client/pool already inside a transaction if called from one.
async function assignReceiptNumber(client, paymentId, paymentDate) {
  const existing = await client.query('SELECT receipt_number FROM payments WHERE id = $1', [paymentId])
  if (existing.rows.length === 0) {
    throw new Error('Payment not found')
  }
  if (existing.rows[0].receipt_number) {
    return existing.rows[0].receipt_number
  }

  const fiscalYear = getFiscalYear(paymentDate)

  const counterRes = await client.query(
    `INSERT INTO receipt_number_counters (fiscal_year, last_number)
     VALUES ($1, 1)
     ON CONFLICT (fiscal_year) DO UPDATE SET last_number = receipt_number_counters.last_number + 1
     RETURNING last_number`,
    [fiscalYear]
  )
  const receiptNumber = `HSM/${fiscalYear}/${String(counterRes.rows[0].last_number).padStart(4, '0')}`

  await client.query('UPDATE payments SET receipt_number = $1 WHERE id = $2', [receiptNumber, paymentId])

  return receiptNumber
}

module.exports = { getFiscalYear, assignReceiptNumber }
