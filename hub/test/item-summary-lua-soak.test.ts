// T4: keep discovery of new live body shapes outside default T3 verification.
import test from 'node:test';
import { compareTrackerLua } from './item-summary-lua-fixture.ts';
test('snapshot summaries and roll-ups equal Lua on every copied live tracker body', t => compareTrackerLua(t, true));
