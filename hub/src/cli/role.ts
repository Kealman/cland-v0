// `cland role …`: the human assigns and revokes roles (spec 4.4, ADR 0001) through the project's hub.
import { readFileSync } from 'node:fs';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { RoleHolder, RoleList } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

export const ROLE_USAGE = `  role set <session> <role>   assign a role (coordinator, lead, implementer, reviewer, qa, aide) to a session,
                  live or not yet connected; the session gets the role's clause
                  --note-file <file>  with a handover note (Markdown: Goals now, Work in flight, Open decisions,
                                      Waiting on); the Coordinator moves from its holder, who is told to stop
                  --move              move the Coordinator from its holder without a note
  role clear <session>        revoke the session's role
  role list       the roles, their launch defaults and holders (--json for JSON)
`;

const holderLine = (h: RoleHolder): string => `${h.label}${h.role === null ? ' (no role)' : ''}${h.live ? '' : ' (offline)'}`;

function describe(v: RoleList): string {
  const lines: string[] = [];
  for (const r of v.roles) {
    const box = r.launch.sandbox;
    const details = box && box.mode !== 'danger-full-access' ? [box.writableRoots.length ? `writable: ${box.writableRoots.join(' ')}` : '', `network: ${box.network}`].filter(Boolean).join('; ') : '';
    const sandbox = box && `sandbox ${box.mode}${details ? ` (${details})` : ''}`;
    const launch = [r.launch.harness, r.launch.model, r.launch.effort && `effort ${r.launch.effort}`, r.launch.approval && `approval ${r.launch.approval}`, sandbox].filter(Boolean).join(', ');
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
  const [first, second] = rest.filter((a, i) => !a.startsWith('--') && !(noteAt >= 0 && i === noteAt + 1));
  const out = (value: unknown, text: string) => process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${text}\n`);
  switch (sub) {
    case 'set': {
      if (!first || !second) throw new Error('usage: cland role set <session> <role> [--note-file <file>] [--move]');
      const note = noteFile !== undefined ? readFileSync(noteFile, 'utf8') : undefined;
      const move = rest.includes('--move');
      const v = (await askHubFrame(d, { type: 'role.set', session: first, role: second, ...(note !== undefined ? { note } : {}), ...(move ? { move } : {}) })) as { session: RoleHolder };
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
