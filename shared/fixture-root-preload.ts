// Allocation-side root authority shared by QA and fake harness launchers.
import { lstatSync } from 'node:fs';

export function fixtureRootPreload(root: string, markHub = false): string {
  const identity = lstatSync(root);
  if (!identity.isDirectory() || !Number.isSafeInteger(identity.dev) || !Number.isSafeInteger(identity.ino)) throw new Error('fixture root identity unavailable');
  return `import {lstatSync} from 'node:fs';
import {enableFixtureHostSockets} from ${JSON.stringify(new URL('./fixture-sockets.ts', import.meta.url).href)};
const root=${JSON.stringify(root)};
const refuse=(reason,nativeCode=null)=>{process.stderr.write(JSON.stringify({event:'qa-node-grant-refused',outcome:'refused',reason,nativeCode})+'\\n');process.exit(1);};
let info;try{info=lstatSync(root);}catch(error){refuse('root-unavailable',typeof error.code==='string'?error.code:null);}
if(!info.isDirectory()||info.dev!==${identity.dev}||info.ino!==${identity.ino})refuse('root-identity-mismatch');
try{enableFixtureHostSockets(root);}catch(error){refuse('grant-unavailable',typeof error.code==='string'?error.code:null);}
${markHub ? "if(process.argv[2]==='hub'&&process.argv[3]==='serve')process.env.CLAND_TEST_FIXTURE_ROOT=process.cwd();" : ''}
`;
}

/** A removed home grants nothing; the fake's existing writer admission rejects
 * its stale CLI without requiring the removed preload. Other Node entries keep
 * their normal behavior. Paths are compiled by the allocator, not child inputs. */
export function fixtureRootBootstrap(root: string, preload: string): string {
  return `import {lstatSync} from 'node:fs';
const refuse=(reason,error)=>{process.stderr.write(JSON.stringify({event:'fixture-node-preload-refused',outcome:'refused',reason,nativeCode:typeof error.code==='string'?error.code:null})+'\\n');process.exit(1);};
let present=true;try{lstatSync(${JSON.stringify(root)});}catch(error){if(error.code==='ENOENT')present=false;else refuse('root-unavailable',error);}
if(present)try{await import(${JSON.stringify(preload)});}catch(error){refuse('preload-unavailable',error);}
`;
}
