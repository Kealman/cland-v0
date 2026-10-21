import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeItem, type Item } from '../../hub/src/tracker/item.ts';

export async function seedItem(root: string, id: string, kind: string, title: string, extra: Partial<Item['fm']> = {}, body = '', comments: Item['comments'] = []) {
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, `.cland/tasks/${id}-web-fixture.md`), serializeItem({
    fm: { id, kind, title, state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null,
      created: '2026-10-20T12:00:00Z', updated: '2026-10-20T12:00:00Z', ...(kind === 'task' ? { size: 'S', status: 'backlog' } : {}), ...extra },
    body, comments,
  }));
}
export async function seedTree(root: string) {
  await seedItem(root, 'R-900000', 'release', 'Tree fixture', { version: '99.0.0' });
  await seedItem(root, 'E-900001', 'epic', 'Working epic', { parent: 'R-900000' }, `## Plan

\`\`\`yaml
stages:
  - name: First stage
    qa: { scope: none, when: after-stage }
    lanes:
      - [T-900002, T-900003]
  - name: Second stage
    qa: { scope: affected, when: after-stage }
    lanes:
      - [T-900004]
\`\`\``);
  await seedItem(root, 'T-900002', 'task', 'Cursor task', { parent: 'E-900001', status: 'planned', rank: 5 }, '## Acceptance criteria\n\n- [ ] C1. First\n- [ ] C2. Second', [
    { author: 'reviewer', at: '2026-10-20T12:00:00Z', text: 'First review', verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'web-r1' } },
    { author: 'reviewer', at: '2026-10-20T13:00:00Z', text: 'Second review', verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'web-r2' } },
  ]);
  await seedItem(root, 'T-900003', 'task', 'Next sibling', { parent: 'E-900001', status: 'planned' });
  await seedItem(root, 'T-900004', 'task', 'Blocked sibling', { parent: 'E-900001', blocked_by: ['T-900003'] });
  await seedItem(root, 'T-900005', 'task', 'Earlier done', { parent: 'E-900001', state: 'closed', status: 'done', closed: '2026-10-19T12:00:00Z' });
  for (let n = 10; n < 28; n++) await seedItem(root, `E-${900000 + n}`, 'epic', `Epic ${n}`, { parent: 'R-900000',
    ...(n >= 26 ? { state: 'closed', closed: n === 26 ? '2026-10-20T12:00:00Z' : '2026-10-19T12:00:00Z' } : {}) });
  await seedItem(root, 'T-900050', 'task', 'Direct fixture', { parent: 'R-900000' });
  await seedItem(root, 'C-900060', 'category', 'Fixture category');
  for (let n = 61; n < 66; n++) await seedItem(root, `T-${900000 + n}`, 'task', `Category task ${n}`, {
    parent: 'C-900060', ...(n === 65 ? { state: 'closed', status: 'done', closed: '2026-10-19T12:00:00Z' } : {}),
  });
  await seedItem(root, 'M-900070', 'map', 'Unscheduled map');
  await seedItem(root, 'R-900090', 'release', 'Archived fixture', { version: '98.0.0', state: 'closed', closed: '2026-10-19T12:00:00Z' });
  await writeFile(join(root, '.cland/crew.toml'), 'idle_from = ["C-900060"]\n');
}
