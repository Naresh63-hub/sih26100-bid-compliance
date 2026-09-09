from datetime import date
from decimal import Decimal
import re
from app.domain.schemas import RequirementData
from app.infrastructure.providers import KeywordRetriever
D=Decimal

def evaluate(req: RequirementData, chunks: list[dict], as_of: date) -> dict:
    evidence=KeywordRetriever().retrieve(req.rule.key,chunks)
    result={'code':req.code,'requirement':req.model_dump(mode='json'),'status':'NEEDS_REVIEW','reason':'','detail':'UNVERIFIED','evidence':evidence,'facts':[],'calculation':'No safe deterministic conclusion.','confidence':req.confidence,'rule_id':f'{req.code}:{req.rule.type}','recommendation':'Review the exact source and record an officer decision.'}
    def finish(status: str, reason: str, detail: str) -> dict:
        result.update(status=status,reason=reason,detail=detail)
        return result
    if not req.confirmed:return finish('NEEDS_REVIEW','The extracted tender clause requires officer confirmation.','UNCONFIRMED')
    if req.extraction_method=='llm' and (req.confidence is None or req.confidence<0.8):return finish('NEEDS_REVIEW','AI extraction confidence is low or unavailable. Confirm the rule manually.','LOW_CONFIDENCE')
    if not evidence:return finish('NEEDS_REVIEW',f'Required evidence was not located: {req.evidence_required}.','MISSING')
    if req.rule.type in ('manual','registration'):return finish('NEEDS_REVIEW','Evidence exists, but semantic interpretation or authoritative verification is required. No live government API is connected.','EXTERNAL_VERIFICATION' if req.rule.type=='registration' else 'INTERPRETATION')
    rule=req.rule
    facts=[];ambiguous=False
    for e in evidence:
        text=e['text'].strip();value=None;period=None
        key=re.escape(rule.key)
        if rule.type=='average':
            m=re.fullmatch(r'(?:Annual\s+)?'+key+r'\s+(FY\s+\d{4}-\d{2})\s*[:=]\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lakhs|inr|rupees)\s*[.;]?',text,re.I)
            if m: period=re.sub(r'\s+',' ',m.group(1)).upper();value=money(m.group(2),m.group(3))
        elif rule.type=='minimum':
            units=r'(crore|cr|lakh|lakhs|inr|rupees)' if rule.unit=='crore' else '('+re.escape(rule.unit)+')'
            m=re.fullmatch(r'(?:Relevant\s+|Annual\s+)?'+key+r'\s*[:=]\s*₹?\s*(\d+(?:\.\d+)?)\s*'+units+r'\s*[.;]?',text,re.I)
            if m:value=money(m.group(1),m.group(2)) if rule.unit=='crore' else D(m.group(1))
        elif rule.type=='expiry':
            m=re.fullmatch(key+r'\s*[:=]\s*(\d{4}-\d{2}-\d{2})\s*[.;]?',text,re.I)
            if m:
                try:value=date.fromisoformat(m.group(1))
                except ValueError:pass
        elif rule.type=='hybrid':
            m=re.fullmatch(r'Project:\s*government=(true|false);\s*similar=(true|false);\s*value=(\d+(?:\.\d+)?)\s*crore;\s*completed=(\d{4}-\d{2}-\d{2})\s*[.;]?',text,re.I)
            if m:
                try:value={'government':m.group(1).lower()=='true','similar':m.group(2).lower()=='true','value':D(m.group(3)),'completed':date.fromisoformat(m.group(4))}
                except ValueError:pass
        if value is None:ambiguous=True
        else:facts.append({'value':value,'period':period,'source':e})
    result['facts']=[{'value':serialize(f['value']),'period':f['period'],'unit':rule.unit,'chunk_id':f['source']['id'],'document_id':f['source']['document_id'],'page':f['source']['page_number'],'quote':f['source']['text']} for f in facts]
    if ambiguous or not facts:return finish('NEEDS_REVIEW','Matching evidence contains ambiguous values, units, dates or qualifications.','AMBIGUOUS')
    if rule.type=='average':
        amounts=[]
        for year in rule.years:
            values=set(f['value'] for f in facts if f['period']==year)
            if not values:return finish('NEEDS_REVIEW',f'Financial evidence for {year} is missing; a partial average was not used.','MISSING_PERIOD')
            if len(values)>1:return finish('NEEDS_REVIEW',f'Conflicting turnover values for {year}.','CONFLICT')
            amounts.append(next(iter(values)))
        total=sum(amounts,D(0));avg=total/D(len(amounts));required=D(str(rule.minimum))
        result['calculation']=f"({' + '.join(map(str,amounts))}) / {len(amounts)} = {avg.quantize(D('0.000001'))} crore; required >= {required} crore"
        return finish('COMPLIANT' if total>=required*len(amounts) else 'NON_COMPLIANT','All required financial years were used in the deterministic average.','THRESHOLD')
    if rule.type=='hybrid':
        try:cutoff=as_of.replace(year=as_of.year-rule.within_years)
        except ValueError:cutoff=as_of.replace(year=as_of.year-rule.within_years,day=28)
        checks=[v['value']['government'] and v['value']['similar'] and v['value']['value']>=D(str(rule.minimum)) and cutoff<=v['value']['completed']<=as_of for v in facts]
        result['calculation']=f'For the same project: government=true AND similar=true AND value >= {rule.minimum} crore AND {cutoff} <= completion <= {as_of}. Results: {checks}'
        return finish('COMPLIANT' if any(checks) else 'NON_COMPLIANT','All project conditions were evaluated together on each cited project record. Similarity claims require officer authentication.','HYBRID')
    values=set(f['value'] for f in facts)
    if len(values)>1:return finish('NEEDS_REVIEW','Information inconsistency detected: cited documents contain conflicting values.','CONFLICT')
    actual=next(iter(values));required=(rule.required_date or as_of) if rule.type=='expiry' else D(str(rule.minimum))
    result['calculation']=f'{actual} {rule.unit} >= {required} {rule.unit}'
    return finish('COMPLIANT' if actual>=required else 'NON_COMPLIANT','The submitted value satisfies the rule.' if actual>=required else 'The submitted value does not satisfy the rule.','EXPIRY' if rule.type=='expiry' else 'THRESHOLD')

def money(value: str, unit: str) -> Decimal:
    number=D(value)
    return number/D(100) if unit.lower() in ('lakh','lakhs') else number/D(10_000_000) if unit.lower() in ('inr','rupees') else number

def serialize(value):
    if isinstance(value,Decimal):return str(value)
    if isinstance(value,date):return value.isoformat()
    if isinstance(value,dict):return {k:serialize(v) for k,v in value.items()}
    return value
