// The role launch settings command: edit source spans and publish one validated snapshot.
import { readFile } from 'node:fs/promises';
import { parse } from 'smol-toml';
import { parseRoles, type LaunchDefaults, type RolesConfig } from './config.ts';
import { setRoleKey, writeRolesFile } from './editor.ts';
import { CODEX_SANDBOX } from './template.ts';
import type { Resumed } from '../hub/budget.ts';
import { namedAccount, readAccounts } from '../accounts/registry.ts';

export const LAUNCH_FIELDS = ['harness', 'model', 'effort', 'account', 'permissions'] as const;
export type LaunchFields = Partial<Record<typeof LAUNCH_FIELDS[number], string>>;
export type RoleLaunchResult = { role: string; launch: LaunchDefaults; changes: LaunchFields; applies: string };

export async function setRoleLaunch(path: string, role: string, fields: LaunchFields, resumed: Resumed, authorize: () => void, env: NodeJS.ProcessEnv): Promise<{ result: RoleLaunchResult; roles: RolesConfig }> {
  resumed(authorize);
  const original = await readFile(path, 'utf8');
  const candidate = resumed(() => {
    authorize();
    const definition = parseRoles(original).get(role);
    if (!definition) throw new Error(`unknown role [${role}]`);
    if (!Object.keys(fields).length) throw new Error('role launch needs at least one launch flag');
    for (const [key, value] of Object.entries(fields)) {
      if (!LAUNCH_FIELDS.includes(key as typeof LAUNCH_FIELDS[number]) || typeof value !== 'string') throw new Error(`invalid launch field ${key}`);
    }
    const changes = { ...fields };
    if (changes.harness !== undefined && changes.harness.trim() !== definition.launch.harness) {
      changes.model ??= '';
      changes.effort ??= changes.harness.trim() === 'claude-code' ? 'max' : changes.harness.trim() === 'codex' ? 'high' : '';
    }
    let text = original;
    for (const key of LAUNCH_FIELDS) if (changes[key] !== undefined) text = setRoleKey(text, role, 'launch', key, changes[key]!);
    // The parsed launch already contains compatibility defaults; only source keys show an explicit choice.
    const written = parse(original)[role] as { launch?: { sandbox?: unknown } } | undefined;
    if (changes.harness?.trim() === 'codex' && written?.launch?.sandbox === undefined && CODEX_SANDBOX[role] !== undefined) {
      text = setRoleKey(text, role, 'launch', 'sandbox', CODEX_SANDBOX[role]);
    }
    const roles = parseRoles(text);
    return { text, roles, launch: roles.get(role)!.launch, changes };
  });
  if (candidate.launch.account !== null) {
    const registry = await readAccounts(env);
    resumed(() => {
      const account = namedAccount(registry, candidate.launch.account!);
      if (account.harness !== candidate.launch.harness) throw new Error(`account "${account.name}" uses ${account.harness}, but launch harness is ${candidate.launch.harness}`);
    });
  }
  await writeRolesFile(path, original, candidate.text, resumed, authorize);
  return { result: { role, launch: candidate.launch, changes: candidate.changes, applies: "from the role's next launch" }, roles: candidate.roles };
}
