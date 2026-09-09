# BIDGUARD — SIH procurement compliance workbench

A runnable vertical-slice prototype for the supplied SIH26100 GeM bid compliance challenge. It turns tender clauses and bidder evidence into traceable document findings, explains risk contributions, and records a separate procurement officer decision.

## Run

Node.js 22.13+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. `npm run build` produces the Cloudflare-compatible Sites bundle. `npm test` runs the compliance engine checks. `npm run typecheck` checks TypeScript.

## Demonstration

1. Open the sample assessment. It has 8 rules, 3 passes, 2 failures and 3 pending registry checks.
2. Select annual turnover. The source states 3.8 crore against a 5 crore requirement. Open its source page.
3. Inspect the warranty shortfall and unconnected GST, PAN and Udyam checks.
4. Open Risk intelligence: the index is 45/100, made up of turnover 20, warranty 10 and three unverified registrations at 5 points each.
5. Enter an officer name, reviewed status and an evidence-based explanation. The automated finding stays visible, and the review is recorded separately.
6. Record a final officer decision. Export a printable report or a complete JSON record.
7. Create a new assessment. Upload a tender TXT/PDF, confirm the candidate clauses, then upload bidder TXT/PDF evidence. Review the resulting matrix.

Sample TXT files can be downloaded from the Documents panel. Text files use a form-feed character to separate pages. PDFs retain physical page numbers; scanned image content is not OCR-processed.

## Supported extraction format

Tender minimum rules are deliberately narrow:

```text
Minimum experience: 5 years
Minimum turnover: 5 crore
Minimum local content: 50%
Minimum warranty: 24 months
Minimum completed projects: 3 projects
GST registration must be verified.
Bidder must provide insurance.
```

Bidder numeric evidence:

```text
Relevant experience: 7 years
Annual turnover: 3.8 crore
Local content: 62%
Warranty: 18 months
Completed projects: 4 projects
```

Numbers and units must be explicit. Missing, ambiguous, negated or conflicting evidence is sent to review. Compound or unsupported clauses stay manual. Candidate extraction is incomplete by design: the officer must check the complete tender and can edit supported thresholds and weights. A document mention never verifies a registry status or document authenticity.

## Architecture

- `components/bidguard.tsx`: responsive review, document, requirement, risk and audit surfaces; printable report.
- `lib/documents.ts`: PDF.js page text extraction, SHA-256 file fingerprints and conservative clause extraction.
- `lib/compliance.ts`: deterministic rules, evidence citations, conflicts and normalized risk.
- `lib/workspace.ts`: assessment model, officer reviews, local activity history and review invalidation.
- `tests/compliance.test.ts`: numeric boundaries, conflicting evidence, missing evidence, source isolation and clause handling.

The application uses React/TypeScript and Vinext. All assessment data is device-local browser storage. There is no server database or submission to a government portal. Imported files are processed in the browser; extracted text, rather than original file bytes, is saved. New evidence or edited rules invalidates prior reviews and the final decision.

## Honest prototype boundaries

- No LLM, embeddings, semantic verification or OCR is enabled. The extraction engine is rule-based, not an AI model. This makes the verification core reproducible without API keys.
- GeM, GSTN, Udyam, PAN, MCA21, EPFO, ESIC, DigiLocker and other registry integrations are unconnected. All externally dependent checks require review.
- The UI records a supplied officer name; it does not authenticate the reviewer. Browser storage and local history are editable and are not a production audit trail.
- The risk formula is a transparent demonstration policy, not an official procurement scoring standard. A zero index does not certify authenticity or eligibility.
- PDF limits: 10 MB, 100 pages, 1 million extracted characters per file. Scans need external OCR; empty PDF pages are flagged.
- Printed PDF output depends on the browser print dialog. JSON includes complete evidence, source fingerprints, original findings, officer reviews and history.
- One workspace is saved per browser origin. Export before replacing it. Exported JSON is an archival record, not an import/restore format.
- A feature-detected read-only WebMCP assessment tool is included. No supported validation context was available; WebMCP is not claimed as verified.

## SIH development roadmap

Use this as the demonstrable verification and human-review core. Before production, add authenticated officer roles, a transactional backend, immutable event records, encrypted document storage and approved registry API adapters. Add an LLM behind a structured extraction interface with page citations, validation and confidence gating; retain deterministic numeric evaluation and human final authority. Evaluate extraction on a labelled tender/bid corpus, including OCR and contradictory-document cases. Do not pitch the roadmap as already implemented.
