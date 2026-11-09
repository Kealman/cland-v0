export { LOGIN_USAGE } from './usage/login.ts';
// Compatibility facade. Edit help in usage/<command>.ts; keep command implementations out.
import { ACCOUNT_USAGE } from './usage/account.ts';
import { OPEN_USAGE } from './usage/open.ts';
import { SUITE_USAGE } from './usage/suite.ts';
import { EXECUTOR_USAGE } from './usage/executor.ts';
import { QA_USAGE } from './usage/qa.ts';
import { INIT_USAGE as INIT_COMMAND_USAGE } from './usage/init.ts';
import { UPDATE_USAGE } from './usage/update.ts';
import { SETUP_USAGE } from './usage/setup.ts';
import { DOCTOR_USAGE } from './usage/doctor.ts';
import { HUB_USAGE } from './usage/hub.ts';
import { TASK_USAGE } from './usage/task.ts';
import { SESSION_USAGE } from './usage/session.ts';
import { WORKTREE_USAGE } from './usage/worktree.ts';
import { MERGE_USAGE } from './usage/merge.ts';
import { PUSH_USAGE } from './usage/push.ts';
import { PUBLISH_USAGE } from './usage/publish.ts';
import { RELEASE_USAGE as RELEASE_COMMAND_USAGE } from './usage/release.ts';
import { SYNC_USAGE } from './usage/sync.ts';
import { ROLE_USAGE } from './usage/role.ts';
import { CREW_USAGE } from './usage/crew.ts';
import { INBOX_USAGE } from './usage/inbox.ts';
import { TOPIC_USAGE } from './usage/topic.ts';
import { HOOK_USAGE } from './usage/hook.ts';
import { ARTIFACT_USAGE } from './usage/artifact.ts';
import { SUBSCRIBE_USAGE } from './usage/subscribe.ts';
import { UNSUBSCRIBE_USAGE } from './usage/unsubscribe.ts';
import { SUBSCRIPTIONS_USAGE as SUBSCRIPTIONS_COMMAND_USAGE } from './usage/subscriptions.ts';
import { RULE_USAGE } from './usage/rule.ts';
import { DEMO_USAGE } from './usage/demo.ts';
import { MODELS_USAGE } from './usage/models.ts';
import { REMOTE_USAGE } from './usage/remote.ts';
import { SECRET_USAGE } from './usage/secret.ts';
import { CONFIG_USAGE } from './usage/config.ts';
import { QA_LINT_USAGE } from './usage/qa-lint.ts';
import { WEB_USAGE } from './usage/web.ts';
export { IMPORT_USAGE } from './usage/task-import.ts';
export { ACCOUNT_USAGE, OPEN_USAGE, SUITE_USAGE, EXECUTOR_USAGE, QA_USAGE, SETUP_USAGE, DOCTOR_USAGE, HUB_USAGE, TASK_USAGE, SESSION_USAGE, WORKTREE_USAGE, MERGE_USAGE, PUSH_USAGE, ROLE_USAGE, CREW_USAGE, INBOX_USAGE, TOPIC_USAGE, HOOK_USAGE, ARTIFACT_USAGE, RULE_USAGE, DEMO_USAGE, MODELS_USAGE, CONFIG_USAGE, SECRET_USAGE, REMOTE_USAGE, QA_LINT_USAGE, WEB_USAGE };
export const INIT_USAGE = INIT_COMMAND_USAGE + UPDATE_USAGE;
export const RELEASE_USAGE = PUBLISH_USAGE + RELEASE_COMMAND_USAGE + SYNC_USAGE;
export const SUBSCRIPTIONS_USAGE = SUBSCRIBE_USAGE + UNSUBSCRIBE_USAGE + SUBSCRIPTIONS_COMMAND_USAGE;

export { AUTH_USAGE, USER_USAGE } from './usage/auth.ts';

export const HOST_USAGE = `  host create [pool] human-only local CLI: create a pool host from a current pool image to ready
                  five-minute boot gate; automatic retries back off 1–30 minutes; provider retry times pause the pool
                  unknown acquisition retains its slot; failures notify Coordinator in Agents
  host status [--json] human-only local CLI: pool slots and settled plus accrued UTC spend; host details
  host stop <id> human-only local CLI: stop renewal and destroy host with confirming reads
  host list [--json] human-only local CLI: id, pool, provider, size, region, state, uptime, USD/hour
  host prepare [pool] human-only local CLI: prepare one or all configured pool images
                  pool: 1–64 letters, digits and hyphens; first character letter or digit
  host destroy <id> human-only local CLI: remove host, delete machine and key with confirming reads
  host revoke <id> human-only local CLI: settle generations within 2s, revoke secret, report leftovers
  host git-proxy <socket> relay Git stdin/stdout through the forwarded Unix socket
  host attach <session> attach using this agent run folder’s private launch record
                  checks native identity; disables terminal suspend; exiting leaves the session running
  host serve      run the host agent on agent.sock (no systemd required)
                  CLAND_HOST_SECRET required; CLAND_HOST_RUN_DIR defaults to ~/.cland-host/run
                  fake-host mode requires CLAND_HOST_BOOT_ID_FILE; ordinary Linux uses kernel boot
                  ignores SIGHUP; supervisor.sh provides detached restart supervision

`;
