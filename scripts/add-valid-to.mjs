import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE ou_licenses ADD COLUMN IF NOT EXISTS valid_to timestamp`;
console.log('Column valid_to added to ou_licenses');
