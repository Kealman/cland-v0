// Static help entry shared by the executable and in-process command coverage.
import {
  ACCOUNT_USAGE,
  MODELS_USAGE,
  OPEN_USAGE,
  WEB_USAGE,
  SUITE_USAGE,
  EXECUTOR_USAGE,
  DEMO_USAGE,
  QA_USAGE,
  QA_LINT_USAGE,
  INIT_USAGE,
  SETUP_USAGE,
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
  SECRET_USAGE,
  REMOTE_USAGE,
  RULE_USAGE,
  INBOX_USAGE,
  TOPIC_USAGE,
  HOOK_USAGE,
  ARTIFACT_USAGE,
  SUBSCRIPTIONS_USAGE,
} from './usage.ts';
import { VERSION } from '../version.ts';

export const usage = `cland ${VERSION}

usage: cland [<command>]

With no command on a terminal, cland opens the workbench (cland open).

${MODELS_USAGE}${ACCOUNT_USAGE}${OPEN_USAGE}${WEB_USAGE}${SUITE_USAGE}${EXECUTOR_USAGE}${DEMO_USAGE}${QA_USAGE}${QA_LINT_USAGE}${INIT_USAGE}${SETUP_USAGE}${DOCTOR_USAGE}${HUB_USAGE}${TASK_USAGE}${SESSION_USAGE}${WORKTREE_USAGE}${MERGE_USAGE}${PUSH_USAGE}${RELEASE_USAGE}${ROLE_USAGE}${CREW_USAGE}${CONFIG_USAGE}${SECRET_USAGE}${REMOTE_USAGE}${RULE_USAGE}${INBOX_USAGE}${TOPIC_USAGE}${HOOK_USAGE}${ARTIFACT_USAGE}${SUBSCRIPTIONS_USAGE}  --version, -v   print the version
  --help, -h      print this help
`;

const commandUsage: Readonly<Record<string, string>> = {
  models: MODELS_USAGE,
  account: ACCOUNT_USAGE,
  open: OPEN_USAGE,
  web: WEB_USAGE,
  verify: SUITE_USAGE,
  suite: SUITE_USAGE,
  executor: EXECUTOR_USAGE,
  demo: DEMO_USAGE,
  qa: QA_LINT_USAGE,
  init: INIT_USAGE,
  update: INIT_USAGE,
  setup: SETUP_USAGE,
  doctor: DOCTOR_USAGE,
  hub: HUB_USAGE,
  task: TASK_USAGE,
  session: SESSION_USAGE,
  worktree: WORKTREE_USAGE,
  merge: MERGE_USAGE,
  push: PUSH_USAGE,
  publish: RELEASE_USAGE,
  release: RELEASE_USAGE,
  sync: RELEASE_USAGE,
  role: ROLE_USAGE,
  crew: CREW_USAGE,
  config: CONFIG_USAGE,
  secret: SECRET_USAGE,
  remote: REMOTE_USAGE,
  rule: RULE_USAGE,
  inbox: INBOX_USAGE,
  topic: TOPIC_USAGE,
  hook: HOOK_USAGE,
  artifact: ARTIFACT_USAGE,
  subscribe: SUBSCRIPTIONS_USAGE,
  unsubscribe: SUBSCRIPTIONS_USAGE,
  subscriptions: SUBSCRIPTIONS_USAGE,
};

// Keep subcommand help in sync with the advertised usage, including repeated
// forms (plan and criterion), continuation lines and shared task options.
const taskOptionsStart = TASK_USAGE.indexOf('                  every task command');
const taskOptions = TASK_USAGE.slice(taskOptionsStart);
const taskUsage = new Map<string, string>();
for (const block of TASK_USAGE.slice(0, taskOptionsStart).split(/(?=^  task )/m)) {
  const sub = /^  task (\S+)/.exec(block)?.[1];
  if (sub) taskUsage.set(sub, (taskUsage.get(sub) ?? '') + block);
}

/** Undefined leaves argument parsing and command execution to the CLI. */
export function commandHelp(command: string, args: readonly string[]): string | undefined {
  if (command === '--help' || command === '-h' || command === 'help') return usage;
  if (command === 'task' && args.length === 2 && (args[1] === '--help' || args[1] === '-h')) {
    const help = taskUsage.get(args[0]!);
    return help === undefined ? undefined : help + taskOptions;
  }
  if (args.length !== 1 || (args[0] !== '--help' && args[0] !== '-h')) return undefined;
  return Object.hasOwn(commandUsage, command) ? commandUsage[command] : undefined;
}
