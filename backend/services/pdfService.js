const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const PDFDocument = require('pdfkit');
const PizZip = require('pizzip');

const GENERATED_DIR = path.resolve(__dirname, '../generated_pdfs');
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const ROOT_DIR = path.resolve(__dirname, '../..');
const CONVERT_SCRIPT_PATH = path.resolve(__dirname, '../scripts/convert_docx.ps1');

if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

function getLetterheadPath(docType) {
  if (docType === 'offer_letter') {
    const list = [
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_offer_letter.docx'),
      path.join(TEMPLATES_DIR, 'APPLYUS_LETTERHEAD_offer_letter.docx'),
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_Final.docx'),
    ];
    for (const p of list) if (fs.existsSync(p)) return p;
  }

  if (docType === 'joining_letter') {
    const list = [
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_joining_letter.docx'),
      path.join(TEMPLATES_DIR, 'APPLYUS_LETTERHEAD_joining_letter.docx'),
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_Final.docx'),
    ];
    for (const p of list) if (fs.existsSync(p)) return p;
  }

  if (docType === 'legal_documents' || docType.startsWith('legal_')) {
    const list = [
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_legal_documents.docx'),
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_legal_notices.docx'),
      path.join(TEMPLATES_DIR, 'APPLYUS_LETTERHEAD_legal_documents.docx'),
      path.join(TEMPLATES_DIR, 'APPLYUS_LETTERHEAD_legal_notices.docx'),
      path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_Final.docx'),
    ];
    for (const p of list) if (fs.existsSync(p)) return p;
  }

  const fallback = path.join(ROOT_DIR, 'APPLYUS_LETTERHEAD_Final.docx');
  return fs.existsSync(fallback) ? fallback : null;
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replacePlaceholdersInXml(xml, placeholders = {}) {
  // 1. Remove Word's spellcheck / grammar error tags that split tokens
  let cleaned = xml.replace(/<w:proofErr[^>]*\/>/g, '');

  // 2. Direct replacements for unsplit tokens
  for (const [k, v] of Object.entries(placeholders)) {
    if (cleaned.includes(k)) {
      cleaned = cleaned.split(k).join(escapeXml(v ?? ''));
    }
  }

  // 3. Paragraph-level merger for tokens that Word split across multiple <w:t> runs
  cleaned = cleaned.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    const plain = para.replace(/<[^>]+>/g, '');
    if (!/\{[^{}]+\}|\[[^\[\]]+\]/.test(plain)) return para;

    const tTexts = [];
    const tRegex = /<w:t(\b[^>]*)>([\s\S]*?)<\/w:t>/g;
    let match;
    while ((match = tRegex.exec(para)) !== null) {
      tTexts.push({ attr: match[1], text: match[2] });
    }

    const combined = tTexts.map((t) => t.text).join('');
    let replacedCombined = combined;
    for (const [k, v] of Object.entries(placeholders)) {
      replacedCombined = replacedCombined.split(k).join(v ?? '');
    }
    if (placeholders['{Salary Amount}']) {
      replacedCombined = replacedCombined.replace(
        /\{\s*Salary Amount\s*\}/g,
        placeholders['{Salary Amount}']
      );
    }

    if (replacedCombined !== combined) {
      let count = 0;
      return para.replace(/<w:t(\b[^>]*)>([\s\S]*?)<\/w:t>/g, (m, attr) => {
        count++;
        if (count === 1) return `<w:t${attr}>${escapeXml(replacedCombined)}</w:t>`;
        return `<w:t${attr}></w:t>`;
      });
    }

    return para;
  });

  return cleaned;
}

function buildBodyParagraphsXml(renderedText) {
  const companyName = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
  const companyAddress = process.env.COMPANY_ADDRESS || 'Hyderabad, Telangana, India';
  const lines = renderedText.split(/\r?\n/);
  const paras = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (i <= 2 && (line.trim() === companyName || line.trim() === companyAddress)) {
      continue;
    }

    if (!line.trim()) {
      paras.push('<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>');
      continue;
    }

    const isHeading =
      /^\d+\.\s+[A-Z]/.test(line.trim()) ||
      /^(Subject:|ACCEPTANCE|EMPLOYEE JOINING ACKNOWLEDGEMENT|STATUTORY LEGAL NOTICE|IN WITNESS WHEREOF|WITHOUT PREJUDICE)/i.test(
        line.trim()
      );

    const rPr = isHeading
      ? '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="22"/></w:rPr>'
      : '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr>';

    const pPr = isHeading
      ? '<w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>'
      : '<w:pPr><w:spacing w:after="80" w:line="260" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>';

    paras.push(
      `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    );
  }

  return paras.join('');
}

function convertDocxToPdfWithWord(docxPath, pdfPath) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        CONVERT_SCRIPT_PATH,
        path.resolve(docxPath),
        path.resolve(pdfPath),
      ],
      { timeout: 45000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || stdout || err.message));
        if (!fs.existsSync(pdfPath)) return reject(new Error('Word did not create PDF file.'));
        resolve(pdfPath);
      }
    );
  });
}

function convertDocxToPdfWithLibreOffice(docxPath, pdfPath) {
  return new Promise((resolve, reject) => {
    execFile(
      'soffice',
      ['--headless', '--convert-to', 'pdf', '--outdir', path.dirname(pdfPath), docxPath],
      { timeout: 30000 },
      (err) => {
        if (err) return reject(err);
        if (fs.existsSync(pdfPath)) return resolve(pdfPath);
        reject(new Error('LibreOffice did not create PDF file.'));
      }
    );
  });
}

async function convertDocxToPdfWithConvertApi(docxPath, pdfPath) {
  const secret = (process.env.CONVERTAPI_SECRET || '').trim();
  if (!secret) throw new Error('CONVERTAPI_SECRET is not configured.');

  const fileBuffer = fs.readFileSync(docxPath);
  const base64Data = fileBuffer.toString('base64');
  const fileName = path.basename(docxPath);

  const payload = {
    Parameters: [
      {
        Name: 'File',
        FileValue: {
          Name: fileName,
          Data: base64Data,
        },
      },
      {
        Name: 'StoreFile',
        Value: false,
      },
    ],
  };

  const response = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`ConvertAPI error (${response.status}): ${data.Message || JSON.stringify(data)}`);
  }

  if (!data.Files || !data.Files[0] || !data.Files[0].FileData) {
    throw new Error('ConvertAPI did not return file data.');
  }

  const pdfBuffer = Buffer.from(data.Files[0].FileData, 'base64');
  fs.writeFileSync(pdfPath, pdfBuffer);
  return pdfPath;
}

async function generateFromWordLetterhead({
  letterheadPath,
  renderedContent,
  placeholders,
  outPdfPath,
}) {
  const zip = new PizZip(fs.readFileSync(letterheadPath, 'binary'));
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('Invalid .docx letterhead: missing word/document.xml');

  let docXml = docXmlFile.asText();

  // If the .docx already contains template text with placeholders, replace placeholders directly
  if (placeholders && Object.keys(placeholders).length > 0) {
    docXml = replacePlaceholdersInXml(docXml, placeholders);
  } else if (renderedContent) {
    // Preserve header/footer sectPr and inject rendered text
    const bodyMatch = docXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
    if (!bodyMatch) throw new Error('Invalid .docx: missing <w:body>');
    const innerBody = bodyMatch[1];
    const sectPrMatch = innerBody.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const sectPr = sectPrMatch ? sectPrMatch[0] : '';
    const newBodyXml = buildBodyParagraphsXml(renderedContent) + sectPr;
    docXml = docXml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${newBodyXml}</w:body>`);
  }

  zip.file('word/document.xml', docXml);
  const tempDocx = outPdfPath.replace(/\.pdf$/i, '.docx');
  fs.writeFileSync(tempDocx, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));

  if (process.platform === 'win32') {
    try {
      await convertDocxToPdfWithWord(tempDocx, outPdfPath);
      return { pdfPath: outPdfPath, engine: 'word-com-letterhead' };
    } catch (wordErr) {
      console.warn('[PDF] Word COM conversion failed, trying ConvertAPI / LibreOffice:', wordErr.message);
    }
  }

  // Cloud / Linux (Render): Convert with genuine Microsoft Word cloud engine via ConvertAPI
  if (process.env.CONVERTAPI_SECRET) {
    try {
      await convertDocxToPdfWithConvertApi(tempDocx, outPdfPath);
      return { pdfPath: outPdfPath, engine: 'convertapi-word-letterhead' };
    } catch (apiErr) {
      console.warn('[PDF] ConvertAPI failed, falling back to LibreOffice:', apiErr.message);
    }
  }

  try {
    await convertDocxToPdfWithLibreOffice(tempDocx, outPdfPath);
    return { pdfPath: outPdfPath, engine: 'libreoffice-letterhead' };
  } catch (loErr) {
    console.warn('[PDF] LibreOffice conversion failed, falling back to PDFKit:', loErr.message);
    throw loErr;
  }
}

function generatePdfWithPdfKit(renderedText, outPdfPath, docTitle) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 95, bottom: 70, left: 55, right: 55 },
      bufferPages: true,
    });

    const stream = fs.createWriteStream(outPdfPath);
    doc.pipe(stream);

    const companyName = process.env.COMPANY_NAME || 'APPLYUS PRIVATE LIMITED';
    const companyAddress = process.env.COMPANY_ADDRESS || 'Hyderabad, Telangana, India';
    const companyEmail = process.env.COMPANY_EMAIL || 'hr@applyus.in';
    const companyPhone = process.env.COMPANY_PHONE || '';
    const companyCin = process.env.COMPANY_CIN || '';

    const drawHeaderFooter = () => {
      doc.save();
      doc.rect(0, 0, doc.page.width, 72).fill('#0f172a');
      doc.rect(0, 72, doc.page.width, 4).fill('#2563eb');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(companyName, 55, 18);
      doc
        .fillColor('#cbd5e1')
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          `${companyAddress}${companyEmail ? '  |  ' + companyEmail : ''}${companyPhone ? '  |  ' + companyPhone : ''} `,
          55,
          40
        );
      if (docTitle) {
        doc.fillColor('#93c5fd').font('Helvetica-Bold').fontSize(8.5).text(docTitle.toUpperCase(), 55, 53);
      }
      doc.restore();
    };

    drawHeaderFooter();
    doc.on('pageAdded', drawHeaderFooter);

    const lines = (renderedText || '').split(/\r?\n/);
    doc.fillColor('#1e293b').font('Helvetica').fontSize(10.5);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      if (i <= 2 && (line.trim() === companyName || line.trim() === companyAddress)) continue;
      if (!line.trim()) {
        doc.moveDown(0.5);
        continue;
      }
      const isSectionHeading =
        /^\d+\.\s+[A-Z]/.test(line.trim()) ||
        /^(Subject:|ACCEPTANCE|EMPLOYEE JOINING ACKNOWLEDGEMENT|STATUTORY LEGAL NOTICE)/i.test(line.trim());

      if (isSectionHeading) {
        doc.moveDown(0.25);
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text(line, { align: 'left', lineGap: 2 });
        doc.font('Helvetica').fontSize(10.2).fillColor('#1e293b');
      } else {
        doc.font('Helvetica').fontSize(10.2).fillColor('#1e293b').text(line, { align: 'justify', lineGap: 2.5 });
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.moveTo(55, doc.page.height - 50).lineTo(doc.page.width - 55, doc.page.height - 50).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
      doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`${companyName}${companyCin ? '  |  CIN: ' + companyCin : ''}  | Confidential`, 55, doc.page.height - 40);
      doc.text(`Page ${i + 1} of ${range.count} `, 55, doc.page.height - 40, { align: 'right', width: doc.page.width - 110 });
      doc.restore();
    }

    doc.end();
    stream.on('finish', () => resolve(outPdfPath));
    stream.on('error', reject);
  });
}

async function generatePdf({ refNumber, docType, renderedContent, placeholders = null }) {
  const safeFile = `${refNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const outPdfPath = path.join(GENERATED_DIR, safeFile);

  const titleMap = {
    offer_letter: 'Offer of Employment',
    joining_letter: 'Joining Letter',
    legal_documents: 'Legal Agreements & Undertakings',
    legal_notices: 'Legal Agreements & Undertakings',
    legal_nda: 'Non-Disclosure & Data Protection Agreement',
    legal_non_compete: 'Non-Compete & Non-Solicitation Agreement',
    legal_ip_assignment: 'Intellectual Property Assignment Agreement',
    legal_breach_notice: 'Statutory Legal Notice',
  };

  const letterheadPath = getLetterheadPath(docType);
  if (letterheadPath) {
    try {
      return await generateFromWordLetterhead({
        letterheadPath,
        docType,
        renderedContent,
        placeholders,
        outPdfPath,
      });
    } catch (err) {
      console.warn(`[PDF] Word letterhead conversion for ${docType} failed, falling back to PDFKit: `, err.message);
    }
  }

  await generatePdfWithPdfKit(renderedContent, outPdfPath, titleMap[docType] || 'Official Document');
  return { pdfPath: outPdfPath, engine: 'pdfkit-letterhead' };
}

module.exports = {
  generatePdf,
  getLetterheadPath,
  TEMPLATES_DIR,
  GENERATED_DIR,
};
