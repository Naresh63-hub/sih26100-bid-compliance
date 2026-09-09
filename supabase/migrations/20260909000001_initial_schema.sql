-- BIDGUARD AI: Supabase PostgreSQL Database Schema
-- SIH Problem Statement: SIH26100 (Ministry of Petroleum & Natural Gas / GeM Procurement)

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    designation TEXT DEFAULT 'Procurement Officer',
    organization TEXT DEFAULT 'Ministry of Petroleum & Natural Gas',
    role TEXT NOT NULL DEFAULT 'OFFICER' CHECK (role IN ('OFFICER', 'ADMIN', 'AUDITOR')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. TENDERS
CREATE TABLE IF NOT EXISTS public.tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    reference_number TEXT NOT NULL UNIQUE,
    procuring_entity TEXT NOT NULL,
    category TEXT DEFAULT 'Goods & Services',
    submission_deadline TIMESTAMPTZ NOT NULL,
    estimated_value NUMERIC(15, 2),
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'EVALUATING', 'COMPLETED', 'ARCHIVED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. BIDDERS
CREATE TABLE IF NOT EXISTS public.bidders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    legal_name TEXT,
    gstin TEXT,
    pan TEXT,
    udyam_registration TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    incorporation_date DATE,
    bid_submission_date TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tender_id, name)
);

-- 4. ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    bidder_id UUID NOT NULL REFERENCES public.bidders(id) ON DELETE CASCADE,
    evaluated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'EVALUATED', 'REVIEWED', 'FINALIZED')),
    compliance_score NUMERIC(5, 2) DEFAULT 0.00,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    total_requirements INTEGER DEFAULT 0,
    compliant_count INTEGER DEFAULT 0,
    non_compliant_count INTEGER DEFAULT 0,
    partial_count INTEGER DEFAULT 0,
    missing_evidence_count INTEGER DEFAULT 0,
    needs_review_count INTEGER DEFAULT 0,
    final_decision TEXT CHECK (final_decision IN ('QUALIFIED', 'DISQUALIFIED', 'CLARIFICATION_REQUESTED')),
    decision_notes TEXT,
    decision_timestamp TIMESTAMPTZ,
    revision INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tender_id, bidder_id)
);

-- 5. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    bidder_id UUID REFERENCES public.bidders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tender', 'bid')),
    document_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (document_type IN (
        'TENDER_NOTICE', 'GST_CERTIFICATE', 'PAN_CARD', 'COMPANY_PROFILE',
        'AUDITED_FINANCIALS', 'TECHNICAL_PROPOSAL', 'EXPERIENCE_CERTIFICATE',
        'COMPLETION_CERTIFICATE', 'UDYAM_MSME', 'BANK_SOLVENCY', 'OEM_AUTHORIZATION',
        'ISO_CERTIFICATE', 'OTHER'
    )),
    storage_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256 TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    is_scanned BOOLEAN DEFAULT FALSE,
    ocr_applied BOOLEAN DEFAULT FALSE,
    warnings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. DOCUMENT PAGES
CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    raw_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(document_id, page_number)
);

-- 7. DOCUMENT CHUNKS
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES public.document_pages(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    line_number INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. REQUIREMENTS
CREATE TABLE IF NOT EXISTS public.requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    clause_text TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('minimum', 'maximum', 'expiry', 'portal', 'boolean', 'manual')),
    minimum_value NUMERIC(15, 4),
    maximum_value NUMERIC(15, 4),
    unit TEXT DEFAULT '',
    required_date DATE,
    source_page INTEGER NOT NULL DEFAULT 1,
    source_quote TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 10 CHECK (weight BETWEEN 1 AND 100),
    mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    confidence NUMERIC(4, 3) DEFAULT 0.95,
    confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    expected_document TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. COMPLIANCE RESULTS
CREATE TABLE IF NOT EXISTS public.compliance_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Compliant', 'Partial', 'Non-compliant', 'Missing evidence', 'Not applicable', 'Needs review')),
    observed_value TEXT,
    calculation_expression TEXT,
    reason TEXT NOT NULL,
    risk_points INTEGER NOT NULL DEFAULT 0,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.95,
    rule_explanation TEXT,
    raw_findings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(assessment_id, requirement_id)
);

-- 10. EVIDENCE
CREATE TABLE IF NOT EXISTS public.evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_result_id UUID NOT NULL REFERENCES public.compliance_results(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    quote TEXT NOT NULL,
    confidence NUMERIC(4, 3) DEFAULT 0.95,
    extracted_entity JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. RISK FINDINGS & ANOMALIES
CREATE TABLE IF NOT EXISTS public.risk_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    finding_type TEXT NOT NULL CHECK (finding_type IN ('SHORTFALL', 'INCONSISTENCY', 'DISCREPANCY', 'AMBIGUITY', 'EXPIRY')),
    severity TEXT NOT NULL CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
    penalty_points INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 12. MISSING DOCUMENTS
CREATE TABLE IF NOT EXISTS public.missing_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    category TEXT NOT NULL,
    mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    found BOOLEAN NOT NULL DEFAULT FALSE,
    matched_filename TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 13. OFFICER REVIEWS & OVERRIDES
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_result_id UUID NOT NULL REFERENCES public.compliance_results(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL CHECK (new_status IN ('Compliant', 'Partial', 'Non-compliant', 'Missing evidence', 'Not applicable', 'Needs review')),
    justification TEXT NOT NULL CHECK (length(trim(justification)) >= 10),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 14. AUDIT EVENTS
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    description TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 15. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    report_title TEXT NOT NULL,
    pdf_storage_path TEXT,
    report_data JSONB NOT NULL,
    sha256_checksum TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_assessments_tender_id ON public.assessments(tender_id);
CREATE INDEX IF NOT EXISTS idx_assessments_bidder_id ON public.assessments(bidder_id);
CREATE INDEX IF NOT EXISTS idx_documents_tender_id ON public.documents(tender_id);
CREATE INDEX IF NOT EXISTS idx_documents_bidder_id ON public.documents(bidder_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_doc_id ON public.document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_requirements_tender_id ON public.requirements(tender_id);
CREATE INDEX IF NOT EXISTS idx_compliance_results_assessment ON public.compliance_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_evidence_compliance_result ON public.evidence(compliance_result_id);
CREATE INDEX IF NOT EXISTS idx_risk_findings_assessment ON public.risk_findings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_assessment ON public.audit_events(assessment_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bidders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with officer/admin roles to select and operate
CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Officers can access tenders" ON public.tenders FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access bidders" ON public.bidders FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access assessments" ON public.assessments FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access documents" ON public.documents FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access document pages" ON public.document_pages FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access document chunks" ON public.document_chunks FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access requirements" ON public.requirements FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access compliance results" ON public.compliance_results FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access evidence" ON public.evidence FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access risk findings" ON public.risk_findings FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access missing documents" ON public.missing_documents FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access reviews" ON public.reviews FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access audit events" ON public.audit_events FOR ALL TO authenticated USING (true);
CREATE POLICY "Officers can access reports" ON public.reports FOR ALL TO authenticated USING (true);

-- STORAGE BUCKETS SETUP
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('tender-documents', 'tender-documents', false),
    ('bidder-documents', 'bidder-documents', false),
    ('generated-reports', 'generated-reports', false)
ON CONFLICT (id) DO NOTHING;
