// The two local settings that turn focus chords into other keys (§3.12).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { probeTimeout, run, warn, which, type Check } from './report.ts';

async function ghostty(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const home = env.HOME;
  const dirs = [env.XDG_CONFIG_HOME ? join(env.XDG_CONFIG_HOME, 'ghostty') : home ? join(home, '.config', 'ghostty') : null,
    process.platform === 'darwin' && home ? join(home, 'Library', 'Application Support', 'com.mitchellh.ghostty') : null];
  let binding: { path: string; line: number; action: string } | undefined;
  for (const dir of dirs) {
    if (!dir) continue;
    // Ghostty 1.3.1 loads legacy config first, then config.ghostty; macOS files
    // follow the XDG files. Track one effective trigger across that whole order.
    for (const name of ['config', 'config.ghostty']) {
      const path = join(dir, name);
      let text: string;
      try { text = await readFile(path, 'utf8'); } catch { continue; }
      for (const [i, line] of text.split('\n').entries()) {
        // Config keys are case-sensitive; comments are whole lines, not suffixes.
        const entry = /^\s*keybind\s*=\s*(.*?)\s*$/.exec(line);
        if (!entry) continue;
        let value = entry[1]!;
        // Ghostty strips enclosing value quotes, keeping the action's Zig text escapes.
        if (value.startsWith('"')) {
          if (!value.endsWith('"') || value.length < 2) continue;
          value = value.slice(1, -1);
        }
        if (value === 'clear') { binding = undefined; continue; }
        const chord = /^(?:(?:all|global|unconsumed|performable|physical):)*shift\+enter=(.+)$/.exec(value);
        if (chord) binding = { path, line: i + 1, action: chord[1]! };
      }
    }
  }
  if (binding?.action !== 'text:\\n') return [];
  return [warn('Ghostty Shift+Enter', `${binding.path}:${binding.line}: Shift+Enter sends LF, the same key as Ctrl+J (focus down)`, `remove the shift+enter=text:\\n keybind from ${binding.path} and reload Ghostty config (Cmd+Shift+, on macOS; Ctrl+Shift+, on Linux)`)];
}

async function tty(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const stty = which('stty', env);
  if (!stty) return [];
  // Inspect the invoking tty, not a fresh PTY or /dev/null. A pipe/non-tty produces no warning.
  const result = await run(stty, ['-a'], env, probeTimeout(env, 2000), true);
  if (result.code === 0 && /(?:^|[;\s])erase\s*=\s*\^H(?:[;\s]|$)/.test(result.stdout)) {
    return [warn('tty erase', 'erase = ^H makes legacy Ctrl+H decode as Backspace instead of focus left', "run stty erase '^?' in this tty (and remove any stty erase '^H' from shell startup files)")];
  }
  return [];
}

/** Absent settings are quiet; these are warnings, never failures. */
export async function checkKeys(env: NodeJS.ProcessEnv): Promise<Check[]> {
  return (await Promise.all([ghostty(env), tty(env)])).flat();
}
