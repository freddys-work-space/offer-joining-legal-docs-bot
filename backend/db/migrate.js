const { getPool } = require('./pool');

async function migrate() {
  const pool = await getPool();
  const sql = `
    ALTER TABLE candidates
      ALTER COLUMN last_name SET DEFAULT '',
      ALTER COLUMN father_name DROP NOT NULL,
      ALTER COLUMN mother_name DROP NOT NULL,
      ALTER COLUMN primary_phone DROP NOT NULL,
      ALTER COLUMN city DROP NOT NULL,
      ALTER COLUMN state DROP NOT NULL,
      ALTER COLUMN pincode DROP NOT NULL,
      ALTER COLUMN full_address DROP NOT NULL,
      ALTER COLUMN interview_date DROP NOT NULL;

    ALTER TABLE candidates
      ADD COLUMN IF NOT EXISTS invited_by VARCHAR(150) DEFAULT 'Inhouse Admin',
      ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS form_submitted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS form_submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS form_access_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_accessed_ip VARCHAR(100) DEFAULT '',
      ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS date_of_birth DATE;
  `;
  try {
    await pool.query(sql);
    console.log('Neon PostgreSQL migration completed successfully.');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

