// `cland doctor [dir]` (spec 4.9): check the toolchain (the harnesses, gh, Neovim) and the project (the hub, its
// config, what `cland init` provisioned); one line per check, ok / warn / fail, each warn and fail naming the fix.
// Plain text, pasteable into an item comment; colour only on a terminal; --json for scripts. Exit 1 on any fail.
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { journalPath, readJournal } from '../hub/journal.ts';
import { render, summarise, warn, ok, type Check } from '../doctor/report.ts';
import { checkToolchain } from '../doctor/toolchain.ts';
import { checkKeys } from '../doctor/keys.ts';
import { projectRoot } from '../project.ts';
import { VERSION } from '../version.ts';

export const DOCTOR_USAGE = `  doctor [dir]    check the harnesses, gh, Neovim, the hub and what cland init provisioned; one line per
                  check with the fix for each problem; exits 1 on a failure (--json for JSON; --fix ends owned orphan servers and deleted-project hubs)
`;

export async function runDoctor(args: string[], cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const json = args.includes('--json');
  const [dir, extra] = args.filter((a) => !a.startsWith('--'));
  if (extra !== undefined || args.some((a) => a.startsWith('--') && a !== '--json' && a !== '--fix')) throw new Error('usage: cland doctor [dir] [--json] [--fix]');
  const root = dir === undefined ? projectRoot(cwd) : resolve(cwd, dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`${root} is not a directory`);
  const { findOrphans, sweepOrphans, SweepBusy } = await import('../orphans.ts');
  const { checkProject } = await import('../doctor/project.ts');
  const [toolchain, project, keys] = await Promise.all([checkToolchain(env), checkProject(root), checkKeys(env)]);
  const orphanChecks: Check[] = [];
  // Test fixtures opt out of machine-wide deleted-project discovery; production keeps the default.
  const hubScopeRoot = env.CLAND_TEST_ORPHAN_ROOT;
  try {
    const lifecycle = readJournal(journalPath(join(root, '.cland')), { kinds: ['hub-started', 'orphan-ended'] });
    const latestStart = lifecycle.findLastIndex(entry => entry.event === 'hub-started');
    orphanChecks.push(...lifecycle.slice(latestStart + 1).filter(entry => entry.event === 'orphan-ended').map(entry => ok('orphan cleanup', `ended pid ${entry.pid}: ${entry.reason} (${entry.root})`)));
    const ended = args.includes('--fix') ? [...await sweepOrphans(root, () => {}, 'harness'), ...await sweepOrphans(root, () => {}, 'hub', hubScopeRoot === undefined ? {} : { hubScopeRoot })] : [];
    orphanChecks.push(...ended.map(p => ok(`orphan ${p.kind}`, `ended pid ${p.process.pid}: ${p.reason} (${p.root})`)));
    const orphans = await findOrphans(root, true, undefined, hubScopeRoot);
    orphanChecks.push(...orphans.map(p => warn(`orphan ${p.kind}`, `pid ${p.process.pid}: ${p.reason} (${p.root})`, p.owned ? 'cland doctor --fix' : 'inspect this process manually; ambiguous candidates are preserved')));
  } catch (err) {
    if (err instanceof SweepBusy) orphanChecks.push(warn('orphan sweep', err.message, 'wait for the active sweep, then rerun cland doctor --fix'));
    else orphanChecks.push(warn('orphan sweep', 'OS process inspection failed; unverified candidates were preserved', 'check that ps and process cwd inspection are available, then rerun cland doctor'));
  }
  const checks = [...toolchain, ...project, ...keys, ...orphanChecks];
  const summary = summarise(checks);
  if (json) process.stdout.write(`${JSON.stringify({ root, version: VERSION, checks, summary })}\n`);
  else {
    const colour = Boolean(process.stdout.isTTY) && env.NO_COLOR === undefined && env.TERM !== 'dumb';
    process.stdout.write(render(checks, `cland doctor ${VERSION} in ${root}`, colour));
  }
  return summary.fail > 0 ? 1 : 0;
}
