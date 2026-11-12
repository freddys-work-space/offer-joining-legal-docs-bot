# APPLYUS PRIVATE LIMITED — Offer Letter, Joining Letter & Legal Forms Bot

Full-stack onboarding, approval, legal notice, and PDF generation system built for **APPLYUS PRIVATE LIMITED**.

## Project Structure
- `backend/` — Express.js API, Neon PostgreSQL (`pg`), PDF generation (`pdfkit` + `.docx` letterhead support via `docxtemplater`), Email dispatch (`nodemailer`)
- `frontend/` — React + Vite + Tailwind CSS dual-portal UI:
  1. **New Employee Side** — Public candidate onboarding form (personal, family, contact, address, interview date)
  2. **Authority Approval Portal** — Protected by `AUTHORITY_ACCESS_KEY`, select candidates, enter Offer & Joining details, generate & email PDFs
- `offer_letter_content.md` — Offer Letter template
- `joining_letter_content.md` — Joining Letter template
- `legal_notices_content.md` — NDA, Non-Compete/No-Moonlighting, IP Assignment, and Formal Legal Notice templates tailored to APPLYUS PRIVATE LIMITED's international job-seeker services

## Setup Instructions

### 1. Configure `.env`
Copy `.env.example` to `.env` in the project root and add your Neon `DATABASE_URL` and company details:
```bash
cp .env.example .env
```

### 2. Initialize Neon PostgreSQL Tables
```bash
cd backend
npm run db:init
```

### 3. Add Your Word Letterhead (Optional)
Place your `.docx` letterhead at `backend/templates/letterhead.docx` (or upload it from the Authority Portal UI). If LibreOffice (`soffice`) is installed, it converts `.docx` directly to PDF; otherwise, the built-in corporate PDFKit letterhead renders your PDFs immediately.

### 4. Start Backend & Frontend
Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

