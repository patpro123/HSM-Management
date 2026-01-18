// Apply Migration 004 using Node.js
const fs = require('fs')
const { Client } = require('pg')

async function applyMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'hsm_dev',
    user: 'hsm_admin',
    password: 'secret'
  })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('✓ Connected successfully')
    console.log('')

    console.log('Reading migration file...')
    const sql = fs.readFileSync('./db/migrations/004_add_authentication_tables.sql', 'utf8')
    console.log('✓ Migration file loaded')
    console.log('')

    console.log('Applying migration 004...')
    console.log('(This may take 10-15 seconds)')
    console.log('')
    
    await client.query(sql)
    
    console.log('✓ Migration applied successfully!')
    console.log('')
    
  } catch (error) {
    console.error('✗ Migration failed:')
    console.error(error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

applyMigration()
