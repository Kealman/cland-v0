import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { EXECUTOR_CREDENTIALS } from '../../../shared/executor-credentials.ts';
import { ok, warn, type Check } from './report.ts';

/** Advisory literal-export scan, never executes startup files or reports values.
 * Includes bash/sh and both HOME and ZDOTDIR zsh locations. Indirect sources,
 * computed exports and system startup files require the human's own audit. */
export async function checkShellCredentials(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const home = env.HOME;
  if (!home) return [warn('shell credentials', 'HOME unavailable', 'audit shell startup exports manually')];
  const files = new Set([
    ...['.profile', '.bash_profile', '.bash_login', '.bashrc', '.zshenv', '.zprofile', '.zshrc', '.zlogin'].map(file => join(home, file)),
    ...['.zshenv', '.zprofile', '.zshrc', '.zlogin'].map(file => join(env.ZDOTDIR ?? home, file)),
    ...[env.BASH_ENV, env.ENV].filter((file): file is string => Boolean(file)),
  ]);
  const names = new Set<string>();
  let incomplete = false;
  for (const file of files) {
    let handle;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 65_536) { incomplete = true; continue; }
      const buffer = Buffer.alloc(65_537);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 65_536) { incomplete = true; continue; }
      const text = buffer.toString('utf8', 0, bytesRead);
      for (const line of text.split('\n')) {
        if (/^\s*#/.test(line)) continue;
        // Examine only names following export/typeset -x/declare -x; never retain RHS.
        const declaration = /(?:^|[;\s])(?:export|(?:typeset|declare)\s+-x)\s+([^#]*)/.exec(line)?.[1];
        if (!declaration) continue;
        for (const name of EXECUTOR_CREDENTIALS) {
          if (new RegExp(`(?:^|[\\s;])${name}(?:\\s|=|;|$)`).test(declaration)) names.add(name);
        }
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') incomplete = true; }
    finally { await handle?.close(); }
  }
  if (names.size) return [warn('shell credentials', [...names].sort().join(', ') + (incomplete ? '; scan incomplete' : ''),
    'move credential exports out of startup files; cland secret set digitalocean.token; restart the hub and sessions (see docs/hub/project-secrets.md)')];
  return [incomplete ? warn('shell credentials', 'scan incomplete', 'audit unreadable or oversized startup files manually')
    : ok('shell credentials', 'no literal provider exports found; indirect sources and system files unverified')];
}
