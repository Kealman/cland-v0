// One read-only row for project and territory maintenance, including old gc.log.
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gitMaintenancePath, projectGitDirectory, type GitMaintenance } from '../git-maintenance.ts';
import { territoryPath } from '../territory.ts';
import { ok, warn, type Check } from './report.ts';
import { readMaintenanceOwner } from '../git-maintenance-owner.ts';

export async function checkGitMaintenance(root: string): Promise<Check> {
  try {
    const directory = await projectGitDirectory(root);
    if (!directory) return ok('git maintenance', 'not a Git repository');
    const owner = await readMaintenanceOwner(root);
    if (owner) return warn('git maintenance', `collector pid ${owner.pid} owns the territory (active or awaiting recovery)`, 'allow active collection to finish; startup or the next territory mutation reconciles retained ownership');
    let report: GitMaintenance | null = null;
    try { report = JSON.parse(await readFile(gitMaintenancePath(root), 'utf8')) as GitMaintenance; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const logs: string[] = [];
    for (const dir of [directory, territoryPath(root)]) {
      try { await lstat(join(dir, 'gc.log')); logs.push(join(dir, 'gc.log')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const failures = report?.repositories.filter(repository => repository.error).map(repository => repository.error) ?? [];
    if (logs.length || failures.length) return warn('git maintenance', [...logs, ...failures].join('; '), 'inspect the Git maintenance failure, then restart the hub to retry; doctor never collects objects');
    if (!report) return ok('git maintenance', 'no background maintenance receipt; each hub start schedules a pass 30 s after serving');
    const recovered = report.repositories.some(repository => repository.recoveredGcLog) ? 'recovered previous gc.log; ' : '';
    return ok('git maintenance', `${recovered}${report.at}; unreachable expiry ${report.expire === 'never' ? 'disabled: retained work or uncertain state' : '14 days'}; implicit auto-GC disabled`);
  } catch (error) {
    return warn('git maintenance', `cannot inspect maintenance: ${error instanceof Error ? error.message : String(error)}`, 'inspect repository metadata and restart the hub');
  }
}
