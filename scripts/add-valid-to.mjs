import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query('ALTER TABLE ou_licenses ADD COLUMN IF NOT EXISTS valid_to timestamp');
  console.log('Column valid_to added to ou_licenses');
} finally {
  await pool.end();
}
