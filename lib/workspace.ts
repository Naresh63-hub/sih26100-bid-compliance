import { demo, type Requirement, type EvidenceDocument, type Status } from './compliance';

export type Audit = {
  id: string;
  time: string;
  actor: string;
  action: string;
  detail: string;
};

export type Review = {
  status: Status;
  reason: string;
  actor: string;
  time: string;
};

export type Assessment = {
  id: string;
  name: string;
  bidder: string;
  procuringEntity: string;
  status: 'In Review' | 'Compliant' | 'Disqualified';
  lastAnalyzed: string;
  sample: boolean;
  requirements: Requirement[];
  documents: EvidenceDocument[];
  reviews: Record<string, Review>;
  audit: Audit[];
  decision?: { status: string; reason: string; actor: string; time: string };
};

export type WorkspaceStore = {
  version: 2;
  activeAssessmentId: string;
  assessments: Assessment[];
};

export function createSampleAssessments(): Assessment[] {
  // Case 1: Vayuna Engineering (Financial & Warranty shortfall - Medium Risk)
  const case1: Assessment = {
    id: 'BG-2026-014',
    name: 'Industrial Pump Supply & Commissioning',
    bidder: 'Vayuna Engineering Pvt. Ltd.',
    procuringEntity: 'South Coast Process Utilities (MoPNG / PSU)',
    status: 'In Review',
    lastAnalyzed: new Date().toISOString(),
    sample: true,
    requirements: demo.requirements,
    documents: demo.documents,
    reviews: {},
    audit: [
      {
        id: 'audit-1',
        time: '2026-09-09T07:00:00.000Z',
        actor: 'System Ingestion',
        action: 'Tender & Bid Ingested',
        detail: 'Tender BG-2026-014 (8 clauses) and 3 bidder documents ingested for Vayuna Engineering.'
      }
    ]
  };

  // Case 2: Aarohan Process Systems (High Compliance - Low Risk)
  const case2: Assessment = {
    id: 'BG-2026-015',
    name: 'Heavy Duty Multistage Process Pump Package',
    bidder: 'Aarohan Process Systems Pvt. Ltd.',
    procuringEntity: 'Western Refinery & Petrochemicals Corp (MoPNG)',
    status: 'Compliant',
    lastAnalyzed: new Date().toISOString(),
    sample: true,
    requirements: [
      { id: 'REQ-001', title: 'Relevant industrial experience ≥ 5 years', category: 'Eligibility', key: 'experience', minimum: 5, unit: 'years', kind: 'minimum', source: 'Tender_WRPC_2026.txt', page: 1, weight: 15, mandatory: true },
      { id: 'REQ-002', title: 'Annual average turnover ≥ ₹5 crore', category: 'Financial', key: 'turnover', minimum: 5, unit: 'crore', kind: 'minimum', source: 'Tender_WRPC_2026.txt', page: 1, weight: 20, mandatory: true },
      { id: 'REQ-003', title: 'Minimum local content (Class-I / MII) ≥ 50%', category: 'Local Content', key: 'local content', minimum: 50, unit: '%', kind: 'minimum', source: 'Tender_WRPC_2026.txt', page: 1, weight: 15, mandatory: true },
      { id: 'REQ-004', title: 'Active GST registration verification', category: 'Statutory', key: 'GST', unit: '', kind: 'portal', source: 'Tender_WRPC_2026.txt', page: 1, weight: 10, mandatory: true },
      { id: 'REQ-005', title: 'Permanent Account Number (PAN) record', category: 'Statutory', key: 'PAN', unit: '', kind: 'portal', source: 'Tender_WRPC_2026.txt', page: 1, weight: 10, mandatory: true },
      { id: 'REQ-006', title: 'Udyam / MSME registration certificate', category: 'MSME', key: 'Udyam', unit: '', kind: 'portal', source: 'Tender_WRPC_2026.txt', page: 1, weight: 10, mandatory: false },
      { id: 'REQ-007', title: 'Comprehensive warranty period ≥ 24 months', category: 'Technical', key: 'warranty', minimum: 24, unit: 'months', kind: 'minimum', source: 'Tender_WRPC_2026.txt', page: 1, weight: 10, mandatory: true },
      { id: 'REQ-008', title: 'Past similar completed projects ≥ 3', category: 'Experience', key: 'completed projects', minimum: 3, unit: 'projects', kind: 'minimum', source: 'Tender_WRPC_2026.txt', page: 1, weight: 10, mandatory: true }
    ],
    documents: [
      {
        id: 'tender-aarohan',
        name: 'Tender_WRPC_2026.txt',
        role: 'tender',
        pages: ['WESTERN REFINERY & PETROCHEMICALS CORP\nMinimum experience: 5 years\nMinimum turnover: 5 crore\nMinimum local content: 50%\nGST registration must be verified.\nPAN must be verified.\nUdyam registration must be verified.\nMinimum warranty: 24 months\nMinimum completed projects: 3 projects']
      },
      {
        id: 'aarohan-profile',
        name: 'Aarohan_Company_Profile.txt',
        role: 'bid',
        pages: ['Aarohan Process Systems Pvt. Ltd.\nRelevant experience: 9 years\nCompleted projects: 7 projects\nPAN: AABCA5678C (Company)\nRegistered address: MIDC Industrial Area, Pune']
      },
      {
        id: 'aarohan-financial',
        name: 'Aarohan_Audited_Financials_FY25.txt',
        role: 'bid',
        pages: ['Aarohan Process Systems Pvt. Ltd.\nAudited Financial Statement FY 2024-25\nAnnual turnover: 12.4 crore\nNet worth: ₹4.8 crore (Positive)\nBank solvency certificate attached']
      },
      {
        id: 'aarohan-technical',
        name: 'Aarohan_Technical_Declaration.txt',
        role: 'bid',
        pages: ['Aarohan Process Systems Pvt. Ltd. — Technical Package\nLocal content: 74%\nWarranty: 36 months\nGST: 27AABCA5678C1Z9\nUdyam: UDYAM-MH-01-0092812\nOEM Authorization from Flowline Pump Dynamics']
      }
    ],
    reviews: {
      'REQ-004': {
        status: 'Compliant',
        reason: 'GSTIN 27AABCA5678C1Z9 verified on GST portal; active filing record confirmed.',
        actor: 'Senior Procurement Officer',
        time: '2026-09-09T08:30:00.000Z'
      }
    },
    audit: [
      {
        id: 'audit-2',
        time: '2026-09-09T08:00:00.000Z',
        actor: 'System Ingestion',
        action: 'Assessment Initialized',
        detail: 'Tender and 3 bidder documents ingested for Aarohan Process Systems.'
      }
    ],
    decision: {
      status: 'Qualified by officer',
      reason: 'All financial, technical, and statutory eligibility criteria fully satisfied with robust documentation.',
      actor: 'Chief Procurement Officer',
      time: '2026-09-09T08:45:00.000Z'
    }
  };

  // Case 3: Kaveri Industrial (Missing mandatory docs & Discrepancies - High Risk)
  const case3: Assessment = {
    id: 'BG-2026-016',
    name: 'Pipeline Valve & Actuator Assembly Supply',
    bidder: 'Kaveri Industrial Solutions Pvt. Ltd.',
    procuringEntity: 'Eastern Gas Transmission Authority',
    status: 'In Review',
    lastAnalyzed: new Date().toISOString(),
    sample: true,
    requirements: [
      { id: 'REQ-001', title: 'Relevant industrial experience ≥ 5 years', category: 'Eligibility', key: 'experience', minimum: 5, unit: 'years', kind: 'minimum', source: 'Tender_EGTA_2026.txt', page: 1, weight: 15, mandatory: true },
      { id: 'REQ-002', title: 'Annual average turnover ≥ ₹5 crore', category: 'Financial', key: 'turnover', minimum: 5, unit: 'crore', kind: 'minimum', source: 'Tender_EGTA_2026.txt', page: 1, weight: 20, mandatory: true },
      { id: 'REQ-003', title: 'Minimum local content (Class-I / MII) ≥ 50%', category: 'Local Content', key: 'local content', minimum: 50, unit: '%', kind: 'minimum', source: 'Tender_EGTA_2026.txt', page: 1, weight: 15, mandatory: true },
      { id: 'REQ-004', title: 'Active GST registration verification', category: 'Statutory', key: 'GST', unit: '', kind: 'portal', source: 'Tender_EGTA_2026.txt', page: 1, weight: 10, mandatory: true },
      { id: 'REQ-005', title: 'Permanent Account Number (PAN) record', category: 'Statutory', key: 'PAN', unit: '', kind: 'portal', source: 'Tender_EGTA_2026.txt', page: 1, weight: 10, mandatory: true },
      { id: 'REQ-007', title: 'Comprehensive warranty period ≥ 24 months', category: 'Technical', key: 'warranty', minimum: 24, unit: 'months', kind: 'minimum', source: 'Tender_EGTA_2026.txt', page: 1, weight: 10, mandatory: true }
    ],
    documents: [
      {
        id: 'tender-kaveri',
        name: 'Tender_EGTA_2026.txt',
        role: 'tender',
        pages: ['EASTERN GAS TRANSMISSION AUTHORITY\nMinimum experience: 5 years\nMinimum turnover: 5 crore\nMinimum local content: 50%\nGST registration must be verified.\nPAN must be verified.\nMinimum warranty: 24 months']
      },
      {
        id: 'kaveri-profile',
        name: 'Kaveri_Company_Profile.txt',
        role: 'bid',
        pages: ['Kaveri Industrial Solutions Pvt. Ltd.\nRelevant experience: 10 years\nPAN: AABCK9012D\nRegistered office: Industrial Estate, Visakhapatnam']
      },
      {
        id: 'kaveri-cert',
        name: 'Kaveri_Experience_Certificate.txt',
        role: 'bid',
        pages: ['Project Completion Certificate — Kaveri Industrial Solutions\nRelevant experience: 4 years in valve maintenance\nAnnual turnover: 4.2 crore']
      }
    ],
    reviews: {},
    audit: [
      {
        id: 'audit-3',
        time: '2026-09-09T09:00:00.000Z',
        actor: 'System Ingestion',
        action: 'Assessment Initialized',
        detail: 'Tender and 2 partial bidder documents ingested for Kaveri Industrial Solutions.'
      }
    ]
  };

  return [case1, case2, case3];
}

export function initialWorkspaceStore(): WorkspaceStore {
  const samples = createSampleAssessments();
  return {
    version: 2,
    activeAssessmentId: samples[0].id,
    assessments: samples
  };
}

export function addAuditToAssessment(assessment: Assessment, actor: string, action: string, detail: string): Assessment {
  return {
    ...assessment,
    audit: [
      ...assessment.audit,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        actor,
        action,
        detail
      }
    ]
  };
}

export function invalidateAssessment(assessment: Assessment): Assessment {
  return {
    ...assessment,
    reviews: {},
    decision: undefined
  };
}
