const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendEnv = path.resolve(__dirname, '.env');
const rootEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config({ path: rootEnv });
}

const { getPool } = require('./db/pool');
const { getLetterheadPath } = require('./services/pdfService');
const { isResendConfigured } = require('./services/emailService');

const candidatesRouter = require('./routes/candidates');
const approvalsRouter = require('./routes/approvals');
const documentsRouter = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(null, true); // allow local dev ports cleanly
    },
  })
);
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', async (req, res) => {
  let dbConnected = false;
  let dbError = null;
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    dbConnected = true;
  } catch (e) {
    dbError = e.message;
  }

  res.json({
    status: 'ok',
    company: process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED',
    database: { connected: dbConnected, error: dbError },
    letterheadDocxPresent: Boolean(getLetterheadPath('offer_letter')),
    emailConfigured: isResendConfigured(),
  });
});

// Verify Authority Access Key
app.post('/api/auth/verify', (req, res) => {
  const expectedKey = process.env.AUTHORITY_ACCESS_KEY || 'applyus-admin-2026';
  const { accessKey } = req.body;
  if (accessKey && accessKey === expectedKey) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false, error: 'Invalid Authority Access Key' });
});

app.use('/api/candidates', candidatesRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/documents', documentsRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`APPLYUS Offer & Legal Bot API running on http://localhost:${PORT}`);
});

