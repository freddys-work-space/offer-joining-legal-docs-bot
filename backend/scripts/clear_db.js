const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { getPool } = require('../db/pool');

async function clearAll() {
  try {
    const pool = await getPool();
    console.log('[DB] Connecting to truncate all tables...');
    await pool.query('TRUNCATE TABLE generated_documents, employment_approvals, candidates, audit_logs CASCADE;');
    console.log('[DB] Successfully removed all records from all tables: generated_documents, employment_approvals, candidates, audit_logs.');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Failed to clear tables:', err.message);
    process.exit(1);
  }
}

clearAll();
