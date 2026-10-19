import { setupHub } from '../hub.ts';
import type { SetupStep } from '../types.ts';

export const hub: SetupStep = async ({ root, env, hub: injected, noAide, interactive, yes }) => {
  if (noAide) return [{ name: 'hub', verdict: 'skip', detail: 'cland starts the hub with the workbench' }];
  if (!interactive && !yes) return [{ name: 'hub', verdict: 'open', detail: 'start the project hub', fix: 'cland hub start' }];
  const client = injected ?? setupHub(root, env);
  try {
    const found = await client.running();
    if (found) return [{ name: 'hub', verdict: 'ok', detail: `pid ${found.pid}` }];
    const started = await client.start();
    return [{ name: 'hub', verdict: 'done', detail: `pid ${started.pid}` }];
  } catch (err) {
    return [{ name: 'hub', verdict: 'fail', detail: err instanceof Error ? err.message : String(err), fix: 'cland hub start' }];
  }
};
