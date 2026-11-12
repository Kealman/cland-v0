import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {get} from 'node:http';
import {WebSocket} from 'ws';
import {frameClient,type FrameClient} from './harness.ts';
import {testWaitMs} from './until.ts';
import {onCleanup} from './process-cleanup.ts';
/** Authenticate through the real one-use link and cookie edge, without a browser. */
export async function authenticatedWeb(t:TestContext,local:FrameClient){
 const link=await local.request({type:'web.link'});assert.equal(link.ok,true,link.error);
 const url=(link.value as {url:string}).url;
 const cookie=await new Promise<string>((resolve,reject)=>{const req=get(url,{agent:false},response=>{response.resume();response.on('end',()=>resolve(response.headers['set-cookie']![0]!.split(';')[0]!));response.on('error',reject);});req.setTimeout(testWaitMs(),()=>req.destroy(Error('web authentication setup timed out')));req.on('error',reject);});
 const origin=new URL(url).origin,ws=new WebSocket(origin.replace('http:','ws:')+'/ws',{origin,headers:{Cookie:cookie}});
 onCleanup(t,()=>ws.terminate());
 const web=frameClient(line=>ws.send(line.trim()),fn=>ws.on('message',data=>fn(data.toString()+'\n')),()=>ws.terminate());
 await once(ws,'open',{signal:AbortSignal.timeout(testWaitMs())});
 const welcome=web.waitFor(frame=>frame.type==='welcome');web.send({type:'hello',protocol:2,client:'web'});await welcome;
 return web;
}
