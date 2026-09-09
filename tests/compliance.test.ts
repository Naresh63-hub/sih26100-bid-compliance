import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  demo,
  evaluate,
  summarize,
  detectMissingDocuments,
  detectAnomalies,
  type EvidenceDocument
} from '../lib/compliance.ts';
import { extractRequirements, readDocument } from '../lib/documents.ts';

const doc = (text: string, role: 'bid' | 'tender' = 'bid', name = 'Evidence.txt'): EvidenceDocument => ({
  id: 'test',
  name,
  role,
  pages: text.split('\f')
});

const experience = demo.requirements[0];

test('sample assessment calculates compliance, missing docs, and explainable risk', () => {
  const findings = evaluate(demo.requirements, demo.documents);
  const summary = summarize(findings, demo.documents);

  // Check individual findings
  assert.equal(findings[0].status, 'Compliant'); // Experience 7 >= 5
  assert.equal(findings[1].status, 'Non-compliant'); // Turnover 3.8 < 5
  assert.equal(findings[2].status, 'Compliant'); // Local content 62 >= 50
  assert.equal(findings[3].status, 'Needs review'); // GST
  assert.equal(findings[4].status, 'Needs review'); // PAN
  assert.equal(findings[5].status, 'Needs review'); // Udyam
  assert.equal(findings[6].status, 'Non-compliant'); // Warranty 18 < 24
  
  // Total summary checks
  assert.equal(summary.total, 8);
  assert.equal(summary.fail, 2);
  assert.equal(summary.review, 3);
  assert.ok(summary.riskScore > 30);
});

test('threshold boundary passes, shortfall fails', () => {
  assert.equal(evaluate([experience], [doc('Experience: 5 years')])[0].status, 'Compliant');
  assert.equal(evaluate([experience], [doc('Experience: 4.99 years')])[0].status, 'Non-compliant');
});

test('missing evidence returns Missing evidence status', () => {
  assert.equal(evaluate([experience], [doc('Nothing supplied')])[0].status, 'Missing evidence');
});

test('negative, wrong unit, ambiguous and negated evidence require review', () => {
  for (const text of [
    'Experience: -7 years',
    'Experience: 7 months',
    'Experience: approximately 7 years',
    'Experience: 7 years not verified',
    'Experience: 7 years\nExperience is disputed'
  ]) {
    assert.equal(evaluate([experience], [doc(text)])[0].status, 'Needs review', text);
  }
});

test('conflicts never silently choose the favourable value', () => {
  const result = evaluate([experience], [doc('Experience: 7 years\fExperience: 3 years')])[0];
  assert.equal(result.status, 'Needs review');
  assert.match(result.reason, /Conflicting/);
  assert.equal(result.evidence[1].page, 2);
});

test('tender requirements are never bidder evidence', () => {
  assert.equal(evaluate([experience], [doc('Experience: 7 years', 'tender')])[0].status, 'Missing evidence');
});

test('percentage and decimal units are preserved', () => {
  assert.equal(evaluate([demo.requirements[2]], [doc('Local content: 50%')])[0].status, 'Compliant');
  assert.equal(evaluate([demo.requirements[1]], [doc('Turnover: 3.8 crore')])[0].status, 'Non-compliant');
});

test('extractor automates explicit clauses and preserves page', () => {
  const rules = extractRequirements(
    doc('Minimum experience: 5 years\fBidder must supply insurance.\nGST must be verified.\nMinimum turnover: 5 crore', 'tender')
  );
  assert.equal(rules.length, 4);
  assert.equal(rules[0].minimum, 5);
  assert.equal(rules[1].kind, 'manual');
  assert.equal(rules[2].kind, 'portal');
  assert.equal(rules[3].page, 2);
});

test('missing document detection identifies expected mandatory documents', () => {
  const readiness = detectMissingDocuments(demo.documents);
  assert.ok(readiness.length >= 6);
  const gst = readiness.find(r => r.name.includes('GST'));
  assert.ok(gst?.found);
  const solvency = readiness.find(r => r.name.includes('Solvency'));
  assert.equal(solvency?.found, false);
});

test('cross-document inconsistency detection flags conflicting claims', () => {
  const docs = [
    doc('Relevant experience: 10 years', 'bid', 'Profile.txt'),
    doc('Relevant experience: 6 years', 'bid', 'Certificate.txt')
  ];
  const findings = evaluate([experience], docs);
  const anomalies = detectAnomalies(findings, docs);
  assert.ok(anomalies.some(a => a.type === 'INCONSISTENCY'));
});

test('text import preserves pages and SHA-256 fingerprints', async () => {
  const file = new File(['Experience: 7 years\fTurnover: 3.8 crore'], 'bid.txt');
  const parsed = await readDocument(file, 'bid');
  assert.equal(parsed.pages.length, 2);
  assert.match(parsed.hash!, /^[a-f0-9]{64}$/);
  assert.equal(parsed.role, 'bid');
  assert.equal((await readDocument(file, 'bid')).hash, parsed.hash);
});

test('unsupported and empty uploads fail gracefully', async () => {
  await assert.rejects(readDocument(new File(['text'], 'bid.exe'), 'bid'), /PDF or/);
  await assert.rejects(readDocument(new File(['   '], 'bid.txt'), 'bid'), /No readable text/);
});
