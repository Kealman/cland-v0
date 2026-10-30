// One read-only row for project and territory maintenance, including old gc.log.
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AUTO_MAINTENANCE_CONFIG, gitMaintenancePath, projectGitDirectory, type GitMaintenance } from '../git-maintenance.ts';
import { territoryPath } from '../territory.ts';
import { run, ok, warn, type Check } from './report.ts';
import { readMaintenanceOwner } from '../git-maintenance-owner.ts';

export async function checkGitMaintenance(root: string, env: NodeJS.ProcessEnv = process.env): Promise<Check> {
  try {
    const directory = await projectGitDirectory(root);
    if (!directory) return ok('git maintenance', 'not a Git repository');
    const configurations: string[] = [];
    let disabled = true;
    for (const [name, cwd] of [['project', root], ['territory', territoryPath(root)]]) {
      if (name === 'territory') {
        try { await lstat(cwd!); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { configurations.push('territory: absent'); continue; } throw error; }
      }
      const values: string[] = [];
      for (const [key, expected] of AUTO_MAINTENANCE_CONFIG) {
        const result = await run('git', ['-C', cwd!, 'config', '--local', '--get', key], env, 5000);
        const value = result.code === 0 && !result.error ? result.stdout.trim() : result.code === 1 && !result.error ? 'unset' : 'unreadable';
        values.push(`${key}=${value}`);
        if (value !== expected) disabled = false;
      }
      configurations.push(`${name}: ${values.join(', ')}`);
    }
    const configuration = configurations.join('; ');
    const detail = (text: string) => `${configuration}; ${text}`;
    const healthy = (text: string): Check => disabled ? ok('git maintenance', detail(text)) : warn('git maintenance', detail(text), 'run cland update to disable implicit Git maintenance in project and territory config; doctor never changes Git config');
    const owner = await readMaintenanceOwner(root);
    if (owner) return warn('git maintenance', detail(`collector pid ${owner.pid} owns the territory (active or awaiting recovery)`), 'allow active collection to finish; startup or the next territory mutation reconciles retained ownership');
    let report: GitMaintenance | null = null;
    try { report = JSON.parse(await readFile(gitMaintenancePath(root), 'utf8')) as GitMaintenance; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const logs: string[] = [];
    for (const dir of [directory, territoryPath(root)]) {
      try { await lstat(join(dir, 'gc.log')); logs.push(join(dir, 'gc.log')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const failures = report?.repositories.filter(repository => repository.error).map(repository => repository.error) ?? [];
    if (logs.length || failures.length) return warn('git maintenance', detail([...logs, ...failures].join('; ')), 'inspect the Git maintenance failure, then restart the hub to retry; doctor never collects objects');
    if (!report) return healthy('no background maintenance receipt; each hub start schedules a pass 30 s after serving');
    const recovered = report.repositories.some(repository => repository.recoveredGcLog) ? 'recovered previous gc.log; ' : '';
    return healthy(`${recovered}${report.at}; unreachable expiry ${report.expire === 'never' ? 'disabled: retained work or uncertain state' : '14 days'}`);
  } catch (error) {
    return warn('git maintenance', `cannot inspect maintenance: ${error instanceof Error ? error.message : String(error)}`, 'inspect repository metadata and restart the hub');
  }
}
