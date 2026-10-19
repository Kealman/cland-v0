import { HARNESS_INSTALLATIONS } from '../../doctor/harnesses.ts';
import type { HarnessId } from '../../doctor/ranges.ts';
import type { SetupMachine, SetupStep } from '../types.ts';
import { basename, dirname, delimiter } from 'node:path';
import { parseConfig, renderConfig } from '../../init/config.ts';
import { isManagedFile } from '../../init/files.ts';
import { isRolesTemplate, rolesTemplate } from '../../roles/template.ts';

export const HARNESS_ORDER: readonly HarnessId[] = ['claude-code', 'codex', 'opencode'];
// Official user-level installers; shown here, never executed by detection.
export const INSTALLERS: Readonly<Record<HarnessId, string>> = {
  'claude-code': 'curl -fsSL https://claude.ai/install.sh | bash',
  codex: 'curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh',
  opencode: 'curl -fsSL https://opencode.ai/v2/install | bash',
};

const NAMES = { 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };

async function rememberDecline(machine: SetupMachine, root: string, env: NodeJS.ProcessEnv, id: HarnessId, declined: boolean): Promise<void> {
  const text = await machine.read('config.toml');
  if (text === null || !isManagedFile(text)) throw new Error('config.toml has no managed by cland mark; cannot save setup declines');
  const config = parseConfig(text, basename(root), env);
  const ids = new Set(config.setup.declinedInstalls);
  if (declined) ids.add(id); else ids.delete(id);
  config.setup.declinedInstalls = [...ids];
  await machine.write('config.toml', renderConfig(config), text);
}

export const harnesses: SetupStep = async ({ machine, root, env, interactive, yes, install, prompter, narrate, json }) => {
  const found = await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)));
  const configText = await machine.read('config.toml');
  const declines = parseConfig(configText ?? '', basename(root), env).setup.declinedInstalls;
  let anyInstalled = found.some(h => h.bin !== null);
  const lines = [];
  let lastInstall = -1;
  for (let h of found) {
    let installed = false;
    if (install === h.id && declines.includes(h.id)) await rememberDecline(machine, root, env, h.id, false);
    if (!h.bin && install !== h.id && declines.includes(h.id)) {
      lines.push({ name: h.id, verdict: 'skip' as const, detail: `declined earlier; cland setup --install ${h.id}` });
      continue;
    }
    if (!h.bin && (install === h.id || (interactive && !yes))) {
      const command = INSTALLERS[h.id];
      narrate?.(`${command}\n`);
      if (install === h.id || await prompter.confirm(`Install ${NAMES[h.id]} now?`, false)) {
        let exit: number | string;
        try { exit = await machine.run(command, { stdout: json ? 'stderr' : 'inherit' }); }
        catch (error) { exit = `could not start: ${String(error)}`; }
        h = await machine.harness(h.id, true);
        if (!h.bin) {
          lines.push({ name: h.id, verdict: 'fail' as const, detail: `not installed after installer (exit code ${exit})`, fix: `run: ${command}` });
          continue;
        }
        installed = true;
        anyInstalled = true;
      } else {
        await rememberDecline(machine, root, env, h.id, true);
        lines.push({ name: h.id, verdict: 'skip' as const, detail: `declined; cland setup --install ${h.id}` });
        continue;
      }
    }
    if (!h.bin) {
      lines.push({ name: h.id, verdict: anyInstalled ? 'skip' as const : 'open' as const, detail: 'not installed', fix: `run: ${INSTALLERS[h.id]}` });
      continue;
    }
    const check = h.checks[0]!;
    const outsidePath = !env[HARNESS_INSTALLATIONS[h.id].override] && !await machine.onPath(h.id);
    if (outsidePath) env.PATH = [env.PATH, dirname(h.bin)].filter(Boolean).join(delimiter);
    lines.push({ ...check, verdict: installed ? 'done' as const : check.verdict === 'ok' ? 'ok' as const : 'fail' as const, detail: `${check.detail}${outsidePath ? '; not on your PATH yet: open a new shell' : ''}` });
    if (installed) lastInstall = lines.length - 1;
  }
  if (lastInstall >= 0) {
    const roles = await machine.read('roles.toml');
    if (roles !== null && isRolesTemplate(roles)) {
      const now = await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)));
      const ids = now.filter(h => h.bin !== null).map(h => h.id);
      await machine.write('roles.toml', rolesTemplate(ids), roles);
      lines[lastInstall]!.detail += `; roles.toml rebuilt for ${ids.join(', ')}`;
    }
  }
  // Re-read after a template rebuild: the installed set may change role requirements.
  const required = await machine.requiredHarnesses();
  for (const line of lines) {
    if (line.detail === 'not installed') line.verdict = anyInstalled && !required.includes(line.name) ? 'skip' : 'open';
  }
  return lines;
};
