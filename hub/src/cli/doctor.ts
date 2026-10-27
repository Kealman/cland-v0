// `cland doctor [dir]` (spec 4.9): check the toolchain (the harnesses, gh, Neovim) and the project (the hub, its
// config, what `cland init` provisioned); one line per check, ok / warn / fail, each warn and fail naming the fix.
// Plain text, pasteable into an item comment; colour only on a terminal; --json for scripts. Exit 1 on any fail.
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { journalPath, readJournal } from '../hub/journal.ts';
import { run, render, summarise, warn, ok, fail, type Check } from '../doctor/report.ts';
import { checkToolchain } from '../doctor/toolchain.ts';
import { checkKeys } from '../doctor/keys.ts';
import { projectRoot } from '../project.ts';
import { checkWebBundle } from '../doctor/web.ts';
import { VERSION } from '../version.ts';
import { harnessesInUse } from '../roles/harnesses.ts';
import { checkRemotes } from '../doctor/remotes.ts';

export { DOCTOR_USAGE } from './usage.ts';

export type DoctorReaders = {
  remotes?: (root: string) => Promise<string[]>;
  project?: import('../doctor/project.ts').ProjectReaders;
  findOrphans?: typeof import('../orphans.ts').findOrphans;
  sweepOrphans?: typeof import('../orphans.ts').sweepOrphans;
  webBundle?: typeof checkWebBundle;
};

/** Local output/probe boundaries let embedders inspect the same report without replacing process globals. */
export async function runDoctor(args: string[], cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env, write: (text: string) => void = text => { process.stdout.write(text); }, probe: typeof run = run, readers: DoctorReaders = {}): Promise<number> {
  const json = args.includes('--json');
  const [dir, extra] = args.filter((a) => !a.startsWith('--'));
  if (extra !== undefined || args.some((a) => a.startsWith('--') && a !== '--json' && a !== '--fix')) throw new Error('usage: cland doctor [dir] [--json] [--fix]');
  const root = dir === undefined ? projectRoot(cwd) : resolve(cwd, dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`${root} is not a directory`);
  const { findOrphans: nativeFindOrphans, sweepOrphans: nativeSweepOrphans, SweepBusy } = await import('../orphans.ts');
  const findOrphans = readers.findOrphans ?? nativeFindOrphans;
  const sweepOrphans = readers.sweepOrphans ?? nativeSweepOrphans;
  const { checkProject } = await import('../doctor/project.ts');
  const requirementChecks: Check[] = [];
  let harnesses: string[] = [];
  try { harnesses = await harnessesInUse(root, env); }
  catch (error) {
    requirementChecks.push(fail('harness requirements', `cannot read role requirements: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`, 'repair .cland/roles.toml and its named accounts'));
  }
  const remotes = await (readers.remotes ?? (async root => {
    const result = await run('git', ['-C', root, 'remote'], env);
    return result.code === 0 ? result.stdout.trim().split(/\s+/) : [];
  }))(root);
  const [toolchain, project, keys] = await Promise.all([checkToolchain(env, probe, { harnesses, github: remotes.includes('github') }), checkProject(root, readers.project, env), checkKeys(env, probe)]);
  const orphanChecks: Check[] = [];
  // Test fixtures opt out of machine-wide deleted-project discovery; production keeps the default.
  const hubScopeRoot = env.CLAND_TEST_ORPHAN_ROOT;
  try {
    const lifecycle = readJournal(journalPath(join(root, '.cland')), { kinds: ['hub-started', 'orphan-ended'] });
    const latestStart = lifecycle.findLastIndex(entry => entry.event === 'hub-started');
    orphanChecks.push(...lifecycle.slice(latestStart + 1).filter(entry => entry.event === 'orphan-ended').map(entry => ok('orphan cleanup', `ended pid ${entry.pid}: ${entry.reason} (${entry.root})`)));
    const ended = args.includes('--fix') ? [...await sweepOrphans(root, () => {}, 'harness'), ...await sweepOrphans(root, () => {}, 'hub', hubScopeRoot === undefined ? {} : { hubScopeRoot }), ...await sweepOrphans(root, () => {}, 'bridge', hubScopeRoot === undefined ? {} : { hubScopeRoot }), ...await sweepOrphans(root, () => {}, 'fixture', hubScopeRoot === undefined ? {} : { hubScopeRoot })] : [];
    orphanChecks.push(...ended.map(p => ok(`orphan ${p.kind}`, `ended pid ${p.process.pid}: ${p.reason} (${p.root})`)));
    const orphans = await findOrphans(root, true, undefined, hubScopeRoot);
    orphanChecks.push(...orphans.map(p => warn(`orphan ${p.kind}`, `pid ${p.process.pid}: ${p.reason} (${p.root})`, p.owned ? 'cland doctor --fix' : 'inspect this process manually; ambiguous candidates are preserved')));
  } catch (err) {
    if (err instanceof SweepBusy) orphanChecks.push(warn('orphan sweep', err.message, 'wait for the active sweep, then rerun cland doctor --fix'));
    else orphanChecks.push(warn('orphan sweep', 'OS process inspection failed; unverified candidates were preserved', 'check that ps and process cwd inspection are available, then rerun cland doctor'));
  }
  const checks = [...toolchain, ...requirementChecks, ...project, ...await checkRemotes(root, env), ...keys, await (readers.webBundle ?? checkWebBundle)(), ...orphanChecks];
  const summary = summarise(checks);
  if (json) write(`${JSON.stringify({ root, version: VERSION, checks, summary })}\n`);
  else {
    const colour = Boolean(process.stdout.isTTY) && env.NO_COLOR === undefined && env.TERM !== 'dumb';
    write(render(checks, `cland doctor ${VERSION} in ${root}`, colour));
  }
  return summary.fail > 0 ? 1 : 0;
}
