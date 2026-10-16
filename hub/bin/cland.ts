#!/usr/bin/env node
// The cland CLI.
import {
  ACCOUNT_USAGE,
  OPEN_USAGE,
  SUITE_USAGE,
  EXECUTOR_USAGE,
  DEMO_USAGE,
  QA_USAGE,
  INIT_USAGE,
  DOCTOR_USAGE,
  HUB_USAGE,
  TASK_USAGE,
  SESSION_USAGE,
  WORKTREE_USAGE,
  MERGE_USAGE,
  PUSH_USAGE,
  RELEASE_USAGE,
  ROLE_USAGE,
  CREW_USAGE,
  CONFIG_USAGE,
  RULE_USAGE,
  INBOX_USAGE,
  TOPIC_USAGE,
  HOOK_USAGE,
  ARTIFACT_USAGE,
  SUBSCRIPTIONS_USAGE,
} from '../src/cli/usage.ts';
import { VERSION } from '../src/version.ts';

const usage = `cland ${VERSION}

usage: cland [<command>]

With no command on a terminal, cland opens the workbench (cland open).

${ACCOUNT_USAGE}${OPEN_USAGE}${SUITE_USAGE}${EXECUTOR_USAGE}${DEMO_USAGE}${QA_USAGE}${INIT_USAGE}${DOCTOR_USAGE}${HUB_USAGE}${TASK_USAGE}${SESSION_USAGE}${WORKTREE_USAGE}${MERGE_USAGE}${PUSH_USAGE}${RELEASE_USAGE}${ROLE_USAGE}${CREW_USAGE}${CONFIG_USAGE}${RULE_USAGE}${INBOX_USAGE}${TOPIC_USAGE}${HOOK_USAGE}${ARTIFACT_USAGE}${SUBSCRIPTIONS_USAGE}  --version, -v   print the version
  --help, -h      print this help
`;

// no command: the workbench on a terminal, the help anywhere else (a script, a pipe)
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const [command = interactive ? 'open' : '--help', ...rest] = process.argv.slice(2);

switch (command) {
  case 'account':
    try {
      const { runAccount } = await import('../src/cli/account.ts');
      process.exitCode = await runAccount(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'demo':
    try {
      const { runDemo } = await import('../src/cli/demo.ts');
      process.exitCode = await runDemo(rest);
    } catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'executor':
    try {
      const { runExecutor } = await import('../src/cli/executor.ts');
      process.exitCode = await runExecutor(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
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
  case 'verify':
  case 'suite':
    try {
      const { runSuiteCommand } = await import('../src/cli/suite.ts');
      process.exitCode = await runSuiteCommand(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'open':
    try {
      const { runOpen } = await import('../src/cli/open.ts');
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
      const { runQa } = await import('../src/cli/qa.ts');
      process.exitCode = await runQa(process.argv.slice(2));
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    }
    break;
  case '--qa-fixture': {
    // internal: a QA case's Neovim writes its fixture project through the tracker's own writer
    const { runQaFixture } = await import('../src/cli/qa-fixture.ts');
    process.exitCode = await runQaFixture();
    break;
  }
  case 'init':
  case 'update':
    try {
      const { runInit, runUpdate } = await import('../src/cli/init.ts');
      process.exitCode = await (command === 'init' ? runInit : runUpdate)(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'doctor':
    try {
      const { runDoctor } = await import('../src/cli/doctor.ts');
      process.exitCode = await runDoctor(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    }
    break;
  case 'hub':
    try {
      const { runHub } = await import('../src/cli/hub.ts');
      process.exitCode = await runHub(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'subscribe':
  case 'unsubscribe':
  case 'subscriptions':
    try {
      const { runSubscriptions } = await import('../src/cli/subscriptions.ts');
      process.exitCode = await runSubscriptions(command, rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'artifact':
    try {
      const { runArtifact } = await import('../src/cli/artifact.ts');
      process.exitCode = await runArtifact(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'task':
    try {
      const { runTask } = await import('../src/cli/task.ts');
      process.exitCode = await runTask(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'session':
    try {
      const { runSession } = await import('../src/cli/session.ts');
      process.exitCode = await runSession(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'push':
    try {
      const { runPush } = await import('../src/cli/push.ts');
      process.exitCode = await runPush(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'sync':
    try {
      const { runSync } = await import('../src/cli/release.ts');
      process.exitCode = await runSync(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'release':
    try {
      const { runRelease } = await import('../src/cli/release.ts');
      process.exitCode = await runRelease(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'merge':
    try {
      const { runMerge } = await import('../src/cli/merge.ts');
      process.exitCode = await runMerge(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'worktree':
    try {
      const { runWorktree } = await import('../src/cli/worktree.ts');
      process.exitCode = await runWorktree(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'rule':
    try {
      const { runRule } = await import('../src/cli/rule.ts');
      process.exitCode = await runRule(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'config':
    try {
      const { runConfig } = await import('../src/cli/config.ts');
      process.exitCode = await runConfig(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'crew':
    try {
      const { runCrew } = await import('../src/cli/crew.ts');
      process.exitCode = await runCrew(rest);
    }
    catch (err) { process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`); process.exitCode = 1; }
    break;
  case 'role':
    try {
      const { runRole } = await import('../src/cli/role.ts');
      process.exitCode = await runRole(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'inbox':
    try {
      const { runInbox } = await import('../src/cli/inbox.ts');
      process.exitCode = await runInbox(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'topic':
    try {
      const { runTopic } = await import('../src/cli/inbox.ts');
      process.exitCode = await runTopic(rest);
    } catch (err) {
      process.stderr.write(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    break;
  case 'hook':
    // never fails the harness that runs it
    try {
      const { runHook } = await import('../src/cli/hook.ts');
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
