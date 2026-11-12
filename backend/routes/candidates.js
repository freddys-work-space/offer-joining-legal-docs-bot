const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { requireAuthority } = require('../middleware/auth');
const { renderDocument, buildPlaceholders, buildCandidateFullName } = require('../services/templateService');
const { generatePdf } = require('../services/pdfService');
const {
  sendFormInviteEmail,
  sendOfferLetterEmail,
  sendJoiningBundleEmail,
} = require('../services/emailService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateRefCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const ts = Date.now().toString().slice(-3);
  return `APP-${year}-${rand}${ts}`;
}

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

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// Authority Only: Create initial candidate record in Inhouse Portal
router.post('/invite', requireAuthority, async (req, res, next) => {
  try {
    const {
      first_name,
      last_name = '',
      primary_email,
      country_code = '+91',
      primary_phone = '',
      invited_by = 'Inhouse Admin',
    } = req.body;

    if (!first_name || !primary_email) {
      return res.status(400).json({ error: 'first_name and primary_email are required.' });
    }

    const reference_code = generateRefCode();
    const result = await query(
      `INSERT INTO candidates (
        reference_code, first_name, last_name, primary_email, country_code, primary_phone, invited_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'invited') RETURNING *`,
      [
        reference_code,
        first_name.trim(),
        last_name.trim(),
        primary_email.trim(),
        country_code.trim(),
        primary_phone.trim(),
        invited_by.trim(),
      ]
    );

    const candidate = result.rows[0];
    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('candidate', $1, 'CREATED_CANDIDATE_RECORD', $2, $3)`,
      [candidate.id, invited_by, JSON.stringify({ reference_code, primary_email })]
    );

    res.status(201).json({ message: 'Candidate record created.', candidate });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Send Onboarding Form Link (?uid=<id>) to Candidate Email
router.post('/:id/send-form', requireAuthority, async (req, res, next) => {
  try {
    const { id } = req.params;
    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candRes.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }
    const candidate = candRes.rows[0];
    const baseUrl = (
      process.env.NEW_EMP_FRONTEND_URL ||
      process.env.EMPLOYEE_PORTAL_URL ||
      'http://localhost:5173'
    ).replace(/\/+$/, '');
    const formUrl = `${baseUrl}/?uid=${candidate.id}`;

    const emailRes = await sendFormInviteEmail({
      to: candidate.primary_email,
      candidateName: buildCandidateFullName(candidate),
      formUrl,
    });

    const nextStatus = candidate.form_submitted ? candidate.status : 'form_sent';
    await query(
      `UPDATE candidates SET invite_sent_at = NOW(), status = $1, updated_at = NOW() WHERE id = $2`,
      [nextStatus, candidate.id]
    );

    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('candidate', $1, 'SENT_FORM_INVITE', 'Inhouse Admin', $2)`,
      [candidate.id, JSON.stringify({ formUrl, email: candidate.primary_email, emailSent: emailRes.sent })]
    );

    res.json({
      message: emailRes.sent
        ? `Onboarding form link emailed to ${candidate.primary_email}.`
        : emailRes.message,
      formUrl,
      ...emailRes,
    });
  } catch (err) {
    next(err);
  }
});

// Public (Tracked via ?uid=): Fetch candidate invite & log every link access
router.get('/form/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (!UUID_REGEX.test(uid)) {
      await query(
        `INSERT INTO audit_logs (entity_type, action, actor, metadata)
         VALUES ('security', 'INVALID_UID_FORM_ACCESS', $1, $2)`,
        [ip, JSON.stringify({ uid, userAgent })]
      );
      return res.status(404).json({ error: 'Invalid onboarding link.' });
    }

    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [uid]);
    if (candRes.rows.length === 0) {
      await query(
        `INSERT INTO audit_logs (entity_type, action, actor, metadata)
         VALUES ('security', 'UNKNOWN_UID_FORM_ACCESS', $1, $2)`,
        [ip, JSON.stringify({ uid, userAgent })]
      );
      return res.status(404).json({ error: 'Onboarding record not found.' });
    }

    const candidate = candRes.rows[0];
    await query(
      `UPDATE candidates
       SET form_access_count = form_access_count + 1,
           last_accessed_ip = $1,
           last_accessed_at = NOW()
       WHERE id = $2`,
      [ip, candidate.id]
    );

    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('candidate', $1, 'FORM_LINK_ACCESSED', $2, $3)`,
      [
        candidate.id,
        ip,
        JSON.stringify({
          ip,
          userAgent,
          alreadySubmitted: candidate.form_submitted,
          accessNumber: (candidate.form_access_count || 0) + 1,
        }),
      ]
    );

    res.json({
      valid: true,
      submitted: Boolean(candidate.form_submitted),
    });
  } catch (err) {
    next(err);
  }
});

// Public (Tracked via ?uid=): Submit New Employee Form for existing invited record
router.put('/form/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (!UUID_REGEX.test(uid)) {
      return res.status(404).json({ error: 'Invalid onboarding link.' });
    }

    const existingRes = await query('SELECT * FROM candidates WHERE id = $1', [uid]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found.' });
    }

    const existing = existingRes.rows[0];
    if (existing.form_submitted) {
      await query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
         VALUES ('candidate', $1, 'DUPLICATE_SUBMIT_ATTEMPT_BLOCKED', $2, $3)`,
        [existing.id, ip, JSON.stringify({ ip, userAgent })]
      );
      return res.status(409).json({
        error: 'This onboarding link has already been submitted. If you need to update details, please contact HR.',
      });
    }

    const {
      first_name,
      middle_name = '',
      last_name,
      father_name,
      mother_name,
      primary_email,
      secondary_email = '',
      country_code = '+91',
      primary_phone,
      secondary_phone = '',
      house_no = '',
      street = '',
      village = '',
      town = '',
      city,
      state,
      pincode,
      landmark = '',
      full_address,
      date_of_birth,
      interview_date,
    } = req.body;

    const required = {
      first_name,
      last_name,
      father_name,
      mother_name,
      primary_email,
      primary_phone,
      city,
      state,
      pincode,
      full_address,
      date_of_birth,
      interview_date,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({ error: 'Please complete all required fields.' });
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const PHONE_REGEX = /^\d{10}$/;

    if (!EMAIL_REGEX.test(primary_email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid primary email address.' });
    }
    if (secondary_email.trim() && !EMAIL_REGEX.test(secondary_email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid secondary email address.' });
    }
    if (!PHONE_REGEX.test(primary_phone.trim())) {
      return res.status(400).json({ error: 'Primary phone number must be 10 digits.' });
    }
    if (secondary_phone.trim() && !PHONE_REGEX.test(secondary_phone.trim())) {
      return res.status(400).json({ error: 'Secondary phone number must be 10 digits.' });
    }

    if (
      secondary_email.trim() &&
      secondary_email.trim().toLowerCase() === primary_email.trim().toLowerCase()
    ) {
      return res.status(400).json({
        error: 'Primary and secondary emails should be different.',
      });
    }

    if (
      secondary_phone.trim() &&
      secondary_phone.replace(/[\s-]/g, '') === primary_phone.replace(/[\s-]/g, '')
    ) {
      return res.status(400).json({
        error: 'Primary and secondary phone numbers should be different.',
      });
    }

    const updatedRes = await query(
      `UPDATE candidates SET
        first_name = $1, middle_name = $2, last_name = $3,
        father_name = $4, mother_name = $5,
        primary_email = $6, secondary_email = $7,
        country_code = $8, primary_phone = $9, secondary_phone = $10,
        house_no = $11, street = $12, village = $13, town = $14,
        city = $15, state = $16, pincode = $17, landmark = $18,
        full_address = $19, date_of_birth = $20, interview_date = $21,
        form_submitted = TRUE, form_submitted_at = NOW(),
    last_accessed_ip = $22, status = 'pending_approval', updated_at = NOW()
      WHERE id = $23 RETURNING * `,
      [
        first_name.trim(),
        middle_name.trim(),
        last_name.trim(),
        father_name.trim(),
        mother_name.trim(),
        primary_email.trim(),
        secondary_email.trim(),
        country_code.trim(),
        primary_phone.trim(),
        secondary_phone.trim(),
        house_no.trim(),
        street.trim(),
        village.trim(),
        town.trim(),
        city.trim(),
        state.trim(),
        pincode.trim(),
        landmark.trim(),
        full_address.trim(),
        date_of_birth,
        interview_date,
        ip,
        uid,
      ]
    );

    await query(
      `INSERT INTO audit_logs(entity_type, entity_id, action, actor, metadata)
       VALUES('candidate', $1, 'SUBMITTED_NEW_EMPLOYEE_FORM', $2, $3)`,
      [uid, ip, JSON.stringify({ primary_email, ip, userAgent })]
    );

    res.json({
      success: true,
      message: 'Onboarding details submitted successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Send Offer Letter + Legal Forms Bundle
router.post('/:id/send-offer-bundle', requireAuthority, async (req, res, next) => {
  try {
    const { id } = req.params;
    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candRes.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }
    const candidate = candRes.rows[0];

    const {
      designation,
      department,
      salary_amount,
      salary_period = 'annum',
      reporting_manager,
      director_name,
      offer_acceptance_date = null,
    } = req.body;

    if (!designation || !department || !salary_amount || !reporting_manager || !director_name) {
      return res.status(400).json({
        error: 'designation, department, salary_amount, reporting_manager, and director_name are required.',
      });
    }

    const appRes = await query(
      `INSERT INTO employment_approvals(
      candidate_id, designation, department, salary_amount, salary_period,
      reporting_manager, director_name, offer_acceptance_date, approved_by
    ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'Inhouse Authority') RETURNING * `,
      [
        candidate.id,
        designation.trim(),
        department.trim(),
        Number(salary_amount),
        salary_period,
        reporting_manager.trim(),
        director_name.trim(),
        offer_acceptance_date || null,
      ]
    );
    const approval = appRes.rows[0];

    // Generate ONLY ONE document: the Offer Letter
    const refNumber = generateDocRef('offer_letter');
    const placeholders = buildPlaceholders(candidate, approval, refNumber);
    const renderedContent = renderDocument('offer_letter', candidate, approval, refNumber);
    const { pdfPath } = await generatePdf({ refNumber, docType: 'offer_letter', renderedContent, placeholders });

      const docRes = await query(
        `INSERT INTO generated_documents (
        candidate_id, approval_id, doc_type, ref_number, rendered_content, pdf_path, sent_to_email, sent_at, status
      ) VALUES ($1, $2, 'offer_letter', $3, $4, $5, $6, NOW(), 'sent') RETURNING *`,
        [candidate.id, approval.id, refNumber, renderedContent, pdfPath, candidate.primary_email]
      );

    const candidateName = buildCandidateFullName(candidate);
      const emailResult = await sendOfferLetterEmail({
        to: candidate.primary_email,
        candidateName,
        designation: approval.designation,
        department: approval.department,
        reportingManager: approval.reporting_manager,
        acceptanceDate: offer_acceptance_date || '',
        refNumber,
        pdfPath,
      });

      await query(`UPDATE candidates SET status = 'offer_sent', updated_at = NOW() WHERE id = $1`, [
        candidate.id,
      ]);

      await query(
          `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('candidate', $1, 'SENT_OFFER_LETTER', 'Inhouse Authority', $2)`,
        [candidate.id, JSON.stringify({ refNumber, emailSent: emailResult.sent })]
      );

      res.status(201).json({
        message: emailResult.sent
        ? `Offer Letter emailed to ${candidate.primary_email}.`
        : `Offer Letter ${refNumber} generated! (${emailResult.message})`,
        documents: [docRes.rows[0]],
        ...emailResult,
    });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Mark User Accepted
router.post('/:id/accept', requireAuthority, async (req, res, next) => {
  try {
    const { id } = req.params;
    const upd = await query(
      `UPDATE candidates SET status = 'accepted', updated_at = NOW() WHERE id = $1 RETURNING * `,
      [id]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    await query(
      `INSERT INTO audit_logs(entity_type, entity_id, action, actor)
  VALUES('candidate', $1, 'MARKED_USER_ACCEPTED', 'Inhouse Authority')`,
      [id]
    );

    res.json({ message: 'Candidate marked as Offer Accepted.', candidate: upd.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Send Joining Letter
router.post('/:id/send-joining', requireAuthority, async (req, res, next) => {
  try {
    const { id } = req.params;
    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candRes.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }
    const candidate = candRes.rows[0];

    const { joining_date, place_of_work, work_address } = req.body;
    if (!joining_date || !place_of_work || !work_address) {
      return res.status(400).json({ error: 'joining_date, place_of_work, and work_address are required.' });
    }

    const appRes = await query(
      'SELECT * FROM employment_approvals WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (appRes.rows.length === 0) {
      return res.status(400).json({
        error: 'Please send the Offer Letter first so designation, department, salary, and director details are on file.',
      });
    }

    const latestApp = appRes.rows[0];
    const updatedAppRes = await query(
      `UPDATE employment_approvals
       SET joining_date = $1, place_of_work = $2, work_address = $3
       WHERE id = $4 RETURNING * `,
      [joining_date, place_of_work.trim(), work_address.trim(), latestApp.id]
    );
    const approval = updatedAppRes.rows[0];

    const joiningRefNumber = generateDocRef('joining_letter');
    const joiningPlaceholders = buildPlaceholders(candidate, approval, joiningRefNumber);
    const joiningRendered = renderDocument('joining_letter', candidate, approval, joiningRefNumber);
    const { pdfPath: joiningPdfPath } = await generatePdf({
      refNumber: joiningRefNumber,
      docType: 'joining_letter',
      renderedContent: joiningRendered,
      placeholders: joiningPlaceholders,
    });

    const joiningDocRes = await query(
        `INSERT INTO generated_documents (
        candidate_id, approval_id, doc_type, ref_number, rendered_content, pdf_path, sent_to_email, sent_at, status
      ) VALUES ($1, $2, 'joining_letter', $3, $4, $5, $6, NOW(), 'sent') RETURNING *`,
        [candidate.id, approval.id, joiningRefNumber, joiningRendered, joiningPdfPath, candidate.primary_email]
      );

    const legalRefNumber = generateDocRef('legal_documents');
    const legalPlaceholders = buildPlaceholders(candidate, approval, legalRefNumber);
    const legalRendered = renderDocument('legal_documents', candidate, approval, legalRefNumber);
    const { pdfPath: legalPdfPath } = await generatePdf({
      refNumber: legalRefNumber,
      docType: 'legal_documents',
      renderedContent: legalRendered,
      placeholders: legalPlaceholders,
    });

    const legalDocRes = await query(
      `INSERT INTO generated_documents (
        candidate_id, approval_id, doc_type, ref_number, rendered_content, pdf_path, sent_to_email, sent_at, status
      ) VALUES ($1, $2, 'legal_documents', $3, $4, $5, $6, NOW(), 'sent') RETURNING *`,
      [candidate.id, approval.id, legalRefNumber, legalRendered, legalPdfPath, candidate.primary_email]
    );

    const candidateName = buildCandidateFullName(candidate);
      const emailResult = await sendJoiningBundleEmail({
        to: candidate.primary_email,
        candidateName,
        designation: approval.designation,
        department: approval.department,
        joiningDate: joining_date,
        placeOfWork: place_of_work,
        workAddress: work_address,
        refNumber: joiningRefNumber,
        pdfPaths: [joiningPdfPath, legalPdfPath],
      });

      await query(`UPDATE candidates SET status = 'joined', updated_at = NOW() WHERE id = $1`, [
        candidate.id,
      ]);

      await query(
          `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('candidate', $1, 'SENT_JOINING_AND_LEGAL_DOCUMENTS', 'Inhouse Authority', $2)`,
        [candidate.id, JSON.stringify({ joiningRefNumber, legalRefNumber, emailSent: emailResult.sent })]
      );

      res.status(201).json({
        message: emailResult.sent
        ? `Joining Letter & Legal Documents emailed to ${candidate.primary_email}.`
        : `Joining Letter & Legal Documents generated! (${emailResult.message})`,
        documents: [joiningDocRes.rows[0], legalDocRes.rows[0]],
        ...emailResult,
    });
  } catch (err) {
    next(err);
  }
});

// Authority Only: List all candidates with latest approval, doc count & access logs
router.get('/', requireAuthority, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*,
  (SELECT row_to_json(a) FROM employment_approvals a WHERE a.candidate_id = c.id ORDER BY a.created_at DESC LIMIT 1) AS latest_approval,
    (SELECT COUNT(*)::int FROM generated_documents d WHERE d.candidate_id = c.id) AS documents_count
       FROM candidates c
       ORDER BY c.created_at DESC`
    );
    res.json({ candidates: result.rows });
  } catch (err) {
    next(err);
  }
});

// Authority Only: Get single candidate with approvals, documents, and link access logs
router.get('/:id', requireAuthority, async (req, res, next) => {
  try {
    const { id } = req.params;
    const candRes = await query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candRes.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    const approvalsRes = await query(
      'SELECT * FROM employment_approvals WHERE candidate_id = $1 ORDER BY created_at DESC',
      [id]
    );
    const docsRes = await query(
      'SELECT * FROM generated_documents WHERE candidate_id = $1 ORDER BY created_at DESC',
      [id]
    );
    const logsRes = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [id]
    );

    res.json({
      candidate: candRes.rows[0],
      approvals: approvalsRes.rows,
      documents: docsRes.rows,
      logs: logsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
