from dataclasses import dataclass
import secrets
from fastapi import Header, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.shared.config import settings
from app.infrastructure.database import SessionLocal, Organization

@dataclass
class Principal:
    user_id: str
    role: str

def session():
    with SessionLocal() as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

def principal(authorization: str = Header(default=''), x_bidguard_user: str = Header(default=''), x_bidguard_role: str = Header(default='PROCUREMENT_OFFICER')) -> Principal:
    supplied=authorization.removeprefix('Bearer ')
    if not settings.api_key or not secrets.compare_digest(supplied,settings.api_key):raise HTTPException(401,'A trusted application session is required.')
    if not x_bidguard_user or len(x_bidguard_user)>240:raise HTTPException(401,'Authenticated user identity is required.')
    if x_bidguard_role not in ('ADMIN','PROCUREMENT_OFFICER','REVIEWER'):raise HTTPException(403,'Unrecognized role.')
    return Principal(x_bidguard_user,x_bidguard_role)

def organization(db: Session, user: Principal) -> Organization:
    org=db.scalar(select(Organization).where(Organization.owner_id==user.user_id))
    if not org:org=Organization(owner_id=user.user_id);db.add(org);db.flush()
    return org

def can_edit(user: Principal):
    if user.role not in ('ADMIN','PROCUREMENT_OFFICER'):raise HTTPException(403,'Only a procurement officer or administrator can change evidence or tender rules.')
