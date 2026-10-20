import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles } from '../../roles/config.ts';
import { shellQuote } from '../../accounts/registry.ts';
import { setupHub } from '../hub.ts';
import { projectKind } from '../project-kind.ts';
import { HARNESS_ORDER } from './harnesses.ts';
import type { SetupStep } from '../types.ts';

export const aide: SetupStep = async ({ root, env, machine, hub: injected, noAide, interactive, kind = projectKind }) => {
  if (noAide) return [{ name: 'aide', verdict: 'skip', detail: 'skipped by --no-aide; run cland setup in a terminal to start the Aide later' }];
  let fix = 'cland setup in a terminal';
  try {
    const client = injected ?? setupHub(root, env);
    const found = !interactive && !await client.running() ? null : await client.session('aide-1');
    if (found?.status === 'running') return [{ name: 'aide', verdict: 'ok', detail: 'aide-1 running' }];
    if (!interactive) return [{ name: 'aide', verdict: 'open', detail: 'the Aide needs a terminal', fix: 'cland setup in a terminal' }];
    if (found) {
      fix = 'cland session resume aide-1 --relaunch';
      await client.resume('aide-1');
      return [{ name: 'aide', verdict: 'done', detail: 'aide-1 resumed' }];
    }
    const installed = (await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)))).filter(h => h.bin !== null).map(h => h.id);
    const selected = parseRoles(await readFile(join(root, '.cland/roles.toml'), 'utf8'), null, HARNESS_ORDER).get('aide')!.launch.harness;
    const favourite = HARNESS_ORDER.find(id => id === selected);
    if (!favourite) throw new Error(`unknown favourite harness: ${selected}`);
    const brief = `Run the onboarding skill; project: ${await kind(root, env)}; harnesses: ${installed.join(', ')}; human's harness: ${favourite}`;
    fix = `cland session launch aide-1 --role aide --harness ${favourite} --brief ${shellQuote(brief)}`;
    await client.launch({ name: 'aide-1', role: 'aide', harness: favourite, brief });
    return [{ name: 'aide', verdict: 'done', detail: `aide-1; ${brief}` }];
  } catch (err) {
    return [{ name: 'aide', verdict: 'fail', detail: err instanceof Error ? err.message : String(err), fix }];
  }
};
