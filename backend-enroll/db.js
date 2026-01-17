const { Pool } = require('pg')

// Support both connection string (for Neon, Railway, etc.) and individual params
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000
    })
  : new Pool({
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
