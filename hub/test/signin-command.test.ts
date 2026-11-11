// T1: common terminal and agent command grammar; no harness execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { signInCommand } from '../src/host/agent/signin-command.ts';
test('sign-in planners use only public harness arguments and mounted paths',()=>{
 assert.deepEqual(signInCommand({harness:'codex',path:'/cland/auth/codex-work'}),{command:'codex',args:['login','--device-auth'],key:'CODEX_HOME',value:'/cland/auth/codex-work'});
 assert.deepEqual(signInCommand({harness:'opencode',path:'/cland/auth/opencode-work'}),{command:'opencode',args:['auth','login'],key:'OPENCODE_DB',value:'/cland/auth/opencode-work/opencode.db'});
 assert.throws(()=>signInCommand({harness:'codex',path:'/tmp/account'}),/path/);
});
