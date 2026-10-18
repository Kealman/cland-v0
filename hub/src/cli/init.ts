// `cland init [dir]` and `cland update [dir]` (spec 4.9): provision a project, or refresh what cland manages in it
// after a version change. Both are idempotent and need no hub; see `src/init/provision.ts` for the managed set.
import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Change } from '../init/files.ts';
import { CLAND_DIR, projectRoot } from '../project.ts';
import { VERSION } from '../version.ts';
import { territoryPath, undoTerritory } from '../territory.ts';
import { provisionAgentsMd } from '../init/instructions.ts';

export { INIT_USAGE } from './usage.ts';

function describe(changes: Change[], root: string, command: string): string {
  const lines = [`cland ${command} ${VERSION} in ${root}`];
  const shown = changes.filter((c) => c.action !== 'unchanged' || c.path.startsWith('.cland/territory.git'));
  // the skills on one line per action: `created .agents/skills/ (38 skills)`
  const skill = (c: Change) => /^\.agents\/skills\/[^/.][^/]*$/.test(c.path) && !c.note;
  const skills = new Map<string, number>();
  for (const c of shown) {
    if (skill(c)) {
      const n = skills.get(c.action) ?? 0;
      skills.set(c.action, n + 1);
      if (n === 0) lines.push(`\0${c.action}`);
      continue;
    }
    lines.push(`  ${c.action.padEnd(9)} ${c.path}${c.note ? `  (${c.note})` : ''}`);
  }
  for (const [i, line] of lines.entries()) {
    if (!line.startsWith('\0')) continue;
    const action = line.slice(1);
    const n = skills.get(action) ?? 0;
    lines[i] = `  ${action.padEnd(9)} .agents/skills/  (${n} skill${n === 1 ? '' : 's'})`;
  }
  const unchanged = changes.length - shown.length;
  if (!shown.some((c) => c.action !== 'kept' && c.action !== 'unchanged')) lines.push('  nothing to change: every managed part is current');
  else if (unchanged) lines.push(`  ${unchanged} managed part${unchanged === 1 ? '' : 's'} already current`);
  return lines.join('\n');
}

async function run(command: 'init' | 'update', args: string[], cwd: string, write: (text: string) => void): Promise<number> {
  const json = args.includes('--json');
  const undo = args.includes('--undo');
  const force = args.includes('--force');
  if (args.some((a) => a.startsWith('--') && !['--json', '--undo', '--force'].includes(a)) || (command === 'update' && (undo || force)) || (force && !undo)) throw new Error(`usage: cland ${command} [dir] [--json]${command === 'init' ? ' [--undo [--force]]' : ''}`);
  const [dir, extra] = args.filter((a) => !a.startsWith('--'));
  if (extra !== undefined) throw new Error(`usage: cland ${command} [dir]`);
  const target = resolve(cwd, dir ?? '.');
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`${target} is not a directory`);
  const root = realpathSync(target);
  const discovered = realpathSync(projectRoot(root));
  if (discovered !== root) throw new Error(`cland ${command} refuses target ${target}: discovered project root ${discovered}; run it in that root explicitly`);
  if (root === realpathSync(homedir())) throw new Error(`cland ${command} refuses HOME as a project root: ${target}`);
  if (command === 'update' && !existsSync(resolve(root, CLAND_DIR))) throw new Error(`${root} has no ${CLAND_DIR}/: run \`cland init\` first`);
  const report = undo ? undoTerritory(root, force) : null;
  if (report && existsSync(resolve(root, CLAND_DIR))) provisionAgentsMd(report, root);
  const changes = report?.changes ?? (await import('../init/provision.ts')).provision(root, { territory: command === 'init' || existsSync(territoryPath(root)) });
  write(json ? `${JSON.stringify({ root, version: VERSION, changes })}\n` : `${describe(changes, root, command)}\n`);
  return 0;
}

export const runInit = (args: string[], cwd: string = process.cwd(), write: (text: string) => void = text => { process.stdout.write(text); }): Promise<number> => run('init', args, cwd, write);
export const runUpdate = (args: string[], cwd: string = process.cwd(), write: (text: string) => void = text => { process.stdout.write(text); }): Promise<number> => run('update', args, cwd, write);
