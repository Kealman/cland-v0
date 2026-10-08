#!/usr/bin/env node
// The cland CLI.
import { HUB_USAGE, runHub } from '../src/cli/hub.ts';
import { TASK_USAGE, runTask } from '../src/cli/task.ts';
import { SESSION_USAGE, runSession } from '../src/cli/session.ts';
import { HOOK_USAGE, runHook } from '../src/cli/hook.ts';
import { OPEN_USAGE, runOpen } from '../src/cli/open.ts';
import { VERSION } from '../src/version.ts';

const usage = `cland ${VERSION}

usage: cland [<command>]

With no command on a terminal, cland opens the workbench (cland open).

${OPEN_USAGE}${HUB_USAGE}${TASK_USAGE}${SESSION_USAGE}${HOOK_USAGE}  --version, -v   print the version
  --help, -h      print this help
`;

// no command: the workbench on a terminal, the help anywhere else (a script, a pipe)
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const [command = interactive ? 'open' : '--help', ...rest] = process.argv.slice(2);

switch (command) {
  case '--version':
  case '-v':
  case 'version':
    process.stdout.write(`${VERSION}\n`);
    break;
  case '--help':
  case '-h':
  case 'help':
    process.stdout.write(usage);
    break;
  case 'open':
    try {
      process.exitCode = await runOpen(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'hub':
    try {
      process.exitCode = await runHub(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'task':
    try {
      process.exitCode = await runTask(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'session':
    try {
      process.exitCode = await runSession(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'hook':
    // never fails the harness that runs it
    try {
      process.exitCode = await runHook(rest);
    } catch (err) {
      process.stderr.write(`cland hook: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 0;
    }
    break;
  default:
    process.stderr.write(`cland: unknown command "${command}"\n\n${usage}`);
    process.exitCode = 2;
}
