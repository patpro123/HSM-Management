const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || 'hsm_dev',
  user: process.env.DB_USER || 'hsm_admin',
  password: process.env.DB_PASSWORD || 'secret',
  max: 10,
  idleTimeoutMillis: 30000
})

pool.on('error', (err) => {
  console.error('Unexpected PG client error:', err)
})

module.exports = pool
