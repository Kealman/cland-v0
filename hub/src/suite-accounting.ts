import type { SuiteJob } from './hub/suites.ts';

export function machineAccounting(machine: NonNullable<SuiteJob['machine']>): string {
  return `${machine.resources ? `total across ${machine.resources} machines · ` : ''}wall lifetime ${machine.lifetimeMs === null ? 'pending confirmation' : Math.round(machine.lifetimeMs / 1000) + ' s'} · cost ${machine.costUsd === null ? 'pending confirmation' : '$' + machine.costUsd.toFixed(4)}`;
}

/** The same receipt is printed in the result and the durable log footer. */
export function suiteAccounting(job: Pick<SuiteJob, 'executor' | 'machine' | 'workers' | 'size'>): string {
  const machine = job.machine;
  return `Executor ${job.executor}${machine ? ` · ${machine.size ?? 'unknown'} ${machine.region ?? 'unknown'} · ${machine.name ?? 'unavailable'} · ${machineAccounting(machine)}` : ''}${job.workers === undefined ? '' : ` · workers ${job.workers}`}${job.size ? ` · requested size ${job.size}` : ''}`;
}
