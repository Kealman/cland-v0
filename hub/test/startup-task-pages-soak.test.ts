// T4: full-scale startup pagination on 5,000 durable open items.
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tempProject} from './harness.ts';
import {assertStartupReplies} from './startup-replies-fixture.ts';

test('five thousand open items cross byte-bounded startup pages without losing rows', {timeout:120000}, async t => {
  const root = await tempProject(t);
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  for (let n=1;n<=5000;n++) await writeFile(join(root,`.cland/tasks/T-${n}-scale.md`),
    `---\nid: T-${n}\ntitle: Open scale item ${n} ${'🐈'.repeat(350)}\nstate: open\n---\n`);
  await assertStartupReplies(t,root,'5000 open',5000,5000);
});
