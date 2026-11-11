import type { LoginRecords } from '../src/host/logins.ts';
import type { Host } from '../src/host/host.ts';
import type { Machine, Volume } from '../src/host/provider/provider.ts';
import { lstat, readlink, unlink } from 'node:fs/promises';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { fakeLoginMountPath } from '../../shared/fake-layout.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import type {Clock} from '../src/hub/clock.ts';
const loginName=(host:string,harness:string)=>`${harness}-${host}`.slice(0,32);
/** Placement/lifecycle fixtures start with a settled disk; binding tests own native acquisition. */
export async function settledLogin(records:LoginRecords,host:string,harness:'codex'|'opencode'|'claude-code'='codex',placement:{provider:string;region:string;account?:string;volumeId?:string;project?:string;env?:NodeJS.ProcessEnv;machine?:Machine;clock?:Clock}={provider:'fake',region:'fake-1'}):Promise<void> {
 const name=loginName(host,harness);
 if(records.get(name))return;
 let volumeId=placement.volumeId;
 if(!volumeId&&placement.provider==='fake'){
  if(!placement.project)throw Error('settled fake login requires its disposable project');
  const {FakeHostProvider}=await import('../src/host/provider/fake.ts');
  const provider=new FakeHostProvider({env:fixtureEnvironment(placement.project,placement.env??process.env,{CLAND_FAKE_HOST_ROOT:placement.project}),...(placement.clock?{now:()=>placement.clock!.now().getTime()}: {})});
  const result=await provider.createVolume({project:placement.project,name,region:placement.region,sizeGiB:1});
  if(result.state!=='created')throw Error('settled fake login volume allocation failed');
  volumeId=result.volume.id;
  if(placement.machine&&(await provider.attachVolume(result.volume,placement.machine)).state!=='attached')throw Error('settled fake login attachment unconfirmed');
 }
 volumeId??=`volume-${name}`;
 records.insert({name,harness,account:placement.account ?? `default:${harness}`,kind:'disk',provider:placement.provider,region:placement.region,volumeId,snapshotIds:[],lastSignIn:null});
 records.transition(name,'ready');records.bind(name,{host,role:'writer',volumeId});
}

/** Native fixture ownership: docs/agents/tests/hub-test-host-destroy-native.test.ts.md. */
export async function mountedSettledLogin(options:{root:string;env:NodeJS.ProcessEnv;records:LoginRecords;host:Host;machine:Machine;beforeStop:(work:()=>Promise<void>)=>void;afterNativeJoin:(work:()=>Promise<void>)=>void;harness?:'codex'|'opencode'|'claude-code';region?:string;account?:string}):Promise<void> {
 const {root,records,host,machine}=options,harness=options.harness??'opencode',region=options.region??'fake-1';
 const {FakeHostProvider}=await import('../src/host/provider/fake.ts');
 const provider=new FakeHostProvider({env:fixtureEnvironment(root,options.env,{CLAND_FAKE_HOST_ROOT:root})});
 const name=loginName(host.name,harness),path=`/cland/auth/${harness}-${name}`;
 const mount=fakeLoginMountPath(hostDirectory(root,machine.id),path);
 let volume:Volume|undefined,target:string|undefined,setup:Promise<void>|undefined,cleaning:Promise<void>|undefined;
 options.beforeStop(async()=>{await setup?.catch(()=>{});});
 // Register ownership before the first provider allocation. This callback runs only
 // after hub/session drainage and an empty native fixture census, before root disposal.
 options.afterNativeJoin(()=>cleaning??=(async()=>{
  await setup?.catch(()=>{});
  if(!volume)return;
  try {
   const stat=await lstat(mount);
   if(!stat.isSymbolicLink()||target===undefined||await readlink(mount)!==target)throw Error('fixture login mount ownership changed');
   await unlink(mount);
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  try{await lstat(mount);throw Error('fixture login mount remains');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const detached=await provider.detachVolume(volume,machine);
  if(detached.state!=='detached')throw Error('fixture login detach unconfirmed');
  const deleted=await provider.deleteVolume(volume);
  if(deleted.state!=='deleted')throw Error('fixture login volume removal unconfirmed');
 })());
 setup=(async()=>{
  const created=await provider.createVolume({project:root,name,region,sizeGiB:1});
  if(created.state!=='created')throw Error('fixture mounted login allocation failed');
  volume=created.volume;
  const attached=await provider.attachVolume(volume,machine);
  if(attached.state!=='attached')throw Error('fixture mounted login attachment failed');
  if(!host.loginDisk)throw Error('fixture host lacks login-disk');
  await host.loginDisk({op:'mount',volume:volume.name,path});
  target=await readlink(mount);
  await settledLogin(records,host.name,harness,{provider:'fake',region,volumeId:volume.id,...(options.account?{account:options.account}:{})});
 })();
 await setup;
}

/** Native fake-host fixtures attach directory-backed volumes through production binding. */
export async function readyLogin(root:string,env:NodeJS.ProcessEnv,records:LoginRecords,harness:'codex'|'opencode'|'claude-code'='codex'):Promise<void> {
 const {FakeHostProvider}=await import('../src/host/provider/fake.ts');
 const provider=new FakeHostProvider({env});
 const name=`fixture-${harness}`;
 if(records.get(name))return;
 const result=await provider.createVolume({project:root,name,region:'fake-1',sizeGiB:1});
 if(result.state!=='created')throw Error('fixture login volume creation failed');
 records.insert({name,harness,account:`default:${harness}`,kind:'disk',provider:'fake',region:'fake-1',volumeId:result.volume.id,snapshotIds:[],lastSignIn:null});
 records.transition(name,'ready');
}

/** Metadata-only growth eligibility for injected creators that never mount disks. */
export function capacityLogin(records:LoginRecords,region='lon1',provider='fake'):void {
 const name='fixture-growth';
 if(records.get(name))return;
 records.insert({name,harness:'codex',account:'work',kind:'disk',provider,region,volumeId:'volume-growth',snapshotIds:[],lastSignIn:null});
 records.transition(name,'ready');
}
