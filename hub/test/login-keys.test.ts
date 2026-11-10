// T2: key cipher and private files at the public key-store boundary; sentinel values only.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { createServer } from 'node:net';
import { beforeDirectories } from './process-cleanup.ts';
import { projectHub, connectUi } from './harness.ts';
import { secretProject, loginKeyCli, secretGit } from './secrets-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';
import { ownDirectory } from './process-cleanup.ts';
import { writeLoginKey, readLoginKey } from '../src/host/login-keys.ts';
import { createDecipheriv } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { LoginRecords } from '../src/host/logins.ts';
import { addKeyLogin } from '../src/host/login-keys.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { readSecretsFile, setSecret, unsetSecret } from '../src/remote/secrets.ts';

async function fixture(t: test.TestContext) {
 const root = await mkdtemp(join(tmpdir(),'cland-login-keys-')); ownDirectory(t,root);
 await mkdir(join(root,'.cland')); return root;
}
test('key files encrypt a sentinel, reuse the store key and authenticate project and name',async t=>{
 const root=await fixture(t), sentinel='SENTINEL-key-login-opaque-12345';
 writeLoginKey(root,'project-a','work',sentinel);
 const key=readSecretsFile(root)['auth.key'];
 assert.equal(Buffer.from(key!,'base64').length,32);
 assert.equal(readLoginKey(root,'project-a','work'),sentinel);
 const path=join(root,'.cland/auth/work.key');
 const envelope=JSON.parse(await readFile(path,'utf8'));
 const decoder=createDecipheriv('aes-256-gcm',Buffer.from(key!,'base64'),Buffer.from(envelope.nonce,'base64'));
 decoder.setAAD(Buffer.from(JSON.stringify(['project-a','work'])));decoder.setAuthTag(Buffer.from(envelope.tag,'base64'));
 assert.equal(Buffer.concat([decoder.update(Buffer.from(envelope.ciphertext,'base64')),decoder.final()]).toString(),sentinel);
 assert.equal((await stat(path)).mode & 0o777,0o600);
 assert.equal((await stat(join(root,'.cland/auth'))).mode & 0o777,0o700);
 assert.ok(!(await readFile(path)).includes(Buffer.from(sentinel)));
 writeLoginKey(root,'project-a','second','SENTINEL-second-key');
 assert.equal(readSecretsFile(root)['auth.key'],key);
 assert.throws(()=>readLoginKey(root,'project-b','work'),/login work.*decrypt/);
 await writeFile(join(root,'.cland/auth/copy.key'),await readFile(path));
 assert.throws(()=>readLoginKey(root,'project-a','copy'),/login copy.*decrypt/);
 assert.throws(()=>setSecret(root,'auth.key',Buffer.alloc(32,1).toString('base64')),/key logins/);
 assert.throws(()=>unsetSecret(root,'auth.key'),/key logins/);
 const data=JSON.parse(await readFile(path,'utf8')); const bytes=Buffer.from(data.ciphertext,'base64'); bytes[0]=bytes[0]! ^ 1; data.ciphertext=bytes.toString('base64');
 await writeFile(path,JSON.stringify(data));
 assert.throws(()=>readLoginKey(root,'project-a','work'),/login work.*decrypt/);
});
test('key store refuses symlink directories and files and never overwrites a key',async t=>{
 const root=await fixture(t); await mkdir(join(root,'outside'));
 await symlink(join(root,'outside'),join(root,'.cland/auth'));
 assert.throws(()=>writeLoginKey(root,'p','work','SENTINEL-key'),/symlink/);
 const other=await fixture(t); writeLoginKey(other,'p','work','SENTINEL-key');
 assert.throws(()=>writeLoginKey(other,'p','work','SENTINEL-new'),/exists/);
 await symlink(join(other,'.cland/auth/work.key'),join(other,'.cland/auth/link.key'));
 assert.throws(()=>readLoginKey(other,'p','link'),/symlink/);
 assert.throws(()=>writeLoginKey(other,'p','link','SENTINEL-new'),/symlink/);
});

test('a held key-store write fences other key creation and store-key rotation',async t=>{
 const root=await fixture(t);
 setSecret(root,'auth.key',Buffer.alloc(32,3).toString('base64'));
 await writeFile(join(root,'.cland/auth.lock'),'');
 assert.throws(()=>writeLoginKey(root,'p','work','SENTINEL-key'),/busy/);
 assert.throws(()=>setSecret(root,'auth.key',Buffer.alloc(32,4).toString('base64')),/busy/);
 assert.throws(()=>unsetSecret(root,'auth.key'),/busy/);
});

test('key admission registers plaintext before storing metadata and refuses invalid ciphertext without a row',async t=>{
 const root=await fixture(t), value='SENTINEL-admission-key';
 writeLoginKey(root,'p','work',value);
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const records=new LoginRecords(db);
 const redact=remoteRedactor();
 const row=addKeyLogin(root,'p',records,values=>{assert.equal(records.get('work'),null);redact.register(values);},{name:'work',harness:'opencode'});
 assert.deepEqual(row,{name:'work',harness:'opencode',account:'work',kind:'key',state:'ready',lastSignIn:null});
 assert.ok(!JSON.stringify(records.list()).includes(value));assert.ok(!redact(value).includes(value));
 assert.throws(()=>addKeyLogin(root,'wrong-project',records,()=>{},{name:'missing',harness:'opencode'}),/login missing.*decrypt/);
 assert.equal(records.get('missing'),null);
 assert.throws(()=>addKeyLogin(root,'p',records,()=>{},{name:'other',harness:'codex'}),/OpenCode only in 0.4.x/);
});

test('store key cannot rotate while a retained key login has lost its file',async t=>{
 const root=await fixture(t);setSecret(root,'auth.key',Buffer.alloc(32,3).toString('base64'));
 const db=new DatabaseSync(join(root,'.cland/hub.db'));
 try {new LoginRecords(db).insert({name:'missing',harness:'opencode',kind:'key',account:'missing',lastSignIn:null});}finally{db.close();}
 assert.throws(()=>setSecret(root,'auth.key',Buffer.alloc(32,4).toString('base64')),/key logins/);
 assert.throws(()=>unsetSecret(root,'auth.key'),/key logins/);
});

test('stdin key CLI publishes metadata only and the hub retains no sentinel bytes',async t=>{
 const {root}=await secretProject(t);await mkdir(join(root,'.cland'));
 await writeFile(join(root,'.cland/config.toml'),'[project]\nname = "key-test"\n');
 const options={clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}};
 const hub=await projectHub(t,root,{},options);
 let deny=false;const requests:string[]=[];
 const frames:unknown[]=[];const sockets=new Set<import('node:net').Socket>();
 const server=createServer(socket=>{
  sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));
  const conversation=hub.dispatcher.open({send:frame=>socket.write(JSON.stringify(frame)+'\n'),close:()=>socket.destroy(),isOpen:()=>!socket.destroyed},{edge:'socket',authenticated:false});
  socket.once('close',()=>conversation.closed());let buffer='';
  socket.on('data',bytes=>{buffer+=String(bytes);let nl:number;while((nl=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,nl);buffer=buffer.slice(nl+1);const frame=JSON.parse(line);requests.push(frame.type);if(deny && frame.type==='login.list'){socket.write(JSON.stringify({type:'result',id:frame.id,ok:false,error:'requires the local human administrator'})+'\n');continue;}if(frame.type==='login.add')frames.push(frame);conversation.receive(line);}});
 });
 beforeDirectories(t,async()=>{await Promise.all([...sockets].map(socket=>new Promise<void>(resolve=>{socket.once('close',()=>resolve());socket.destroy();})));await new Promise<void>(resolve=>server.close(()=>resolve()));});
 const socket=fixtureSocketPath(root,'capture.sock');await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});
 await writeFile(join(root,'.cland/hub.json'),JSON.stringify({...hub.discovery,socket}));
 deny=true;
 const denied=await loginKeyCli(t,root,['opencode','--kind','key','--name','denied']);
 assert.equal(denied.code,1);assert.match(denied.stderr,/local human administrator/);
 await assert.rejects(stat(join(root,'.cland/auth')),{code:'ENOENT'});await assert.rejects(stat(join(root,'.cland/secrets.toml')),{code:'ENOENT'});
 assert.equal(requests.filter(type=>type==='login.add').length,0);deny=false;
 const value='SENTINEL-stdin-key-98765';
 assert.ok(JSON.stringify({positive:value}).includes(value),'scan positive control');
 const result=await loginKeyCli(t,root,['opencode','--kind','key','--name','work','--account','work-account'],value+'\n');
 assert.equal(result.code,0,result.stderr);assert.equal(result.signal,null);
 assert.ok(!result.argv.join(' ').includes(value));assert.equal(result.leaked,false);
 const key=readSecretsFile(root)['auth.key'];assert.ok(key);
 assert.equal(readLoginKey(root,projectTag(root,'key-test'),'work'),value);
 assert.ok(!(await readFile(join(root,'.cland/auth/work.key'))).includes(Buffer.from(value)));
 assert.equal(frames.length,1);const frame=frames[0] as Record<string,unknown>;
 assert.deepEqual(Object.keys(frame).sort(),['account','harness','id','kind','name','type']);assert.ok(!JSON.stringify(frames).includes(value));
 const ui=await connectUi(t,hub.discovery,'cli');const listed=await ui.request({type:'login.list'});assert.equal(listed.ok,true,listed.error);
 assert.deepEqual(listed.value,[{name:'work',harness:'opencode',account:'work-account',kind:'key',state:'ready',lastSignIn:null,bindings:[]}]);
 const diskDb=new DatabaseSync(join(root,'.cland/hub.db'));try{new LoginRecords(diskDb).insert({name:'opencode-1',harness:'opencode',account:'disk',kind:'disk',provider:'fake',region:'fake-1',volumeId:null,snapshotIds:[],lastSignIn:null});}finally{diskDb.close();}
 const second=await loginKeyCli(t,root,['opencode','--kind','key'],'SENTINEL-second-stdin\n');assert.equal(second.code,0,second.stderr);assert.equal(readSecretsFile(root)['auth.key'],key);assert.equal(readLoginKey(root,projectTag(root,'key-test'),'opencode-2'),'SENTINEL-second-stdin');
 for(const harness of ['codex','claude-code']){const refused=await loginKeyCli(t,root,[harness,'--kind','key']);assert.equal(refused.code,1);assert.match(refused.stderr,/0.4.x/);}
 const argument=await loginKeyCli(t,root,['opencode','--kind','key','--value']);assert.equal(argument.code,1);assert.match(argument.stderr,/stdin/);
 await secretGit(t,root,['init','--quiet']);assert.match(await secretGit(t,root,['check-ignore','.cland/auth/work.key']),/auth\/work.key/);
 writeLoginKey(root,projectTag(root,'key-test'),'work-bad',value);
 const file=join(root,'.cland/auth/work-bad.key'),data=JSON.parse(await readFile(file,'utf8'));const bytes=Buffer.from(data.ciphertext,'base64');bytes[0]=bytes[0]! ^ 1;data.ciphertext=bytes.toString('base64');await writeFile(file,JSON.stringify(data));
 const tampered=await ui.request({type:'login.add',kind:'key',harness:'opencode',name:'work-bad'});assert.equal(tampered.ok,false);assert.match(tampered.error!,/login work-bad.*decrypt/);assert.ok(!tampered.error!.includes(value));
 await hub.stop();
 for(const path of ['log/hub.log','journal.jsonl','hub.db'])assert.ok(!(await readFile(join(root,'.cland',path))).includes(Buffer.from(value)),path);
});
