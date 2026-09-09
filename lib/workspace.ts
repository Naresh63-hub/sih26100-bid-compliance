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

export function createSampleAssessment(): Assessment {
  return {
    id: 'BG-2026-014',
    name: 'Industrial Pump Supply & Commissioning',
    bidder: 'Vayuna Engineering Pvt. Ltd.',
    procuringEntity: 'South Coast Process Utilities (PSU / MoPNG)',
    status: 'In Review',
    lastAnalyzed: new Date().toISOString(),
    sample: true,
    requirements: demo.requirements,
    documents: demo.documents,
    reviews: {},
    audit: [
      {
        id: 'audit-init',
        time: '2026-09-09T07:00:00.000Z',
        actor: 'System Ingestion',
        action: 'Assessment Initialized',
        detail: 'Tender BG-2026-014 (8 clauses) and 3 bidder evidence documents ingested.'
      }
    ]
  };
}

export function initialWorkspaceStore(): WorkspaceStore {
  const sample = createSampleAssessment();
  return {
    version: 2,
    activeAssessmentId: sample.id,
    assessments: [sample]
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
