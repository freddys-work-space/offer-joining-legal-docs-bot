-- APPLYUS PRIVATE LIMITED - Offer Letter, Joining Letter & Legal Forms Bot
-- Neon PostgreSQL Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Candidates (Created by Admin/Inhouse, Completed by New Employee via ?uid=<id>)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(32) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  father_name VARCHAR(150) DEFAULT '',
  mother_name VARCHAR(150) DEFAULT '',
  primary_email VARCHAR(200) NOT NULL,
  secondary_email VARCHAR(200) DEFAULT '',
  country_code VARCHAR(10) NOT NULL DEFAULT '+91',
  primary_phone VARCHAR(30) DEFAULT '',
  secondary_phone VARCHAR(30) DEFAULT '',
  house_no VARCHAR(100) DEFAULT '',
  street VARCHAR(150) DEFAULT '',
  village VARCHAR(150) DEFAULT '',
  town VARCHAR(150) DEFAULT '',
  city VARCHAR(120) DEFAULT '',
  state VARCHAR(120) DEFAULT '',
  pincode VARCHAR(20) DEFAULT '',
  landmark VARCHAR(200) DEFAULT '',
  full_address TEXT DEFAULT '',
  date_of_birth DATE,
  interview_date DATE,
  invited_by VARCHAR(150) DEFAULT 'Inhouse Admin',
  invite_sent_at TIMESTAMPTZ,
  form_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  form_submitted_at TIMESTAMPTZ,
  form_access_count INT NOT NULL DEFAULT 0,
  last_accessed_ip VARCHAR(100) DEFAULT '',
  last_accessed_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(primary_email);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);

-- 2. Employment Approvals (Inhouse / Higher Authority Form)
CREATE TABLE IF NOT EXISTS employment_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  designation VARCHAR(150) NOT NULL,
  department VARCHAR(150) NOT NULL,
  salary_amount NUMERIC(12, 2) NOT NULL,
  salary_period VARCHAR(20) NOT NULL DEFAULT 'annum',
  reporting_manager VARCHAR(150) NOT NULL,
  director_name VARCHAR(150) NOT NULL,
  joining_date DATE,
  place_of_work VARCHAR(150) DEFAULT '',
  work_address TEXT DEFAULT '',
  offer_acceptance_date DATE,
  approved_by VARCHAR(150) DEFAULT 'Higher Authority',
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_candidate_id ON employment_approvals(candidate_id);

-- 3. Generated Documents (Offer Letter, Joining Letter, Legal Notices & Agreements)
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  approval_id UUID REFERENCES employment_approvals(id) ON DELETE SET NULL,
  doc_type VARCHAR(50) NOT NULL,
  ref_number VARCHAR(64) UNIQUE NOT NULL,
  rendered_content TEXT NOT NULL,
  pdf_path VARCHAR(500) DEFAULT '',
  sent_to_email VARCHAR(200) DEFAULT '',
  sent_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_candidate_id ON generated_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON generated_documents(doc_type);

-- 4. Audit Logs (including tracked form link accesses)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(150) DEFAULT 'system',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
