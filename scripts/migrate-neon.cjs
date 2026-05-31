// migrate-neon.js — copy all data from old Neon to new Neon
const { Pool } = require('pg');

const oldUrl = process.env.MIGRATE_OLD_URL;   // set before running: export MIGRATE_OLD_URL=postgresql://...
const newUrl = process.env.MIGRATE_NEW_URL;   // set before running: export MIGRATE_NEW_URL=postgresql://...

// Ordered by FK dependencies — parents first
const tables = [
  // No FK deps (root tables)
  'organizational_units',
  'sessions',
  'system_settings',
  'session_audit_log',
  'faqs',
  // FK → organizational_units
  'physical_locations',
  // FK → physical_locations
  'users',
  // FK → users
  'user_location_scopes',
  'ou_licenses',
  // FK → users + organizational_units
  'gs_members',
  'gs_messages',
  'guest_name_imports',
  'calendar_events',
  'valet_tickets',
  // FK → gs_messages
  'gs_replies',
  // FK → valet_tickets
  'ticket_guest_trips',
];

async function migrate() {
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  let totalRows = 0;

  for (const table of tables) {
    try {
      // Read from old
      const select = await oldPool.query(`SELECT * FROM ${table}`);
      const rows = select.rows;
      if (rows.length === 0) {
        console.log(`  SKIP ${table} (0 rows)`);
        continue;
      }

      // Get column names
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      // Build INSERT with explicit columns
      const colList = columns.map(c => `"${c}"`).join(', ');
      const insertSql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

      // Batch insert (10 rows per batch to be safe)
      const batchSize = 10;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        for (const row of batch) {
          const values = columns.map(c => row[c]);
          await newPool.query(insertSql, values);
        }
      }

      totalRows += rows.length;
      console.log(`  ✅ ${table}: ${rows.length} rows`);
    } catch (e) {
      console.error(`  ❌ ${table}: ${e.message}`);
    }
  }

  console.log(`\nTotal: ${totalRows} rows migrated`);

  // Verify
  console.log('\nVerification:');
  for (const table of tables) {
    try {
      const oldC = await oldPool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      const newC = await newPool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      const oldN = parseInt(oldC.rows[0].cnt);
      const newN = parseInt(newC.rows[0].cnt);
      const match = oldN === newN ? '✅' : '❌';
      console.log(`  ${match} ${table}: old=${oldN} new=${newN}`);
    } catch (e) {
      console.log(`  ❌ ${table}: verify error - ${e.message}`);
    }
  }

  await oldPool.end();
  await newPool.end();
  console.log('\nDone!');
}

migrate().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
