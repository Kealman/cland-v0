import test from 'node:test';
import assert from 'node:assert/strict';
import { assertClaudeHookProcessed, type ClaudeHookClose } from './claude-hook-receipt.ts';

test('Claude hook completion requires exact processing and a successful native close', () => {
  const expected = { job:'job', promptId:'prompt', event:'UserPromptSubmit' };
  const closed: ClaudeHookClose = {...expected,pid:123,code:0,signal:null,spawnError:null};
  assert.doesNotThrow(()=>assertClaudeHookProcessed(closed,expected,true));
  for(const bad of [{job:'other'},{promptId:'other'},{event:'Stop'},{pid:undefined},{code:1},{code:null,signal:'SIGTERM'},{spawnError:'spawn failed'}]) {
    assert.throws(()=>assertClaudeHookProcessed({...closed,...bad},expected,true),/incomplete Claude hook/);
  }
  assert.throws(()=>assertClaudeHookProcessed(closed,expected,false),/incomplete Claude hook/);
});
