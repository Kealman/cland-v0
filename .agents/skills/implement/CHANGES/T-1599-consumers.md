# T-1599 consumer inventory

Search scope: production, colocated tests, hub tests (all tiers), QA briefs, skills and docs. Existing agent frames remain supported; new operations are additive. Registry injected Hosts and CLAND_TEST_HOSTS stay supported.

## Registry / daemon

- `docs/hub/ssh-transport.md`
- `docs/hub/declining-an-accepted-verifier-request-t-1494.md`
- `qa/briefs/E-1532-stage-2.md`
- `docs/hub/adapters-and-sessions.md`
- `hub/test/durations.json`
- `hub/test/transport-ssh.test.ts`
- `hub/src/hub/server.ts`
- `.agents/skills/implement/CHANGES/T-1598-session-forwards.md`
- `qa/briefs/E-1531.md`
- `qa/briefs/E-1531-stage-3.md`
- `qa/briefs/E-1531-stage-2.md`
- `docs/agents/tests/hub-test-session-host-routing.test.ts.md`
- `hub/test/account-coalescing.test.ts`
- `hub/test/session-host-routing.test.ts`
- `hub/test/transport-forwards.test.ts`
- `hub/src/hub/daemon.ts`
- `hub/src/host/host.ts`
- `hub/src/host/records.ts`
- `hub/test/session-credential-io.test.ts`
- `hub/test/transport-contract-fixture.ts`
- `hub/test/host-registry.test.ts`
- `docs/agents/tests/hub-test-transport-fake-contract.test.ts.md`
- `hub/test/task-worktrees.test.ts`
- `hub/src/transport/ssh.ts`
- `hub/test/session-host-placement.test.ts`
- `hub/src/adapters/index.ts`
- `hub/src/adapters/codex.ts`
- `hub/test/session-async-processes.test.ts`
- `hub/test/host-launch-layout.test.ts`
- `hub/test/orphan-servers.test.ts`

## Agent wire

- `docs/hub/ssh-transport.md`
- `docs/hub/declining-an-accepted-verifier-request-t-1494.md`
- `docs/hub/adapters-and-sessions.md`
- `qa/briefs/E-1532-stage-2.md`
- `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`
- `hub/test/transport-ssh.test.ts`
- `qa/briefs/E-1538-stage-2.md`
- `docs/agents/tests/hub-test-host-supervisor.test.ts.md`
- `docs/agents/tests/hub-test-transport-ssh-contract.test.ts.md`
- `docs/agents/host-agent.md`
- `docs/spec/v0.4.md`
- `docs/agents/tests/hub-test-transport-ssh.test.ts.md`
- `docs/agents/tests/hub-test-host-agent-files.test.ts.md`
- `hub/test/host-supervisor.test.ts`
- `hub/test/transport-contract.ts`
- `hub/test/fixtures/cli-usage/commands.json`
- `hub/src/cli/usage.ts`
- `hub/src/host/agent-client.ts`
- `hub/test/fixture-socket-path.test.ts`
- `hub/src/host/records.ts`
- `hub/src/host/agent/server.ts`
- `hub/src/host/agent/protocol.ts`
- `hub/src/host/agent/processes.ts`
- `hub/test/transport-contract-fixture.ts`
- `hub/src/transport/ssh.ts`
- `hub/test/stop-classification-fixture.ts`
- `hub/test/host-agent.test.ts`
- `hub/test/host-agent-files.test.ts`
- `hub/test/fakes/fake-host-socket.ts`
- `hub/test/fakes/fake-host.ts`

## Host command environment

- `docs/hub/declining-an-accepted-verifier-request-t-1494.md`
- `hub/src/remote/discord-socket.ts`
- `hub/src/remote/gateway.ts`
- `hub/test/host-boundary.test.ts`
- `hub/test/suite-soak-component.test.ts`
- `hub/test/verdict-commit-component.test.ts`
- `hub/src/remote/discord.ts`
- `hub/test/suite.test.ts`
- `hub/test/executor-admission.test.ts`
- `hub/test/speech.test.ts`
- `hub/src/remote/state.ts`
- `qa/briefs/E-1538-stage-2.md`
- `hub/test/tier-tripwire-runner.test.ts`
- `qa/briefs/E-1536-stage-2.md`
- `qa/briefs/E-1538-stage-1.md`
- `hub/src/hub/store.ts`
- `hub/test/executor-deletion-confirmation.test.ts`
- `hub/test/suite-remote-log.test.ts`
- `hub/src/hub/users.ts`
- `qa/briefs/E-1536-stage-3.md`
- `hub/test/discord-render.test.ts`
- `hub/test/clock.test.ts`
- `hub/src/hub/budget.ts`
- `hub/test/suite-wait-metrics.test.ts`
- `hub/test/stage-qa.test.ts`
- `hub/test/transport-records.test.ts`
- `hub/test/harness.ts`
- `hub/test/lint-child-environment.ts`
- `hub/test/cli-as-user.test.ts`
- `hub/test/discord-users.test.ts`
- `hub/test/suite-persistence.test.ts`
- `hub/src/hub/store.test.ts`
- `hub/src/executor/droplet/health.ts`
- `hub/test/default-subscriptions-lifecycle.test.ts`
- `hub/test/telegram-approvals.test.ts`
- `hub/src/territory.ts`
- `hub/test/claude-code-sessions.test.ts`
- `hub/src/adapters/opencode/server.ts`
- `hub/src/adapters/sessions.ts`
- `hub/src/adapters/opencode.test.ts`
- `hub/src/adapters/codex.ts`
- `hub/src/adapters/processes.ts`
- `hub/src/adapters/claude-code-local.ts`
- `hub/src/adapters/claude-code.ts`
- `hub/test/speech-command.test.ts`
- `hub/test/host-contract.ts`
- `hub/test/executor.test.ts`
- `hub/test/suite-stage-rules.test.ts`
- `hub/test/subscription-hygiene.test.ts`
- `hub/test/session-host.test.ts`
- `hub/test/session-host-routing.test.ts`
- `hub/test/project-hub.test.ts`
- `hub/test/codex-adapter.test.ts`
- `hub/test/discord-commands.test.ts`
- `hub/test/claude-code-sessions-lifecycle.test.ts`
- `hub/test/message-display-name.test.ts`
- `hub/test/memory-seal.ts`
- `hub/test/setup-remote-component.test.ts`
- `hub/test/tracker-status-component.test.ts`
- `hub/test/artifact-user.test.ts`
- `hub/test/hub-resources.ts`
- `hub/test/opencode-adapter.test.ts`
- `hub/test/executor-safety.test.ts`
- `hub/test/suite-cache.test.ts`
- `hub/test/discord-inbound-media.test.ts`
- `hub/test/opencode-launch-policy.test.ts`
- `hub/test/session-credential-fixture.ts`
- `hub/test/pid-identity.test.ts`
- `hub/test/message-users.test.ts`
- `hub/test/prerequisite-cli.ts`
- `hub/test/suite-remote-budget.test.ts`
- `hub/test/opencode-host.test.ts`
- `hub/test/artifact-folders.test.ts`
- `hub/test/auth-mode.test.ts`
- `hub/test/host-registry.test.ts`
- `hub/test/inject-stalled.test.ts`
- `hub/test/suite-accounting.test.ts`
- `hub/test/host-orphans.test.ts`
- `hub/test/codex-host.test.ts`
- `hub/test/telegram-cards.test.ts`
- `hub/test/host-records.test.ts`
- `hub/test/system-processes.test.ts`
- `hub/test/stop-classification-fixture.ts`
- `hub/test/answer-users.test.ts`
- `hub/test/adapter-native-boundary.test.ts`
- `hub/test/discord-cards.test.ts`
- `hub/test/fake-harness-capabilities.test.ts`
- `hub/test/state-inventory.test.ts`
- `hub/test/suite-admission-native.test.ts`
- `hub/test/human-hold.test.ts`
- `hub/test/host-agent.test.ts`
- `hub/test/discord-messages.test.ts`
- `hub/test/host-agent-files.test.ts`
- `hub/test/suite-progress.test.ts`
- `hub/test/tier-tripwire.ts`
- `hub/test/session-host-placement.test.ts`
- `hub/test/executor-run-rules.test.ts`
- `hub/test/suite-queue-policy.test.ts`
- `hub/test/host-launch-layout.test.ts`
- `hub/src/tracker/index-db.ts`
- `hub/test/claude-code-host.test.ts`
- `hub/test/fake-harness.test.ts`
- `hub/test/session-cwd.test.ts`
- `hub/test/claude-code-environment.test.ts`
- `hub/test/dev-t3-search.test.ts`
- `hub/test/name-reservation.test.ts`
- `hub/test/suite-unit-fixture.ts`
- `hub/test/remote-clock.ts`
- `hub/test/task-migrate.test.ts`
- `hub/test/host-local-liveness.test.ts`
- `hub/test/claude-code-schedule.test.ts`
- `hub/test/prerequisite-process.test.ts`
- `hub/test/suite-soak.test.ts`
- `hub/test/telegram-inbound.test.ts`
- `hub/test/verifier-routing.test.ts`
- `hub/test/discord-artifacts.test.ts`
- `hub/test/discord-cards-fixture.ts`
- `hub/test/orphan-servers.test.ts`
- `hub/test/merge-batches.test.ts`
- `hub/test/tracker-ready-native.test.ts`
- `hub/test/scenarios/hook-bridge.test.ts`
- `hub/test/topic-withdraw.test.ts`
- `hub/test/pairing-approval.test.ts`
- `hub/test/web-authority-unit.test.ts`
- `hub/test/suite-coordinator.test.ts`
- `hub/test/executor-run.test.ts`
- `hub/test/scenarios/remotes.test.ts`
- `hub/test/telegram-polling-fixture.ts`
- `hub/test/suite-cover.test.ts`
- `hub/test/topic-model.test.ts`
- `hub/test/termination-ownership.test.ts`
- `hub/test/mod-bridge.test.ts`
- `hub/test/gateway.test.ts`
- `hub/test/codex-sandbox-host.test.ts`
- `hub/src/setup/steps/harnesses.ts`
- `hub/src/setup/steps/logins.ts`
- `hub/test/web-signin.test.ts`
- `hub/src/host/host.ts`
- `hub/test/executor-admission-lock.test.ts`
- `hub/src/host/records.ts`
- `hub/src/host/local.ts`
- `hub/test/fakes/discord/hub.ts`
- `hub/src/host/agent/server.ts`

## Migration assessment

- Adapter command producers: Claude `#run`, Codex version/spawn, OpenCode
  launch use the shared explicit-additions builder. Local Host still consumes
  complete environments; its native behavior is unchanged. Other Host.run/spawn
  callers (territory and local process helpers) keep that local complete-env
  contract. `HostCommand`'s shape is unchanged.
- Registry consumers: daemon adds the SSH lifecycle owner; projectSessions keeps
  explicit injection and CLAND_TEST_HOSTS. Existing Sessions, placement, orphan,
  worktree and account consumers continue to consume the Host interface.
- Agent clients: AgentClient accepts optional capabilities and native error code;
  SSH Host requires the new capability. Existing transport probes, raw socket
  fixtures, QA startup probes and stored process readers use the retained fields
  and monolithic operations. No old field or row is removed.
- Contract cases: only the forwarding/layout row adds optional per-Host inputs
  and expectations. Mapped launch-layout expectations migrate from hub base env
  to explicit additions; local expected argv/env/file bytes remain unchanged.
- Retained process readers and all T3/T4 callers keep their original row shapes.
  `processUsage` is a new operation for the full Host native snapshot; the
  existing recorded-process `processes` operation is preserved.
- `run-host` and `cancel-run` use a connection-scoped token for cancellation.
  The original monolithic `run` and its callers remain unchanged. `Host.run`
  cancellation waits for the original command's native cleanup result.
- Optional error `code` is consumed by LaunchFiles' existing ENOENT/EEXIST
  branches. Old errors without code remain valid. No client parses prose.

`hub/src/adapters/launch-files.ts` is also an explicit native-error consumer:
its `.code` branches for missing parents/existing directories need the additive
wire `code` carried through AgentClient and SSH Host error wrapping. It needs no
source migration; the real adapter-over-SSH tests exercise those branches.

`hub/test/host-records.test.ts` keeps its T2 native-free registration focus by
injecting inert f1/f2 Hosts when fake records are enabled. Otherwise the new
daemon owner would correctly start carrier processes at startup. Its database,
secret-redaction, alias and socket-budget assertions are unchanged. The new T3
registry case covers real carrier ownership. Historical QA briefs are pinned to
their recorded heads; current SSH integration fixtures explicitly select the fake
SSH binary and never use a real sshd or account.

A-16248 follow-up inventory: new `settle-prepared`, `native-receipts`, recovery
key and operation-id fields are consumed only by agent/prepared, agent/server
and SSH Host. Previous operations and reply fields remain. Completed outcomes
are addressed by exact id in prepared-results; startup streams unfinished plans.
`processHost.stop` now delegates a recorded Linux birth with an absent root to
the Host's retained-owner closure path, while rejecting live birth mismatches
and missing Linux proof. Existing session-host-routing assertions are unchanged.

Coordinator a5d3ae17 narrows the agent dependency exception to the existing shared
credential leaf, imported only by agent/command-environment with a Node-only
closure. Coordinator baaf0066 adds the pre-existing stop ps/birth observation race
to this item's scope. The exported predicate is single-owned in agent/native;
AgentProcesses.stop and T1 negative controls consume that same predicate.

A-16257 follow-up: run-host now carries an optional recoveryKey with its token;
SSH Host supplies UUID/key before admission, while raw fixture callers omitting
them receive server-minted identities. settle-prepared covers command outcomes
as well as prepared operations. parseAgentRun is the single parser used by
monolithic run and durable run-host. Commands with no cleanup receipt retain
an explicit unknown fence. No prior frame or result field is removed.

Native cleanup-incomplete classification is single-owned by agent/command.ts;
worktrees, prepared-checkout and prepared command settlement import it. Command
validation is single-owned by parseAgentRun. These helpers add no wire fields or
permission; old monolithic consumers retain their command/result shapes.

A-16262 follow-up inventory: prepared checkout native commands are called by
reserveCheckout, observeCheckout, validateCheckout and cleanupCheckout, all owned
by PreparedOperations; host-prepared tests also inspect the public cleanup/restart
seam. The optional checkout runner affects only that native boundary. Every
prepared Git inspection/mutation now checkpoints and restores through one owner.
The retained phase field and unknown-writer refusal are unchanged.

boundedCommandResult is consumed only by durable runCommand before saveOutcome.
The original run producer, doctor/report reexport, worktree/native helpers,
monolithic agent run, HostRunResult and all existing parsers retain their fields
and small-result behavior. SSH Host and raw run-host/settle-prepared clients
already accept the retained code/stdout/stderr/error shape; no field is added or
removed. Oversized durable results explicitly retain exit code and output tails,
so both direct and recovered replies fit the existing protocol byte policy.
AgentClient, server, transport probes, QA startup probes and old protocol fixtures
continue to use that policy unchanged. No persisted process reader is affected.

Verification 523013bf found an additional status-only consumer:
`hub/test/transport-status.test.ts` registers a host and then owns a fake carrier.
With automatic registered-host startup, it must inject its inert Host before
startup, as the host-records fixture already does. The migration changes setup
only; real hub.status, CLI rendering and previous-reply assertions remain exact.
No production transport ownership or reply contract changes.
