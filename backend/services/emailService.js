const fs = require('fs');
const path = require('path');

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function getFromEmail() {
  return (
    process.env.FROM_EMAIL ||
    process.env.RESEND_FROM ||
    'ApplyUS Team <hiring@applyus.org>'
  );
}

function toTitleCase(str = '') {
  return String(str)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmailHtml(company, title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#0f172a;padding:20px 28px;border-bottom:3px solid #0b57d0;">
                <p style="margin:0;font-size:16px;font-weight:700;letter-spacing:0.4px;color:#ffffff;">${escapeHtml(company)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#cbd5e1;">${escapeHtml(title)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:14px;line-height:1.65;color:#1f2937;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
                <p style="margin:0;">This is an official communication from Talent Acquisition &amp; HR Operations, ${escapeHtml(company)}.</p>
                <p style="margin:4px 0 0;">Please treat this email and its attachments as strictly confidential.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendViaResend({ to, subject, text, html, pdfPaths = [] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      sent: false,
      simulated: true,
      message: 'RESEND_API_KEY is not configured in .env.',
    };
  }

  const attachments = pdfPaths
    .filter((p) => p && fs.existsSync(p))
    .map((p) => ({
      filename: path.basename(p),
      content: fs.readFileSync(p).toString('base64'),
    }));

  const payload = {
    from: getFromEmail(),
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
  };

  if (html) {
    payload.html = html;
  }

  if (attachments.length > 0) {
    payload.attachments = attachments;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend API error (${res.status}): ${data.message || JSON.stringify(data)}`);
  }

  return {
    sent: true,
    simulated: false,
    messageId: data.id,
  };
}

async function sendFormInviteEmail({ to, candidateName, formUrl }) {
  const company = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
  const name = toTitleCase(candidateName);

  const text = `Dear ${name},

Greetings from ${company}!

Thank you for participating in our selection process. Following your recent interview, we are pleased to invite you to complete your pre-onboarding personal information form.

Please access your personal, single-use onboarding link below:
${formUrl}

Important Instructions:
- This link is uniquely assigned to you and is strictly for your personal use. Please do not forward or share it with anyone else.
- Ensure all personal, contact, and address details match your official government identification documents (Aadhaar / PAN / Passport).

Should you have any questions, please reply to this email.

Warm regards,
Talent Acquisition Team
${company}`;

  const html = wrapEmailHtml(
    company,
    'Candidate Pre-Onboarding Verification',
    `<p style="margin:0 0 14px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
     <p style="margin:0 0 14px;">Greetings from <strong>${escapeHtml(company)}</strong>!</p>
     <p style="margin:0 0 14px;">Thank you for participating in our selection process. Following your recent interview, we are pleased to invite you to complete your pre-onboarding personal information form so we may proceed with your formal offer documentation.</p>
     <p style="margin:20px 0;">
       <a href="${escapeHtml(formUrl)}" style="display:inline-block;background-color:#0b57d0;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:11px 22px;border-radius:6px;">Complete Onboarding Form</a>
     </p>
     <p style="margin:0 0 14px;font-size:12px;color:#475569;">If the button above does not work, copy and paste this link into your browser:<br/><span style="word-break:break-all;color:#0b57d0;">${escapeHtml(formUrl)}</span></p>
     <div style="background-color:#f8fafc;border-left:3px solid #0b57d0;padding:12px 14px;margin:16px 0;font-size:12.5px;color:#334155;">
       <strong>Important:</strong> This link is uniquely generated for you and is single-use. Please do not forward or share it with anyone else, and ensure all details match your government ID documents.
     </div>
     <p style="margin:18px 0 0;">Warm regards,<br/><strong>Talent Acquisition Team</strong><br/>${escapeHtml(company)}</p>`
  );

  return sendViaResend({
    to,
    subject: `Action Required: Pre-Onboarding Form – ${company}`,
    text,
    html,
  });
}

    async function sendOfferLetterEmail({
      to,
      candidateName,
      designation,
      department,
      reportingManager,
      acceptanceDate,
      refNumber,
      pdfPath,
    }) {
      const company = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
      const name = toTitleCase(candidateName);

      const text = `Dear ${ name },

    Greetings from ${ company }!

Congratulations on your selection! Following our discussions and the review of your profile, we are delighted to extend to you an Offer of Employment with ${ company } for the position of ${ designation } in the ${ department } department.

Offer Summary:
  - Reference Number: ${ refNumber }
  - Position         : ${ designation }
  - Department       : ${ department }
  - Reporting Manager: ${ reportingManager }${ acceptanceDate ? `\n- Acceptance Due By: ${acceptanceDate}` : '' }

Attached Document:
  - Official Offer of Employment Letter(PDF)

Next Steps:
  - Please review all terms, compensation details, and policies mentioned in the letter carefully.
- Sign the Offer Acceptance section, and reply to this email confirming your acceptance${ acceptanceDate ? ` on or before ${acceptanceDate}` : ' at your earliest convenience' }.

We are excited about the prospect of welcoming you to ${ company } and look forward to a mutually rewarding association.

Warm regards,
    Human Resources Team
${ company } `;

  const html = wrapEmailHtml(
    company,
    'Offer of Employment',
    `<p style="margin:0 0 14px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
     <p style="margin:0 0 14px;">Greetings from <strong>${escapeHtml(company)}</strong>!</p>
     <p style="margin:0 0 16px;">Congratulations on your selection! Following our discussions and the review of your profile, we are delighted to extend to you an <strong>Offer of Employment</strong> for the position of <strong>${escapeHtml(designation)}</strong> in the <strong>${escapeHtml(department)}</strong> department.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;font-size:13px;">
       <tr style="background-color:#f8fafc;">
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;color:#475569;width:38%;">Reference Number</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${escapeHtml(refNumber)}</td>
       </tr>
       <tr>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">Designation</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${escapeHtml(designation)}</td>
       </tr>
       <tr style="background-color:#f8fafc;">
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">Department</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${escapeHtml(department)}</td>
       </tr>
       <tr>
         <td style="padding:9px 14px;${acceptanceDate ? 'border-bottom:1px solid #e2e8f0;' : ''}color:#475569;">Reporting Manager</td>
         <td style="padding:9px 14px;${acceptanceDate ? 'border-bottom:1px solid #e2e8f0;' : ''}font-weight:600;color:#0f172a;">${escapeHtml(reportingManager)}</td>
       </tr>
       ${acceptanceDate
      ? `<tr style="background-color:#f8fafc;">
                <td style="padding:9px 14px;color:#475569;">Acceptance Deadline</td>
                <td style="padding:9px 14px;font-weight:600;color:#0b57d0;">${escapeHtml(acceptanceDate)}</td>
              </tr>`
      : ''
    }
     </table>
     <p style="margin:16px 0 8px;"><strong>Attached Document:</strong></p>
     <ul style="margin:0 0 16px;padding-left:20px;color:#334155;">
       <li>Official Offer of Employment Letter (PDF)</li>
     </ul>
     <p style="margin:0 0 16px;">Please review all terms carefully, sign the Offer Acceptance section, and reply to this email with your confirmation${acceptanceDate ? ` on or before <strong>${escapeHtml(acceptanceDate)}</strong>` : ' at your earliest convenience'}.</p>
     <p style="margin:0 0 18px;">We look forward to welcoming you to <strong>${escapeHtml(company)}</strong> and wish you a successful career with us.</p>
     <p style="margin:0;">Warm regards,<br/><strong>Human Resources Team</strong><br/>${escapeHtml(company)}</p>`
  );

  return sendViaResend({
    to,
    subject: `Offer of Employment – ${designation} | ${company} (${refNumber})`,
    text,
    html,
    pdfPaths: pdfPath ? [pdfPath] : [],
  });
}

async function sendJoiningBundleEmail({
  to,
  candidateName,
  designation,
  department,
  joiningDate,
  placeOfWork,
  workAddress,
  refNumber,
  pdfPaths = [],
}) {
  const company = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
  const name = toTitleCase(candidateName);

  const text = `Dear ${name},

Warm greetings from ${company}!

We are pleased to welcome you aboard as ${designation} in the ${department} department. Please find attached your official Joining Letter and Legal Agreements.

Joining Details:
- Reference Number: ${refNumber}
- Date of Joining : ${joiningDate}
- Place of Work   : ${placeOfWork}
- Office Address  : ${workAddress}

Attached Documents (PDF):
1. Official Joining Letter & Confirmation of Employment
2. Comprehensive Legal Documents & Agreements (NDA & Data Protection, No Moonlighting & Non-Compete, Intellectual Property Assignment, Code of Conduct)

Important Day-1 Instructions:
- Please report at 9:30 AM on your Date of Joining to complete induction and onboarding formalities.
- Please carry photocopies of your Aadhaar, PAN, educational certificates, relieving/experience letters from previous employers (if applicable), passport-size photographs, bank account details, and signed copies of the attached Legal Agreements.

We look forward to a successful and rewarding journey with ${company}.

Warm regards,
Human Resources & Legal Team
${company}`;

  const html = wrapEmailHtml(
    company,
    'Joining Letter & Legal Agreements',
    `<p style="margin:0 0 14px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
     <p style="margin:0 0 14px;">Warm greetings from <strong>${escapeHtml(company)}</strong>!</p>
     <p style="margin:0 0 16px;">We are delighted to welcome you aboard as <strong>${escapeHtml(designation)}</strong> in the <strong>${escapeHtml(department)}</strong> department. Please find attached your official <strong>Joining Letter</strong> along with the <strong>Company Legal Agreements</strong>.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;font-size:13px;">
       <tr style="background-color:#f8fafc;">
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;color:#475569;width:38%;">Reference Number</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(refNumber)}</td>
       </tr>
       <tr>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">Date of Joining</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0b57d0;">${escapeHtml(joiningDate)}</td>
       </tr>
       <tr style="background-color:#f8fafc;">
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">Place of Work</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(placeOfWork)}</td>
       </tr>
       <tr>
         <td style="padding:9px 14px;color:#475569;">Office Address</td>
         <td style="padding:9px 14px;color:#0f172a;">${escapeHtml(workAddress)}</td>
       </tr>
     </table>
     <p style="margin:16px 0 8px;"><strong>Attached Documents (2 PDFs):</strong></p>
     <ol style="margin:0 0 16px;padding-left:20px;color:#334155;">
       <li>Official Joining Letter &amp; Confirmation of Employment</li>
       <li>Company Legal Documents &amp; Agreements (NDA, Non-Compete, IP Assignment &amp; Code of Conduct)</li>
     </ol>
     <p style="margin:0 0 16px;">Please report at <strong>9:30 AM</strong> on your Date of Joining and carry photocopies of your Aadhaar, PAN, educational certificates, previous relieving letters (if any), passport-size photographs, bank account details, and signed copies of the attached Legal Agreements.</p>
     <p style="margin:0;">Warm regards,<br/><strong>Human Resources &amp; Legal Team</strong><br/>${escapeHtml(company)}</p>`
  );

  return sendViaResend({
    to,
    subject: `Welcome Aboard: Joining Letter & Legal Documents – ${company} (${refNumber})`,
    text,
    html,
    pdfPaths,
  });
}

async function sendBundleEmail({ to, subject, text, html, pdfPaths = [] }) {
  return sendViaResend({ to, subject, text, html, pdfPaths });
}

async function sendDocumentEmail({ to, candidateName, docType, refNumber, pdfPath }) {
  const company = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
  const name = toTitleCase(candidateName);
  const subjectMap = {
    offer_letter: `Offer of Employment – ${company} (${refNumber})`,
    joining_letter: `Joining Letter – ${company} (${refNumber})`,
    legal_documents: `Legal Documents & Agreements – ${company} (${refNumber})`,
    legal_notices: `Legal Agreements & Undertakings – ${company} (${refNumber})`,
    legal_nda: `Non-Disclosure Agreement – ${company} (${refNumber})`,
    legal_non_compete: `Non-Compete & Non-Solicitation Agreement – ${company} (${refNumber})`,
    legal_ip_assignment: `Intellectual Property Assignment – ${company} (${refNumber})`,
    legal_breach_notice: `LEGAL NOTICE – ${company} (${refNumber})`,
  };

  return sendViaResend({
    to,
    subject: subjectMap[docType] || `Official Document (${refNumber}) – ${company}`,
    text: `Dear ${name},\n\nPlease find attached your official document (${refNumber}) from ${company}.\n\nWarm regards,\nHuman Resources & Legal Team\n${company}`,
    pdfPaths: pdfPath ? [pdfPath] : [],
  });
}

module.exports = {
  sendDocumentEmail,
  sendFormInviteEmail,
  sendOfferLetterEmail,
  sendJoiningBundleEmail,
  sendBundleEmail,
  isSmtpConfigured: isResendConfigured,
  isResendConfigured,
};
