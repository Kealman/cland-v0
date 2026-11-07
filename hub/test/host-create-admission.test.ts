// T2: local CLI and socket admission, directory-only fake provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, cland } from './harness.ts';

test('C4 create refuses an unprepared pool naming host prepare', async t => {
 const root=await tempProject(t);
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root});
 const result=await cland(root,'host','create','agents');
 assert.equal(result.code,1);
 assert.match(result.stderr,/cland host prepare/);
});

test('C5 host help lists create and list',async t=>{
 const root=await tempProject(t);
 const help=await cland(root,'host','--help');assert.equal(help.code,0,help.stderr);
 assert.match(help.stdout,/host create \[pool\]/);assert.match(help.stdout,/host list/);
});

test('C4 create refuses a prepared image after harness pins change',async t=>{
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 const path=join(root,'.cland/config.toml');
 const text='[hosts]\nharnesses={opencode="1.0.0"}\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n';
 await writeFile(path,text);await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root});
 assert.equal((await cland(root,'host','prepare','agents')).code,0);
 await writeFile(path,text.replace('1.0.0','2.0.0'));
 const result=await cland(root,'host','create','agents');
 assert.equal(result.code,1);assert.match(result.stderr,/cland host prepare agents/);
});

test('DigitalOcean create names missing E-1534 admission before image checks or API calls',async t=>{
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.do]\nprovider="digitalocean"\nsize="s-2vcpu-4gb"\nregion="lon1"\n');
 await projectHub(t,root);
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('provider network forbidden in admission fixture');});
 await assert.rejects(fetch('https://fixture.invalid/admission-control'),/provider network forbidden/);
 assert.equal(calls,1,'positive control intercepts a fetch before exercising create');calls=0;
 const result=await cland(root,'host','create','do');
 assert.equal(result.code,1);assert.match(result.stderr,/E-1534.*lease.*watchdog.*spend/);
 assert.equal(calls,0,'refusal precedes every provider API call');
});
