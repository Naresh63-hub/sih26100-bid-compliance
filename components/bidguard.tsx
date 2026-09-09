'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ShieldCheck,
  Files,
  ListChecks,
  Activity,
  History,
  ChevronRight,
  Check,
  AlertTriangle,
  Search,
  Download,
  Fingerprint,
  CircleHelp,
  Plus,
  X,
  Upload,
  FileText,
  ArrowUpRight,
  RotateCcw,
  Pencil,
  ArrowLeft,
  Settings as SettingsIcon,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Scale,
  Building2,
  Trash2,
  ExternalLink
} from 'lucide-react';
import {
  evaluate,
  summarize,
  type Status,
  type Requirement,
  type EvidenceDocument,
  type AssessmentSummary,
  type Finding
} from '../lib/compliance';
import {
  initialWorkspaceStore,
  createSampleAssessment,
  addAuditToAssessment,
  invalidateAssessment,
  type WorkspaceStore,
  type Assessment
} from '../lib/workspace';
import { extractRequirements, readDocument } from '../lib/documents';

type ViewMode = 'assessments' | 'new-assessment' | 'assessment-detail' | 'settings';
type AssessmentTab = 'Overview' | 'Compliance' | 'Risk' | 'Evidence' | 'Report';

const assessmentTabs: { name: AssessmentTab; icon: typeof ListChecks }[] = [
  { name: 'Overview', icon: Layers },
  { name: 'Compliance', icon: ListChecks },
  { name: 'Risk', icon: Activity },
  { name: 'Evidence', icon: Files },
  { name: 'Report', icon: FileSpreadsheet }
];

const statuses: Status[] = ['Compliant', 'Non-compliant', 'Needs review'];
const statusClass = (s: string) => s.toLowerCase().replaceAll(' ', '-');

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={'status ' + statusClass(status)}>
      {status === 'Compliant' ? (
        <Check size={13} />
      ) : status === 'Non-compliant' ? (
        <XCircle size={13} />
      ) : (
        <AlertTriangle size={13} />
      )}
      {' ' + status}
    </span>
  );
}

function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href]');
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function Bidguard() {
  const [store, setStore] = useState<WorkspaceStore>(initialWorkspaceStore);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewMode>('assessments');
  const [activeTab, setActiveTab] = useState<AssessmentTab>('Overview');

  // Active Assessment State
  const activeAssessment = useMemo(() => {
    return store.assessments.find(a => a.id === store.activeAssessmentId) || store.assessments[0];
  }, [store]);

  // Inspection & Filters
  const [selectedReqId, setSelectedReqId] = useState<string>('REQ-002');
  const [filter, setFilter] = useState('All requirements');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Modals & Source Viewer
  const [modal, setModal] = useState<'decision' | 'report' | null>(null);
  const [source, setSource] = useState<{ doc: EvidenceDocument; page: number; quote?: string } | null>(null);
  const [editReq, setEditReq] = useState<Requirement | null>(null);

  // Review Form state
  const [officer, setOfficer] = useState('');
  const [reason, setReason] = useState('');
  const [reviewStatus, setReviewStatus] = useState<Status>('Needs review');
  const [decisionStatus, setDecisionStatus] = useState('Request clarification');

  // Guided Creation Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [newTenderTitle, setNewTenderTitle] = useState('');
  const [newTenderEntity, setNewTenderEntity] = useState('South Coast Process Utilities (MoPNG / PSU)');
  const [newBidderName, setNewBidderName] = useState('');
  const [wizardTenderDoc, setWizardTenderDoc] = useState<EvidenceDocument | null>(null);
  const [wizardExtractedReqs, setWizardExtractedReqs] = useState<Requirement[]>([]);
  const [wizardBidDocs, setWizardBidDocs] = useState<EvidenceDocument[]>([]);
  const tenderFileRef = useRef<HTMLInputElement>(null);
  const bidFilesRef = useRef<HTMLInputElement>(null);

  // Load from LocalStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bidguard-workspace-store-v2');
      if (raw) {
        const val = JSON.parse(raw);
        if (val.version === 2 && Array.isArray(val.assessments) && val.assessments.length > 0) {
          setStore(val);
        }
      } else {
        // Fallback for v1 data migration
        const oldV1 = localStorage.getItem('bidguard-workspace-v1');
        if (oldV1) {
          const v1Val = JSON.parse(oldV1);
          if (v1Val.version === 1) {
            const migrated: Assessment = {
              id: 'BG-2026-014',
              name: v1Val.name || 'Industrial Pump Supply & Commissioning',
              bidder: v1Val.bidder || 'Vayuna Engineering Pvt. Ltd.',
              procuringEntity: 'South Coast Process Utilities (PSU / MoPNG)',
              status: v1Val.decision?.status?.includes('Qualified') ? 'Compliant' : 'In Review',
              lastAnalyzed: new Date().toISOString(),
              sample: v1Val.sample ?? true,
              requirements: v1Val.requirements || [],
              documents: v1Val.documents || [],
              reviews: v1Val.reviews || {},
              audit: v1Val.audit || [],
              decision: v1Val.decision
            };
            setStore({ version: 2, activeAssessmentId: migrated.id, assessments: [migrated] });
          }
        }
      }
    } catch {
      setError('Saved assessments could not be loaded. Standard sample is active.');
    }
    setReady(true);
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem('bidguard-workspace-store-v2', JSON.stringify(store));
      } catch {
        setError('Browser storage is full or unavailable.');
      }
    }
  }, [store, ready]);

  // Reactive Evaluation for active assessment
  const results: Finding[] = useMemo(() => {
    if (!activeAssessment) return [];
    return evaluate(activeAssessment.requirements, activeAssessment.documents);
  }, [activeAssessment]);

  const summary: AssessmentSummary = useMemo(() => {
    if (!activeAssessment) {
      return {
        total: 0,
        pass: 0,
        fail: 0,
        review: 0,
        compliancePercentage: 0,
        riskScore: 0,
        riskLevel: 'Low',
        riskFactors: [],
        expectedDocuments: [],
        readinessCount: { found: 0, total: 0, percentage: 0 },
        anomalies: []
      };
    }
    return summarize(results, activeAssessment.documents);
  }, [results, activeAssessment]);

  const activeFinding = useMemo(() => {
    return results.find(r => r.requirement.id === selectedReqId) || results[0];
  }, [results, selectedReqId]);

  const categories = useMemo(() => {
    if (!activeAssessment) return [];
    return ['All categories', ...Array.from(new Set(activeAssessment.requirements.map(r => r.category)))];
  }, [activeAssessment]);

  const visibleFindings = useMemo(() => {
    return results.filter(r => {
      const matchStatus = filter === 'All requirements' || r.status === filter;
      const matchCat = categoryFilter === 'All categories' || r.requirement.category === categoryFilter;
      const matchQuery = (r.requirement.title + ' ' + r.requirement.id + ' ' + r.requirement.key).toLowerCase().includes(query.toLowerCase());
      return matchStatus && matchCat && matchQuery;
    });
  }, [results, filter, categoryFilter, query]);

  // Update active assessment helper
  const updateActiveAssessment = (updater: (prev: Assessment) => Assessment, actionName: string, detailText: string, actorName = 'Procurement Officer') => {
    setStore(prev => {
      const updatedAssessments = prev.assessments.map(a => {
        if (a.id === prev.activeAssessmentId) {
          const mod = updater(a);
          return addAuditToAssessment(mod, actorName, actionName, detailText);
        }
        return a;
      });
      return { ...prev, assessments: updatedAssessments };
    });
    setMessage(actionName);
    setError('');
  };

  const inspect = (name: string, page: number, quote?: string) => {
    if (!activeAssessment) return;
    const doc = activeAssessment.documents.find(d => d.name === name);
    if (doc) setSource({ doc, page, quote });
  };

  const exportJson = () => {
    if (!activeAssessment) return;
    download(
      `bidguard-${activeAssessment.id}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          assessment: activeAssessment,
          results,
          summary,
          disclaimer: 'Deterministic evaluation based on submitted documents. Official registry checks require authorized portal verification.'
        },
        null,
        2
      )
    );
    setMessage('Complete assessment JSON exported.');
  };

  const saveReview = () => {
    if (!activeFinding || !activeAssessment) return;
    if (!officer.trim() || reason.trim().length < 10) {
      setError('Enter your name and a review rationale of at least 10 characters.');
      return;
    }
    const oldStatus = activeAssessment.reviews[activeFinding.requirement.id]?.status || activeFinding.status;
    updateActiveAssessment(
      prev => ({
        ...prev,
        reviews: {
          ...prev.reviews,
          [activeFinding.requirement.id]: {
            status: reviewStatus,
            reason: reason.trim(),
            actor: officer.trim(),
            time: new Date().toISOString()
          }
        }
      }),
      'Officer review recorded',
      `${activeFinding.requirement.id}: ${oldStatus} → ${reviewStatus}. Rationale: ${reason.trim()}`,
      officer.trim()
    );
    setReason('');
  };

  // WebMCP Tool Registration
  const snapshotRef = useRef({ results, summary, assessment: activeAssessment });
  snapshotRef.current = { results, summary, assessment: activeAssessment };
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_bid_assessment',
            description: 'Read current procurement compliance findings, evidence citations, and risk index.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: () => snapshotRef.current
          },
          { signal: lifecycle.signal }
        )
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);

  // Wizard Handlers
  async function handleWizardTenderUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      const file = files[0];
      const doc = await readDocument(file, 'tender');
      const reqs = extractRequirements(doc);
      if (!reqs.length) {
        throw new Error('No candidate clauses were detected. Ensure the tender contains explicit "Minimum...", "shall", or "must" statements.');
      }
      setWizardTenderDoc(doc);
      setWizardExtractedReqs(reqs);
      if (!newTenderTitle.trim()) {
        setNewTenderTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setWizardStep(2);
      setMessage(`${reqs.length} candidate clauses extracted from ${file.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tender parsing failed.');
    } finally {
      setBusy(false);
      if (tenderFileRef.current) tenderFileRef.current.value = '';
    }
  }

  async function handleWizardBidDocsUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      const docs: EvidenceDocument[] = [];
      for (const file of Array.from(files)) {
        const doc = await readDocument(file, 'bid');
        if (docs.some(d => d.name === doc.name || d.hash === doc.hash)) continue;
        docs.push(doc);
      }
      setWizardBidDocs(prev => [...prev, ...docs]);
      setMessage(`${docs.length} bidder documents parsed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bid document import failed.');
    } finally {
      setBusy(false);
      if (bidFilesRef.current) bidFilesRef.current.value = '';
    }
  }

  function finalizeNewAssessment() {
    if (!newTenderTitle.trim() || !newBidderName.trim() || !wizardTenderDoc || !wizardExtractedReqs.length) {
      setError('Please provide tender title, bidder name, tender document, and confirm requirements.');
      return;
    }
    const newId = `BG-${new Date().getFullYear()}-${String(store.assessments.length + 1).padStart(3, '0')}`;
    const newAssessment: Assessment = {
      id: newId,
      name: newTenderTitle.trim(),
      bidder: newBidderName.trim(),
      procuringEntity: newTenderEntity.trim() || 'Indian Public Procurement Entity',
      status: 'In Review',
      lastAnalyzed: new Date().toISOString(),
      sample: false,
      requirements: wizardExtractedReqs,
      documents: [wizardTenderDoc, ...wizardBidDocs],
      reviews: {},
      audit: [
        {
          id: crypto.randomUUID(),
          time: new Date().toISOString(),
          actor: 'Procurement Officer',
          action: 'Assessment Created',
          detail: `Tender "${newTenderTitle}" initialized with ${wizardExtractedReqs.length} requirements and ${wizardBidDocs.length} bidder documents.`
        }
      ]
    };

    setStore(prev => ({
      version: 2,
      activeAssessmentId: newId,
      assessments: [newAssessment, ...prev.assessments]
    }));

    // Reset wizard
    setWizardStep(1);
    setNewTenderTitle('');
    setNewBidderName('');
    setWizardTenderDoc(null);
    setWizardExtractedReqs([]);
    setWizardBidDocs([]);
    setSelectedReqId(wizardExtractedReqs[0]?.id || 'REQ-001');

    setView('assessment-detail');
    setActiveTab('Overview');
    setMessage(`Assessment ${newId} initialized successfully.`);
  }

  return (
    <>
      <div className="shell">
        {/* SIDEBAR NAVIGATION */}
        <aside className="sidebar">
          <a
            className="brand"
            href="/"
            onClick={e => {
              e.preventDefault();
              setView('assessments');
            }}
          >
            <span className="brand-icon">
              <ShieldCheck size={25} />
            </span>
            <span>
              BIDGUARD
              <small>PROCUREMENT INTELLIGENCE</small>
            </span>
          </a>

          <div className="workspace">
            <span className="workspace-icon">BG</span>
            <div>
              Procurement Workspace
              <small>SIH 2026 · Ministry of PNG</small>
            </div>
          </div>

          <p className="nav-label">MAIN NAVIGATION</p>
          <nav aria-label="Main navigation">
            <button
              className={view === 'assessments' || view === 'assessment-detail' ? 'active' : ''}
              onClick={() => setView('assessments')}
            >
              <Layers size={18} />
              Assessments
              <span>{store.assessments.length}</span>
            </button>
            <button
              className={view === 'new-assessment' ? 'active' : ''}
              onClick={() => {
                setWizardStep(1);
                setView('new-assessment');
              }}
            >
              <Plus size={18} />
              + New Assessment
            </button>
            <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
              <SettingsIcon size={18} />
              Settings
            </button>
          </nav>

          <div className="sidebar-bottom">
            <div className="secure">
              <Fingerprint size={22} />
              <b>Evidence. Not assumptions.</b>
              <p>
                Every finding has a source.
                <br />
                Every decision stays human.
              </p>
            </div>
            <div className="profile">
              <span>PO</span>
              <div>
                Procurement Officer
                <small>Air-Gapped / On-Device</small>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main>
          {/* TOPBAR */}
          <header className="topbar">
            <div>
              <span>BIDGUARD</span>
              <ChevronRight size={14} />
              {view === 'assessments' && <b>Procurement Assessments Dashboard</b>}
              {view === 'new-assessment' && <b>Guided Assessment Wizard</b>}
              {view === 'settings' && <b>System & Evaluation Settings</b>}
              {view === 'assessment-detail' && (
                <>
                  <button className="text-link" onClick={() => setView('assessments')}>
                    Assessments
                  </button>
                  <ChevronRight size={14} />
                  <b>{activeAssessment?.id}</b>
                </>
              )}
            </div>
            <div className="demo-badge">
              <i />
              {activeAssessment?.sample ? 'FICTIONAL PSU DEMO' : 'LOCAL WORKSPACE'}
            </div>
          </header>

          <section className="content">
            {/* ALERTS & FEEDBACK */}
            {error && (
              <div role="alert" className="error">
                {error}
                <button className="dismiss" aria-label="Dismiss error" onClick={() => setError('')}>
                  <X size={15} />
                </button>
              </div>
            )}
            {message && (
              <div className="feedback" role="status">
                {message}
                <button className="dismiss" aria-label="Dismiss message" onClick={() => setMessage('')}>
                  <X size={15} />
                </button>
              </div>
            )}

            {/* VIEW 1: MAIN ASSESSMENTS DASHBOARD */}
            {view === 'assessments' && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">PROCUREMENT ASSESSMENTS</p>
                    <h1>Review Tenders & Bidder Compliance</h1>
                    <p>Evidence-first compliance analysis for Indian Government & PSU tenders</p>
                  </div>
                  <div className="toolbar">
                    <button
                      className="button primary"
                      onClick={() => {
                        setWizardStep(1);
                        setView('new-assessment');
                      }}
                    >
                      <Plus size={16} /> + New Assessment
                    </button>
                  </div>
                </div>

                <div className="stats">
                  <div>
                    <small>Total Assessments</small>
                    <strong>{store.assessments.length}</strong>
                    <p>Active procurement cases</p>
                  </div>
                  <div>
                    <small>Active Tender Bids</small>
                    <strong>{store.assessments.reduce((sum, a) => sum + a.documents.filter(d => d.role === 'bid').length, 0)}</strong>
                    <p>Bidder documents processed</p>
                  </div>
                  <div>
                    <small>Total Requirements</small>
                    <strong>{store.assessments.reduce((sum, a) => sum + a.requirements.length, 0)}</strong>
                    <p>Deterministic checks configured</p>
                  </div>
                  <div>
                    <small>Human Reviews Logged</small>
                    <strong>{store.assessments.reduce((sum, a) => sum + Object.keys(a.reviews).length, 0)}</strong>
                    <p>Officer overrides recorded</p>
                  </div>
                </div>

                <section className="panel page-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>All Procurement Assessments</h2>
                      <p>Select an assessment to inspect compliance findings, evidence, and risk analysis</p>
                    </div>
                    <span className="count">{store.assessments.length} cases</span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ASSESSMENT ID</th>
                          <th>TENDER & PROCURING ENTITY</th>
                          <th>BIDDER</th>
                          <th>REQUIREMENTS</th>
                          <th>COMPLIANCE</th>
                          <th>RISK LEVEL</th>
                          <th>STATUS</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {store.assessments.map(item => {
                          const itemResults = evaluate(item.requirements, item.documents);
                          const itemSummary = summarize(itemResults, item.documents);
                          return (
                            <tr
                              key={item.id}
                              onClick={() => {
                                setStore(prev => ({ ...prev, activeAssessmentId: item.id }));
                                setSelectedReqId(item.requirements[0]?.id || 'REQ-001');
                                setView('assessment-detail');
                                setActiveTab('Overview');
                              }}
                            >
                              <td>
                                <b>{item.id}</b>
                                <small>{item.sample ? 'Demo Fixture' : 'Custom Upload'}</small>
                              </td>
                              <td>
                                <strong>{item.name}</strong>
                                <small>{item.procuringEntity}</small>
                              </td>
                              <td>
                                <b>{item.bidder}</b>
                                <small>{item.documents.filter(d => d.role === 'bid').length} supporting files</small>
                              </td>
                              <td>
                                <span>{item.requirements.length} checks</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <b>{itemSummary.compliancePercentage}%</b>
                                  <div className="risk-bar" style={{ width: 60, height: 6, margin: 0 }}>
                                    <span style={{ width: `${itemSummary.compliancePercentage}%`, background: '#2c8862' }} />
                                  </div>
                                </div>
                                <small>{itemSummary.pass} compliant</small>
                              </td>
                              <td>
                                <span
                                  className="status"
                                  style={{
                                    background:
                                      itemSummary.riskLevel === 'Low'
                                        ? '#eaf6ef'
                                        : itemSummary.riskLevel === 'Medium'
                                        ? '#fff7e3'
                                        : '#fff0ec',
                                    color:
                                      itemSummary.riskLevel === 'Low'
                                        ? '#348362'
                                        : itemSummary.riskLevel === 'Medium'
                                        ? '#a78737'
                                        : '#b46153'
                                  }}
                                >
                                  {itemSummary.riskScore}/100 · {itemSummary.riskLevel}
                                </span>
                              </td>
                              <td>
                                <span className="demo-badge">{item.decision?.status || item.status}</span>
                              </td>
                              <td>
                                <button className="button primary">
                                  Open Assessment <ChevronRight size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* VIEW 2: GUIDED NEW ASSESSMENT CREATION WORKFLOW */}
            {view === 'new-assessment' && (
              <div className="page-panel">
                <div className="page-heading">
                  <div>
                    <button className="text-link" onClick={() => setView('assessments')}>
                      <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                    <h1>Create New Procurement Assessment</h1>
                    <p>Continuous guided workflow: Upload Tender → Extract Requirements → Upload Bidder Evidence → Run Assessment</p>
                  </div>
                </div>

                {/* Step Indicators */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <div
                    className={`panel ${wizardStep === 1 ? 'selected' : ''}`}
                    style={{ flex: 1, padding: 16, borderLeft: wizardStep >= 1 ? '4px solid #193e31' : undefined }}
                  >
                    <small style={{ color: '#7e8b84' }}>STEP 1</small>
                    <h3 style={{ margin: '4px 0 0', fontSize: 14 }}>Tender Document & Ingestion</h3>
                  </div>
                  <div
                    className={`panel ${wizardStep === 2 ? 'selected' : ''}`}
                    style={{ flex: 1, padding: 16, borderLeft: wizardStep >= 2 ? '4px solid #193e31' : undefined }}
                  >
                    <small style={{ color: '#7e8b84' }}>STEP 2</small>
                    <h3 style={{ margin: '4px 0 0', fontSize: 14 }}>Requirement Review ({wizardExtractedReqs.length})</h3>
                  </div>
                  <div
                    className={`panel ${wizardStep === 3 ? 'selected' : ''}`}
                    style={{ flex: 1, padding: 16, borderLeft: wizardStep === 3 ? '4px solid #193e31' : undefined }}
                  >
                    <small style={{ color: '#7e8b84' }}>STEP 3</small>
                    <h3 style={{ margin: '4px 0 0', fontSize: 14 }}>Bidder Documents & Run</h3>
                  </div>
                </div>

                {/* STEP 1: Upload Tender */}
                {wizardStep === 1 && (
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Step 1: Upload Tender Specification</h2>
                        <p>Upload the official tender document (PDF or UTF-8 TXT) to automatically extract candidate compliance clauses</p>
                      </div>
                      <Upload size={20} />
                    </div>
                    <div className="section-body">
                      <div className="form-grid">
                        <label className="field">
                          Tender Title
                          <input
                            placeholder="e.g. Supply & Commissioning of Industrial Centrifugal Pumps"
                            value={newTenderTitle}
                            onChange={e => setNewTenderTitle(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Procuring Organization
                          <input
                            placeholder="e.g. South Coast Process Utilities (MoPNG / PSU)"
                            value={newTenderEntity}
                            onChange={e => setNewTenderEntity(e.target.value)}
                          />
                        </label>
                      </div>

                      <label className="upload-label">
                        Choose Tender Document (PDF or TXT)
                        <input
                          ref={tenderFileRef}
                          className="file-input"
                          type="file"
                          accept=".pdf,.txt"
                          disabled={busy}
                          onChange={e => void handleWizardTenderUpload(e.target.files)}
                        />
                      </label>
                      {busy && <p role="status">Extracting text, identifying page boundaries, and calculating SHA-256 fingerprint…</p>}

                      <div className="notice" style={{ marginTop: 24 }}>
                        <b>Supported Clause Formats:</b> The extractor identifies explicit minimums (e.g. <code>Minimum experience: 5 years</code>, <code>Minimum turnover: 5 crore</code>, <code>Minimum local content: 50%</code>, <code>Minimum warranty: 24 months</code>) and statutory verification keywords (<code>GST</code>, <code>PAN</code>, <code>Udyam</code>).
                      </div>
                    </div>
                  </section>
                )}

                {/* STEP 2: Review Extracted Requirements */}
                {wizardStep === 2 && (
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Step 2: Review Extracted Tender Clauses</h2>
                        <p>Verify candidate rules extracted from {wizardTenderDoc?.name}. You can edit thresholds or risk weights.</p>
                      </div>
                      <span className="count">{wizardExtractedReqs.length} clauses discovered</span>
                    </div>
                    <div className="section-body">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>CLAUSE ID</th>
                              <th>TITLE / DESCRIPTION</th>
                              <th>RULE LOGIC</th>
                              <th>CATEGORY</th>
                              <th>WEIGHT</th>
                              <th>SOURCE PAGE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wizardExtractedReqs.map(req => (
                              <tr key={req.id}>
                                <td><b>{req.id}</b></td>
                                <td>{req.title}</td>
                                <td>
                                  <code>{req.kind === 'minimum' ? `>= ${req.minimum} ${req.unit}` : req.kind === 'portal' ? 'Portal Verification' : 'Manual Review'}</code>
                                </td>
                                <td><span className="count">{req.category}</span></td>
                                <td>{req.weight} pts</td>
                                <td>Page {req.page}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="toolbar" style={{ marginTop: 24, justifyContent: 'space-between' }}>
                        <button className="button" onClick={() => setWizardStep(1)}>
                          <ArrowLeft size={15} /> Back to Step 1
                        </button>
                        <button className="button primary" onClick={() => setWizardStep(3)}>
                          Confirm Requirements & Proceed to Step 3 <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* STEP 3: Bidder Documents & Run */}
                {wizardStep === 3 && (
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Step 3: Bidder Information & Supporting Documents</h2>
                        <p>Specify the bidder company name and upload their submission files for automated compliance evaluation</p>
                      </div>
                      <Files size={20} />
                    </div>
                    <div className="section-body">
                      <label className="field" style={{ maxWidth: 500 }}>
                        Bidder Company Name
                        <input
                          required
                          placeholder="e.g. Vayuna Engineering Pvt. Ltd."
                          value={newBidderName}
                          onChange={e => setNewBidderName(e.target.value)}
                        />
                      </label>

                      <label className="upload-label" style={{ marginTop: 20 }}>
                        Upload Bidder Supporting Documents (Financials, Certificates, Declarations)
                        <input
                          ref={bidFilesRef}
                          className="file-input"
                          type="file"
                          accept=".pdf,.txt"
                          multiple
                          disabled={busy}
                          onChange={e => void handleWizardBidDocsUpload(e.target.files)}
                        />
                      </label>
                      {busy && <p role="status">Parsing document pages and computing SHA-256 digests…</p>}

                      <div className="document-list" style={{ marginTop: 20 }}>
                        {wizardBidDocs.map(doc => (
                          <div className="document-row" key={doc.id}>
                            <FileText size={22} />
                            <div>
                              <b>{doc.name}</b>
                              <p>{doc.pages.length} page(s) · SHA-256 {doc.hash?.slice(0, 16)}…</p>
                            </div>
                            <span className="status compliant"><Check size={12} /> Ready</span>
                          </div>
                        ))}
                        {!wizardBidDocs.length && (
                          <div className="notice">
                            No bidder documents uploaded yet. You can also run the assessment with empty documents and upload them later in the Evidence tab.
                          </div>
                        )}
                      </div>

                      <div className="toolbar" style={{ marginTop: 24, justifyContent: 'space-between' }}>
                        <button className="button" onClick={() => setWizardStep(2)}>
                          <ArrowLeft size={15} /> Back to Step 2
                        </button>
                        <button
                          className="button primary"
                          disabled={!newBidderName.trim()}
                          onClick={finalizeNewAssessment}
                        >
                          <CheckCircle2 size={16} /> Run Complete Assessment
                        </button>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* VIEW 3: ASSESSMENT WORKSPACE */}
            {view === 'assessment-detail' && activeAssessment && (
              <>
                {/* ASSESSMENT HEADER STRIP */}
                <div className="page-heading" style={{ marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <button className="text-link" onClick={() => setView('assessments')}>
                        <ArrowLeft size={14} /> All Assessments
                      </button>
                      <span style={{ color: '#99a49f' }}>/</span>
                      <span style={{ fontSize: 12, color: '#7a8883', fontWeight: 600 }}>{activeAssessment.id}</span>
                      <span className="demo-badge">{activeAssessment.decision?.status || activeAssessment.status}</span>
                    </div>
                    <h1>{activeAssessment.name}</h1>
                    <p style={{ margin: '4px 0 0' }}>
                      Bidder: <b>{activeAssessment.bidder}</b> · Procuring Entity: {activeAssessment.procuringEntity}
                    </p>
                  </div>
                  <div className="toolbar">
                    <button className="button" onClick={() => setModal('report')}>
                      <Download size={16} /> Export Report
                    </button>
                    <button className="button primary" onClick={() => { setReason(''); setModal('decision'); }}>
                      <CheckCircle2 size={16} /> Record Officer Decision
                    </button>
                  </div>
                </div>

                {/* WORKSPACE 5 TABS NAVIGATION */}
                <nav
                  style={{
                    display: 'flex',
                    gap: 8,
                    borderBottom: '1px solid #dfe6e2',
                    paddingBottom: 0,
                    marginBottom: 20
                  }}
                  aria-label="Assessment tabs"
                >
                  {assessmentTabs.map(t => (
                    <button
                      key={t.name}
                      style={{
                        padding: '12px 18px',
                        border: 'none',
                        borderBottom: activeTab === t.name ? '3px solid #193e31' : '3px solid transparent',
                        background: 'none',
                        color: activeTab === t.name ? '#193e31' : '#6b7c74',
                        fontWeight: activeTab === t.name ? 650 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                      onClick={() => setActiveTab(t.name)}
                    >
                      <t.icon size={16} />
                      {t.name}
                      {t.name === 'Compliance' && <span className="count">{summary.total}</span>}
                    </button>
                  ))}
                </nav>

                {/* TAB 1: OVERVIEW */}
                {activeTab === 'Overview' && (
                  <>
                    {/* Executive KPI Ribbon */}
                    <div className="stats">
                      <div>
                        <small>Compliance Score</small>
                        <strong style={{ color: summary.compliancePercentage >= 70 ? '#2c8862' : '#b95850' }}>
                          {summary.compliancePercentage}%
                        </strong>
                        <p>{summary.pass} of {summary.total} rules satisfied</p>
                      </div>
                      <div>
                        <small>Document Risk Index</small>
                        <strong style={{ color: summary.riskScore > 40 ? '#b95850' : summary.riskScore > 20 ? '#aa822d' : '#2c8862' }}>
                          {summary.riskScore}/100
                        </strong>
                        <p>{summary.riskLevel} Risk rating</p>
                      </div>
                      <div>
                        <small>Evidence Verified</small>
                        <strong>
                          {summary.pass}<span>/ {summary.total}</span>
                        </strong>
                        <p>{summary.review} items require officer review</p>
                      </div>
                      <div>
                        <small>Document Readiness</small>
                        <strong>
                          {summary.readinessCount.found}<span>/ {summary.readinessCount.total}</span>
                        </strong>
                        <p>{summary.readinessCount.percentage}% expected documents</p>
                      </div>
                    </div>

                    {/* ATTENTION REQUIRED SUMMARY BANNER */}
                    {(summary.fail > 0 || summary.review > 0 || summary.anomalies.length > 0) && (
                      <div
                        className="panel"
                        style={{
                          background: '#fffdf8',
                          border: '1px solid #f0dfb2',
                          padding: 20,
                          borderRadius: 8,
                          marginBottom: 20
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <AlertCircle size={20} color="#aa822d" />
                          <h3 style={{ margin: 0, fontSize: 16, color: '#8a6416' }}>Attention Required on this Assessment</h3>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, color: '#685422', fontSize: 13, lineHeight: 1.8 }}>
                          {summary.fail > 0 && <li><b>{summary.fail} numeric requirement shortfalls:</b> Criteria thresholds not met.</li>}
                          {summary.review > 0 && <li><b>{summary.review} items requiring officer review:</b> Statutory registries or manual clauses pending verification.</li>}
                          {summary.expectedDocuments.filter(d => d.mandatory && !d.found).length > 0 && (
                            <li>
                              <b>{summary.expectedDocuments.filter(d => d.mandatory && !d.found).length} missing mandatory documents:</b>{' '}
                              {summary.expectedDocuments.filter(d => d.mandatory && !d.found).map(d => d.name).join(', ')}.
                            </li>
                          )}
                          {summary.anomalies.filter(a => a.type === 'INCONSISTENCY').length > 0 && (
                            <li><b>Cross-document discrepancies detected:</b> Different claims found across submitted documents.</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="review-layout">
                      {/* Document Readiness Checklist */}
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Document Readiness Checklist</h2>
                            <p>Verification of mandatory and supporting procurement documents</p>
                          </div>
                          <span className="count">
                            {summary.readinessCount.found}/{summary.readinessCount.total} Found
                          </span>
                        </div>
                        <div className="section-body" style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'grid', gap: 10 }}>
                            {summary.expectedDocuments.map(item => (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  borderRadius: 6,
                                  border: '1px solid #e5eae6',
                                  background: item.found ? '#f8fbf9' : '#fff9f9'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {item.found ? (
                                    <CheckCircle2 size={16} color="#2c8862" />
                                  ) : (
                                    <XCircle size={16} color={item.mandatory ? '#b95850' : '#88938c'} />
                                  )}
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 550, color: item.found ? '#20322e' : '#721c24' }}>
                                      {item.name}
                                    </span>
                                    {item.mandatory && <small style={{ color: '#b95850', marginLeft: 6 }}>*Mandatory</small>}
                                    {item.matchedDocument && (
                                      <small style={{ display: 'block', color: '#687960' }}>Matched: {item.matchedDocument}</small>
                                    )}
                                  </div>
                                </div>
                                <span className={`status ${item.found ? 'compliant' : 'non-compliant'}`}>
                                  {item.found ? 'Found' : 'Missing'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                      {/* Top Risk Findings Preview */}
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Top Risk Contributors</h2>
                            <p>Key non-compliant or unreviewed items</p>
                          </div>
                          <button className="text-link" onClick={() => setActiveTab('Compliance')}>
                            View Matrix <ArrowUpRight size={14} />
                          </button>
                        </div>
                        <div className="section-body" style={{ padding: '12px 20px' }}>
                          {results.filter(r => r.status !== 'Compliant').map(r => (
                            <div
                              key={r.requirement.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: '1px solid #edf0ed',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSelectedReqId(r.requirement.id);
                                setActiveTab('Compliance');
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <small style={{ color: '#7a8883' }}>{r.requirement.id} · {r.requirement.category}</small>
                                <StatusBadge status={r.status} />
                              </div>
                              <b style={{ fontSize: 13, display: 'block', margin: '4px 0' }}>{r.requirement.title}</b>
                              <p style={{ margin: 0, fontSize: 11, color: '#78857b' }}>{r.reason}</p>
                            </div>
                          ))}
                          {!results.some(r => r.status !== 'Compliant') && (
                            <div className="empty">All requirements are compliant.</div>
                          )}
                        </div>
                      </section>
                    </div>
                  </>
                )}

                {/* TAB 2: COMPLIANCE MATRIX */}
                {activeTab === 'Compliance' && (
                  <div className="review-layout">
                    {/* Matrix Table */}
                    <section className="matrix panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Compliance Matrix</h2>
                          <p>Automated verification against tender clauses with page citations</p>
                        </div>
                        <span className="count">{results.length} requirements</span>
                      </div>

                      {/* Controls */}
                      <div className="matrix-controls" style={{ flexWrap: 'wrap' }}>
                        <label className="search" style={{ minWidth: 200 }}>
                          <Search size={16} />
                          <input
                            aria-label="Search requirements"
                            placeholder="Search requirements…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                          />
                        </label>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                          {categories.map(c => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                        <select value={filter} onChange={e => setFilter(e.target.value)}>
                          {['All requirements', ...statuses].map(s => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Table */}
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>REQUIREMENT</th>
                              <th>STATUS</th>
                              <th>EVIDENCE</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {visibleFindings.map(r => (
                              <tr
                                key={r.requirement.id}
                                className={activeFinding?.requirement.id === r.requirement.id ? 'selected' : ''}
                                onClick={() => {
                                  setSelectedReqId(r.requirement.id);
                                  setReason('');
                                }}
                              >
                                <td>
                                  <small>{r.requirement.id} · {r.requirement.category}</small>
                                  <button
                                    className="row-title"
                                    onClick={() => {
                                      setSelectedReqId(r.requirement.id);
                                      setReason('');
                                    }}
                                  >
                                    {r.requirement.title}
                                  </button>
                                  {activeAssessment.reviews[r.requirement.id] && (
                                    <small className="reviewed">
                                      Officer: {activeAssessment.reviews[r.requirement.id].status}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <StatusBadge status={r.status} />
                                </td>
                                <td>
                                  <span className="evidence-cell">
                                    {r.evidence[0] ? `Page ${r.evidence[0].page}` : 'Missing'}
                                    <small>{r.evidence.length} source{r.evidence.length !== 1 ? 's' : ''}</small>
                                  </span>
                                </td>
                                <td>
                                  <ChevronRight size={15} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!visibleFindings.length && <div className="empty">No requirements match this filter.</div>}
                      </div>
                      <div className="matrix-footer">
                        <ShieldCheck size={15} /> Deterministic rules verify · Officer retains final authority
                      </div>
                    </section>

                    {/* Right-Side Evidence Inspector */}
                    {activeFinding && (
                      <aside className="evidence panel">
                        <div className="panel-heading">
                          <div>
                            <p className="eyebrow">EVIDENCE INSPECTOR / {activeFinding.requirement.id}</p>
                            <h2>{activeFinding.requirement.title}</h2>
                          </div>
                          <Files size={20} />
                        </div>
                        <div className="evidence-body">
                          <StatusBadge status={activeFinding.status} />
                          <p className="explanation">{activeFinding.reason}</p>

                          {/* Comparison Box */}
                          <div className="comparison">
                            <div>
                              <small>REQUIRED</small>
                              <b>
                                {activeFinding.requirement.minimum !== undefined
                                  ? `${activeFinding.requirement.minimum} ${activeFinding.requirement.unit}`
                                  : 'Statutory Verification'}
                              </b>
                            </div>
                            <div>
                              <small>OBSERVED</small>
                              <b className={activeFinding.status === 'Non-compliant' ? 'red-text' : ''}>
                                {activeFinding.values.length
                                  ? `${activeFinding.values.join(' / ')} ${activeFinding.requirement.unit}`
                                  : 'Unverified'}
                              </b>
                            </div>
                          </div>

                          {/* Rule Calculation */}
                          {activeFinding.calculation && (
                            <div style={{ background: '#f8faf9', padding: '10px 14px', borderRadius: 6, marginBottom: 16, border: '1px solid #e2e7df' }}>
                              <small style={{ color: '#7a8883', display: 'block', marginBottom: 4 }}>RULE EVALUATION</small>
                              <code style={{ fontSize: 11, color: '#193e31' }}>{activeFinding.calculation}</code>
                            </div>
                          )}

                          {/* Quoted Sources */}
                          <button
                            className="source-link"
                            onClick={() => inspect(activeFinding.requirement.source, activeFinding.requirement.page)}
                          >
                            Tender Clause · Page {activeFinding.requirement.page} <ArrowUpRight size={13} />
                          </button>

                          {activeFinding.evidence.map((e, i) => (
                            <div className="source" key={i}>
                              <div>
                                <Files size={15} />
                                <b>{e.document}</b>
                                <span>p. {e.page}</span>
                              </div>
                              <blockquote>“{e.quote}”</blockquote>
                              <button className="source-link" onClick={() => inspect(e.document, e.page, e.quote)}>
                                View Source Page <ArrowUpRight size={12} />
                              </button>
                            </div>
                          ))}

                          {!activeFinding.evidence.length && (
                            <div className="notice">No supporting evidence found in submitted documents.</div>
                          )}

                          {/* Officer Review Form */}
                          <div className="review-form">
                            <h2>Officer Review & Override</h2>
                            {activeAssessment.reviews[activeFinding.requirement.id] && (
                              <div className="notice">
                                <b>Override: {activeAssessment.reviews[activeFinding.requirement.id].status}</b>
                                <br />
                                {activeAssessment.reviews[activeFinding.requirement.id].reason}
                                <br />
                                <small>By {activeAssessment.reviews[activeFinding.requirement.id].actor}</small>
                              </div>
                            )}

                            <label className="field">
                              Reviewer Name
                              <input
                                value={officer}
                                onChange={e => setOfficer(e.target.value)}
                                placeholder="Your Name"
                                maxLength={100}
                              />
                            </label>

                            <label className="field">
                              Reviewed Status
                              <select
                                value={reviewStatus}
                                onChange={e => setReviewStatus(e.target.value as Status)}
                              >
                                {statuses.map(s => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              Rationale / Verification Reference
                              <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="Explain your assessment and citations…"
                                maxLength={2000}
                              />
                            </label>

                            <button className="button primary full" onClick={saveReview}>
                              Record Officer Review
                            </button>
                          </div>
                        </div>
                      </aside>
                    )}
                  </div>
                )}

                {/* TAB 3: RISK INTELLIGENCE */}
                {activeTab === 'Risk' && (
                  <>
                    <div className="risk-layout page-panel">
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Document Risk Index</h2>
                          <Activity size={18} />
                        </div>
                        <div className="section-body">
                          <div className="risk-score">{summary.riskScore}<span>/100</span></div>
                          <span className={`status ${summary.riskScore > 40 ? 'non-compliant' : summary.riskScore > 20 ? 'needs-review' : 'compliant'}`}>
                            {summary.riskLevel} Risk
                          </span>
                          <div className="risk-bar">
                            <span style={{ width: `${summary.riskScore}%` }} />
                          </div>
                          <p className="muted">An explainable, deterministic review-priority score calculated from threshold shortfalls, missing documents, and inconsistencies.</p>
                          <p className="muted">
                            0–20 Low · 21–40 Medium<br />
                            41–60 High · 61–100 Critical
                          </p>
                        </div>
                      </section>

                      <section className="panel">
                        <div className="panel-heading">
                          <h2>What Contributes to the Score</h2>
                          <span className="count">{summary.riskFactors.length} penalty factors</span>
                        </div>
                        <div className="section-body">
                          {summary.riskFactors.map((f, idx) => (
                            <div className="risk-row" key={idx}>
                              <div>
                                <b style={{ fontSize: 13 }}>{f.name}</b>
                                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7b8776' }}>{f.description}</p>
                              </div>
                              <b>+{f.points}</b>
                            </div>
                          ))}
                          {!summary.riskFactors.length && <p>No risk points incurred from current findings.</p>}
                        </div>
                      </section>
                    </div>

                    {/* Cross-Document Anomalies Table */}
                    <section className="panel page-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Cross-Document Inconsistencies & Anomalies</h2>
                          <p>Automated discrepancy detection across distinct bidder submissions</p>
                        </div>
                        <span className="count">{summary.anomalies.length} items detected</span>
                      </div>
                      <div className="section-body">
                        {summary.anomalies.map(anom => (
                          <div
                            key={anom.id}
                            style={{
                              padding: 16,
                              borderRadius: 6,
                              border: '1px solid #ebd8b2',
                              background: '#fffdf9',
                              marginBottom: 12
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <b style={{ color: '#8d681c', fontSize: 14 }}>{anom.title}</b>
                              <span className="status needs-review">{anom.severity} Severity</span>
                            </div>
                            <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#554728' }}>{anom.description}</p>
                            {anom.evidence.map((ev, i) => (
                              <div key={i} style={{ fontSize: 11, color: '#756540', marginLeft: 10 }}>
                                • <i>{ev.document} (p. {ev.page})</i>: “{ev.quote}”
                              </div>
                            ))}
                          </div>
                        ))}
                        {!summary.anomalies.length && (
                          <p style={{ color: '#687960' }}>No cross-document inconsistencies detected.</p>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {/* TAB 4: EVIDENCE & DOCUMENT VAULT */}
                {activeTab === 'Evidence' && (
                  <section className="panel page-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Document & Evidence Vault</h2>
                        <p>In-browser page-level chunk reader with cryptographic SHA-256 fingerprints</p>
                      </div>
                      <Upload size={20} />
                    </div>
                    <div className="section-body">
                      <div className="document-list">
                        {activeAssessment.documents.map(doc => (
                          <div className="document-row" key={doc.id}>
                            <FileText size={25} />
                            <div>
                              <b>{doc.name}</b>
                              <p>
                                {doc.role === 'tender' ? 'Tender Specification' : 'Bidder Evidence'} · {doc.pages.length} page(s) ·{' '}
                                {doc.hash ? `SHA-256 ${doc.hash.slice(0, 16)}…` : 'Synthetic Fixture'}
                              </p>
                            </div>
                            <button className="button" onClick={() => setSource({ doc, page: 1 })}>
                              Read Document
                            </button>
                            <button
                              className="icon-button"
                              aria-label={'Download ' + doc.name}
                              onClick={() => download(doc.name.replace(/\.pdf$/i, '.txt'), doc.pages.join('\f'), 'text/plain')}
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* TAB 5: REPORT PREVIEW & EXPORT */}
                {activeTab === 'Report' && (
                  <section className="panel page-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Bid Compliance Report Preview</h2>
                        <p>Formal procurement evaluation summary ready for export or committee printing</p>
                      </div>
                      <div className="toolbar">
                        <button className="button primary" onClick={() => window.print()}>
                          <Download size={15} /> Print / Save as PDF
                        </button>
                        <button className="button" onClick={exportJson}>
                          Download JSON
                        </button>
                      </div>
                    </div>
                    <div className="section-body" style={{ background: '#fafbf9', padding: 30 }}>
                      <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', padding: 36, border: '1px solid #dfe6e2', borderRadius: 8 }}>
                        <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>BIDGUARD · Bid Compliance Assessment</h1>
                        <p style={{ color: '#7a8883', margin: '0 0 20px', fontSize: 13 }}>
                          Tender: <b>{activeAssessment.name}</b> ({activeAssessment.id})<br />
                          Bidder: <b>{activeAssessment.bidder}</b><br />
                          Procuring Entity: {activeAssessment.procuringEntity}<br />
                          Date of Evaluation: {new Date(activeAssessment.lastAnalyzed).toLocaleDateString()}
                        </p>

                        <div className="notice" style={{ margin: '16px 0 24px' }}>
                          <b>Executive Summary:</b> Compliance Score: <b>{summary.compliancePercentage}%</b> ({summary.pass} compliant, {summary.fail} non-compliant, {summary.review} need review) · Document Risk Index: <b>{summary.riskScore}/100 ({summary.riskLevel})</b> · Final Officer Decision: <b>{activeAssessment.decision?.status || 'In Review'}</b>
                        </div>

                        <h3 style={{ fontSize: 16, borderBottom: '1px solid #dfe6e2', paddingBottom: 8 }}>Compliance Findings & Citations</h3>
                        <div style={{ display: 'grid', gap: 14, margin: '16px 0' }}>
                          {results.map(r => (
                            <div key={r.requirement.id} style={{ padding: '10px 0', borderBottom: '1px solid #edf0ed' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <b>{r.requirement.id}: {r.requirement.title}</b>
                                <StatusBadge status={r.status} />
                              </div>
                              <p style={{ margin: '4px 0', fontSize: 12, color: '#556b58' }}>{r.reason}</p>
                              {r.evidence.map((ev, i) => (
                                <small key={i} style={{ display: 'block', color: '#78857b' }}>
                                  Source: {ev.document} (Page {ev.page}): “{ev.quote}”
                                </small>
                              ))}
                              {activeAssessment.reviews[r.requirement.id] && (
                                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#2c8862', fontWeight: 550 }}>
                                  Officer Override: {activeAssessment.reviews[r.requirement.id].status} — {activeAssessment.reviews[r.requirement.id].actor} ({activeAssessment.reviews[r.requirement.id].reason})
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <h3 style={{ fontSize: 16, borderBottom: '1px solid #dfe6e2', paddingBottom: 8, marginTop: 24 }}>Document Provenance & SHA-256 Checksums</h3>
                        <div style={{ display: 'grid', gap: 6, margin: '12px 0', fontSize: 11, color: '#78857b' }}>
                          {activeAssessment.documents.map(d => (
                            <div key={d.id}>
                              <b>{d.name}</b>: {d.hash || 'Synthetic Fixture'}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}

            {/* VIEW 4: SETTINGS */}
            {view === 'settings' && (
              <section className="panel page-panel">
                <div className="panel-heading">
                  <div>
                    <h2>System & Evaluation Settings</h2>
                    <p>Configure evaluation defaults, officer credentials, and air-gapped options</p>
                  </div>
                  <SettingsIcon size={20} />
                </div>
                <div className="section-body">
                  <div className="form-grid" style={{ maxWidth: 600 }}>
                    <label className="field">
                      Default Procurement Officer Name
                      <input
                        placeholder="Your Name"
                        value={officer}
                        onChange={e => setOfficer(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="notice" style={{ marginTop: 24, maxWidth: 600 }}>
                    <b>Local Air-Gapped Mode:</b> All document parsing (PDF.js) and deterministic rule execution run directly inside your browser. No files or text are uploaded to any external server.
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <button
                      className="button"
                      onClick={() => {
                        setStore(initialWorkspaceStore());
                        setMessage('Reset to default sample assessment.');
                      }}
                    >
                      <RotateCcw size={15} /> Reset Sample Data
                    </button>
                  </div>
                </div>
              </section>
            )}
          </section>
        </main>
      </div>

      {/* SOURCE VIEWER MODAL */}
      {source && (
        <Modal title={source.doc.name} close={() => setSource(null)}>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <label className="field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center' }}>
              Page:
              <select
                value={source.page}
                onChange={e => setSource({ ...source, page: Number(e.target.value), quote: undefined })}
              >
                {source.doc.pages.map((_, i) => (
                  <option key={i} value={i + 1}>
                    Page {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted" style={{ marginLeft: 'auto' }}>
              {source.doc.role === 'tender' ? 'Tender Specification' : 'Bidder Evidence'} · Page {source.page} of {source.doc.pages.length}
            </span>
          </div>
          {source.quote && (
            <blockquote className="notice" style={{ margin: '0 0 16px' }}>
              <mark>{source.quote}</mark>
            </blockquote>
          )}
          <pre>{source.doc.pages[source.page - 1] || 'No readable text on this page.'}</pre>
          <p className="hash" style={{ marginTop: 14 }}>
            SHA-256: {source.doc.hash || 'Synthetic fixture — no binary file fingerprint'}
          </p>
        </Modal>
      )}

      {/* FINAL DECISION MODAL */}
      {modal === 'decision' && activeAssessment && (
        <Modal title="Record Final Officer Decision" close={() => setModal(null)}>
          <div className="notice">
            Automated evaluation: <b>{summary.compliancePercentage}% Compliance</b>, {summary.fail} failures, {summary.review} need review. Your decision is recorded separately; original findings are preserved in the audit log.
          </div>
          <label className="field">
            Officer Name
            <input value={officer} onChange={e => setOfficer(e.target.value)} maxLength={100} placeholder="Your name" />
          </label>
          <label className="field">
            Decision
            <select value={decisionStatus} onChange={e => setDecisionStatus(e.target.value)}>
              {['Qualified by officer', 'Disqualified by officer', 'Request clarification'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Decision Rationale
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain the legal or technical justification for this procurement decision…"
              maxLength={3000}
            />
          </label>
          <button
            className="button primary"
            disabled={!officer.trim() || reason.trim().length < 10}
            onClick={() => {
              updateActiveAssessment(
                prev => ({
                  ...prev,
                  status: decisionStatus.includes('Qualified') ? 'Compliant' : decisionStatus.includes('Disqualified') ? 'Disqualified' : 'In Review',
                  decision: {
                    status: decisionStatus,
                    reason: reason.trim(),
                    actor: officer.trim(),
                    time: new Date().toISOString()
                  }
                }),
                'Final officer decision recorded',
                `${decisionStatus}. Justification: ${reason.trim()}`,
                officer.trim()
              );
              setModal(null);
              setReason('');
            }}
          >
            Confirm and Commit Decision
          </button>
        </Modal>
      )}

      {/* EXPORT REPORT MODAL */}
      {modal === 'report' && activeAssessment && (
        <Modal title="Export Procurement Compliance Report" close={() => setModal(null)}>
          <div className="notice">
            <b>{activeAssessment.bidder}</b> / {activeAssessment.name}<br />
            {summary.compliancePercentage}% Compliance · Risk Index: {summary.riskScore}/100 ({summary.riskLevel})<br />
            Officer Decision: {activeAssessment.decision?.status || 'In Review'}
          </div>
          <p className="muted">
            The generated report includes all tender clauses, verified numbers, verbatim evidence quotes, document SHA-256 fingerprints, officer overrides, and complete audit history.
          </p>
          <div className="toolbar" style={{ marginTop: 20 }}>
            <button
              className="button primary"
              onClick={() => {
                setModal(null);
                setActiveTab('Report');
                setTimeout(() => window.print(), 300);
              }}
            >
              <Download size={16} /> Print / Save as PDF
            </button>
            <button className="button" onClick={exportJson}>
              Download JSON Package
            </button>
          </div>
        </Modal>
      )}

      {/* PRINTABLE REPORT FORMATTER (FOR @media print) */}
      {activeAssessment && (
        <article className="report">
          <h1>BIDGUARD AI · Bid Compliance & Risk Report</h1>
          <p>
            Assessment ID: {activeAssessment.id} · Tender: {activeAssessment.name}<br />
            Bidder: {activeAssessment.bidder} · Procuring Entity: {activeAssessment.procuringEntity}<br />
            Date of Analysis: {new Date(activeAssessment.lastAnalyzed).toLocaleString()}
          </p>
          <p>
            <b>Compliance:</b> {summary.compliancePercentage}% ({summary.pass} Pass, {summary.fail} Fail, {summary.review} Review) · <b>Risk Index:</b> {summary.riskScore}/100 ({summary.riskLevel})
          </p>
          <h2>Final Officer Decision</h2>
          <p>
            {activeAssessment.decision
              ? `${activeAssessment.decision.status} — ${activeAssessment.decision.actor} (${activeAssessment.decision.time}). Rationale: ${activeAssessment.decision.reason}`
              : 'No final decision committed.'}
          </p>
          <h2>Clause-by-Clause Compliance Matrix</h2>
          {results.map(r => (
            <section key={r.requirement.id}>
              <h3>{r.requirement.id}: {r.requirement.title} — [{r.status}]</h3>
              <p>{r.reason}</p>
              {r.calculation && <small>Calculation: {r.calculation}</small>}
              {r.evidence.map((ev, idx) => (
                <blockquote key={idx}>{ev.document} (p. {ev.page}): “{ev.quote}”</blockquote>
              ))}
              {activeAssessment.reviews[r.requirement.id] && (
                <p>
                  <b>Officer Review:</b> {activeAssessment.reviews[r.requirement.id].status} by {activeAssessment.reviews[r.requirement.id].actor} ({activeAssessment.reviews[r.requirement.id].reason})
                </p>
              )}
            </section>
          ))}
          <h2>Document SHA-256 Provenance</h2>
          {activeAssessment.documents.map(d => (
            <p key={d.id} className="hash">{d.name}: {d.hash || 'Synthetic Fixture'}</p>
          ))}
          <h2>Audit Trail</h2>
          {activeAssessment.audit.map(a => (
            <p key={a.id}>{a.time} · {a.actor} · {a.action}: {a.detail}</p>
          ))}
        </article>
      )}
    </>
  );
}
