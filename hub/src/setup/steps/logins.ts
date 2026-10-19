import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { accountEnvironment, clandOpenCodeDatabase, shellQuote } from '../../accounts/registry.ts';
import { HARNESS_INSTALLATIONS } from '../../doctor/harnesses.ts';
import { HARNESS_ORDER } from './harnesses.ts';
import type { SetupLine, SetupStep } from '../types.ts';

const NAMES = { 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };
const ARGUMENTS = { 'claude-code': 'auth login', codex: 'login', opencode: 'auth login --standalone' };

export const logins: SetupStep = async ({ machine, env, interactive, prompter, narrate, json }) => {
  const required = await machine.requiredHarnesses();
  const found = await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)));
  const lines: SetupLine[] = [];
  for (let h of found.filter(h => h.bin !== null)) {
    const name = `${h.id} login`;
    let check = h.checks[1]!;
    const installation = HARNESS_INSTALLATIONS[h.id];
    const binary = env[installation.override] ? shellQuote(h.bin!) : installation.bin;
    const command = `${binary} ${ARGUMENTS[h.id]}`;
    const database = clandOpenCodeDatabase(env);
    const loginEnv = h.id === 'opencode' ? accountEnvironment(env, { OPENCODE_DB: database }) : env;
    const variable = h.id === 'claude-code' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME';
    const instruction = h.id === 'opencode' ? `OPENCODE_DB=${shellQuote(database)} ${command}`
      : env[variable] ? `${variable}=${shellQuote(env[variable])} ${command}` : command;
    if (!required.includes(h.id)) {
      lines.push({ name, verdict: 'skip', detail: 'no role uses it' });
      continue;
    }
    if (check.verdict === 'ok') {
      lines.push({ name, verdict: 'ok', detail: check.detail });
      continue;
    }
    if (!interactive) {
      lines.push({ name, verdict: h.id === 'opencode' ? 'skip' : 'open', detail: check.detail, fix: `run: ${instruction}` });
      continue;
    }
    narrate?.(`${instruction}\n`);
    if (!await prompter.confirm(`Sign in to ${NAMES[h.id]} now?`, h.id !== 'opencode')) {
      lines.push({ name, verdict: 'skip', detail: 'declined', fix: `run: ${instruction}` });
      continue;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (h.id === 'opencode') await mkdir(dirname(database), { recursive: true, mode: 0o700 });
        await machine.run(command, { env: loginEnv, stdout: json ? 'stderr' : 'inherit' });
      }
      catch (error) { narrate?.(`Login could not start: ${String(error)}\n`); }
      h = await machine.harness(h.id, true);
      check = h.checks[1]!;
      if (check.verdict === 'ok' || attempt === 1) break;
      if (!await prompter.confirm(`Still signed out of ${NAMES[h.id]}. Try once more?`, true)) break;
    }
    lines.push({ name, verdict: check.verdict === 'ok' ? 'done' : 'fail', detail: check.detail,
      ...(check.verdict === 'ok' ? {} : { fix: `run: ${instruction}` }) });
  }
  return lines;
};
