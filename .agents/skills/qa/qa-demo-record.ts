// Called by qa-record.sh: execute the headless case and bring its captures back before the lease ends.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { assertPublishable, validateDemoResult } from './qa-demo-policy.ts';

const exec = promisify(execFile);
if (process.argv[2] === '--help') {
  console.log('qa-demo-record.ts <cland> <epic> <case> <destination>\nQA_EXPECTED_FACTS: optional local JSON array of required result.facts keys.\nMissing/null facts, recorded step errors or nonzero PASS exits become BLOCKED (2).\nCaptures and diagnostics are secret-scanned before copying; unsafe output is withheld.');
  process.exit(0);
}
const [cland, epic, caseId, destination] = process.argv.slice(2);
if (!cland || !epic || !caseId || !destination) throw new Error('demo recorder needs cland, epic, case and destination');
// The envelope keeps binary/text evidence out of the terminal and contains no host credentials.
const remote = String.raw`
const fs=require('fs'), cp=require('child_process'), path=require('path');
const id=process.argv[1], out=fs.mkdtempSync(path.join(require('os').tmpdir(),'cland-demo-case-'));
let stdout='',stderr='',code=0,result,captures=[],error;
try {
 const r=cp.spawnSync('cland',['--headless','--qa','qa/cases/'+id+'.lua','--out',out],{encoding:'utf8',maxBuffer:8*1024*1024});
 stdout=r.stdout||'';stderr=r.stderr||'';code=r.status===null?2:r.status;
 if(r.error) throw r.error;
 if(r.signal) throw new Error('headless case terminated by '+r.signal);
 result=JSON.parse(stdout.trim().split('\n').at(-1));
 if(!result || !['PASS','FAIL','INCONCLUSIVE','BLOCKED'].includes(result.result) || !Array.isArray(result.evidence)) throw new Error('invalid headless case result');
 // Native Lua cases can save structured facts without changing the headless wire shape.
 const factFile=path.join(out,id+'.facts.json');
 if(fs.existsSync(factFile)) {
  const full=fs.realpathSync(factFile);
  if(!full.startsWith(fs.realpathSync(out)+'/')) throw new Error('facts outside case output directory');
  const facts=JSON.parse(fs.readFileSync(full,'utf8'));
  if(!facts || typeof facts!=='object' || Array.isArray(facts) || !Object.hasOwn(facts,'facts')) throw new Error('invalid case facts sidecar');
  for(const key of ['facts','steps','error','errors','stepErrors']) if(Object.hasOwn(facts,key)) {
   if(Object.hasOwn(result,key)) throw new Error('duplicate case facts field');
   result[key]=facts[key];
  }
  if(!result.evidence.includes(factFile)) result.evidence.push(factFile);
 }
 for(const file of result.evidence) {
  const full=fs.realpathSync(file);
  if(!full.startsWith(fs.realpathSync(out)+'/')) throw new Error('capture outside case output directory: '+file);
  captures.push({name:path.basename(file),data:fs.readFileSync(full).toString('base64')});
 }
} catch(e) {error=String(e.message||e);code=2;}
console.log(JSON.stringify({result,code,stderr,captures,out,error}));`;
// A separate acknowledgement deletes sources only after every local copy was read back.
const cleanup = String.raw`
const fs=require('fs'),path=require('path'),out=process.argv[1];
if(path.dirname(out)!==require('os').tmpdir() || !path.basename(out).startsWith('cland-demo-case-')) throw new Error('invalid case output directory');
fs.rmSync(out,{recursive:true,force:true});`;
let remoteStderr = '', remoteOutput: string | undefined;
try {
  const { stdout, stderr } = await exec(cland, ['demo', 'exec', epic, '--', 'node', '-e', remote, caseId], { maxBuffer: 16 * 1024 * 1024, timeout: 3600000 });
  remoteStderr = stderr;
  // Scan metadata and every decoded capture before the first publication write.
  assertPublishable(stdout);
  assertPublishable(stderr);
  const envelope = JSON.parse(stdout) as { result: { result: string; evidence: string[] }; code: number; captures: Array<{ name: string; data: string }>; stderr: string; out: string; error?: string };
  assertPublishable(envelope);
  remoteStderr += envelope.stderr;
  remoteOutput = envelope.out;
  for (const capture of envelope.captures) {
    const bytes = Buffer.from(capture.data, 'base64');
    assertPublishable(bytes.toString('utf8'));
    assertPublishable(bytes.toString('utf16le'));
  }
  if (envelope.error) throw new Error(envelope.error);
  const expectedFacts: unknown = process.env.QA_EXPECTED_FACTS
    ? JSON.parse(await readFile(process.env.QA_EXPECTED_FACTS, 'utf8')) : [];
  validateDemoResult(envelope.result, envelope.code, expectedFacts);
  await mkdir(destination, { recursive: true });
  const evidence: string[] = [];
  const names = new Set<string>();
  for (const capture of envelope.captures) {
    if (basename(capture.name) !== capture.name || !capture.name || capture.name === '.' || capture.name === '..') throw new Error(`invalid capture name: ${capture.name}`);
    if (names.has(capture.name)) throw new Error(`duplicate capture name: ${capture.name}`);
    names.add(capture.name);
    const path = join(destination, capture.name);
    const bytes = Buffer.from(capture.data, 'base64');
    await writeFile(path, bytes, { flag: 'wx' });
    if (!(await readFile(path)).equals(bytes)) throw new Error(`capture copy verification failed: ${capture.name}`);
    evidence.push(path);
  }
  await exec(cland, ['demo', 'exec', epic, '--', 'node', '-e', cleanup, remoteOutput], { maxBuffer: 1024 * 1024, timeout: 60000 });
  process.stdout.write(`${JSON.stringify({ ...envelope.result, evidence, ...(remoteStderr ? { stderr: remoteStderr } : {}) })}\n`);
  process.stderr.write(remoteStderr);
  process.exitCode = envelope.code;
} catch (error) {
  const failure = error as Error & { stderr?: string };
  let message = failure.message ?? String(error);
  remoteStderr += failure.stderr ?? '';
  try { assertPublishable(message); assertPublishable(remoteStderr); assertPublishable(remoteOutput ?? ''); }
  catch { message = 'secret scan refused publication'; remoteStderr = ''; remoteOutput = undefined; }
  process.stdout.write(`${JSON.stringify({ result: 'BLOCKED', evidence: [], message, stderr: remoteStderr, ...(remoteOutput ? { remote_output: remoteOutput } : {}) })}\n`);
  process.stderr.write(`qa-record: ${message}\n${remoteStderr}`);
  process.exitCode = 2;
}
