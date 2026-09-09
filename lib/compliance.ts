export type Status = 'Compliant' | 'Non-compliant' | 'Needs review';

export type Requirement = {
  id: string;
  title: string;
  category: string;
  key: string;
  minimum?: number;
  unit: string;
  kind: 'minimum' | 'portal' | 'manual';
  source: string;
  page: number;
  weight: number;
  mandatory?: boolean;
};

export type EvidenceDocument = {
  id: string;
  name: string;
  pages: string[];
  role: 'tender' | 'bid';
  hash?: string;
};

export type Evidence = {
  document: string;
  page: number;
  quote: string;
};

export type Finding = {
  requirement: Requirement;
  status: Status;
  reason: string;
  values: number[];
  evidence: Evidence[];
  risk: number;
  ruleExplanation?: string;
  calculation?: string;
};

export type Anomaly = {
  id: string;
  type: 'INCONSISTENCY' | 'EXPIRY' | 'SHORTFALL' | 'DISCREPANCY';
  title: string;
  description: string;
  evidence: Evidence[];
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type RiskFactor = {
  name: string;
  points: number;
  category: 'Compliance' | 'Evidence' | 'Financial' | 'Document' | 'Anomaly';
  description: string;
};

export type DocumentReadinessItem = {
  id: string;
  name: string;
  category: string;
  mandatory: boolean;
  found: boolean;
  matchedDocument?: string;
};

export type AssessmentSummary = {
  total: number;
  pass: number;
  fail: number;
  review: number;
  compliancePercentage: number;
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskFactors: RiskFactor[];
  expectedDocuments: DocumentReadinessItem[];
  readinessCount: { found: number; total: number; percentage: number };
  anomalies: Anomaly[];
};

export const EXPECTED_DOCUMENTS_LIST: { id: string; name: string; category: string; mandatory: boolean; matchPatterns: RegExp[] }[] = [
  { id: 'doc-gst', name: 'GST Certificate', category: 'Statutory', mandatory: true, matchPatterns: [/gst/i, /goods and services tax/i] },
  { id: 'doc-pan', name: 'PAN Card / Record', category: 'Statutory', mandatory: true, matchPatterns: [/pan/i, /permanent account number/i] },
  { id: 'doc-profile', name: 'Company Profile & Registration', category: 'Eligibility', mandatory: true, matchPatterns: [/profile/i, /incorporation/i, /company/i] },
  { id: 'doc-financial', name: 'Audited Financial Statement', category: 'Financial', mandatory: true, matchPatterns: [/financial/i, /turnover/i, /balance sheet/i, /annual report/i] },
  { id: 'doc-technical', name: 'Technical Proposal / Declaration', category: 'Technical', mandatory: true, matchPatterns: [/technical/i, /declaration/i, /specification/i] },
  { id: 'doc-exp', name: 'Experience & Completion Certificates', category: 'Experience', mandatory: true, matchPatterns: [/experience/i, /completion/i, /work order/i] },
  { id: 'doc-udyam', name: 'Udyam / MSME Certificate', category: 'MSME Preference', mandatory: false, matchPatterns: [/udyam/i, /msme/i, /udyogaadhar/i] },
  { id: 'doc-solvency', name: 'Bank Solvency Certificate', category: 'Financial', mandatory: false, matchPatterns: [/solvency/i, /bank solvency/i, /banker/i] }
];

export const demo: { requirements: Requirement[]; documents: EvidenceDocument[] } = {
  requirements: [
    { id: 'REQ-001', title: 'Relevant experience ≥ 5 years', category: 'Eligibility', key: 'experience', minimum: 5, unit: 'years', kind: 'minimum', source: 'Tender requirements.txt', page: 1, weight: 15, mandatory: true },
    { id: 'REQ-002', title: 'Annual turnover ≥ ₹5 crore', category: 'Financial', key: 'turnover', minimum: 5, unit: 'crore', kind: 'minimum', source: 'Tender requirements.txt', page: 1, weight: 20, mandatory: true },
    { id: 'REQ-003', title: 'Local content ≥ 50%', category: 'Technical', key: 'local content', minimum: 50, unit: '%', kind: 'minimum', source: 'Tender requirements.txt', page: 1, weight: 15, mandatory: true },
    { id: 'REQ-004', title: 'GST registration verification', category: 'Statutory', key: 'GST', unit: '', kind: 'portal', source: 'Tender requirements.txt', page: 1, weight: 10, mandatory: true },
    { id: 'REQ-005', title: 'PAN verification', category: 'Statutory', key: 'PAN', unit: '', kind: 'portal', source: 'Tender requirements.txt', page: 1, weight: 10, mandatory: true },
    { id: 'REQ-006', title: 'Udyam registration check', category: 'Statutory', key: 'Udyam', unit: '', kind: 'portal', source: 'Tender requirements.txt', page: 1, weight: 10, mandatory: false },
    { id: 'REQ-007', title: 'Warranty period ≥ 24 months', category: 'Technical', key: 'warranty', minimum: 24, unit: 'months', kind: 'minimum', source: 'Tender requirements.txt', page: 1, weight: 10, mandatory: true },
    { id: 'REQ-008', title: 'Completed similar projects ≥ 3', category: 'Eligibility', key: 'completed projects', minimum: 3, unit: 'projects', kind: 'minimum', source: 'Tender requirements.txt', page: 1, weight: 10, mandatory: true }
  ],
  documents: [
    {
      id: 'tender',
      name: 'Tender_BG-2026-014.txt',
      role: 'tender',
      pages: [
        'GOVERNMENT PROCUREMENT TENDER — South Coast Process Utilities\nTender Reference: BG-2026-014\nItem: Industrial pump supply & commissioning\nMinimum experience: 5 years\nMinimum turnover: 5 crore\nMinimum local content: 50%\nGST registration must be verified.\nPAN must be verified.\nUdyam registration must be verified.\nMinimum warranty: 24 months\nMinimum completed projects: 3 projects'
      ]
    },
    {
      id: 'profile',
      name: 'Company_Profile_Vayuna.txt',
      role: 'bid',
      pages: [
        'Vayuna Engineering Pvt. Ltd. — Corporate Overview\nRelevant experience: 7 years\nCompleted projects: 4 projects\nPAN: SAMPLE-PAN (synthetic identifier)\nRegistered address: Guindy Industrial Estate, Chennai'
      ]
    },
    {
      id: 'financial',
      name: 'Audited_Financial_Statement_FY25.txt',
      role: 'bid',
      pages: [
        'Audited Financial Summary — FY 2024-25\nVayuna Engineering Pvt. Ltd.\nAnnual turnover: 3.8 crore\nNet worth: Positive (₹1.4 crore)\nCA Registration Number: 049281'
      ]
    },
    {
      id: 'technical',
      name: 'Technical_Offer_&_Declarations.txt',
      role: 'bid',
      pages: [
        'Technical Compliance & Declarations\nLocal content: 62%\nWarranty: 18 months\nGST: SAMPLE-GST (synthetic identifier)\nUdyam: SAMPLE-UDYAM (synthetic identifier)\nCountry of Origin: India'
      ]
    }
  ]
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function evaluate(requirements: Requirement[], documents: EvidenceDocument[]): Finding[] {
  return requirements.map(requirement => {
    const evidence: Evidence[] = [];
    const values: number[] = [];
    let ambiguous = false;
    const keyword = new RegExp('\\b' + escape(requirement.key) + '\\b', 'i');

    for (const doc of documents.filter(d => d.role === 'bid')) {
      doc.pages.forEach((page, index) => {
        for (const line of page.split(/\n/).filter(l => keyword.test(l))) {
          evidence.push({ document: doc.name, page: index + 1, quote: line.trim() });
          if (requirement.kind === 'minimum') {
            const cleanPattern = new RegExp('^(?:relevant |annual |minimum |total )?' + escape(requirement.key) + '\\s*[:=]\\s*(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s*' + escape(requirement.unit) + '\\s*[.;]?\\s*$', 'i');
            const match = line.match(cleanPattern);
            if (match && !/\b(not|estimated|approximately|proposed|up to|disputed|unverified)\b/i.test(line)) {
              values.push(Number(match[1]));
            } else {
              ambiguous = true;
            }
          }
        }
      });
    }

    let status: Status = 'Needs review';
    let reason = 'No matching evidence was found in bidder submissions. Request supporting documents.';
    let ruleExplanation = `Requires at least ${requirement.minimum ?? 'verified'} ${requirement.unit}.`;
    let calculation = 'No calculation available.';

    if (requirement.kind === 'portal') {
      ruleExplanation = 'Must be verified against official statutory portal records.';
      reason = evidence.length
        ? 'Identifier detected in submitted text. Official registry connection is unverified; verification requires review.'
        : 'Statutory registration evidence is missing from bidder documents.';
      calculation = evidence.length ? 'REGISTRY_STATUS == UNVERIFIED (Manual review required)' : 'EVIDENCE == MISSING';
    } else if (requirement.kind === 'manual') {
      ruleExplanation = 'Requires qualitative review by procurement officer.';
      reason = 'This clause requires officer interpretation. Automated verification is not supported.';
      calculation = 'MANUAL_INTERPRETATION';
    } else if (values.length && !ambiguous && new Set(values).size === 1) {
      const val = values[0];
      const pass = val >= requirement.minimum!;
      status = pass ? 'Compliant' : 'Non-compliant';
      calculation = `${val} ${requirement.unit} >= ${requirement.minimum} ${requirement.unit} -> ${pass ? 'TRUE' : 'FALSE'}`;
      reason = pass
        ? `Document states ${val} ${requirement.unit}, satisfying the tender minimum of ${requirement.minimum} ${requirement.unit}.`
        : `Document states ${val} ${requirement.unit}, falling below the tender minimum of ${requirement.minimum} ${requirement.unit}. Shortfall: ${(requirement.minimum! - val).toFixed(1)} ${requirement.unit}.`;
    } else if (evidence.length) {
      if (new Set(values).size > 1) {
        reason = `Conflicting values found across documents (${[...new Set(values)].join(', ')} ${requirement.unit}). Officer review required.`;
        calculation = `CONFLICT: [${[...new Set(values)].join(', ')}]`;
      } else {
        reason = 'Evidence text was found, but value or unit could not be parsed unambiguously. Officer review required.';
        calculation = 'PARSE_AMBIGUITY';
      }
    }

    const riskPoints = status === 'Compliant' ? 0 : status === 'Non-compliant' ? requirement.weight : requirement.weight / 2;

    return {
      requirement,
      status,
      reason,
      values: [...new Set(values)],
      evidence,
      risk: riskPoints,
      ruleExplanation,
      calculation
    };
  });
}

export function detectMissingDocuments(documents: EvidenceDocument[]): DocumentReadinessItem[] {
  const bidDocs = documents.filter(d => d.role === 'bid');
  return EXPECTED_DOCUMENTS_LIST.map(exp => {
    const matched = bidDocs.find(d => {
      const nameMatch = exp.matchPatterns.some(p => p.test(d.name));
      if (nameMatch) return true;
      const textMatch = d.pages.some(p => exp.matchPatterns.some(pat => pat.test(p)));
      return textMatch;
    });
    return {
      id: exp.id,
      name: exp.name,
      category: exp.category,
      mandatory: exp.mandatory,
      found: !!matched,
      matchedDocument: matched?.name
    };
  });
}

export function detectAnomalies(findings: Finding[], documents: EvidenceDocument[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const bidDocs = documents.filter(d => d.role === 'bid');

  // Check 1: Cross-document experience discrepancy
  const expQuotes: Evidence[] = [];
  bidDocs.forEach(doc => {
    doc.pages.forEach((page, pIdx) => {
      page.split('\n').forEach(line => {
        if (/experience/i.test(line) && /\d+\s*years?/i.test(line)) {
          expQuotes.push({ document: doc.name, page: pIdx + 1, quote: line.trim() });
        }
      });
    });
  });

  const distinctYears = new Set(
    expQuotes
      .map(e => {
        const m = e.quote.match(/(\d+(?:\.\d+)?)\s*years?/i);
        return m ? Number(m[1]) : null;
      })
      .filter((n): n is number => n !== null)
  );

  if (distinctYears.size > 1) {
    anomalies.push({
      id: 'anomaly-exp-inconsistency',
      type: 'INCONSISTENCY',
      title: 'Cross-document experience inconsistency',
      description: `Different experience figures (${[...distinctYears].join(' years, ')} years) were mentioned across submitted documents.`,
      evidence: expQuotes,
      severity: 'MEDIUM'
    });
  }

  // Check 2: Threshold shortfalls
  findings
    .filter(f => f.status === 'Non-compliant')
    .forEach(f => {
      anomalies.push({
        id: `anomaly-${f.requirement.id}`,
        type: 'SHORTFALL',
        title: `${f.requirement.title} Shortfall`,
        description: f.reason,
        evidence: f.evidence,
        severity: f.requirement.weight >= 15 ? 'HIGH' : 'MEDIUM'
      });
    });

  // Check 3: Missing mandatory statutory items
  findings
    .filter(f => f.requirement.kind === 'portal' && !f.evidence.length && f.requirement.mandatory)
    .forEach(f => {
      anomalies.push({
        id: `anomaly-missing-${f.requirement.id}`,
        type: 'DISCREPANCY',
        title: `Missing ${f.requirement.title}`,
        description: 'Mandatory statutory registration document was not submitted.',
        evidence: [],
        severity: 'HIGH'
      });
    });

  return anomalies;
}

export function summarize(findings: Finding[], documents: EvidenceDocument[]): AssessmentSummary {
  const totalWeight = findings.reduce((s, r) => s + r.requirement.weight, 0);
  const compliantWeight = findings.filter(r => r.status === 'Compliant').reduce((s, r) => s + r.requirement.weight, 0);
  const compliancePercentage = totalWeight ? Math.round((compliantWeight / totalWeight) * 100) : 0;

  const expectedDocs = detectMissingDocuments(documents);
  const foundCount = expectedDocs.filter(d => d.found).length;
  const missingMandatoryCount = expectedDocs.filter(d => d.mandatory && !d.found).length;

  const anomalies = detectAnomalies(findings, documents);

  // Build Itemized Explainable Risk Factors
  const riskFactors: RiskFactor[] = [];

  findings
    .filter(f => f.status === 'Non-compliant')
    .forEach(f => {
      riskFactors.push({
        name: `${f.requirement.title} shortfall`,
        points: f.requirement.weight,
        category: f.requirement.category === 'Financial' ? 'Financial' : 'Compliance',
        description: f.reason
      });
    });

  findings
    .filter(f => f.status === 'Needs review')
    .forEach(f => {
      riskFactors.push({
        name: `Unverified ${f.requirement.title}`,
        points: Math.round(f.requirement.weight / 2),
        category: 'Evidence',
        description: f.reason
      });
    });

  if (missingMandatoryCount > 0) {
    riskFactors.push({
      name: `Missing mandatory documents (${missingMandatoryCount})`,
      points: missingMandatoryCount * 5,
      category: 'Document',
      description: `${missingMandatoryCount} expected mandatory documents were not found in bidder submissions.`
    });
  }

  anomalies
    .filter(a => a.type === 'INCONSISTENCY')
    .forEach(a => {
      riskFactors.push({
        name: a.title,
        points: 7,
        category: 'Anomaly',
        description: a.description
      });
    });

  const rawRiskPoints = riskFactors.reduce((sum, f) => sum + f.points, 0);
  const riskScore = Math.min(100, Math.max(0, Math.round(totalWeight ? (rawRiskPoints / (totalWeight + missingMandatoryCount * 5 + 7)) * 100 : 0)));

  const riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' =
    riskScore <= 20 ? 'Low' : riskScore <= 40 ? 'Medium' : riskScore <= 60 ? 'High' : 'Critical';

  return {
    total: findings.length,
    pass: findings.filter(r => r.status === 'Compliant').length,
    fail: findings.filter(r => r.status === 'Non-compliant').length,
    review: findings.filter(r => r.status === 'Needs review').length,
    compliancePercentage,
    riskScore,
    riskLevel,
    riskFactors,
    expectedDocuments: expectedDocs,
    readinessCount: {
      found: foundCount,
      total: expectedDocs.length,
      percentage: Math.round((foundCount / expectedDocs.length) * 100)
    },
    anomalies
  };
}
