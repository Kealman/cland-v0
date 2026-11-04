// T1: clone orchestration against a typed Host double; no child or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureHostClone } from '../src/host/clone.ts';
import type { Host } from '../src/host/host.ts';

test('C1 first clone uses only git socket origin and proxy; publishes clone discovery',async()=>{
 const calls:string[][]=[];const writes:Array<[string,number|undefined]>=[];
 const host={fileType:async()=> 'missing',run:async(c:{args:string[]})=>{calls.push(c.args);return {code:0,stdout:'',stderr:''};},readFile:async()=>Buffer.from('synthetic discovery'),writeFile:async(p:string,_b:Uint8Array,o:{mode:number})=>{writes.push([p,o.mode]);},removePath:async()=>{},makeDirectory:async()=>{}} as unknown as Host;
 await ensureHostClone({host,root:'/host/work/project',layout:{node:'node',cli:'/code/cland.ts',runDirectory:'/host/run',discoveryFile:'/host/run/hub.json'} as never,bundle:async()=>{throw Error('unexpected fallback');}});
 assert.ok(calls.some(args=>args.includes('clone')&&args.includes('git://cland/territory.git')));
 assert.ok(calls.flat().some(arg=>arg.includes('core.gitProxy=')&&arg.includes('/host/run/git-proxy')));
 assert.equal(writes[0]?.[1],0o700);assert.ok(writes[0]?.[0].startsWith('/host/run/git-proxy.'));assert.deepEqual(writes[1],['/host/work/project/.cland/hub.json',0o600]);
});
test('C2 daemon failure copies bundle then restores socket origin',async()=>{
 const calls:string[][]=[];let copied=false;
 const host={fileType:async()=> 'missing',run:async(c:{args:string[]})=>{calls.push(c.args);return {code:c.args.includes('git://cland/territory.git')&&c.args.includes('clone')?1:0,stdout:'',stderr:'daemon unavailable'};},readFile:async()=>Buffer.from('synthetic discovery'),writeFile:async()=>{},removePath:async()=>{},makeDirectory:async()=>{}} as unknown as Host;
 await ensureHostClone({host,root:'/host/work/project',layout:{node:'node',cli:'/code/cland.ts',runDirectory:'/host/run',discoveryFile:'/host/run/hub.json'} as never,bundle:async target=>{assert.ok(target.startsWith('/host/run/'));copied=true;}});
 assert.equal(copied,true);assert.ok(calls.some(args=>args.includes('clone')&&args.some(a=>a.endsWith('.bundle'))));
 assert.ok(calls.some(args=>args.includes('remote')&&args.includes('set-url')&&args.includes('git://cland/territory.git')));
});
