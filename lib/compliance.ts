export type Status = 'Compliant' | 'Non-compliant' | 'Needs review';
export type Requirement = { id: string; title: string; category: string; key: string; minimum?: number; unit: string; kind: 'minimum' | 'portal' | 'manual'; source: string; page: number; weight: number };
export type EvidenceDocument = { id: string; name: string; pages: string[]; role: 'tender' | 'bid'; hash?: string };
export type Evidence = { document: string; page: number; quote: string };
export type Finding = { requirement: Requirement; status: Status; reason: string; values: number[]; evidence: Evidence[]; risk: number };
export const demo: { requirements: Requirement[]; documents: EvidenceDocument[] } = {
 requirements: [
  {id:'REQ-001',title:'Relevant experience ≥ 5 years',category:'Eligibility',key:'experience',minimum:5,unit:'years',kind:'minimum',source:'Tender requirements.txt',page:1,weight:15},
  {id:'REQ-002',title:'Annual turnover ≥ ₹5 crore',category:'Financial',key:'turnover',minimum:5,unit:'crore',kind:'minimum',source:'Tender requirements.txt',page:1,weight:20},
  {id:'REQ-003',title:'Local content ≥ 50%',category:'Technical',key:'local content',minimum:50,unit:'%',kind:'minimum',source:'Tender requirements.txt',page:1,weight:15},
  {id:'REQ-004',title:'GST registration status',category:'Statutory',key:'GST',unit:'',kind:'portal',source:'Tender requirements.txt',page:1,weight:10},
  {id:'REQ-005',title:'PAN verification',category:'Statutory',key:'PAN',unit:'',kind:'portal',source:'Tender requirements.txt',page:1,weight:10},
  {id:'REQ-006',title:'Udyam registration',category:'Statutory',key:'Udyam',unit:'',kind:'portal',source:'Tender requirements.txt',page:1,weight:10},
  {id:'REQ-007',title:'Warranty ≥ 24 months',category:'Technical',key:'warranty',minimum:24,unit:'months',kind:'minimum',source:'Tender requirements.txt',page:1,weight:10},
  {id:'REQ-008',title:'Completed projects ≥ 3',category:'Eligibility',key:'completed projects',minimum:3,unit:'projects',kind:'minimum',source:'Tender requirements.txt',page:1,weight:10}
 ],
 documents:[
 {id:'tender',name:'Tender requirements.txt',role:'tender',pages:['DEMONSTRATION ONLY — Industrial pump supply & commissioning\nMinimum experience: 5 years\nMinimum turnover: 5 crore\nMinimum local content: 50%\nGST registration must be verified.\nPAN must be verified.\nUdyam registration must be verified.\nMinimum warranty: 24 months\nMinimum completed projects: 3 projects']},
 {id:'profile',name:'Company profile.txt',role:'bid',pages:['DEMONSTRATION ONLY — Vayuna Engineering Pvt. Ltd.\nRelevant experience: 7 years\nCompleted projects: 4 projects\nPAN: SAMPLE-PAN (synthetic identifier)']},
 {id:'financial',name:'Financial statement.txt',role:'bid',pages:['DEMONSTRATION ONLY — Financial summary for FY 2025–26\nAnnual turnover: 3.8 crore\nThis synthetic statement is not an audited financial document.']},
 {id:'technical',name:'Technical declaration.txt',role:'bid',pages:['DEMONSTRATION ONLY — Technical offer\nLocal content: 62%\nWarranty: 18 months\nGST: SAMPLE-GST (synthetic identifier)\nUdyam: SAMPLE-UDYAM (synthetic identifier)']}
 ]
};
const escape = (text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Conservative document rules. Document text cannot authorize a final decision.
export function evaluate(requirements: Requirement[], documents: EvidenceDocument[]): Finding[] {
 return requirements.map(requirement=>{
  const evidence: Evidence[]=[]; const values:number[]=[]; let ambiguous=false;
  const keyword = new RegExp('\\b'+escape(requirement.key)+'\\b','i');
  for(const doc of documents.filter(d=>d.role==='bid')) doc.pages.forEach((page,index)=>{
   for(const line of page.split(/\n/).filter(l=>keyword.test(l))) {
    evidence.push({document:doc.name,page:index+1,quote:line.trim()});
    if(requirement.kind==='minimum') {
     const match=line.match(new RegExp(escape(requirement.key)+'\\s*[:=]\\s*(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s*'+escape(requirement.unit)+'\\s*[.;]?\\s*$','i'));
     if(match && !/\b(not|estimated|approximately|proposed|up to)\b/i.test(line)) values.push(Number(match[1])); else ambiguous=true;
    }
   }
  });
  let status:Status='Needs review'; let reason='No matching evidence was found. Request supporting documents.';
  if(requirement.kind==='portal') reason=evidence.length?'Identifier found in submitted text. Live registry verification is not connected; authenticity and status remain unverified.':'Registration evidence is missing. Live registry verification is not connected.';
  else if(requirement.kind==='manual') reason='This clause requires officer interpretation. Automated verification is not supported.';
  else if(values.length && !ambiguous && new Set(values).size===1) { status=values[0]>=requirement.minimum!?'Compliant':'Non-compliant'; reason=`Document states ${values[0]} ${requirement.unit}; tender requires at least ${requirement.minimum} ${requirement.unit}. ${status==='Compliant'?'The numeric threshold is satisfied.':'The numeric threshold is not satisfied.'}`; }
  else if(evidence.length) reason=new Set(values).size>1?'Conflicting values across documents. Resolve the discrepancy before deciding.':'Evidence was found, but the value or unit could not be read unambiguously. Officer review is required.';
  return {requirement,status,reason,values:[...new Set(values)],evidence,risk:status==='Compliant'?0:status==='Non-compliant'?requirement.weight:requirement.weight/2};
 });
}
export function summarize(results:Finding[]) {
 const weight=results.reduce((s,r)=>s+r.requirement.weight,0);
 const risk=weight?Math.round(results.reduce((s,r)=>s+r.risk,0)/weight*100):0;
 return {total:results.length,pass:results.filter(r=>r.status==='Compliant').length,fail:results.filter(r=>r.status==='Non-compliant').length,review:results.filter(r=>r.status==='Needs review').length,risk,level:risk<=20?'Low':risk<=40?'Medium':risk<=60?'High':'Critical'};
}
