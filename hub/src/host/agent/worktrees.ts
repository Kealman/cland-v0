import { dirname } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import { run, nativeCommandFailure as failure } from './command.ts';
import { worktreeInstall } from './worktree-install.ts';
export type WorktreeAdd = { root: string; path: string; branch: string; territory?: { path: string; tip: string }; reuseOnly?: boolean; detached?: boolean; beforeInstall?: () => void | false | Promise<void | false> };
export function worktreeOperations(env: NodeJS.ProcessEnv) { return {
    worktreeAdd: async ({ root, path, branch, territory, reuseOnly, detached, beforeInstall }: WorktreeAdd) => {
      if (!reuseOnly) {
        if (territory) {
          const fetched = await run('git', ['-c', 'gc.auto=0', 'fetch', '--no-auto-maintenance', '--no-tags', '--no-write-fetch-head', territory.path, territory.tip], env, undefined, false, undefined, 'utf8', root);
          if (fetched.error || fetched.code !== 0) throw failure(fetched, 'git fetch task branch failed');
          const current = await run('git', ['-c', 'gc.auto=0', 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], env, undefined, false, undefined, 'utf8', root);
          if (current.error || (current.code !== 0 && current.code !== 1)) throw failure(current, 'git task branch inspection failed');
          const trees = await run('git', ['-c', 'gc.auto=0', 'worktree', 'list', '--porcelain'], env, undefined, false, undefined, 'utf8', root);
          if (trees.error || trees.code !== 0) throw failure(trees, 'git worktree inspection failed');
          if (trees.stdout.split('\n').includes(`branch refs/heads/${branch}`)) throw new Error(`task branch ${branch} is already checked out`);
          const updated = await run('git', ['-c', 'gc.auto=0', 'update-ref', '--no-deref', `refs/heads/${branch}`, territory.tip, current.code === 0 ? current.stdout.trim() : '0'.repeat(40)], env, undefined, false, undefined, 'utf8', root);
          if (updated.error || updated.code !== 0) throw failure(updated, 'git task branch failed');
        }
        await mkdir(dirname(path),{recursive:true});
        const result = await run('git', ['-c', 'gc.auto=0', 'worktree', 'add', ...(detached ? ['--detach'] : []), '--', path, branch], env, undefined, false, undefined, 'utf8', root);
        if (result.error || result.code !== 0) throw failure(result, 'git worktree add failed');
      }
      if (await beforeInstall?.() === false) return {};
      const warning = await worktreeInstall(root, path);
      return warning ? { warning } : {};
    },
    worktreeRemove: async ({ root, path }: {root: string; path: string}) => {
      const exists=await stat(path).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
      if(!exists){
        const listed=await run('git',['worktree','list','--porcelain'],env,undefined,false,undefined,'utf8',root);
        if(!listed.error&&listed.code===0&&!listed.stdout.split('\n').includes(`worktree ${path}`))return;
      }
      const result = await run('git', ['-c', 'gc.auto=0', 'worktree', 'remove', '--', path], env, undefined, false, undefined, 'utf8', root);
      if (result.error || result.code !== 0) throw failure(result, 'git worktree remove failed');
    },
}; }
