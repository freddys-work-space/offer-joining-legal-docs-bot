const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { query } = require('../db/pool');
const { requireAuthority } = require('../middleware/auth');
const { renderDocument, buildCandidateFullName } = require('../services/templateService');
const { generatePdf, TEMPLATES_DIR, getLetterheadPath } = require('../services/pdfService');
const { sendDocumentEmail } = require('../services/emailService');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMPLATES_DIR),
    filename: (req, file, cb) => cb(null, 'letterhead.docx'),
  }),
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.docx')) {
      return cb(new Error('Only .docx files are allowed for the Word letterhead.'));
    }
    cb(null, true);
  },
});

function generateDocRef(docType) {
  const prefixMap = {
    offer_letter: 'OL',
    joining_letter: 'JL',
    legal_nda: 'NDA',
    legal_non_compete: 'NC',
    legal_ip_assignment: 'IP',
    legal_breach_notice: 'LN',
  };
  const prefix = prefixMap[docType] || 'DOC';
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `APPLYUS-${prefix}-${year}-${rand}`;
}

// Authority Only: Generate Offer, Joining, or Legal PDF
router.post('/generate', requireAuthority, async (req, res, next) => {
  try {
    const { candidate_id, approval_id, doc_type } = req.body;
    if (!candidate_id || !doc_type) {
      return res.status(400).json({ error: 'candidate_id and doc_type are required.' });
    }

    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [candidate_id]);
    if (candRes.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }
    const candidate = candRes.rows[0];

    let approval = null;
    if (approval_id) {
      const appRes = await query('SELECT * FROM employment_approvals WHERE id = $1', [approval_id]);
      approval = appRes.rows[0] || null;
    } else {
      const appRes = await query(
        'SELECT * FROM employment_approvals WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1',
        [candidate_id]
      );
      approval = appRes.rows[0] || null;
    }

    if (!approval) {
      return res.status(400).json({
        error: 'Please submit the Current Employee Approval Form (designation, department, salary, reporting manager, director) before generating documents.',
      });
    }

    const refNumber = generateDocRef(doc_type);
    const renderedContent = renderDocument(doc_type, candidate, approval, refNumber);
    const { pdfPath, engine } = await generatePdf({
      refNumber,
      docType: doc_type,
      renderedContent,
    });

    const docRes = await query(
      `INSERT INTO generated_documents (
        candidate_id, approval_id, doc_type, ref_number, rendered_content, pdf_path, status
      ) VALUES ($1,$2,$3,$4,$5,$6,'generated') RETURNING *`,
      [candidate.id, approval.id, doc_type, refNumber, renderedContent, pdfPath]
    );

    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('document', $1, 'GENERATED_DOCUMENT', 'Higher Authority', $2)`,
      [docRes.rows[0].id, JSON.stringify({ doc_type, refNumber, engine })]
    );

    res.status(201).json({
      message: `Document ${refNumber} generated successfully.`,
      engine,
      document: docRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Download generated PDF
router.get('/:id/download', requireAuthority, async (req, res, next) => {
  try {
    const docRes = await query('SELECT * FROM generated_documents WHERE id = $1', [req.params.id]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const doc = docRes.rows[0];
    if (!doc.pdf_path || !fs.existsSync(doc.pdf_path)) {
      return res.status(404).json({ error: 'PDF file not found on disk.' });
    }
    res.download(doc.pdf_path, `${doc.ref_number}.pdf`);
  } catch (err) {
    next(err);
  }
});

// Authority Only: Send generated document via Email
router.post('/:id/send', requireAuthority, async (req, res, next) => {
  try {
    const docRes = await query('SELECT * FROM generated_documents WHERE id = $1', [req.params.id]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const doc = docRes.rows[0];
    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [doc.candidate_id]);
    const candidate = candRes.rows[0];

    const recipient = req.body.email || candidate.primary_email;
    const emailResult = await sendDocumentEmail({
      to: recipient,
      candidateName: buildCandidateFullName(candidate),
      docType: doc.doc_type,
      refNumber: doc.ref_number,
      pdfPath: doc.pdf_path,
    });

    await query(
      `UPDATE generated_documents SET sent_to_email = $1, sent_at = NOW(), status = 'sent' WHERE id = $2`,
      [recipient, doc.id]
    );

    if (doc.doc_type === 'offer_letter') {
      await query(`UPDATE candidates SET status = 'offer_sent', updated_at = NOW() WHERE id = $1`, [
        candidate.id,
      ]);
    } else if (doc.doc_type === 'joining_letter') {
      await query(`UPDATE candidates SET status = 'joined', updated_at = NOW() WHERE id = $1`, [
        candidate.id,
      ]);
    }

    res.json({
      message: emailResult.sent
        ? `Document emailed to ${recipient}.`
        : emailResult.message,
      ...emailResult,
    });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Upload Word (.docx) Letterhead
router.post('/letterhead', requireAuthority, upload.single('letterhead'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a .docx file.' });
  }
  res.json({
    message: 'Word letterhead uploaded successfully.',
    path: req.file.path,
  });
});

// Authority Only: Check Letterhead status
router.get('/letterhead/status', requireAuthority, (req, res) => {
  const lh = getLetterheadPath();
  res.json({
    configured: Boolean(lh),
    path: lh ? path.basename(lh) : null,
  });
});

module.exports = router;

