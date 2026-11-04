import type { Host } from './host.ts';
import type { HostWorktreeRecord } from './task-worktrees.ts';
/** Positive publication receipt; no hub filesystem operation uses a host path. */
export async function flushHostBranch(host: Pick<Host,'name'|'run'|'flushBranch'>, row: HostWorktreeRecord, territoryHead: () => Promise<string>, reported?: string): Promise<string> {
  let head = reported ?? 'unknown', reason: string | undefined;
  try {
    if (row.host !== host.name || row.phase && row.phase !== 'ready') throw new Error('worktree owner unavailable');
    const read = await host.run({command:'git',args:['rev-parse','--verify','HEAD'],cwd:row.path,env:{},timeoutMs:10000});
    if (read.code !== 0 || read.error || !/^[a-f0-9]{40,64}$/.test(read.stdout.trim())) throw new Error('host HEAD unavailable');
    head = read.stdout.trim();
    const branch=await host.run({command:'git',args:['symbolic-ref','--quiet','--short','HEAD'],cwd:row.path,env:{},timeoutMs:10000});
    if(branch.code!==0||branch.error||branch.stdout.trim()!==row.branch)throw new Error('worktree branch differs');
    if (reported !== undefined && reported !== head) throw new Error('reported HEAD changed');
    if (!host.flushBranch) throw new Error('agent flush capability unavailable');
    await host.flushBranch(row.path, row.branch);
    const after = await host.run({command:'git',args:['rev-parse','--verify','HEAD'],cwd:row.path,env:{},timeoutMs:10000});
    if (after.code !== 0 || after.error || after.stdout.trim() !== head) throw new Error('host HEAD changed during flush');
    const afterBranch=await host.run({command:'git',args:['symbolic-ref','--quiet','--short','HEAD'],cwd:row.path,env:{},timeoutMs:10000});
    if(afterBranch.code!==0||afterBranch.error||afterBranch.stdout.trim()!==row.branch)throw new Error('worktree branch changed during flush');
  } catch (error) { reason = error instanceof Error ? error.message : String(error); }
  const territory = await territoryHead().catch(() => 'unknown');
  if (reason || territory !== head) throw new Error(`host-flush-refused: ${reason ?? 'territory HEAD differs'}; worktree HEAD ${head}; territory HEAD ${territory}`);
  return head;
}
