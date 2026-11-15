import { basename, join } from 'node:path';
import { readText } from '../init/files.ts';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { hubDiscovery, readDiscovery, pidAlive } from '../project.ts';
import { askHubFrame, HubTimeout } from '../cli/socket-client.ts';
import { ok, warn, type Check } from './report.ts';
import { realClock, type Clock } from '../hub/clock.ts';

/** Config owns the mode; only the running hub supplies user counts. */
export async function checkUsers(root: string, env: NodeJS.ProcessEnv, clock: Clock = realClock): Promise<Check[]> {
  const name = 'sign-in mode';
  let mode;
  try {
    const text = readText(join(root, '.cland/config.toml'));
    mode = (text === null ? defaultConfig(basename(root)) : parseConfig(text, basename(root), env)).auth.mode;
  } catch { return [warn(name, 'mode unavailable', 'repair .cland/config.toml')]; }
  if (mode === 'single') return [ok(name, 'single')];
  const discovery = readDiscovery(hubDiscovery(root, env));
  if (!discovery || (!discovery.remote && !pidAlive(discovery.pid))) return [warn(name, 'users; counts: hub not running', 'cland hub start')];
  try {
    const result = await askHubFrame(discovery, { type: 'user.list' }, 3000, env, clock) as { users: { state: string; role: string }[] };
    if (!Array.isArray(result.users) || result.users.some(u => !u || typeof u.state !== 'string' || typeof u.role !== 'string')) throw new Error('invalid users');
    const states = new Map<string, number>();
    let admins = 0, activeAdmins = 0;
    for (const user of result.users) {
      states.set(user.state, (states.get(user.state) ?? 0) + 1);
      if (user.role === 'admin') {
        admins++;
        if (user.state === 'active') activeAdmins++;
      }
    }
    // State labels are metadata; output only the known vocabulary, never arbitrary hub bytes.
    const known = ['active', 'invited'];
    const counts = known.map(state => `${states.get(state) ?? 0} ${state}`);
    const other = result.users.filter(user => !known.includes(user.state)).length;
    if (other) counts.push(`${other} other`);
    const detail = `users; ${counts.join(', ')}; ${admins} admins (${activeAdmins} active)`;
    return [activeAdmins ? ok(name, detail) : warn(name, detail, 'cland user invite <name>')];
  } catch (error) {
    if (error instanceof HubTimeout) return [warn(name, 'users; counts unavailable (hub did not answer)', 'cland hub reload')];
    if (['ENOENT', 'ECONNREFUSED'].includes((error as NodeJS.ErrnoException)?.code ?? '')) return [warn(name, 'users; counts: hub not running', 'cland hub start')];
    return [warn(name, "users; running hub doesn't report users mode", 'cland hub reload')];
  }
}
