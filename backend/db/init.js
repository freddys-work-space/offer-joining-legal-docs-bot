const fs = require('fs');
const path = require('path');
const { getPool } = require('./pool');

async function initDb() {
  let pool;
  try {
    pool = await getPool();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('Neon PostgreSQL schema initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
