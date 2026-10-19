// T2 item replay: committed public hub snapshots, projected by the standard frame recorder.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { startShell } from './shell-fixture.ts';
import type { Scenario } from './stub-hub.ts';

export async function itemSnapshot(name: string, root = '@root@'): Promise<Scenario> {
  const text = await readFile(new URL(`./fixtures/t902-${name}.json`, import.meta.url), 'utf8');
  return JSON.parse(text.split('@root@').join(root));
}
export async function startItems(t: TestContext, name: string) {
  const initial = await itemSnapshot(name);
  const c = await startShell(t, scenario => Object.assign(scenario, initial, {
    tracker: { levels: name === 'containers' ? ['initiative', 'feature'] : name === 'closed' ? ['release', 'epic'] : ['epic'] },
  }));
  // Files are local editor inputs; tracker interpretation is proved by the producer test.
  await mkdir(join(c.root, '.cland/tasks'), { recursive: true });
  for (const item of initial.items ?? []) {
    const fields = Object.entries(item).filter(([key, value]) => ['id', 'title', 'kind', 'state', 'parent'].includes(key) && value != null);
    await writeFile(join(c.root, '.cland/tasks', String(item.file)), `---\n${fields.map(([key,value]) => `${key}: ${value}`).join('\n')}\n---\n`);
  }
  const pushItems = async (next: string) => {
    const scenario = await itemSnapshot(next, c.root);
    await c.control({ set: { items: scenario.items } });
    for (const item of scenario.items ?? []) await c.control({ emit: { type: 'task', id: item.id, item } });
  };
  return Object.assign(c, { pushItems });
}
