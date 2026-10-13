// Read-only first draft. The skill supplies the final grouping and QA judgement.
import { spawnSync } from 'node:child_process';

const [epic, ...args] = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const scope = option('--scope', 'affected'), when = option('--when', 'after-stage');
function read(...args) {
  const result = spawnSync(process.env.CLAND || 'cland', [...args, '--json'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
try {
  if (!epic) throw new Error('usage: draft.mjs <epic-id> [--scope none|affected|full] [--when per-item|after-stage]');
  if (!['none', 'affected', 'full'].includes(scope) || !['per-item', 'after-stage'].includes(when)) throw new Error('invalid QA policy');
  const parent = read('task', 'view', epic).item;
  if (parent.plan) throw new Error('epic already has a plan: revise its accepted stages instead of replacing them with a first draft');
  const crew = read('crew', 'show').config.crew.implementer;
  const tasks = read('task', 'list', '--under', epic).items.filter(item => item.kind === 'task' && item.state === 'open');
  if (!tasks.length) throw new Error('epic has no remaining tasks');
  const remaining = new Map(tasks.map(item => [item.id, item]));
  const stages = [];
  while (remaining.size) {
    const roots = [...remaining.values()].filter(item => item.blocked_by.every(id => !remaining.has(id)));
    if (!roots.length) throw new Error(`dependency cycle among ${[...remaining.keys()].join(', ')}`);
    const lanes = roots.map(item => [item.id]);
    // Chains can share a lane when no cross-lane prerequisite is needed.
    if (crew.policy === 'per-group') {
      for (const lane of lanes) {
        for (;;) {
          const next = [...remaining.values()].find(item => !lanes.some(l => l.includes(item.id)) && item.blocked_by.some(id => lane.includes(id)) && item.blocked_by.every(id => !remaining.has(id) || lane.includes(id)));
          if (!next) break;
          lane.push(next.id);
        }
      }
    }
    stages.push({ name: `stage ${stages.length + 1}`, qa: { scope, when }, lanes });
    for (const lane of lanes) for (const id of lane) remaining.delete(id);
  }
  // This fixed schema needs no target-project packages. JSON quoting is valid YAML
  // for scalar strings and flow lanes, including arbitrary tracker identifiers.
  process.stdout.write('stages:\n' + stages.map(stage =>
    `  - name: ${JSON.stringify(stage.name)}\n    qa: { scope: ${scope}, when: ${when} }\n    lanes:\n`
    + stage.lanes.map(lane => `      - ${JSON.stringify(lane)}\n`).join('')
  ).join(''));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
