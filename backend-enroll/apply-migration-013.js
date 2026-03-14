const pool = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Running Migration 013: Create notifications table');
        await client.query('BEGIN');

        // Create notifications table
        await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID DEFAULT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT false,
          action_link VARCHAR(255),
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Create indexes for fast querying
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read 
      ON notifications(user_id, is_read);
    `);

        await client.query('COMMIT');
        console.log('Migration 013 successful! Created notifications table.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
