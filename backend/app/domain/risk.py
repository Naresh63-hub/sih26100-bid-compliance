import re

def name_anomalies(chunks: list[dict]) -> list[dict]:
    names={}
    for c in chunks:
        m=re.fullmatch(r'Company name:\s*(.+)',c['text'].strip(),re.I)
        if m:names.setdefault(' '.join(m.group(1).lower().split()),[]).append(c)
    if len(names)>1:return [{'kind':'COMPANY_NAME_CONFLICT','reason':'Different company names appear in the submitted documents. Confirm the legal entity; this is not a fraud finding.','evidence':[c for group in names.values() for c in group]}]
    return []

def risk_assessment(results: list[dict], anomalies: list[dict]) -> dict:
    total=sum(r['requirement']['weight'] for r in results)
    factors=[];verified=0
    dimensions={k:0.0 for k in ['Compliance','Evidence','Financial','Document','Anomaly']}
    for r in results:
        weight=r['requirement']['weight']
        if r['status']=='COMPLIANT':verified+=weight;continue
        multiplier=1 if r['status']=='NON_COMPLIANT' or r['detail']=='MISSING' else 0.5
        points=round(weight*multiplier/total*100,2) if total else 0
        dimension='Anomaly' if r['detail']=='CONFLICT' else 'Document' if r['detail']=='EXPIRY' else 'Evidence' if r['status']=='NEEDS_REVIEW' else 'Financial' if r['requirement']['category']=='FINANCIAL' else 'Compliance'
        dimensions[dimension]+=points
        factors.append({'requirement_id':r['requirement_id'],'code':r['code'],'reason':r['reason'],'points':points,'dimension':dimension})
    for anomaly in anomalies:
        dimensions['Anomaly']+=10
        factors.append({'requirement_id':None,'code':'Cross-document check','reason':anomaly['reason'],'points':10,'dimension':'Anomaly'})
    risk=min(100,round(sum(f['points'] for f in factors))) if total else None
    counts={s:sum(r['status']==s for r in results) for s in ['COMPLIANT','NON_COMPLIANT','NEEDS_REVIEW']}
    return {'score':risk,'level':'Not analyzed' if risk is None else 'LOW' if risk<=20 else 'MEDIUM' if risk<=40 else 'HIGH' if risk<=60 else 'CRITICAL','compliance':round(verified/total*100) if total else None,'counts':counts,'factors':factors,'dimensions':{k:round(v,2) for k,v in dimensions.items()},'missing':[{'requirement_id':r['requirement_id'],'document':r['requirement']['evidence_required'],'code':r['code']} for r in results if r['detail'] in ('MISSING','MISSING_PERIOD')],'conflicts':sum(r['detail']=='CONFLICT' for r in results)+len(anomalies),'evidence_found':sum(bool(r['evidence']) for r in results),'total':len(results),'method':'Pass: 0; failed or absent evidence: full weight; unresolved evidence: half weight. Normalize by total weight, add 10 points per company-name anomaly, cap at 100. Compliance uses passed weight only; officer overrides do not rewrite the automated score.'}
