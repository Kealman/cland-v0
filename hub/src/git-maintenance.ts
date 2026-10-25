// Owned background Git maintenance; retained work and the age grace protect objects.
import { territoryPath, withTerritoryLockAsync } from './territory.ts';
import { lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { durableJson, leaseRoot, readLease } from './executor/droplet/lease.ts';
import { run } from './doctor/report.ts';
import { MaintenanceRecoveryRequired, ownedMaintenanceRunner, readMaintenanceOwner } from './git-maintenance-owner.ts';

/** Native command/lock seams; production uses cancellable owned GC. */
export type MaintenanceServices = { signal?: AbortSignal; run?: typeof run; lock?: typeof withTerritoryLockAsync };

export type GitMaintenance = { at: string; expire: '2.weeks.ago' | 'never'; repositories: Array<{ directory: string; recoveredGcLog: boolean; error?: string }> };
export const gitMaintenancePath = (root: string): string => join(root, '.cland/run/git-maintenance.json');

/** Resolve the common object store without starting Git in doctor's read path. */
export async function projectGitDirectory(root: string): Promise<string | null> {
  const dotGit = join(root, '.git');
  let info;
  try { info = await lstat(dotGit); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  let directory = dotGit;
  if (!info.isDirectory()) {
    const match = /^gitdir: (.+)\s*$/.exec(await readFile(dotGit, 'utf8'));
    if (!match) throw new Error('invalid .git file');
    directory = resolve(root, match[1]!);
  }
  try { return resolve(directory, (await readFile(join(directory, 'commondir'), 'utf8')).trim()); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return directory; throw error; }
}

/** Missing legacy fields, malformed records and expired-but-unreleased leases
 * cannot establish idleness. Retained finished jobs are conservative too. */
async function mayPrune(root: string, meta: (key: string) => string | null): Promise<boolean> {
  try {
    const jobs: unknown = JSON.parse(meta('suite-jobs') ?? '[]');
    if (!Array.isArray(jobs) || jobs.length || JSON.parse(meta('merge-batch') ?? 'null') !== null) return false;
    const leases: unknown = JSON.parse(meta('executor-leases') ?? '[]');
    if (!Array.isArray(leases) || leases.some(lease => !lease || lease.state !== 'released')) return false;
    let entries;
    try { entries = await readdir(leaseRoot(root), { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error; }
    for (const entry of entries) {
      if (!entry.isDirectory() || (await readLease(join(leaseRoot(root), entry.name))).state !== 'released') return false;
    }
    return true;
  } catch { return false; }
}

export async function maintainProjectGit(root: string, meta: (key: string) => string | null, env: NodeJS.ProcessEnv, services: MaintenanceServices = {}): Promise<void> {
  const directory = await projectGitDirectory(root);
  if (!directory || services.signal?.aborted) return;
  await (services.lock ?? withTerritoryLockAsync)(root, async () => {
    if (services.signal?.aborted) return;
    const expire = await mayPrune(root, meta) ? '2.weeks.ago' : 'never';
    const report: GitMaintenance = { at: new Date().toISOString(), expire, repositories: [] };
    let handoff: Error | undefined;
    const repositories = [{ cwd: root, directory }];
    try {
      const info = await lstat(territoryPath(root));
      if (!info.isDirectory()) throw new Error('territory is not a directory');
      repositories.push({ cwd: territoryPath(root), directory: territoryPath(root) });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for (const repository of repositories) {
      if (services.signal?.aborted) break;
      const result: GitMaintenance['repositories'][number] = { directory: repository.directory, recoveredGcLog: false };
      report.repositories.push(result);
      try {
        const git = async (args: string[]) => {
          const result = await (services.run ?? ownedMaintenanceRunner(root, repository.cwd, repository.directory))('git', ['-C', repository.cwd, '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], env, 30_000, false, services.signal);
          if (result.error?.includes('cleanup incomplete')) {
            try {
              const owner = await readMaintenanceOwner(root);
              handoff = owner ? new MaintenanceRecoveryRequired(owner, `${result.error}; stderr tail: ${result.stderr.slice(-4096) || '(empty)'}`) : new Error(`${result.error}; durable recovery receipt unavailable; preserve territory`);
            } catch (error) {
              handoff = new Error(`${result.error}; cannot read durable recovery ownership: ${error instanceof Error ? error.message : String(error)}`);
            }
            throw handoff;
          }
          if (result.error || result.code !== 0) throw new Error(`git ${args.includes('gc') ? 'gc' : args[0]} (${result.code ?? 'no exit'}): ${result.error ?? result.stderr.trim().slice(-4096)}`);
          return result;
        };
        // Shared repository-local config covers task worktrees and ordinary Git
        // commands too. No global configuration or upstream repository is changed.
        await git(['config', '--local', 'gc.auto', '0']);
        await git(['config', '--local', 'maintenance.auto', 'false']);
        const hadGcLog = await lstat(join(repository.directory, 'gc.log')).then(() => true, error => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error;
        });
        // GC spawns repack/prune children. Its deadline must stop that entire
        // process group and await close before ownership or fixture cleanup proceeds.
        await git(['-c', 'gc.autoDetach=false', '-c', 'gc.reflogExpire=never', '-c', 'gc.reflogExpireUnreachable=never', '-c', 'gc.worktreePruneExpire=never', 'gc', '--cruft', `--prune=${expire}`]);
        result.recoveredGcLog = hadGcLog;
      } catch (error) { result.error = error instanceof Error ? error.message : String(error); }
      if (handoff) break;
    }
    await mkdir(dirname(gitMaintenancePath(root)), { recursive: true });
    await durableJson(gitMaintenancePath(root), report);
    if (handoff) throw handoff;
  });
}
