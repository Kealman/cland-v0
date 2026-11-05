// Failure-only, read-only fixture receipts. Never read launch plans, HOME or environments.
import { linuxBirthBootId } from '../src/host/agent/identity.ts';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { remoteRedactor } from '../src/host/agent/redact.ts';
import type { AgentHello } from '../src/host/agent/protocol.ts';
type Receipt = {status:'present';value:unknown}|{status:'incomplete';reason:string};
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const pick=(value:unknown,keys:readonly string[])=>Object.fromEntries(keys.filter(key=>Object.hasOwn(object(value),key)).map(key=>{const item=object(value)[key];return [key,typeof item==='string'?item.slice(-512):item===null||typeof item==='number'||typeof item==='boolean'?item:'[non-scalar]'];}));
const native=(value:unknown)=>{const targets=object(value).targets;return {...pick(value,['launchId','pid','identity','authority','ended','rootExitObserved','code','signal']),...(Array.isArray(targets)?{targets:targets.slice(0,8).map(v=>pick(v,['pid','identity'])),targetsTotal:targets.length,targetsTruncated:targets.length>8}:{})};};
const admission=(value:unknown)=>({...pick(value,['id','head','notice','started']),native:pick(object(value).native,['pid','identity'])});
const result=(value:unknown)=>pick(value,['code','signal','error','stderr']);
async function read(path:string,json=true):Promise<Receipt>{
 let file;
 try{
  file=await open(path,'r');const limit=json?65536:256,bytes=Buffer.alloc(limit+1),{bytesRead}=await file.read(bytes,0,bytes.length,0);
  if(bytesRead>limit)return {status:'incomplete',reason:json?'over64KiB':'over256B'};
  const text=bytes.subarray(0,bytesRead).toString('utf8');return {status:'present',value:json?JSON.parse(text):text.trim()};
 }catch(error){return {status:'incomplete',reason:(error as NodeJS.ErrnoException).code??(error as Error).name};}
 finally{await file?.close();}
}
const projected=(receipt:Receipt,project:(value:unknown)=>unknown)=>receipt.status==='present'?{status:receipt.status,value:project(receipt.value)}:receipt;
export async function pushRecoveryFacts(options:{runDir:string;path:string;bootFile:string;before:AgentHello;after:AgentHello;captured:{id:string;native:{pid:number;identity:string}};expectedHead:string;observedHead:string|null;secrets?:readonly string[];observe?:(pid:number)=>Promise<string|null>}){
 const redact=remoteRedactor(options.secrets);
 const safeRead=async(path:string,json=true):Promise<Receipt>=>{const value=await read(path,json);return value.status==='present'?{...value,value:redact.value(value.value)}:value;};
 const watches=await safeRead(join(options.runDir,'ref-watches.json'));
 const matching=watches.status==='present'&&Array.isArray(watches.value)?watches.value.filter(v=>object(v).path===options.path):[];
 const captured=redact.value(options.captured);
 const ids=new Set([captured.id]);
 for(const row of matching){if(typeof object(object(row).pending).id==='string')ids.add(object(object(row).pending).id as string);for(const fence of Array.isArray(object(row).fences)?object(row).fences as unknown[]:[]){if(typeof object(fence).id==='string')ids.add(object(fence).id as string);}}
 const producers=[];
 for(const id of [...ids].slice(0,4)){
  if(!/^[a-f0-9-]{36}$/.test(id)){producers.push({id,status:'incomplete',reason:'invalid generation'});continue;}
  producers.push({id,birth:projected(await safeRead(join(options.runDir,'launches',id,'birth.json')),native),closed:projected(await safeRead(join(options.runDir,'launches',id,'closed.json')),native),result:projected(await safeRead(join(options.runDir,'ref-push',id+'.json')),value=>({...pick(value,['launchId','pid','identity','head','complete']),result:result(object(value).result)}))});
 }
 const ledger=await safeRead(join(options.runDir,'processes.json'));
 const relevant=ledger.status==='present'&&Array.isArray(ledger.value)?ledger.value.filter(row=>ids.has(String(object(row).launchId))||object(row).pid===captured.native.pid):[];
 const pids=[...new Set([options.after.pid,captured.native.pid,...relevant.flatMap(row=>[object(row).pid,...(Array.isArray(object(row).targets)?object(row).targets as unknown[]:[]).map(target=>object(target).pid)])])].filter((pid):pid is number=>typeof pid==='number'&&Number.isSafeInteger(pid)&&pid>1).slice(0,8);
 const observe=options.observe;
 const observed=observe?await Promise.all(pids.map(async pid=>{
  try{const identity=await observe(pid);return {pid,status:identity===null?'unknown-or-absent':'present',identity};}
  catch(error){return {pid,status:'incomplete',reason:redact.text((error as Error).message).slice(-512)};}
 })):{status:'unexecuted',reason:'not requested'};
 const observer=Array.isArray(observed)?observed.find(value=>value.pid===options.after.pid):undefined;
 const observerIdentity=object(observer).identity;
 const observerBoot=linuxBirthBootId(typeof observerIdentity==='string'?observerIdentity:null);
 const facts={outcome:'incomplete publication',expectedHead:options.expectedHead,observedHead:options.observedHead,
  helloBefore:pick(redact.value(options.before),['protocol','version','pid','bootId']),helloAfter:pick(redact.value(options.after),['protocol','version','pid','bootId']),
  fakeBoot:await safeRead(options.bootFile,false),kernelBoot:process.platform==='linux'?await safeRead('/proc/sys/kernel/random/boot_id',false):{status:'unexecuted',reason:'non-Linux'},
  rebootRetirement:{status:'not wired',reason:'direct-agent fixture has no hub, Sessions or registry'},
  capturedNativeBootId:linuxBirthBootId(captured.native.identity),
  recoveredObserverBootId:observerBoot?{status:'present',value:observerBoot}:{status:'unknown',reason:'agent native identity unavailable'},
  nativeObservation:observed,
  currentAgent:projected(await safeRead(join(options.runDir,'agent.pid')),native),
  supervisor:{pid:await safeRead(join(options.runDir,'supervisor.lock/pid'),false),birth:await safeRead(join(options.runDir,'supervisor.lock/birth'),false)},
  captured:admission(captured),watches:projected(watches,()=>matching.slice(0,4).map(row=>({...pick(row,['path','branch','head','remote','decision','notice','fencedCause']),pending:admission(object(row).pending),fences:(Array.isArray(object(row).fences)?object(row).fences as unknown[]:[]).slice(0,4).map(admission),result:result(object(row).result)}))),
  ledger:projected(ledger,values=>{if(!Array.isArray(values))return {status:'incomplete',reason:'not an array'};const matching=values.filter(row=>ids.has(String(object(row).launchId))||object(row).pid===captured.native.pid);return {records:matching.slice(0,8).map(native),matchingRecords:matching.length,recordsTruncated:matching.length>8};}),producerGenerationsTotal:ids.size,producerGenerationsCaptured:producers.length,producers};
 return redact.value(facts);
}
