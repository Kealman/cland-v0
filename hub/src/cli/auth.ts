import { readDiscovery, hubDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { User } from '../hub/users.ts';
import { AUTH_USAGE, USER_USAGE } from './usage/auth.ts';
function discovery(cwd: string) {
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run cland hub start');
  return d;
}
export async function runAuth(args: string[], cwd = process.cwd(), out: (text: string) => void = text => { process.stdout.write(text); }): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) { out(AUTH_USAGE); return 0; }
  let user: User | undefined;
  if (args.length === 2 && args[0] === 'mode' && args[1] === 'users') {
    const result = await askHubFrame(discovery(cwd), { type: 'auth.mode', mode: 'users' }) as { user: User; url?: string };
    user = result.user;
    out(`${user.name}  ${user.role}\n`);
    if (result.url) out(`${result.url}\n`);
  } else if (args.length === 1 && args[0] === 'reset') {
    await askHubFrame(discovery(cwd), { type: 'auth.reset' });
    out('Sign-in mode: single\n');
  } else throw new Error(AUTH_USAGE.trim());
  return 0;
}
export async function runUser(args: string[], cwd = process.cwd(), out: (text: string) => void = text => { process.stdout.write(text); }): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) { out(USER_USAGE); return 0; }
  if ((args[0] === 'add' && (args.length === 2 || (args.length === 4 && args[2] === '--display'))) || (args[0] === 'invite' && args.length === 2)) {
    const result = await askHubFrame(discovery(cwd), { type: args[0] === 'add' ? 'user.add' : 'user.invite', name: args[1]!, ...(args[3] !== undefined ? { displayName: args[3] } : {}) }) as { user: User; url: string };
    out(`${result.user.name}  ${result.user.role}  ${result.user.state}\n${result.url}\n`);
    return 0;
  }
  if (args.length !== 1 || args[0] !== 'list') throw new Error(USER_USAGE.trim());
  const result = await askHubFrame(discovery(cwd), { type: 'user.list' }) as { users: User[] };
  out('NAME  DISPLAY NAME  ROLE  STATE\n');
  for (const user of result.users) out(`${user.name}  ${user.displayName}  ${user.role}  ${user.state}\n`);
  return 0;
}
