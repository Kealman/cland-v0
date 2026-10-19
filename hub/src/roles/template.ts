// New-project role policy. Parsing omitted keys continues to use the machine-independent shipped defaults.
import type { HarnessId } from '../doctor/ranges.ts';
import { DEFAULT_ROLES_TOML } from './default-roles.ts';

export const ROLE_HARNESS_ORDER: readonly HarnessId[] = ['claude-code', 'codex', 'opencode'];
const MARK = '# cland roles template v1; harnesses = ';
export const CODEX_SANDBOX: Readonly<Record<string, string>> = {
  coordinator: 'danger-full-access', lead: 'danger-full-access',
  implementer: 'workspace-write', reviewer: 'read-only', qa: 'danger-full-access', aide: 'workspace-write',
};

/** Build from a canonical installed set; with none installed retain the shipped harness/model mapping. */
export function rolesTemplate(installed: readonly HarnessId[]): string {
  const harnesses = ROLE_HARNESS_ORDER.filter(id => installed.includes(id));
  const text = DEFAULT_ROLES_TOML.replace(/\[(\w+)\.launch\]\n([\s\S]*?)(?=\n\[|$)/g, (_block, role: string, shipped: string) => {
    const original = /^harness = "([^"]+)"/m.exec(shipped)![1] as HarnessId;
    const harness = harnesses.includes(original) ? original : (harnesses[0] ?? original);
    // Keep the shipped model comments only when the role keeps its shipped harness.
    let launch = shipped;
    if (harness !== original) launch = `harness = "${harness}"\nmodel = ""\neffort = "${harness === 'claude-code' ? 'max' : harness === 'codex' ? 'high' : ''}"\n# account = ""\n`;
    launch = launch.replace(/^(?:approval|sandbox|permissions|writable_roots|network) = .*\n?/gm, '')
      .replace(/^# Full access so any harness.*\n/gm, '');
    let policy = '';
    if (harness === 'claude-code') policy = 'permissions = "auto"\n';
    if (harness === 'codex') {
      if (role === 'coordinator' || role === 'lead') policy += '# Full access for cland git refs, territory, network, hub sockets and session/worktree launches.\n';
      policy += `approval = "never"\nsandbox = "${CODEX_SANDBOX[role]}"\n`;
    }
    return `[${role}.launch]\n${launch.trimEnd()}\n${policy}`;
  });
  const newline = text.indexOf('\n') + 1;
  return text.slice(0, newline) + MARK + JSON.stringify(harnesses) + '\n' + text.slice(newline);
}

/** An exact, conservative check for setup: edits, unknown stamps and older template versions are never rebuilt. */
export function isRolesTemplate(text: string): boolean {
  const stamp = text.split('\n').filter(line => line.startsWith(MARK));
  if (stamp.length !== 1) return false;
  try {
    const installed: unknown = JSON.parse(stamp[0]!.slice(MARK.length));
    if (!Array.isArray(installed) || !installed.every(id => ROLE_HARNESS_ORDER.includes(id))) return false;
    return text === rolesTemplate(installed as HarnessId[]);
  } catch { return false; }
}
