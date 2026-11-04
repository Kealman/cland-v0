// T1: parse source files only, without importing or starting the spoke or hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { eagerSpecifiers, spokeStartupFindings } from './spoke-import-graph.ts';

test('C1 spoke eager startup graph excludes SQLite, journal, tracker and tool implementations', () => {
  assert.deepEqual(spokeStartupFindings(fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')), []);
});

test('startup graph detects transitive runtime edges and excludes erased or deferred imports', () => {
  assert.deepEqual(eagerSpecifiers(`
    import type { Store } from './erased.ts';
    import { type A } from './also-erased.ts';
    export type { B } from './erased-export.ts';
    import './side-effect.ts';
    export { value } from './reexport.ts';
    const eager = await import('./eager.ts');
    const later = async () => import('./deferred.ts');
  `), ['./side-effect.ts', './reexport.ts', './eager.ts']);
  const sources: Record<string, string> = {
    '/fixture/hub/bin/cland-spoke.ts': "import { start } from '../src/start.ts';",
    '/fixture/hub/src/start.ts': "export { value } from './tracker/item.ts'; import 'node:sqlite';",
  };
  assert.deepEqual(spokeStartupFindings('/fixture', path => sources[path]!), [
    'hub/bin/cland-spoke.ts -> hub/src/start.ts -> hub/src/tracker/item.ts',
    'hub/bin/cland-spoke.ts -> hub/src/start.ts -> node:sqlite',
  ]);
});
