#!/usr/bin/env node
// The cland CLI.
import { HUB_USAGE, runHub } from '../src/cli/hub.ts';
import { TASK_USAGE, runTask } from '../src/cli/task.ts';
import { VERSION } from '../src/version.ts';

const usage = `cland ${VERSION}

usage: cland <command>

${HUB_USAGE}${TASK_USAGE}  --version, -v   print the version
  --help, -h      print this help
`;

const [command = '--help', ...rest] = process.argv.slice(2);

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
  default:
    process.stderr.write(`cland: unknown command "${command}"\n\n${usage}`);
    process.exitCode = 2;
}
