// `cland open [dir]` (and `cland` with no command, on a terminal): the workbench. Starts the project's hub
// when none runs (`cland hub start`, which also replaces a stale hub.json), then Neovim as the standalone
// build (`nvim/bin/cland-nvim`, spec 4.1, ADR 0005) on the project's root, from anywhere inside it.
// CLAND_LAUNCHER names another launcher (the tests' stand-in).
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot } from '../project.ts';
import { runHub } from './hub.ts';

import { OPEN_USAGE } from './usage.ts';
export { OPEN_USAGE } from './usage.ts';

const LAUNCHER = fileURLToPath(new URL('../../../nvim/bin/cland-nvim', import.meta.url));

export async function runOpen(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [dir, ...rest] = args;
  if (dir === '--help' || dir === '-h') {
    process.stdout.write(`usage: cland open [dir] [nvim args…]\n\n${OPEN_USAGE}`);
    return 0;
  }
  const root = projectRoot(dir ? resolve(cwd, dir) : cwd);
  let said = '';
  const io = { out: (s: string) => void (said += s), err: (s: string) => void (said += s) };
  const started = await runHub(['start'], root, io);
  if (started !== 0) {
    process.stderr.write(`cland: the hub did not start for ${root}\n${said}`);
    return started;
  }
  const launcher = process.env.CLAND_LAUNCHER || LAUNCHER;
  const child = spawn(launcher, [root, ...rest], { cwd: root, stdio: 'inherit' });
  // the terminal's signals belong to Neovim while it runs
  const ignore = () => {};
  process.on('SIGINT', ignore);
  process.on('SIGQUIT', ignore);
  return new Promise<number>((done) => {
    child.on('error', (err) => {
      process.stderr.write(`cland: cannot start ${launcher}: ${err.message}\n`);
      done(1);
    });
    child.on('exit', (code, signal) => {
      process.off('SIGINT', ignore);
      process.off('SIGQUIT', ignore);
      done(code ?? (signal ? 1 : 0));
    });
  });
}
