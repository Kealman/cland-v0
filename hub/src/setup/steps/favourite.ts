import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles } from '../../roles/config.ts';
import { CHOSEN, projectSetUp, setRoleKey, writeRolesFile } from '../../roles/editor.ts';
import { setMissingCodexSandbox } from '../../roles/launch.ts';
import { HARNESS_ORDER } from './harnesses.ts';
import type { HarnessId } from '../../doctor/ranges.ts';
import type { SetupStep } from '../types.ts';
import { Cancelled } from '../prompter.ts';

const LABELS = { 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };

export const favourite: SetupStep = async ({ root, machine, prompter, interactive, yes, harness }) => {
  const path = join(root, '.cland', 'roles.toml');
  try {
    const original = await readFile(path, 'utf8');
    const current = parseRoles(original, null, HARNESS_ORDER).get('aide')!.launch.harness;
    const installed = (await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)))).filter(h => h.bin !== null);
    if (harness && !installed.some(h => h.id === harness)) return [{ name: 'favourite', verdict: 'fail', detail: `${harness} is not installed; installed: ${installed.map(h => h.id).join(', ') || 'none'}` }];
    if (installed.some(h => h.id === current) && (!harness || harness === current) && await projectSetUp(root)) {
      return [{ name: 'favourite', verdict: 'ok', detail: current }];
    }
    if (!installed.length || (!interactive && !yes && !harness)) return [{ name: 'favourite', verdict: 'open', detail: installed.length ? 'choose the harness you talk to' : 'no harness installed', fix: 'run cland setup --harness <h> or cland setup --yes after installing a harness' }];
    const first = installed[0]!.id;
    const chosen: HarnessId = harness ?? (installed.length === 1 || yes ? first : await prompter.choose('Which harness do you talk to?', installed.map(h => ({ value: h.id, label: `${LABELS[h.id]}${h.checks[1]?.verdict === 'ok' ? '' : ' (signed out)'}` })), first));
    let edited = setRoleKey(original, 'aide', 'launch', 'harness', chosen, CHOSEN);
    if (chosen !== current) {
      edited = setRoleKey(edited, 'aide', 'launch', 'model', '');
      edited = setRoleKey(edited, 'aide', 'launch', 'effort', chosen === 'claude-code' ? 'max' : chosen === 'codex' ? 'high' : '');
    }
    await writeRolesFile(path, original, setMissingCodexSandbox(edited, 'aide', chosen));
    return [{ name: 'favourite', verdict: await projectSetUp(root) ? 'done' : 'fail', detail: chosen }];
  } catch (err) {
    if (err instanceof Cancelled) throw err;
    return [{ name: 'favourite', verdict: 'fail', detail: `roles.toml: ${err instanceof Error ? err.message : String(err)}`, fix: 'repair it (cland doctor names the line)' }];
  }
};
