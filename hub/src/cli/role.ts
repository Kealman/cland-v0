// `cland role …`: the human assigns and revokes roles (spec 4.4, ADR 0001) through the project's hub.
import { readFileSync } from 'node:fs';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { RoleHolder, RoleList } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

import { LAUNCH_FIELDS, type LaunchFields, type RoleLaunchResult } from '../roles/launch.ts';

import { ROLE_USAGE } from './usage.ts';
export { ROLE_USAGE } from './usage.ts';

const holderLine = (h: RoleHolder): string => `${h.label}${h.role === null ? ' (no role)' : ''}${h.live ? '' : ' (offline)'}`;

function describe(v: RoleList): string {
  const lines: string[] = [];
  for (const r of v.roles) {
    const box = r.launch.sandbox;
    const details = box && box.mode !== 'danger-full-access' ? [box.writableRoots.length ? `writable: ${box.writableRoots.join(' ')}` : '', `network: ${box.network}`].filter(Boolean).join('; ') : '';
    const sandbox = box && `sandbox ${box.mode}${details ? ` (${details})` : ''}`;
    const launch = [r.launch.harness, `model ${r.launch.model ?? 'harness default'}`, `effort ${r.launch.effort ?? 'harness default'}`, `account ${r.launch.account ?? 'harness default'}`, `permissions ${r.launch.permissions ?? 'harness default'}`, `approval ${r.launch.approval ?? 'harness default'}`, sandbox || 'sandbox harness default'].join(', ');
    lines.push(`${r.label}${r.exclusive ? ' (one holder)' : ''}  launch: ${launch || 'harness default'}`);
    lines.push(r.holders.length ? r.holders.map((h) => `  ${holderLine(h)}`).join('\n') : '  no holder');
  }
  lines.push(v.coordinator ? `coordinator: ${v.coordinator}` : 'no coordinator');
  return lines.join('\n');
}

export async function runRole(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write('cland: no hub runs for this project — run `cland hub start`\n');
    return 1;
  }
  const json = rest.includes('--json');
  const noteAt = rest.indexOf('--note-file');
  const noteFile = noteAt >= 0 ? rest[noteAt + 1] : undefined;
  if (noteAt >= 0 && (!noteFile || noteFile.startsWith('--'))) throw new Error('--note-file needs a file');
  const itemAt = rest.indexOf('--item');
  const item = itemAt >= 0 ? rest[itemAt + 1] : undefined;
  if (itemAt >= 0 && (!item || item.startsWith('--'))) throw new Error('--item needs an item id');
  const [first, second] = rest.filter((a, i) => !a.startsWith('--') && !(noteAt >= 0 && i === noteAt + 1) && !(itemAt >= 0 && i === itemAt + 1));
  const out = (value: unknown, text: string) => process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${text}\n`);
  switch (sub) {
    case 'launch': {
      const [role, ...flags] = rest;
      if (!role || role.startsWith('--')) throw new Error('usage: cland role launch <role> [--harness …] [--model …] [--effort …] [--account …] [--permissions …] [--json]');
      const fields: LaunchFields = {};
      for (let i = 0; i < flags.length; i++) {
        const flag = flags[i]!;
        if (flag === '--json') continue;
        const key = LAUNCH_FIELDS.find(key => flag === `--${key}`);
        if (!key) throw new Error(`unknown role launch flag ${flag}`);
        const value = flags[++i];
        if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
        fields[key] = value;
      }
      if (!Object.keys(fields).length) throw new Error('role launch needs at least one launch flag');
      const value = await askHubFrame(d, { type: 'role.launch', role, fields }, 10_000) as RoleLaunchResult;
      const changes = Object.entries(value.changes).map(([key, v]) => `${key} = ${v || 'harness default'}`).join(', ');
      out(value, `${value.role}: ${changes}; applies ${value.applies}`);
      return 0;
    }
    case 'set': {
      if (!first || !second) throw new Error('usage: cland role set <session> <role> [--note-file <file>] [--move]');
      const note = noteFile !== undefined ? readFileSync(noteFile, 'utf8') : undefined;
      const move = rest.includes('--move');
      if (item && (second !== 'lead' || (!move && note === undefined))) throw new Error('--item requires role lead and --move or --note-file');
      // Assignment awaits configuration freshness before persisting the role and publishing its clause
      // (dispatch.ts, role.set). Like task mutations, allow 10 s for that work plus the socket handshake.
      const v = (await askHubFrame(d, { type: 'role.set', session: first, role: second, ...(note !== undefined ? { note } : {}), ...(move ? { move } : {}), ...(item ? { item } : {}) }, 10_000)) as { session: RoleHolder };
      out(v, `${holderLine(v.session)}: role set${note !== undefined ? ', with the handover note' : ''}`);
      return 0;
    }
    case 'clear': {
      if (!first) throw new Error('usage: cland role clear <session>');
      const v = (await askHubFrame(d, { type: 'role.clear', session: first })) as { session: RoleHolder };
      out(v, `${v.session.name}: role cleared`);
      return 0;
    }
    case 'list': {
      const v = (await askHubFrame(d, { type: 'role.list' })) as RoleList;
      out(v, describe(v));
      return 0;
    }
    default:
      process.stderr.write(`cland: unknown role command "${sub ?? ''}"\n\nusage: cland role <command>\n\n${ROLE_USAGE}`);
      return 2;
  }
}
