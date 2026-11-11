import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { constants, chmodSync, closeSync, existsSync, fstatSync, fsyncSync, mkdirSync, unlinkSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { symlinkOnPath } from '../init/files.ts';
import { readSecretsFile, withLoginStoreKey, validateSecretValue } from '../remote/secrets.ts';
import type { LoginRecords } from './logins.ts';

function keyPath(root: string, name: string): string {
 if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) throw Error('invalid login name');
 const path = join(root,'.cland/auth',`${name}.key`);
 if (symlinkOnPath(root,path) !== null) throw Error(`login ${name}: symlink refused`);
 return path;
}
const aad = (project: string, name: string) => Buffer.from(JSON.stringify([project,name]));

/** Local CLI boundary. No plaintext is published to the hub transport. Create-only. */
export function writeLoginKey(root: string, project: string, name: string, value: string): void {
 validateSecretValue(value);
 const path = keyPath(root,name);
 const dir = join(root,'.cland/auth');
 mkdirSync(dir,{recursive:true,mode:0o700}); chmodSync(dir,0o700);
 if (existsSync(path)) throw Error(`login ${name}: key file already exists`);
 return withLoginStoreKey(root,key => {
 const nonce = randomBytes(12);
 const cipher = createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),nonce);
 cipher.setAAD(aad(project,name));
 const ciphertext = Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 const fd = openSync(path,constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600);
 try { writeFileSync(fd,JSON.stringify({version:1,nonce:nonce.toString('base64'),ciphertext:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64')})); fsyncSync(fd); }
 finally { closeSync(fd); }
 });
}

/** Authenticated read, bounded and value-free on all refusals. */
export function readLoginKey(root: string, project: string, name: string): string {
 const path = keyPath(root,name);
 try {
  const fd = openSync(path,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let text: string;
  try {
   const info = fstatSync(fd);
   if (!info.isFile() || info.nlink !== 1 || info.size > 16384 || (info.mode & 0o777) !== 0o600) throw Error();
   text = readFileSync(fd,'utf8');
  } finally { closeSync(fd); }
  const data = JSON.parse(text);
  if (data.version !== 1 || typeof data.nonce !== 'string' || typeof data.tag !== 'string' || typeof data.ciphertext !== 'string') throw Error();
  const nonce=Buffer.from(data.nonce,'base64'),tag=Buffer.from(data.tag,'base64');
  if (nonce.length !== 12 || tag.length !== 16) throw Error();
  const key=readSecretsFile(root)['auth.key']; if (!key) throw Error();
  const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),nonce);
  cipher.setAAD(aad(project,name)); cipher.setAuthTag(tag);
  const value=Buffer.concat([cipher.update(Buffer.from(data.ciphertext,'base64')),cipher.final()]).toString('utf8');
  validateSecretValue(value); return value;
 } catch { throw Error(`login ${name}: cannot decrypt key file`); }
}

/** Called only after the dispatcher has admitted the local human. */
export function addKeyLogin(root: string, project: string, records: LoginRecords, register: (values: readonly string[])=>void, input: {harness:string;name?:string;account?:string}) {
 if (input.harness !== 'opencode') throw Error('key logins support OpenCode only in 0.4.x');
 if (!input.name) throw Error('key login requires a name');
 if (records.get(input.name)) throw Error('login name must be unique in the project');
 const value=readLoginKey(root,project,input.name);
 register([value]);
 records.insert({name:input.name,harness:'opencode',kind:'key',account:input.account ?? input.name,lastSignIn:null});
 return records.transition(input.name,'ready');
}

/** Re-read on each native generation, including resume; callers persist only the login name. */
export function loginKeyEnvironment(root:string, project:string, records:LoginRecords, register:(values:readonly string[])=>void, name:string):Record<string,string> {
 const login=records.get(name);
 if(!login)throw Error(`login ${name}: unavailable`);
 if(login.kind!=='key')return {};
 if(login.harness!=='opencode'||login.state!=='ready')throw Error(`login ${name}: unavailable`);
 const value=readLoginKey(root,project,name);register([value]);return {OPENCODE_API_KEY:value};
}

/** Remove only the named encrypted envelope; retain the shared auth store key. */
export function removeLoginKey(root:string,name:string):void {
 const path=keyPath(root,name);
 try {unlinkSync(path);} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw Error(`login ${name}: key deletion unconfirmed`);}
 if(existsSync(path))throw Error(`login ${name}: key deletion unconfirmed`);
}
