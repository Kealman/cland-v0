// Called by qa-record.sh: execute the headless case and bring its captures back before the lease ends.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const exec = promisify(execFile);
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
  const envelope = JSON.parse(stdout) as { result: { result: string; evidence: string[] }; code: number; captures: Array<{ name: string; data: string }>; stderr: string; out: string; error?: string };
  remoteStderr += envelope.stderr;
  remoteOutput = envelope.out;
  if (envelope.error) throw new Error(envelope.error);
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
  const message = failure.message ?? String(error);
  remoteStderr += failure.stderr ?? '';
  process.stdout.write(`${JSON.stringify({ result: 'BLOCKED', evidence: [], message, stderr: remoteStderr, ...(remoteOutput ? { remote_output: remoteOutput } : {}) })}\n`);
  process.stderr.write(`qa-record: ${message}\n${remoteStderr}`);
  process.exitCode = 2;
}
