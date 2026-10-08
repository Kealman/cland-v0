// `cland role …`: the human assigns and revokes roles (spec 4.4, ADR 0001) through the project's hub.
import { layout, projectRoot, readDiscovery } from '../project.ts';
import type { RoleHolder, RoleList } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

export const ROLE_USAGE = `  role set <session> <role>   assign a role (coordinator, implementer, reviewer, qa) to a session,
                  live or not yet connected; the session gets the role's clause
  role clear <session>        revoke the session's role
  role list       the roles, their launch defaults and holders (--json for JSON)
`;

const holderLine = (h: RoleHolder): string => `${h.label}${h.role === null ? ' (no role)' : ''}${h.live ? '' : ' (offline)'}`;

function describe(v: RoleList): string {
  const lines: string[] = [];
  for (const r of v.roles) {
    const launch = [r.launch.harness, r.launch.model, r.launch.effort && `effort ${r.launch.effort}`].filter(Boolean).join(', ');
    lines.push(`${r.label}${r.exclusive ? ' (one holder)' : ''}  launch: ${launch || 'harness default'}`);
    lines.push(r.holders.length ? r.holders.map((h) => `  ${holderLine(h)}`).join('\n') : '  no holder');
  }
  lines.push(v.coordinator ? `coordinator: ${v.coordinator}` : 'no coordinator');
  return lines.join('\n');
}

export async function runRole(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  const d = readDiscovery(layout(projectRoot(cwd)).discovery);
  if (!d) {
    process.stderr.write('cland: no hub runs for this project — run `cland hub start`\n');
    return 1;
  }
  const json = rest.includes('--json');
  const [first, second] = rest.filter((a) => !a.startsWith('--'));
  const out = (value: unknown, text: string) => process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${text}\n`);
  switch (sub) {
    case 'set': {
      if (!first || !second) throw new Error('usage: cland role set <session> <role>');
      const v = (await askHubFrame(d, { type: 'role.set', session: first, role: second })) as { session: RoleHolder };
      out(v, `${holderLine(v.session)}: role set`);
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
