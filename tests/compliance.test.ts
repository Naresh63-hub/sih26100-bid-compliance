import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demo,evaluate,summarize,type EvidenceDocument} from '../lib/compliance.ts';
import {extractRequirements,readDocument} from '../lib/documents.ts';
const doc=(text:string,role:'bid'|'tender'='bid'):EvidenceDocument=>({id:'test',name:'Evidence.txt',role,pages:text.split('\f')});
const experience=demo.requirements[0];
test('sample has traceable failures and honest portal review',()=>{
 const findings=evaluate(demo.requirements,demo.documents);
 assert.deepEqual(summarize(findings),{total:8,pass:3,fail:2,review:3,risk:45,level:'High'});
 assert.equal(findings[1].evidence[0].document,'Financial statement.txt');
 assert.equal(findings[1].values[0],3.8);
 assert.ok(findings.filter(r=>r.requirement.kind==='portal').every(r=>r.status==='Needs review'));
});
test('threshold boundary passes, shortfall fails',()=>{
 assert.equal(evaluate([experience],[doc('Experience: 5 years')])[0].status,'Compliant');
 assert.equal(evaluate([experience],[doc('Experience: 4.99 years')])[0].status,'Non-compliant');
});
test('missing, negative, wrong unit, ambiguous and negated evidence require review',()=>{
 for(const text of ['Nothing supplied','Experience: -7 years','Experience: 7 months','Experience: approximately 7 years','Experience: 7 years not verified','Experience: 7 years\nExperience is disputed']) assert.equal(evaluate([experience],[doc(text)])[0].status,'Needs review',text);
});
test('conflicts never silently choose the favourable value',()=>{
 const result=evaluate([experience],[doc('Experience: 7 years\fExperience: 3 years')])[0];
 assert.equal(result.status,'Needs review');assert.match(result.reason,/Conflicting/);assert.equal(result.evidence[1].page,2);
});
test('tender requirements are never bidder evidence',()=>{
 assert.equal(evaluate([experience],[doc('Experience: 7 years','tender')])[0].status,'Needs review');
});
test('percentage and decimal units are preserved',()=>{
 assert.equal(evaluate([demo.requirements[2]],[doc('Local content: 50%')])[0].status,'Compliant');
 assert.equal(evaluate([demo.requirements[1]],[doc('Turnover: 3.8 crore')])[0].status,'Non-compliant');
});
test('extractor only automates explicit supported clauses and preserves page',()=>{
 const rules=extractRequirements(doc('Minimum experience: 5 years\fBidder must supply insurance.\nGST must be verified.\nMinimum turnover: 5 crore','tender'));
 assert.equal(rules.length,4);assert.equal(rules[0].minimum,5);assert.equal(rules[1].kind,'manual');assert.equal(rules[2].kind,'portal');assert.equal(rules[3].page,2);
});
test('compound clauses are manual, avoiding partial automatic qualification',()=>{
 const rules=extractRequirements(doc('Minimum experience: 5 years and 2 government contracts','tender'));
 assert.equal(rules[0].kind,'manual');
});
test('empty assessment is stable',()=>assert.deepEqual(summarize([]),{total:0,pass:0,fail:0,review:0,risk:0,level:'Low'}));
test('numeric qualifications cannot be ignored',()=>{
 assert.equal(evaluate([experience],[doc('Experience: 7 years, disputed by certificate: 3 years')])[0].status,'Needs review');
});
test('text import preserves pages and fingerprints',async()=>{
 const file=new File(['Experience: 7 years\fTurnover: 3.8 crore'],'bid.txt');
 const parsed=await readDocument(file,'bid');assert.equal(parsed.pages.length,2);assert.match(parsed.hash!,/^[a-f0-9]{64}$/);assert.equal(parsed.role,'bid');
 assert.equal((await readDocument(file,'bid')).hash,parsed.hash);
});
test('unsupported and empty uploads fail intentionally',async()=>{
 await assert.rejects(readDocument(new File(['text'],'bid.exe'),'bid'),/PDF or/);
 await assert.rejects(readDocument(new File(['   '],'bid.txt'),'bid'),/No readable text/);
});
