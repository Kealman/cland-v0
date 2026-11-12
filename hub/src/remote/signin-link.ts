import {randomUUID} from 'node:crypto';
import type {HubFrame} from '../protocol.ts';
import {allowedSignInLink} from '../host/login-signin-output.ts';
import {redactHubFrame} from './redact.ts';

export type SignInLinkLookup=(id:string)=>{question:string;harness:unknown;url:unknown}|undefined;

/** Run the ordinary boundary first. Only the exact stored card question can
 * retain its parsed URL; every other field and URL keeps its ordinary masking. */
export function redactSignInFrame(frame:HubFrame,redact:(text:string)=>string,lookup:SignInLinkLookup|undefined,containsSecret:((bytes:Uint8Array)=>boolean)|undefined):HubFrame{
 const masked=redactHubFrame(frame,redact);
 if(!lookup||!containsSecret)return masked;
 const question=(id:string,input:unknown):string|undefined=>{
  const stored=lookup(id);
  if(!stored||input!==stored.question||!allowedSignInLink(stored.harness,stored.url))return;
  // Conservatively keep normal masking if any registered bytes occur anywhere
  // in the question, including across a link boundary.
  if(containsSecret(Buffer.from(stored.question)))return;
  const link=stored.url;
  // Replace only a whole URL token, never the prefix of another URL.
  let protectedLink=false;
  const marker='clandsignin'+randomUUID().replaceAll('-','');
  const prepared=stored.question.replace(/https:\/\/[^\s<>"']+/g,value=>{
   if(value!==link)return value;protectedLink=true;return marker;
  });
  if(!protectedLink)return;
  return redact(prepared).replaceAll(marker,link);
 };
 const visit=(raw:unknown,safe:unknown):void=>{
  if(!raw||!safe||typeof raw!=='object'||typeof safe!=='object')return;
  if(Array.isArray(raw)){raw.forEach((value,index)=>visit(value,(safe as unknown[])[index]));return;}
  const before=raw as Record<string,unknown>,after=safe as Record<string,unknown>;
  for(const key of Object.keys(before))visit(before[key],after[key]);
  if(typeof before.id==='string'){
   const q=question(before.id,before.question);if(q!==undefined)after.question=q;
   const text=question(before.id,before.text);if(text!==undefined)after.text=text;
  }
  const cardId=typeof before.ask==='string'?before.ask:typeof before.answerTo==='string'?before.answerTo:before.id;
  if(typeof cardId==='string')for(const key of ['card','ask']){
   const card=before[key],safeCard=after[key];
   if(card&&safeCard&&typeof card==='object'&&typeof safeCard==='object'){
    const q=question(cardId,(card as Record<string,unknown>).question);
    if(q!==undefined)(safeCard as Record<string,unknown>).question=q;
   }
  }
 };
 visit(frame,masked);return masked;
}
