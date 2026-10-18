import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject } from './fixture.ts';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { fileURLToPath } from 'node:url';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

test('parsed bodies yield written summaries and the seven fallback rules', {skip}, async t => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, {CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,fileURLToPath(new URL('./stub-hub.ts', import.meta.url))])});
  const summary = (body:string) => c.lua("local text,from=require('cland.explorer_summary').summary(...); return {text=text,from=from or vim.NIL}",body);
  assert.deepEqual(await summary('## Goal\nFallback.\n\n## Summary\nWritten first. Written second. Written third. Written fourth.'), {text:'Written first. Written second. Written third. Written fourth.',from:'written'});
  assert.deepEqual(await summary('## Parent\nE-1: Parent.\n\n## Problem\nThe card follows the cursor. It shows the summary. Extra sentence.'), {text:'The card follows the cursor. It shows the summary.',from:'Problem'});
  assert.deepEqual(await summary('## Problem\nFound by qa-1 in the demo. Reported by the human. The cursor stays on its item.'), {text:'The cursor stays on its item.',from:'Problem'});
  assert.deepEqual(await summary('## Work\n- [ ] Show the summary.\n- Show the body later.'), {text:'Show the summary.',from:'Work'});
  assert.deepEqual(await summary('## Work\nThe card opens. Next we show:'), {text:'The card opens.',from:'Work'});
  assert.deepEqual(await summary('## Work\nNext we show:'), {text:'',from:'Work'});
  const long = Array.from({length:60},(_,i)=>`word${i+1}`).join(' ')+'.';
  const capped = await summary('## Work\n'+long) as {text:string};
  assert.equal(capped.text,Array.from({length:50},(_,i)=>`word${i+1}`).join(' ')+' …');
  assert.deepEqual(await summary('## Work\n'+Array.from({length:30},()=> 'first').join(' ')+'. '+Array.from({length:30},()=> 'second').join(' ')+'.'), {text:Array.from({length:30},()=> 'first').join(' ')+'.',from:'Work'});
  assert.deepEqual(await summary('```md\n## Summary\nFake.\n```\n## Problem\nThe real paragraph.'), {text:'The real paragraph.',from:'Problem'});
  assert.deepEqual(await summary('Without a heading. Another sentence.'), {text:'Without a heading. Another sentence.',from:null});
  assert.deepEqual(await c.lua("local s=require('cland.explorer_summary'); local names,n=s.outline(...); return {names,n}",'## Parent\nE-1\n## Work\nThree words here.'), [['Parent','Work'],8]);
});
