from datetime import date
from pathlib import Path
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.infrastructure.database import Organization, Assessment, Bid, Document, Page, Chunk, Requirement, ComplianceResult, EvidenceLink, Review, AuditLog, uid, now
from app.infrastructure.documents import parse_document, split_chunks
from app.infrastructure.providers import RuleBasedProvider, HttpLLMProvider
from app.domain.schemas import RequirementData
from app.domain.compliance import evaluate
from app.domain.risk import risk_assessment, name_anomalies
from app.infrastructure.storage import get_storage_service, TENDER_BUCKET, BIDDER_BUCKET, REPORTS_BUCKET
from app.shared.config import settings

def scoped(db: Session, assessment_id: str, organization_id: str) -> Assessment:
    obj=db.scalar(select(Assessment).where(Assessment.id==assessment_id,Assessment.organization_id==organization_id))
    if not obj:raise HTTPException(404,'Assessment not found.')
    return obj

def bid_scoped(db: Session, assessment: Assessment, bid_id: str) -> Bid:
    bid=db.scalar(select(Bid).where(Bid.id==bid_id,Bid.assessment_id==assessment.id))
    if not bid:raise HTTPException(404,'Bidder not found in this assessment.')
    return bid

def log(db: Session, assessment: Assessment, actor: str, action: str, entity_id: str, reason: str, previous: dict | None = None, new: dict | None = None):
    db.add(AuditLog(assessment_id=assessment.id,actor=actor,action=action,entity_id=entity_id,reason=reason,previous_state=previous,new_state=new))

def touch(assessment: Assessment):
    assessment.updated_at=now()

def invalidate(db: Session, assessment: Assessment, bid_id: str | None = None):
    for bid in db.scalars(select(Bid).where(Bid.assessment_id==assessment.id)):
        if bid_id is None or bid.id==bid_id:bid.analyzed=False;bid.decision=None
    touch(assessment)

def chunks_for(db: Session, assessment: Assessment, bid_id: str | None = None, document_id: str | None = None) -> list[dict]:
    query=select(Chunk,Document).join(Document,Chunk.document_id==Document.id).where(Document.assessment_id==assessment.id)
    if bid_id is not None:query=query.where(Document.bid_id==bid_id,Document.role=='bid')
    if document_id is not None:query=query.where(Document.id==document_id)
    rows=db.execute(query.order_by(Document.name,Chunk.page_number,Chunk.line_number)).all()
    return [{'id':c.id,'document_id':d.id,'document_name':d.name,'page_number':c.page_number,'line_number':c.line_number,'start':c.start,'end':c.end,'text':c.text} for c,d in rows]

def upload_document(db: Session, assessment: Assessment, actor: str, filename: str, content: bytes, role: str, bid_id: str | None = None) -> Document:
    if role not in ('tender','bid'):raise ValueError('Invalid document role.')
    if role=='bid':bid_scoped(db,assessment,bid_id)
    else:bid_id=None
    if len(list(db.scalars(select(Document.id).where(Document.assessment_id==assessment.id))))>=30:raise ValueError('This assessment supports up to 30 documents.')
    parsed=parse_document(filename,content)
    if db.scalar(select(Document.id).where(Document.assessment_id==assessment.id,Document.bid_id==bid_id,Document.sha256==parsed.sha256)):
        raise ValueError('This exact document is already uploaded for this tender or bidder.')
    document_id=uid();ext = '.pdf' if parsed.mime=='application/pdf' else '.txt'
    if role == 'tender':
        bucket = TENDER_BUCKET
        rel_path = f"{assessment.id}/{document_id}{ext}"
    else:
        bucket = BIDDER_BUCKET
        rel_path = f"{bid_id}/{document_id}{ext}"
    
    storage_path = get_storage_service().upload_file(bucket, rel_path, content, parsed.mime)
    doc=Document(id=document_id,assessment_id=assessment.id,bid_id=bid_id,name=Path(filename.replace('\\','/')).name[:240],role=role,file_type=parsed.mime,stored_name=rel_path,storage_path=storage_path,sha256=parsed.sha256,page_count=len(parsed.pages),warnings=parsed.warnings)
    db.add(doc);db.flush()
    page_ids={}
    for number,text in enumerate(parsed.pages,1):
        page=Page(document_id=doc.id,number=number,text=text);db.add(page);db.flush();page_ids[number]=page.id
    for c in split_chunks(doc.id,parsed.pages):db.add(Chunk(page_id=page_ids[c['page_number']],**c))
    db.flush()
    invalidate(db,assessment,bid_id) if role=='bid' else touch(assessment)
    log(db,assessment,actor,'DOCUMENT_UPLOADED',doc.id,'Document parsed with page and chunk provenance.',new={'name':doc.name,'role':role,'bid_id':bid_id,'pages':doc.page_count,'sha256':doc.sha256,'warnings':parsed.warnings})
    return doc

async def extract_requirements(db: Session, assessment: Assessment, document_id: str, provider: str, actor: str):
    doc=db.scalar(select(Document).where(Document.id==document_id,Document.assessment_id==assessment.id,Document.role=='tender'))
    if not doc:raise HTTPException(404,'Tender document not found.')
    candidates=await (HttpLLMProvider() if provider=='llm' else RuleBasedProvider()).requirements(chunks_for(db,assessment,document_id=document_id))
    if not candidates:raise ValueError('No candidate clauses detected. Use explicit requirements or the downloadable sample tender. Unsupported clauses need manual review.')
    if len(candidates)>100:raise ValueError('The MVP supports up to 100 requirements per assessment.')
    db.execute(update(Requirement).where(Requirement.assessment_id==assessment.id,Requirement.active.is_(True)).values(active=False))
    for req in candidates:db.add(Requirement(assessment_id=assessment.id,source_document_id=doc.id,source_chunk_id=req.source_chunk,data=req.model_dump(mode='json')))
    invalidate(db,assessment)
    log(db,assessment,actor,'REQUIREMENTS_EXTRACTED',doc.id,'Candidate clauses require officer review; previous rules retained as history.',new={'count':len(candidates),'provider':provider})


def analyze(db: Session, assessment: Assessment, bid_id: str, actor: str):
    bid=bid_scoped(db,assessment,bid_id)
    requirements=list(db.scalars(select(Requirement).where(Requirement.assessment_id==assessment.id,Requirement.active.is_(True))))
    if not requirements:raise ValueError('Extract and review tender requirements first.')
    if any(not r.data['confirmed'] for r in requirements):raise ValueError('Confirm all extracted requirements before running the assessment.')
    evidence=chunks_for(db,assessment,bid_id=bid_id)
    if not evidence:raise ValueError('Upload bidder documents before running the assessment.')
    log(db,assessment,actor,'ANALYSIS_STARTED',bid_id,'Deterministic assessment started.')
    db.execute(update(ComplianceResult).where(ComplianceResult.bid_id==bid_id,ComplianceResult.active.is_(True)).values(active=False))
    results=[]
    for requirement in requirements:
        result=evaluate(RequirementData.model_validate(requirement.data),evidence,date.fromisoformat(assessment.assessment_date))
        result['requirement_id']=requirement.id
        record=ComplianceResult(assessment_id=assessment.id,bid_id=bid_id,requirement_id=requirement.id,data=result)
        db.add(record);db.flush()
        for chunk in result['evidence']:db.add(EvidenceLink(result_id=record.id,requirement_id=requirement.id,document_id=chunk['document_id'],chunk_id=chunk['id']))
        results.append(result)
    bid.analyzed=True;bid.decision=None;touch(assessment)
    risk=risk_assessment(results,name_anomalies(evidence))
    log(db,assessment,actor,'ANALYSIS_COMPLETED',bid_id,'Facts, source evidence, rule evaluations and explainable risk saved.',new={'counts':risk['counts'],'risk':risk['score'],'requirements':len(results)})


def assessment_view(db: Session, assessment: Assessment) -> dict:
    requirements=list(db.scalars(select(Requirement).where(Requirement.assessment_id==assessment.id,Requirement.active.is_(True))))
    documents=list(db.scalars(select(Document).where(Document.assessment_id==assessment.id)))
    bids=[]
    for bid in db.scalars(select(Bid).where(Bid.assessment_id==assessment.id)):
        results=[]
        if bid.analyzed:
            for r in db.scalars(select(ComplianceResult).where(ComplianceResult.bid_id==bid.id,ComplianceResult.active.is_(True))):
                reviews=list(db.scalars(select(Review).where(Review.result_id==r.id).order_by(Review.timestamp)))
                results.append({**r.data,'id':r.id,'reviews':[{'id':v.id,'reviewer':v.reviewer_id,'timestamp':v.timestamp,'original_status':v.original_status,'new_status':v.new_status,'note':v.note} for v in reviews]})
        results.sort(key=lambda r:r['code'])
        anomalies=name_anomalies(chunks_for(db,assessment,bid_id=bid.id)) if bid.analyzed else []
        bids.append({'id':bid.id,'name':bid.name,'analyzed':bid.analyzed,'decision':bid.decision,'results':results,'risk':risk_assessment(results,anomalies),'anomalies':anomalies})
    events=list(db.scalars(select(AuditLog).where(AuditLog.assessment_id==assessment.id).order_by(AuditLog.timestamp)))
    return {'id':assessment.id,'title':assessment.title,'reference':assessment.reference,'procuring_entity':assessment.procuring_entity,'deadline':assessment.deadline,'assessment_date':assessment.assessment_date,'sample':assessment.sample,'revision':assessment.revision,'updated_at':assessment.updated_at,'requirements':[{'id':r.id,**r.data} for r in requirements],'documents':[{'id':d.id,'name':d.name,'role':d.role,'bid_id':d.bid_id,'page_count':d.page_count,'sha256':d.sha256,'warnings':d.warnings} for d in documents],'bids':bids,'audit':[{'id':e.id,'actor':e.actor,'timestamp':e.timestamp,'action':e.action,'entity_id':e.entity_id,'reason':e.reason,'previous_state':e.previous_state,'new_state':e.new_state} for e in events]}
