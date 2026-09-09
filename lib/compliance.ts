export type Status =
  | 'Compliant'
  | 'Partial'
  | 'Non-compliant'
  | 'Missing evidence'
  | 'Not applicable'
  | 'Needs review';

export type RequirementCategory =
  | 'Eligibility'
  | 'Financial'
  | 'Technical'
  | 'Statutory'
  | 'Experience'
  | 'MSME'
  | 'Local Content'
  | 'OEM Authorization'
  | 'Certifications'
  | 'General';

export type RequirementKind = 'minimum' | 'maximum' | 'expiry' | 'portal' | 'boolean' | 'manual';

export type Requirement = {
  id: string;
  title: string;
  category: RequirementCategory | string;
  key: string;
  minimum?: number;
  maximum?: number;
  requiredDate?: string;
  unit: string;
  kind: RequirementKind;
  source: string;
  page: number;
  weight: number;
  mandatory?: boolean;
  expectedIdentifier?: string;
};

export type EvidenceDocument = {
  id: string;
  name: string;
  pages: string[];
  role: 'tender' | 'bid';
  hash?: string;
  uploadedAt?: string;
  fileSize?: number;
};

export type Evidence = {
  document: string;
  page: number;
  quote: string;
  confidence?: number;
};

export type Finding = {
  requirement: Requirement;
  status: Status;
  reason: string;
  values: number[];
  dates?: string[];
  evidence: Evidence[];
  risk: number;
  confidence: number;
  ruleExplanation?: string;
  calculation?: string;
  entityDetails?: Record<string, string>;
};

export type AnomalyType = 'INCONSISTENCY' | 'EXPIRY' | 'SHORTFALL' | 'DISCREPANCY' | 'NAME_MISMATCH';

export type Anomaly = {
  id: string;
  type: AnomalyType;
  title: string;
  description: string;
  evidence: Evidence[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
};

export type RiskFactor = {
  name: string;
  points: number;
  category: 'Compliance' | 'Evidence' | 'Financial' | 'Document' | 'Anomaly' | 'Statutory';
  description: string;
};

export type DocumentReadinessItem = {
  id: string;
  name: string;
  category: string;
  mandatory: boolean;
  found: boolean;
  matchedDocument?: string;
  extractedSnippet?: string;
  confidence?: number;
};

export type AssessmentSummary = {
  total: number;
  pass: number;
  partial: number;
  fail: number;
  missing: number;
  review: number;
  notApplicable: number;
  compliancePercentage: number;
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskFactors: RiskFactor[];
  expectedDocuments: DocumentReadinessItem[];
  readinessCount: { found: number; total: number; percentage: number };
  anomalies: Anomaly[];
};

export const EXPECTED_DOCUMENTS_LIST: { id: string; name: string; category: string; mandatory: boolean; matchPatterns: RegExp[] }[] = [
  { id: 'doc-gst', name: 'GST Certificate (Form GST REG-06)', category: 'Statutory', mandatory: true, matchPatterns: [/gst/i, /goods and services tax/i, /gstin/i] },
  { id: 'doc-pan', name: 'Income Tax PAN Card', category: 'Statutory', mandatory: true, matchPatterns: [/pan/i, /permanent account number/i] },
  { id: 'doc-profile', name: 'Company Profile & Registration', category: 'Eligibility', mandatory: true, matchPatterns: [/profile/i, /incorporation/i, /company/i, /mca/i] },
  { id: 'doc-financial', name: 'Audited Financial Statement (Balance Sheet / P&L)', category: 'Financial', mandatory: true, matchPatterns: [/financial/i, /turnover/i, /balance sheet/i, /annual report/i, /profit/i] },
  { id: 'doc-technical', name: 'Technical Proposal & Datasheet', category: 'Technical', mandatory: true, matchPatterns: [/technical/i, /declaration/i, /specification/i, /datasheet/i] },
  { id: 'doc-exp', name: 'Experience & Project Completion Certificates', category: 'Experience', mandatory: true, matchPatterns: [/experience/i, /completion/i, /work order/i, /past project/i] },
  { id: 'doc-udyam', name: 'Udyam / MSME Certificate', category: 'MSME Preference', mandatory: false, matchPatterns: [/udyam/i, /msme/i, /udyogaadhar/i] },
  { id: 'doc-oem', name: 'OEM Authorization Letter', category: 'OEM Authorization', mandatory: false, matchPatterns: [/oem/i, /manufacturer authorization/i, /authorization letter/i] },
  { id: 'doc-local', name: 'Make in India (Local Content) Declaration', category: 'Local Content', mandatory: true, matchPatterns: [/local content/i, /make in india/i, /class-i/i, /class-ii/i] },
  { id: 'doc-solvency', name: 'Bank Solvency Certificate', category: 'Financial', mandatory: false, matchPatterns: [/solvency/i, /bank solvency/i, /banker certificate/i] }
];

export function decodePANCategory(pan: string): string {
  const clean = pan.trim().toUpperCase();
  if (clean.length < 4) return 'Unknown Entity';
  const char = clean[3];
  const map: Record<string, string> = {
    C: 'Company (Private/Public Limited)',
    P: 'Individual / Proprietorship',
    F: 'Partnership Firm / LLP',
    H: 'Hindu Undivided Family (HUF)',
    A: 'Association of Persons (AOP)',
    B: 'Body of Individuals (BOI)',
    G: 'Government Department / PSU',
    J: 'Artificial Juridical Person',
    L: 'Local Authority',
    T: 'Trust'
  };
  return map[char] || `Other (${char})`;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function evaluate(requirements: Requirement[], documents: EvidenceDocument[]): Finding[] {
  return requirements.map(requirement => {
    const evidence: Evidence[] = [];
    const values: number[] = [];
    const dates: string[] = [];
    let ambiguous = false;
    let confidence = 0.95;
    const entityDetails: Record<string, string> = {};

    let keywordPattern = '\\b' + escapeRegex(requirement.key) + '\\b';
    if (requirement.key.toLowerCase() === 'gst') {
      keywordPattern = '\\b(gst|gstin)\\b';
    } else if (requirement.key.toLowerCase() === 'pan') {
      keywordPattern = '\\b(pan|permanent account number)\\b';
    } else if (requirement.key.toLowerCase() === 'udyam' || requirement.key.toLowerCase() === 'msme') {
      keywordPattern = '\\b(udyam|msme|udyoga)\\b';
    }
    const keyword = new RegExp(keywordPattern, 'i');

    for (const doc of documents.filter(d => d.role === 'bid')) {
      doc.pages.forEach((page, index) => {
        for (const line of page.split(/\n/).filter(l => keyword.test(l))) {
          evidence.push({
            document: doc.name,
            page: index + 1,
            quote: line.trim(),
            confidence: 0.94
          });

          // 1. Numeric Minimum Check
          if (requirement.kind === 'minimum') {
            const hasHedging = /\b(not|estimated|approximately|proposed|up to|disputed|unverified)\b/i.test(line);
            const pattern = new RegExp(
              '(?:relevant |average |annual |minimum |total |past )?' +
                escapeRegex(requirement.key) +
                '[^\n-]*?[:=]?\\s*(?:₹|INR|Rs\\.?\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*' +
                escapeRegex(requirement.unit) +
                '(?:\\b|[.;]|$)',
              'i'
            );
            const match = line.match(pattern);
            const num = match ? Number(match[1]) : NaN;
            if (match && !hasHedging && !isNaN(num) && num >= 0 && !line.includes(`-${match[1]}`)) {
              values.push(num);
            } else if (hasHedging || !match || num < 0) {
              ambiguous = true;
              confidence = 0.65;
            }
          }

          // 2. Numeric Maximum Check
          if (requirement.kind === 'maximum') {
            const hasHedging = /\b(not|estimated|approximately|proposed|up to|disputed)\b/i.test(line);
            const pattern = new RegExp(
              '(?:maximum |delivery |lead time )?' +
                escapeRegex(requirement.key) +
                '[^\n-]*?[:=]?\\s*(-?\\d+(?:\\.\\d+)?)\\s*' +
                escapeRegex(requirement.unit) +
                '(?:\\b|[.;]|$)',
              'i'
            );
            const match = line.match(pattern);
            const num = match ? Number(match[1]) : NaN;
            if (match && !hasHedging && !isNaN(num) && num >= 0 && !line.includes(`-${match[1]}`)) {
              values.push(num);
            } else if (hasHedging || !match || num < 0) {
              ambiguous = true;
              confidence = 0.65;
            }
          }

          // 3. Date Expiry Check
          if (requirement.kind === 'expiry') {
            const dateMatch = line.match(/\b(\d{4}-\d{2}-\d{2})\b/);
            if (dateMatch) {
              dates.push(dateMatch[1]);
            }
          }

          // 4. PAN Entity Extraction
          if (requirement.key.toUpperCase() === 'PAN') {
            const panMatch = line.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
            if (panMatch) {
              const panNum = panMatch[1].toUpperCase();
              entityDetails['PAN Number'] = panNum;
              entityDetails['Taxpayer Type'] = decodePANCategory(panNum);
            }
          }

          // 5. GSTIN Entity Extraction
          if (requirement.key.toUpperCase() === 'GST') {
            const gstMatch = line.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1})\b/i);
            if (gstMatch) {
              const gstin = gstMatch[1].toUpperCase();
              entityDetails['GSTIN'] = gstin;
              entityDetails['State Code'] = gstin.slice(0, 2);
              entityDetails['PAN Component'] = gstin.slice(2, 12);
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
      if (!evidence.length) {
        status = 'Missing evidence';
        reason = 'Statutory registration evidence is missing from bidder documents.';
        calculation = 'EVIDENCE == MISSING';
        confidence = 0.99;
      } else {
        status = 'Needs review';
        reason = `Identifier detected in submitted text (${Object.keys(entityDetails).length ? JSON.stringify(entityDetails) : 'Synthetic'}). Live official registry verification required before final award.`;
        calculation = 'REGISTRY_STATUS == UNVERIFIED (Manual review required)';
        confidence = 0.92;
      }
    } else if (requirement.kind === 'manual') {
      ruleExplanation = 'Requires qualitative review by procurement officer.';
      reason = 'This clause requires officer interpretation. Automated verification is not supported.';
      calculation = 'MANUAL_INTERPRETATION';
      confidence = 0.75;
    } else if (requirement.kind === 'expiry') {
      ruleExplanation = `Certificate must remain valid through ${requirement.requiredDate || 'tender deadline'}.`;
      if (!dates.length) {
        status = evidence.length ? 'Needs review' : 'Missing evidence';
        reason = evidence.length ? 'Expiry date could not be parsed from certificate.' : 'Certificate is missing.';
        calculation = 'DATE == UNPARSEABLE';
      } else {
        const observedDate = dates[0];
        const reqDate = requirement.requiredDate || '2026-09-30';
        const pass = observedDate >= reqDate;
        status = pass ? 'Compliant' : 'Non-compliant';
        calculation = `${observedDate} >= ${reqDate} -> ${pass ? 'TRUE' : 'FALSE'}`;
        reason = pass
          ? `Certificate is valid until ${observedDate}, covering the required date of ${reqDate}.`
          : `Certificate expires on ${observedDate}, which falls before the required validity date of ${reqDate}.`;
        confidence = 0.95;
      }
    } else if (requirement.kind === 'maximum' && values.length && !ambiguous) {
      const val = values[0];
      const max = requirement.maximum ?? 4;
      const pass = val <= max;
      status = pass ? 'Compliant' : 'Non-compliant';
      calculation = `${val} ${requirement.unit} <= ${max} ${requirement.unit} -> ${pass ? 'TRUE' : 'FALSE'}`;
      reason = pass
        ? `Quoted ${val} ${requirement.unit}, satisfying the maximum allowed limit of ${max} ${requirement.unit}.`
        : `Quoted ${val} ${requirement.unit}, exceeding the maximum allowed limit of ${max} ${requirement.unit}.`;
    } else if (values.length && !ambiguous && new Set(values).size === 1) {
      const val = values[0];
      const pass = val >= requirement.minimum!;
      status = pass ? 'Compliant' : 'Non-compliant';
      calculation = `${val} ${requirement.unit} >= ${requirement.minimum} ${requirement.unit} -> ${pass ? 'TRUE' : 'FALSE'}`;
      reason = pass
        ? `Document states ${val} ${requirement.unit}, satisfying the tender minimum of ${requirement.minimum} ${requirement.unit}.`
        : `Document states ${val} ${requirement.unit}, falling below the tender minimum of ${requirement.minimum} ${requirement.unit}. Shortfall: ${(requirement.minimum! - val).toFixed(1)} ${requirement.unit}.`;
      confidence = 0.98;
    } else if (evidence.length) {
      if (new Set(values).size > 1) {
        status = 'Needs review';
        reason = `Conflicting values found across documents (${[...new Set(values)].join(', ')} ${requirement.unit}). Officer review required.`;
        calculation = `CONFLICT: [${[...new Set(values)].join(', ')}]`;
        confidence = 0.85;
      } else {
        status = 'Needs review';
        reason = 'Evidence text was found, but value or unit could not be parsed unambiguously. Officer review required.';
        calculation = 'PARSE_AMBIGUITY';
        confidence = 0.6;
      }
    } else {
      status = 'Missing evidence';
      reason = `No evidence matching "${requirement.key}" was found in bidder submissions.`;
      calculation = 'EVIDENCE == MISSING';
      confidence = 0.98;
    }

    let riskPoints = 0;
    const currentStatus: string = status;
    if (currentStatus === 'Non-compliant') {
      riskPoints = requirement.weight;
    } else if (currentStatus === 'Missing evidence') {
      riskPoints = requirement.mandatory ? requirement.weight : Math.round(requirement.weight * 0.75);
    } else if (currentStatus === 'Needs review' || currentStatus === 'Partial') {
      riskPoints = Math.round(requirement.weight / 2);
    } else {
      riskPoints = 0;
    }

    return {
      requirement,
      status,
      reason,
      values: [...new Set(values)],
      dates: [...new Set(dates)],
      evidence,
      risk: riskPoints,
      confidence,
      ruleExplanation,
      calculation,
      entityDetails: Object.keys(entityDetails).length ? entityDetails : undefined
    };
  });
}

export function detectMissingDocuments(documents: EvidenceDocument[]): DocumentReadinessItem[] {
  const bidDocs = documents.filter(d => d.role === 'bid');
  return EXPECTED_DOCUMENTS_LIST.map(exp => {
    let matchedDoc: EvidenceDocument | undefined;
    let snippet: string | undefined;

    for (const d of bidDocs) {
      const nameMatch = exp.matchPatterns.some(p => p.test(d.name));
      if (nameMatch) {
        matchedDoc = d;
        snippet = d.pages[0]?.split('\n')[0] || 'Document attached.';
        break;
      }
      for (let pIdx = 0; pIdx < d.pages.length; pIdx++) {
        const p = d.pages[pIdx];
        const line = p.split('\n').find(l => exp.matchPatterns.some(pat => pat.test(l)));
        if (line) {
          matchedDoc = d;
          snippet = `Page ${pIdx + 1}: ${line.trim()}`;
          break;
        }
      }
      if (matchedDoc) break;
    }

    return {
      id: exp.id,
      name: exp.name,
      category: exp.category,
      mandatory: exp.mandatory,
      found: !!matchedDoc,
      matchedDocument: matchedDoc?.name,
      extractedSnippet: snippet,
      confidence: matchedDoc ? 0.95 : 0.98
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
      title: 'Cross-document experience discrepancy',
      description: `Conflicting experience claims (${[...distinctYears].join(' years vs ')} years) detected across separate submitted documents.`,
      evidence: expQuotes,
      severity: 'HIGH'
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
        severity: f.requirement.weight >= 15 ? 'CRITICAL' : 'HIGH'
      });
    });

  // Check 3: Missing mandatory statutory items
  findings
    .filter(f => (f.status === 'Missing evidence' || (f.requirement.kind === 'portal' && !f.evidence.length)) && f.requirement.mandatory)
    .forEach(f => {
      anomalies.push({
        id: `anomaly-missing-${f.requirement.id}`,
        type: 'DISCREPANCY',
        title: `Missing Mandatory Document: ${f.requirement.title}`,
        description: 'Mandatory statutory document is completely missing from bidder submission.',
        evidence: [],
        severity: 'CRITICAL'
      });
    });

  return anomalies;
}

export function summarize(findings: Finding[], documents: EvidenceDocument[]): AssessmentSummary {
  const totalWeight = findings.reduce((s, r) => s + r.requirement.weight, 0);
  const compliantWeight = findings.filter(r => r.status === 'Compliant').reduce((s, r) => s + r.requirement.weight, 0);
  const partialWeight = findings.filter(r => r.status === 'Partial').reduce((s, r) => s + r.requirement.weight * 0.5, 0);
  const compliancePercentage = totalWeight ? Math.round(((compliantWeight + partialWeight) / totalWeight) * 100) : 0;

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
        name: `${f.requirement.title} Shortfall`,
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
      name: `Missing Mandatory Documents (${missingMandatoryCount})`,
      points: missingMandatoryCount * 5,
      category: 'Document',
      description: `${missingMandatoryCount} mandatory procurement documents were not located in bidder submissions.`
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
    partial: findings.filter(r => r.status === 'Partial').length,
    fail: findings.filter(r => r.status === 'Non-compliant').length,
    missing: findings.filter(r => r.status === 'Missing evidence').length,
    review: findings.filter(r => r.status === 'Needs review').length,
    notApplicable: findings.filter(r => r.status === 'Not applicable').length,
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

export const demo: { requirements: Requirement[]; documents: EvidenceDocument[] } = {
  requirements: [
    { id: 'REQ-001', title: 'Relevant industrial experience ≥ 5 years', category: 'Eligibility', key: 'experience', minimum: 5, unit: 'years', kind: 'minimum', source: 'Tender_BG-2026-014.txt', page: 1, weight: 15, mandatory: true },
    { id: 'REQ-002', title: 'Annual average turnover ≥ ₹5 crore', category: 'Financial', key: 'turnover', minimum: 5, unit: 'crore', kind: 'minimum', source: 'Tender_BG-2026-014.txt', page: 1, weight: 20, mandatory: true },
    { id: 'REQ-003', title: 'Minimum local content (Class-I / MII) ≥ 50%', category: 'Local Content', key: 'local content', minimum: 50, unit: '%', kind: 'minimum', source: 'Tender_BG-2026-014.txt', page: 1, weight: 15, mandatory: true },
    { id: 'REQ-004', title: 'Active GST registration verification', category: 'Statutory', key: 'GST', unit: '', kind: 'portal', source: 'Tender_BG-2026-014.txt', page: 1, weight: 10, mandatory: true },
    { id: 'REQ-005', title: 'Permanent Account Number (PAN) record', category: 'Statutory', key: 'PAN', unit: '', kind: 'portal', source: 'Tender_BG-2026-014.txt', page: 1, weight: 10, mandatory: true },
    { id: 'REQ-006', title: 'Udyam / MSME registration certificate', category: 'MSME', key: 'Udyam', unit: '', kind: 'portal', source: 'Tender_BG-2026-014.txt', page: 1, weight: 10, mandatory: false },
    { id: 'REQ-007', title: 'Comprehensive warranty period ≥ 24 months', category: 'Technical', key: 'warranty', minimum: 24, unit: 'months', kind: 'minimum', source: 'Tender_BG-2026-014.txt', page: 1, weight: 10, mandatory: true },
    { id: 'REQ-008', title: 'Past similar completed projects ≥ 3', category: 'Experience', key: 'completed projects', minimum: 3, unit: 'projects', kind: 'minimum', source: 'Tender_BG-2026-014.txt', page: 1, weight: 10, mandatory: true }
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
        'Vayuna Engineering Pvt. Ltd. — Corporate Overview\nRelevant experience: 7 years\nCompleted projects: 4 projects\nPAN: AABCV1234F (Private Limited Company)\nRegistered address: Guindy Industrial Estate, Chennai'
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
        'Technical Compliance & Declarations\nLocal content: 62%\nWarranty: 18 months\nGST: 33AABCV1234F1Z5\nUdyam: UDYAM-TN-02-0019284\nCountry of Origin: India'
      ]
    }
  ]
};
