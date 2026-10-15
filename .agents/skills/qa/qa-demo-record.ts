// Called by qa-record.sh: execute the headless case and bring its captures back before the lease ends.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const exec = promisify(execFile);
const [cland, epic, caseId, destination] = process.argv.slice(2);
if (!cland || !epic || !caseId || !destination) throw new Error('demo recorder needs cland, epic, case and destination');
// The envelope keeps binary/text evidence out of the terminal and contains no host credentials.
const remote = String.raw`
const fs=require('fs'), cp=require('child_process'), path=require('path');
const id=process.argv[1], out=fs.mkdtempSync(path.join(require('os').tmpdir(),'cland-demo-case-'));
let stdout='',stderr='',code=0;
try { const r=cp.execFileSync('node',['hub/bin/cland.ts','--headless','--qa','qa/cases/'+id+'.lua','--out',out],{encoding:'utf8',maxBuffer:8*1024*1024}); stdout=r; }
catch(e) {stdout=String(e.stdout||'');stderr=String(e.stderr||'');code=typeof e.status==='number'?e.status:2;}
let result; try {result=JSON.parse(stdout.trim().split('\n').at(-1));} catch {result={result:'BLOCKED',evidence:[]};code=2;}
const captures=[];
for(const file of result.evidence||[]) {
 const full=path.resolve(file);
 if(!full.startsWith(out+'/')) throw new Error('capture outside case output directory');
 captures.push({name:path.basename(full),data:fs.readFileSync(full).toString('base64')});
}
console.log(JSON.stringify({result,code,stderr,captures}));
fs.rmSync(out,{recursive:true,force:true});`;
try {
  const { stdout } = await exec(cland, ['demo', 'exec', epic, '--', 'node', '-e', remote, caseId], { maxBuffer: 16 * 1024 * 1024, timeout: 3600000 });
  const envelope = JSON.parse(stdout) as { result: { result: string; evidence: string[] }; code: number; captures: Array<{ name: string; data: string }>; stderr: string };
  await mkdir(destination, { recursive: true });
  const evidence: string[] = [];
  for (const capture of envelope.captures) {
    if (basename(capture.name) !== capture.name || !capture.name.startsWith(caseId)) throw new Error('invalid capture name');
    const path = join(destination, capture.name);
    await writeFile(path, Buffer.from(capture.data, 'base64'));
    evidence.push(path);
  }
  process.stdout.write(`${JSON.stringify({ ...envelope.result, evidence })}\n`);
  process.stderr.write(envelope.stderr);
  process.exitCode = envelope.code;
} catch {
  process.stdout.write(`${JSON.stringify({ result: 'BLOCKED', evidence: [] })}\n`);
  process.stderr.write('qa-record: demo execution or capture collection failed\n');
  process.exitCode = 2;
}
