from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import create_engine, String, Text, ForeignKey, Integer, Boolean, JSON, UniqueConstraint, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from app.shared.config import settings

def uid() -> str:
    return str(uuid4())
def now() -> str:
    return datetime.now(timezone.utc).isoformat()

class Base(DeclarativeBase):
    pass
class Organization(Base):
    __tablename__ = 'organizations'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(String(240), unique=True)
    name: Mapped[str] = mapped_column(String(240), default='Procurement workspace')
class Assessment(Base):
    __tablename__ = 'assessments'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey('organizations.id'), index=True)
    title: Mapped[str] = mapped_column(String(240))
    reference: Mapped[str] = mapped_column(String(80))
    procuring_entity: Mapped[str] = mapped_column(String(240))
    deadline: Mapped[str] = mapped_column(String(10))
    assessment_date: Mapped[str] = mapped_column(String(10))
    sample: Mapped[bool] = mapped_column(Boolean, default=False)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    __mapper_args__ = {'version_id_col': revision}
class Bid(Base):
    __tablename__ = 'bids'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id'), index=True)
    name: Mapped[str] = mapped_column(String(240))
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    analyzed: Mapped[bool] = mapped_column(Boolean, default=False)
    decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)
class Document(Base):
    __tablename__ = 'documents'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id'), index=True)
    bid_id: Mapped[str | None] = mapped_column(ForeignKey('bids.id'), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(240))
    role: Mapped[str] = mapped_column(String(20))
    file_type: Mapped[str] = mapped_column(String(60))
    stored_name: Mapped[str] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(300), default='')
    sha256: Mapped[str] = mapped_column(String(64))
    page_count: Mapped[int] = mapped_column(Integer)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
class Page(Base):
    __tablename__ = 'pages'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    document_id: Mapped[str] = mapped_column(ForeignKey('documents.id'), index=True)
    number: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    __table_args__ = (UniqueConstraint('document_id', 'number'),)
class Chunk(Base):
    __tablename__ = 'chunks'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    document_id: Mapped[str] = mapped_column(ForeignKey('documents.id'), index=True)
    page_id: Mapped[str] = mapped_column(ForeignKey('pages.id'), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    line_number: Mapped[int] = mapped_column(Integer)
    start: Mapped[int] = mapped_column(Integer)
    end: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
class Requirement(Base):
    __tablename__ = 'requirements'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id'), index=True)
    source_document_id: Mapped[str] = mapped_column(ForeignKey('documents.id'))
    source_chunk_id: Mapped[str] = mapped_column(ForeignKey('chunks.id'))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    data: Mapped[dict] = mapped_column(JSON)
class ComplianceResult(Base):
    __tablename__ = 'compliance_results'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id'), index=True)
    bid_id: Mapped[str] = mapped_column(ForeignKey('bids.id'), index=True)
    requirement_id: Mapped[str] = mapped_column(ForeignKey('requirements.id'), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    data: Mapped[dict] = mapped_column(JSON)
class EvidenceLink(Base):
    __tablename__ = 'evidence_links'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    result_id: Mapped[str] = mapped_column(ForeignKey('compliance_results.id'), index=True)
    requirement_id: Mapped[str] = mapped_column(ForeignKey('requirements.id'))
    document_id: Mapped[str] = mapped_column(ForeignKey('documents.id'))
    chunk_id: Mapped[str] = mapped_column(ForeignKey('chunks.id'))
class Review(Base):
    __tablename__ = 'reviews'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    result_id: Mapped[str] = mapped_column(ForeignKey('compliance_results.id'), index=True)
    reviewer_id: Mapped[str] = mapped_column(String(240))
    timestamp: Mapped[str] = mapped_column(String(40), default=now)
    original_status: Mapped[str] = mapped_column(String(30))
    new_status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(Text)
class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id'), index=True)
    actor: Mapped[str] = mapped_column(String(240))
    timestamp: Mapped[str] = mapped_column(String(40), default=now)
    action: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(120))
    reason: Mapped[str] = mapped_column(Text)
    previous_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)

db_url = settings.database_url
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg://', 1)

engine = create_engine(db_url, connect_args={'check_same_thread': False} if db_url.startswith('sqlite') else {}, pool_pre_ping=True)
if settings.database_url.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
SessionLocal = sessionmaker(engine, expire_on_commit=False)
