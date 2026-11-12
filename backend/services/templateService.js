const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ROOT_DIR = path.resolve(__dirname, '../..');

function extractTextFromDocx(docxPath) {
  if (!fs.existsSync(docxPath)) return null;
  try {
    const zip = new PizZip(fs.readFileSync(docxPath, 'binary'));
    const docXml = zip.file('word/document.xml')?.asText();
    if (!docXml) return null;
    return docXml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  } catch {
    return null;
  }
}

function getTemplateRawText(docType) {
  const fileMap = {
    offer_letter: {
      docx: path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_offer_letter.docx'),
      md: path.join(ROOT_DIR, 'offer_letter_content.md'),
    },
    joining_letter: {
      docx: path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_joining_letter.docx'),
      md: path.join(ROOT_DIR, 'joining_letter_content.md'),
    },
    legal: {
      docx: fs.existsSync(path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_legal_documents.docx'))
        ? path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_legal_documents.docx')
        : path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_legal_notices.docx'),
      md: path.join(ROOT_DIR, 'legal_notices_content.md'),
    },
  };

  const target =
    docType === 'offer_letter'
      ? fileMap.offer_letter
      : docType === 'joining_letter'
      ? fileMap.joining_letter
      : fileMap.legal;

  // 1. Try reading directly from the .docx file
  const docxText = extractTextFromDocx(target.docx);
  if (docxText) return docxText;

  // 2. Fallback to .md file if present
  if (fs.existsSync(target.md)) {
    return fs.readFileSync(target.md, 'utf8');
  }

  return '';
}

function formatDate(dateVal) {
  if (!dateVal) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildCandidateFullName(c) {
  return [c.first_name, c.middle_name, c.last_name]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function buildPlaceholders(candidate, approval, refNumber) {
  const companyName = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
  const companyAddress = process.env.COMPANY_ADDRESS || 'Hyderabad, Telangana, India';
  const candidateName = buildCandidateFullName(candidate);
  const candidateAddress = candidate.full_address || [
    candidate.house_no,
    candidate.street,
    candidate.village,
    candidate.town,
    candidate.city,
    candidate.state,
    candidate.pincode,
  ].filter(Boolean).join(', ');

  const salaryFormatted = approval?.salary_amount
    ? Number(approval.salary_amount).toLocaleString('en-IN')
    : '0';

  const acceptanceDate = approval?.offer_acceptance_date
    ? formatDate(approval.offer_acceptance_date)
    : formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  return {
    '{Company Name}': companyName,
    '{Company Address}': companyAddress,
    '[Company Address]': companyAddress,
    '{Date}': formatDate(new Date()),
    '{Reference Number}': refNumber,
    '{Candidate Name}': candidateName,
    '{Candidate Address}': candidateAddress,
    '{Candidate Email}': candidate.primary_email || '',
    '{Candidate Phone}': `${candidate.country_code || '+91'} ${candidate.primary_phone || ''}`.trim(),
    '{Father Name}': candidate.father_name || '',
    '{Mother Name}': candidate.mother_name || '',
    '{Date of Birth}': candidate.date_of_birth ? formatDate(candidate.date_of_birth) : '',
    '{Designation}': approval?.designation || '',
    '{Department}': approval?.department || '',
    '{Reporting Manager}': approval?.reporting_manager || '',
    '{Director Name}': approval?.director_name || '',
    '[Director’s Name]': approval?.director_name || '',
    "[Director's Name]": approval?.director_name || '',
    '{Salary Amount}': salaryFormatted,
    '{Salary Period}': approval?.salary_period || 'annum',
    '{Date of Joining}': approval?.joining_date ? formatDate(approval.joining_date) : 'To be confirmed',
    '{Place of Work}': approval?.place_of_work || 'Hyderabad Office',
    '{Work Address}': approval?.work_address || companyAddress,
    '{Offer Acceptance Date}': acceptanceDate,
  };
}

function applyPlaceholders(templateText, map) {
  let result = templateText;
  for (const [token, value] of Object.entries(map)) {
    result = result.split(token).join(value ?? '');
  }
  return result;
}

function extractLegalSection(markdownText, sectionHeadingPrefix) {
  const sections = markdownText.split(/\n---\n/);
  const match = sections.find((s) => s.includes(sectionHeadingPrefix));
  if (!match) return markdownText;
  return match
    .replace(/^#.*$/gm, '')
    .trim();
}

function renderDocument(docType, candidate, approval, refNumber) {
  const placeholders = buildPlaceholders(candidate, approval, refNumber);

  if (docType === 'offer_letter') {
    const raw = getTemplateRawText('offer_letter');
    return applyPlaceholders(raw, placeholders);
  }

  if (docType === 'joining_letter') {
    const raw = getTemplateRawText('joining_letter');
    return applyPlaceholders(raw, placeholders);
  }

  const legalRaw = getTemplateRawText('legal');
  if (docType === 'legal_documents' || docType === 'legal_notices') {
    return applyPlaceholders(legalRaw, placeholders);
  }

  const sectionMap = {
    legal_nda: '1. NON-DISCLOSURE',
    legal_non_compete: '2. NON-COMPETE',
    legal_ip_assignment: '3. INTELLECTUAL PROPERTY',
    legal_breach_notice: '4. FORMAL LEGAL NOTICE',
  };

  const prefix = sectionMap[docType];
  if (!prefix) {
    throw new Error(`Unsupported document type: ${docType}`);
  }
  const sectionText = extractLegalSection(legalRaw, prefix);
  return applyPlaceholders(sectionText, placeholders);
}

module.exports = {
  renderDocument,
  buildPlaceholders,
  buildCandidateFullName,
  formatDate,
};

