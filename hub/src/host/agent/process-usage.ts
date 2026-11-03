import { run } from './command.ts';
export type HostProcessUsage = { pid: number; parent: number; rssBytes: number; cpuPercent: number };
export async function processUsage(env: NodeJS.ProcessEnv): Promise<HostProcessUsage[]> {

      const result = await run('ps', ['-e', '-o', 'pid=,ppid=,rss=,pcpu=,stat='], { ...env, LC_ALL: 'C' });
      if (result.error || result.code !== 0) throw new Error('cannot inspect Host resource usage: ps failed');
      const rows: HostProcessUsage[] = [];
      for (const line of result.stdout.split('\n').filter(line => line.trim())) {
        const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\S+)\s*$/.exec(line);
        if (!match) throw new Error('cannot inspect Host resource usage: unknown ps format');
        if (/^[ZX]/.test(match[5]!)) continue;
        rows.push({ pid: Number(match[1]), parent: Number(match[2]), rssBytes: Number(match[3]) * 1024, cpuPercent: Number(match[4]) });
      }
      if (!rows.length) throw new Error('cannot inspect Host resource usage: empty ps table');
      const byPid = new Map(rows.map(row => [row.pid, row]));
      const children = new Map<number, number>();
      for (const row of rows) if (byPid.has(row.parent)) children.set(row.parent, (children.get(row.parent) ?? 0) + 1);
      const leaves = rows.filter(row => !children.has(row.pid));
      for (const row of leaves) {
        const parent = byPid.get(row.parent);
        if (!parent) continue;
        parent.rssBytes += row.rssBytes;
        parent.cpuPercent += row.cpuPercent;
        const remaining = children.get(parent.pid)! - 1;
        children.set(parent.pid, remaining);
        if (!remaining) leaves.push(parent);
      }
      if (leaves.length !== rows.length) throw new Error('cannot inspect Host resource usage: cyclic ancestry');
      return rows;
    
}
