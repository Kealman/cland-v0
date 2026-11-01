import { join } from 'node:path';
import type { Host } from './host.ts';
import { worktreeInstall } from './worktree-install.ts';
import type { WorktreeGit } from '../hub/worktrees.ts';

/** Compatibility for older injected Git fixtures: the Host owns install handling,
 * even when the fixture supplies the entire territory operation. */
export function legacyWorktreeGit(git: WorktreeGit, host: Host): WorktreeGit {
  return { ...git,
    ensureTaskWorktree: async (...args) => {
      let tree: Awaited<ReturnType<WorktreeGit['ensureTaskWorktree']>> | undefined;
      const resumed = args[2] ?? (work => work());
      const authorize = () => resumed(args[3] ?? (() => {}));
      const adapter: Host = { ...host, worktreeAdd: async options => {
        tree = await git.ensureTaskWorktree(...args);
        if (await options.beforeInstall?.() === false) return {};
        const warning = await worktreeInstall(args[0], tree.path, authorize);
        return warning ? { warning } : {};
      } };
      const item = args[1];
      const installed = await adapter.worktreeAdd({ root: args[0], path: join(args[0], '.cland/worktrees', item.id), branch: item.branch ?? `t/${item.id}-${item.slug}` });
      if (!tree) throw new Error('legacy worktree add returned no worktree');
      return { ...tree, ...installed };
    },
    removeTaskWorktree: async (...args) => {
      let removed: Awaited<ReturnType<WorktreeGit['removeTaskWorktree']>> | undefined;
      const adapter: Host = { ...host, worktreeRemove: async () => { removed = await git.removeTaskWorktree(...args); } };
      await adapter.worktreeRemove({ root: args[0], path: join(args[0], '.cland/worktrees', args[1]) });
      if (!removed) throw new Error('legacy worktree remove returned no worktree');
      return removed;
    },
  };
}
