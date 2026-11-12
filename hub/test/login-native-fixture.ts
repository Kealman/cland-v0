// Native login matrix uses explicit fake binaries for every adapter.
import type test from 'node:test';
import {fixture as hostFixture} from './host-create-fixture.ts';
import {CodexAdapter} from '../src/adapters/codex.ts';
import {ClaudeCodeAdapter} from '../src/adapters/claude-code.ts';
import {testWaitMs} from './until.ts';
export const fixture=(t:test.TestContext,options:Parameters<typeof hostFixture>[1]={})=>hostFixture(t,{...options,adapters:[
 boundary=>new CodexAdapter(boundary,{bin:new URL('./fakes/codex/codex',import.meta.url).pathname,spawnDeadlineMs:testWaitMs()}),
 boundary=>new ClaudeCodeAdapter(boundary,{bin:new URL('./fakes/claude-code/claude',import.meta.url).pathname,pollMs:50}),
]});
