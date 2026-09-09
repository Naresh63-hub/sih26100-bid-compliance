import { demo, type Requirement, type EvidenceDocument, type Status } from './compliance';
export type Audit = {id:string;time:string;actor:string;action:string;detail:string};
export type Review = {status:Status;reason:string;actor:string;time:string};
export type Workspace = {version:1;name:string;bidder:string;sample:boolean;requirements:Requirement[];documents:EvidenceDocument[];reviews:Record<string,Review>;audit:Audit[];decision?:{status:string;reason:string;actor:string;time:string}};
export function initialWorkspace():Workspace {return {version:1,name:'Industrial pump supply & commissioning',bidder:'Vayuna Engineering Pvt. Ltd.',sample:true,requirements:demo.requirements,documents:demo.documents,reviews:{},audit:[{id:'demo',time:'2026-09-09T07:00:00.000Z',actor:'Demo setup',action:'Sample assessment prepared',detail:'8 tender requirements and 3 synthetic bidder documents loaded. No registry verification performed.'}]};}
export function addAudit(state:Workspace,actor:string,action:string,detail:string):Workspace {return {...state,audit:[...state.audit,{id:crypto.randomUUID(),time:new Date().toISOString(),actor,action,detail}]};}
export function invalidate(state:Workspace):Workspace{return {...state,reviews:{},decision:undefined};}
