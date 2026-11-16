import { whichAsync } from './doctor/report.ts';
import { assetCommand, type AssetCommand } from './release-web.ts';
import { gitignoreNeedsRewrite } from './project.ts';
import { releasePreflight } from './release-preflight.ts';

/** Resolve and execute only on the hub machine, with the hub's environment. */
export async function inspectRelease(root: string, version: string | undefined, env: NodeJS.ProcessEnv, authorize: () => void, boundary: { lookup?: typeof whichAsync; run?: AssetCommand } = {}) {
  const run = boundary.run ?? assetCommand();
  const lookup = boundary.lookup ?? whichAsync;
  const git = await lookup('git', env, root);
  let head: string | undefined;
  const runGit = async (args: string[]) => {
    authorize();
    if (!git) throw new Error('git unavailable');
    const output = await run(git, args, root, env);
    return args[0] === 'show' ? output : output.trim();
  };
  return releasePreflight(version, {
    lookup: tool => { authorize(); return lookup(tool, env, root); },
    auth: async gh => { authorize(); await run(gh, ['auth', 'status', '--active', '--hostname', 'github.com'], root, env); },
    git: async args => { const result = await runGit(args); if (args[0] === 'rev-parse') head = result; return result; },
    read: async path => {
      if (!head) throw new Error('dev unavailable');
      const exists = await runGit(['ls-tree', '--name-only', head, '--', path]);
      if (!exists) return null;
      return runGit(['show', `${head}:${path}`]);
    },
    managedIgnore: text => !gitignoreNeedsRewrite(text),
  });
}
