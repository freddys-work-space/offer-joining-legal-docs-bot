const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { requireAuthority } = require('../middleware/auth');

// Authority Only: Submit / Update Approval Details for Offer & Joining Letters
router.post('/', requireAuthority, async (req, res, next) => {
  try {
    const {
      candidate_id,
      designation,
      department,
      salary_amount,
      salary_period = 'annum',
      reporting_manager,
      director_name,
      joining_date = null,
      place_of_work = '',
      work_address = '',
      offer_acceptance_date = null,
      approved_by = 'Higher Authority',
    } = req.body;

    if (!candidate_id || !designation || !department || !salary_amount || !reporting_manager || !director_name) {
      return res.status(400).json({
        error: 'candidate_id, designation, department, salary_amount, reporting_manager, and director_name are required.',
      });
    }

    const candCheck = await query('SELECT id FROM candidates WHERE id = $1', [candidate_id]);
    if (candCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const result = await query(
      `INSERT INTO employment_approvals (
        candidate_id, designation, department, salary_amount, salary_period,
        reporting_manager, director_name, joining_date, place_of_work,
        work_address, offer_acceptance_date, approved_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        candidate_id,
        designation.trim(),
        department.trim(),
        Number(salary_amount),
        salary_period,
        reporting_manager.trim(),
        director_name.trim(),
        joining_date || null,
        place_of_work.trim(),
        work_address.trim(),
        offer_acceptance_date || null,
        approved_by.trim(),
      ]
    );

    await query(
      `UPDATE candidates SET status = 'offer_approved', updated_at = NOW() WHERE id = $1`,
      [candidate_id]
    );

    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor, metadata)
       VALUES ('approval', $1, 'APPROVED_EMPLOYMENT', $2, $3)`,
      [result.rows[0].id, approved_by, JSON.stringify({ candidate_id, designation, department })]
    );

    res.status(201).json({
      message: 'Employment approval saved.',
      approval: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

