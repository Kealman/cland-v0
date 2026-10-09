#!/usr/bin/env node
// The cland CLI.
import { HUB_USAGE, runHub } from '../src/cli/hub.ts';
import { TASK_USAGE, runTask } from '../src/cli/task.ts';
import { SESSION_USAGE, runSession } from '../src/cli/session.ts';
import { ROLE_USAGE, runRole } from '../src/cli/role.ts';
import { INBOX_USAGE, runInbox, TOPIC_USAGE, runTopic } from '../src/cli/inbox.ts';
import { HOOK_USAGE, runHook } from '../src/cli/hook.ts';
import { OPEN_USAGE, runOpen } from '../src/cli/open.ts';
import { INIT_USAGE, runInit, runUpdate } from '../src/cli/init.ts';
import { DOCTOR_USAGE, runDoctor } from '../src/cli/doctor.ts';
import { QA_USAGE, runQa } from '../src/cli/qa.ts';
import { runQaFixture } from '../src/cli/qa-fixture.ts';
import { VERSION } from '../src/version.ts';

const usage = `cland ${VERSION}

usage: cland [<command>]

With no command on a terminal, cland opens the workbench (cland open).

${OPEN_USAGE}${QA_USAGE}${INIT_USAGE}${DOCTOR_USAGE}${HUB_USAGE}${TASK_USAGE}${SESSION_USAGE}${ROLE_USAGE}${INBOX_USAGE}${TOPIC_USAGE}${HOOK_USAGE}  --version, -v   print the version
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
  case '--headless':
  case '--qa':
    // a QA case's result is the exit code; what stops the run before any case has BLOCKED's code
    try {
      process.exitCode = await runQa(process.argv.slice(2));
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    }
    break;
  case '--qa-fixture':
    // internal: a QA case's Neovim writes its fixture project through the tracker's own writer
    process.exitCode = await runQaFixture();
    break;
  case 'init':
  case 'update':
    try {
      process.exitCode = await (command === 'init' ? runInit : runUpdate)(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'doctor':
    try {
      process.exitCode = await runDoctor(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
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
  case 'role':
    try {
      process.exitCode = await runRole(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'inbox':
    try {
      process.exitCode = await runInbox(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'topic':
    try {
      process.exitCode = await runTopic(rest);
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
