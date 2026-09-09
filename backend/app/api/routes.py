from datetime import date
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, Depends, File, UploadFile, Form, Header, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import session,principal,organization,can_edit,Principal
from app.infrastructure.database import Assessment,Bid,Document,Requirement,ComplianceResult,Review,Chunk,Page,now
from app.application.assessments import scoped,bid_scoped,assessment_view,upload_document,extract_requirements,analyze,log,touch,invalidate
from app.domain.schemas import AssessmentCreate,BidCreate,ExtractRequest,RequirementEdit,AnalyzeRequest,ReviewCreate,DecisionCreate
from app.infrastructure.reports import report_pdf
from app.infrastructure.sample_documents import ROOT,SAMPLES,generate_samples
from app.infrastructure.storage import get_storage_service, TENDER_BUCKET, BIDDER_BUCKET, REPORTS_BUCKET
from app.infrastructure.database import uid
from app.shared.config import settings
router=APIRouter(prefix='/api/v1')
DB=Annotated[Session,Depends(session)]
USER=Annotated[Principal,Depends(principal)]
def check_version(a: Assessment, revision: str | None):
    if revision is None:raise HTTPException(428,'Assessment revision is required.')
    if revision.strip('"')!=str(a.revision):raise HTTPException(409,'This assessment changed in another window. Refresh before applying your action.')
def view(db,a):
    db.flush()
    return assessment_view(db,a)
@router.get('/settings')
def config(user:USER):return {'user':user.user_id,'role':user.role,'ai_configured':bool(settings.llm_url and settings.llm_api_key),'extractor':'Structured rule-based fallback','ocr':'Adapter available; OCR not enabled','database':'PostgreSQL' if settings.database_url.startswith('postgres') else 'SQLite local development','document_formats':['PDF','TXT'],'max_upload_mb':10,'max_pages':100}
@router.get('/assessments')
def list_assessments(db:DB,user:USER):
    org=organization(db,user)
    return [view(db,a) for a in db.scalars(select(Assessment).where(Assessment.organization_id==org.id).order_by(Assessment.updated_at.desc()))]
@router.post('/assessments',status_code=201)
def create_assessment(data:AssessmentCreate,db:DB,user:USER):
    can_edit(user);org=organization(db,user)
    a=Assessment(organization_id=org.id,title=data.title,reference=data.reference,procuring_entity=data.procuring_entity,deadline=data.deadline.isoformat(),assessment_date=date.today().isoformat())
    db.add(a);db.flush();log(db,a,user.user_id,'ASSESSMENT_CREATED',a.id,'Assessment created.');return view(db,a)
@router.post('/assessments/sample',status_code=201)
async def sample_assessment(db:DB,user:USER):
    can_edit(user);org=organization(db,user)
    a=Assessment(organization_id=org.id,title='Industrial Pump Supply & Commissioning',reference='BG-2026-014',procuring_entity='South Coast Process Utilities (fictional PSU)',deadline='2026-09-30',assessment_date='2026-09-09',sample=True)
    db.add(a);db.flush();log(db,a,user.user_id,'ASSESSMENT_CREATED',a.id,'Explicit fictional SIH demo seeded through the actual document pipeline.')
    bid=Bid(assessment_id=a.id,name='Vayuna Engineering Pvt. Ltd.');db.add(bid);db.flush()
    if not (ROOT/'data/sample_tenders/industrial-pump-tender.pdf').exists():generate_samples()
    for name in SAMPLES:
        path=ROOT/'data'/name;role='tender' if 'sample_tenders' in name else 'bid'
        doc=upload_document(db,a,user.user_id,path.name,path.read_bytes(),role,bid.id if role=='bid' else None)
        if role=='tender':await extract_requirements(db,a,doc.id,'rules',user.user_id)
    for r in db.scalars(select(Requirement).where(Requirement.assessment_id==a.id,Requirement.active.is_(True))):r.data={**r.data,'confirmed':True}
    db.flush();log(db,a,'Fictional demo setup','REQUIREMENTS_CONFIRMED',a.id,'Demo clauses confirmed for the fictional example. Real tenders require officer confirmation.')
    analyze(db,a,bid.id,user.user_id);return view(db,a)
@router.get('/assessments/{assessment_id}')
def get_assessment(assessment_id:str,db:DB,user:USER):return view(db,scoped(db,assessment_id,organization(db,user).id))
@router.post('/assessments/{assessment_id}/bids',status_code=201)
def add_bid(assessment_id:str,data:BidCreate,db:DB,user:USER,if_match: str | None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match)
    bid=Bid(assessment_id=a.id,name=data.name);db.add(bid);db.flush();touch(a);log(db,a,user.user_id,'BIDDER_ADDED',bid.id,'Bidder added.',new={'name':data.name});return view(db,a)
@router.post('/assessments/{assessment_id}/documents',status_code=201)
async def upload(assessment_id:str,db:DB,user:USER,file:UploadFile=File(...),role:str=Form(...),bid_id:str|None=Form(default=None),if_match:str|None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match)
    content=await file.read(settings.max_file_bytes+1)
    upload_document(db,a,user.user_id,file.filename or 'unknown',content,role,bid_id)
    return view(db,a)
@router.post('/assessments/{assessment_id}/extract')
async def extract(assessment_id:str,data:ExtractRequest,db:DB,user:USER,if_match:str|None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match)
    await extract_requirements(db,a,data.document_id,data.provider,user.user_id);return view(db,a)
@router.post('/assessments/{assessment_id}/confirm')
def confirm(assessment_id:str,db:DB,user:USER,if_match:str|None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match)
    reqs=list(db.scalars(select(Requirement).where(Requirement.assessment_id==a.id,Requirement.active.is_(True))))
    if not reqs:raise ValueError('Extract the tender requirements first.')
    for req in reqs:req.data={**req.data,'confirmed':True}
    invalidate(db,a);log(db,a,user.user_id,'REQUIREMENTS_CONFIRMED',a.id,'Officer confirmed the extracted clauses against their source pages.',new={'count':len(reqs)});return view(db,a)
@router.put('/assessments/{assessment_id}/requirements/{requirement_id}')
def edit_requirement(assessment_id:str,requirement_id:str,data:RequirementEdit,db:DB,user:USER,if_match:str|None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match)
    req=db.scalar(select(Requirement).where(Requirement.id==requirement_id,Requirement.assessment_id==a.id,Requirement.active.is_(True)))
    if not req:raise HTTPException(404,'Requirement not found.')
    ch=db.scalar(select(Chunk).join(Document,Chunk.document_id==Document.id).where(Chunk.id==data.data.source_chunk,Document.assessment_id==a.id,Document.role=='tender'))
    if not ch or ch.text!=data.data.source_quote or ch.document_id!=data.data.source_document or ch.page_number!=data.data.source_page:raise ValueError('Source citation must match an exact tender chunk.')
    before=req.data;req.data={**data.data.model_dump(mode='json'),'confirmed':True,'extraction_method':'officer'};req.source_chunk_id=ch.id;req.source_document_id=ch.document_id
    invalidate(db,a);log(db,a,user.user_id,'REQUIREMENT_EDITED',req.id,data.reason,previous=before,new=req.data);return view(db,a)
@router.post('/assessments/{assessment_id}/analyze')
def run_analysis(assessment_id:str,data:AnalyzeRequest,db:DB,user:USER,if_match:str|None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match);analyze(db,a,data.bid_id,user.user_id);return view(db,a)
@router.post('/assessments/{assessment_id}/results/{result_id}/review')
def review_result(assessment_id:str,result_id:str,data:ReviewCreate,db:DB,user:USER,if_match:str|None=Header(default=None)):
    a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match)
    r=db.scalar(select(ComplianceResult).where(ComplianceResult.id==result_id,ComplianceResult.assessment_id==a.id,ComplianceResult.active.is_(True)))
    if not r or not bid_scoped(db,a,r.bid_id).analyzed:raise HTTPException(409,'This result is stale. Run the assessment before reviewing.')
    previous=db.scalar(select(Review).where(Review.result_id==r.id).order_by(Review.timestamp.desc()))
    old=previous.new_status if previous else r.data['status']
    db.add(Review(result_id=r.id,reviewer_id=user.user_id,original_status=old,new_status=data.status,note=data.note));bid_scoped(db,a,r.bid_id).decision=None;touch(a)
    log(db,a,user.user_id,'FINDING_REVIEWED' if data.status==old else 'RESULT_OVERRIDDEN',r.id,data.note,previous={'status':old},new={'status':data.status,'original_result':r.data['status']});return view(db,a)
@router.post('/assessments/{assessment_id}/bids/{bid_id}/decision')
def final_decision(assessment_id:str,bid_id:str,data:DecisionCreate,db:DB,user:USER,if_match:str|None=Header(default=None)):
    can_edit(user);a=scoped(db,assessment_id,organization(db,user).id);check_version(a,if_match);bid=bid_scoped(db,a,bid_id)
    if not bid.analyzed:raise ValueError('Run the assessment before recording a final decision.')
    before=bid.decision;bid.decision={'decision':data.decision,'note':data.note,'reviewer':user.user_id,'timestamp':now()};touch(a);log(db,a,user.user_id,'OFFICER_DECISION',bid.id,data.note,previous=before,new=bid.decision);return view(db,a)
@router.get('/assessments/{assessment_id}/documents/{document_id}')
def document_text(assessment_id:str,document_id:str,db:DB,user:USER):
    a=scoped(db,assessment_id,organization(db,user).id);doc=db.scalar(select(Document).where(Document.id==document_id,Document.assessment_id==a.id))
    if not doc:raise HTTPException(404,'Document not found.')
    pages=list(db.scalars(select(Page).where(Page.document_id==doc.id).order_by(Page.number)))
    return {'id':doc.id,'name':doc.name,'sha256':doc.sha256,'pages':[{'number':p.number,'text':p.text} for p in pages]}
@router.get('/assessments/{assessment_id}/documents/{document_id}/download')
def download_document(assessment_id:str,document_id:str,db:DB,user:USER):
    a=scoped(db,assessment_id,organization(db,user).id);doc=db.scalar(select(Document).where(Document.id==document_id,Document.assessment_id==a.id))
    if not doc:raise HTTPException(404,'Document not found.')
    bucket = TENDER_BUCKET if doc.role == 'tender' else BIDDER_BUCKET
    try:
        content = get_storage_service().download_file(bucket, doc.stored_name)
    except FileNotFoundError:
        raise HTTPException(404,'Stored document unavailable.')
    return Response(content,media_type=doc.file_type,headers={'Content-Disposition':f'attachment; filename="{doc.name}"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
@router.get('/assessments/{assessment_id}/report')
def report(assessment_id:str,bid_id:str,db:DB,user:USER):
    a=scoped(db,assessment_id,organization(db,user).id);bid=bid_scoped(db,a,bid_id)
    if not bid.analyzed:raise HTTPException(409,'Run the assessment before exporting a report.')
    log(db,a,user.user_id,'REPORT_GENERATED',bid.id,'Evidence-grounded PDF report generated.');db.flush();dto=view(db,a);selected=next(b for b in dto['bids'] if b['id']==bid_id)
    pdf_bytes = report_pdf(dto,selected)
    report_id = uid()
    report_path = f"{a.id}/{report_id}.pdf"
    get_storage_service().upload_file(REPORTS_BUCKET, report_path, pdf_bytes, 'application/pdf')
    return Response(pdf_bytes,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="BIDGUARD-{a.id[:8]}.pdf"','Cache-Control':'private, no-store','X-Storage-Path':f'{REPORTS_BUCKET}/{report_path}'})
