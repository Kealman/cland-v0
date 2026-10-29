// T3: pinned representative bodies through production frames and the real Lua oracle.
import test from 'node:test';
import { compareTrackerLua } from './item-summary-lua-fixture.ts';
test('snapshot summaries and roll-ups equal Lua on every pinned tracker body', t => compareTrackerLua(t));
