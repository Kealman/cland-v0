---
id: T-1743
kind: task
title: Launches placed on a pool's host
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1738
  - T-1739
  - T-1740
topic: topic-1436
branch: t/T-1743-launches-placed-on-a-pool-s-host
created: 2026-11-07T16:01:57.824Z
updated: 2026-11-08T00:41:06.825Z
---

## Summary

`session.launch` reads the role's `pool` at each launch. For a pool other than `local`, the scheduler places the session on a ready host of that pool, by weight, densely or spread, and the session row names the host. A launch for a role bound to a pool missing from `config.toml` is refused, naming the configured pools, before any reservation. The Coordinator and the Aide stay on `local` (`checkRoleHost`). An explicit `host` in the frame pins the launch to that host and bypasses the pool.

## What to build

The tracer bullet from roles to a running session on a pool's host. Until T-1744, a pool with no host that can take the launch refuses it with "no host in pool <pool>". An explicitly pinned host with no room refuses the launch; a pinned launch never waits. The pool runtime takes membership from the provision records and used weight from the process table. It uses T-1737's injected create seam, so placement is testable with provided fake Hosts.

## Acceptance criteria

- [ ] C1. With `[implementer.launch] pool = "agents"` and one ready fake host in `agents`, an Implementer launch runs on that host, and `cland session list` names it (test).
- [ ] C2. A role with no pool, or `pool = "local"`, launches on the local host as before (test).
- [ ] C3. With two ready hosts, successive launches go to the fuller host with room, and after `spread = true` is set they go to the emptiest (test).
- [ ] C4. A launch for a role bound to a pool missing from `config.toml` is refused naming the configured pools, with no role reserved and no spawn (test).
- [ ] C5. Changing a role's `pool` in `roles.toml` between two launches moves the second launch without a hub restart (test).
- [ ] C6. A launch with an explicit `host` runs on that host whatever the role's pool, and is refused when that host has no room (test).

## Blocked by

- T-1738
- T-1739
- T-1740

## Notes

- Hot files: `hub/src/adapters/sessions.ts` (launch host selection), `hub/src/host/pool-runtime.ts` (new), `hub/src/hub/daemon.ts` (wiring).
- Tests: new `hub/test/session-pool-placement.test.ts` (T2, provided fake Hosts tagged by pool); one case on the host-create fixture (T3).
- Serves epic C1 and C2.

## Comments

### impl-1743 · 2026-11-08T00:41:06.825Z

Rule 20 pre-change consumer sweep: session.launch, session.list, validateLaunchHost, HarnessProcessView, host, usedMilli/promisedMilli; production, wire clients, skills, briefs, fixtures and all test tiers searched. Add optional process host (old shape accepted); preserve all existing fields. Routing/worktree callers must acquire placement before checkout; resume/host resolution validators remain explicit-only. Pool membership uses existing provision records unchanged; scheduler contract unchanged. UI/Nvim consumers accept optional host with local fallback. Tests/deep-equals will be checked for optional-field impacts. Candidate search paths (includes unrelated host access, unchanged):

hub/src/hub/worktrees.ts
shared/wire/index.ts
hub/src/adapters/requests.ts
hub/src/hub/dispatch.ts
web/test/withdraw.test.ts
web/test/phone-sessions.test.ts
qa/briefs/E-412-stage-3.md
hub/test/launch-recovery.test.ts
qa/briefs/T-270.md
web/test/topics.test.ts
qa/briefs/E-1532.md
web/test/phone-notifications.test.ts
qa/briefs/E-1532-stage-6.md
.agents/skills/implement/SKILL.md
qa/briefs/E-414-stage-1.md
hub/test/lead-launch.test.ts
qa/briefs/E-418.md
web/test/session-actions.test.ts
hub/test/verifier-routing-process.test.ts
nvim/lua/cland/state.lua
web/test/key-contexts.test.ts
web/test/phone-approvals.test.ts
hub/test/durations.json
nvim/test/fixtures/graph-t19.json
web/test/passkeys.test.ts
hub/test/host-create-entry.test.ts
qa/briefs/E-1532-stage-2.md
hub/test/host-provision-records.test.ts
nvim/test/fixtures/protocol-frames/artifacts.json
nvim/lua/cland/panels.lua
web/test/phone-disconnected.test.ts
nvim/test/fixtures/protocol-frames/inbox-actions.json
hub/test/cli-session-credential.test.ts
qa/briefs/E-419.md
nvim/test/fixtures/protocol-frames/crew.json
web/test/palette.test.ts
nvim/test/fixtures/protocol-frames/launcher-component.json
qa/briefs/E-1534-stage-1.md
web/test/accounts.test.ts
web/src/sessions/SessionLaunch.tsx
nvim/test/fixtures/protocol-frames/item-prefixes.json
nvim/lua/cland/launcher.lua
qa/briefs/T-275.md
hub/test/wire-conformance.ts
nvim/lua/cland/hub.lua
web/test/events.test.ts
nvim/test/fixtures/protocol-frames/needs-you.json
web/test/sessions.test.ts
nvim/test/fixtures/protocol-frames/agents-filters.json
web/test/session-drawer.test.ts
qa/briefs/E-1532-stage-3.md
web/test/phone-composer.test.ts
web/test/inbox.test.ts
web/test/remote-via.test.ts
hub/test/visibility-component.test.ts
web/test/area-slots.test.ts
nvim/test/layers.test.ts
nvim/test/fixtures/protocol-frames/explorer.json
qa/briefs/E-417-stage-3.md
web/test/shell.test.ts
web/test/items.test.ts
nvim/test/fixtures/protocol-frames/explorer-component.json
web/test/session-launch.test.ts
nvim/lua/cland/init.lua
hub/test/transport-ssh.test.ts
web/src/connection.ts
nvim/test/fixtures/protocol-frames/shell.json
nvim/test/launcher-model-fixture.ts
web/test/items-actions.test.ts
nvim/test/readiness.ts
nvim/test/session-archive.test.ts
nvim/test/shell-component.test.ts
qa/briefs/E-419-stage-4.md
nvim/test/palette.test.ts
nvim/test/launcher-component.test.ts
nvim/test/fixtures/protocol-frames/shell-component.json
nvim/test/stub-hub.ts
qa/briefs/T-113.md
nvim/test/shell.test.ts
nvim/test/fixtures/protocol-frames/declined-ask-component.json
qa/briefs/E-1533.md
nvim/test/fixtures/protocol-frames/inbox-requests.json
nvim/test/fixtures/protocol-frames/panel-placement-component.json
nvim/test/fixtures/protocol-frames/human-marks-component.json
qa/briefs/T-108.md
hub/test/skills-onboarding.test.ts
nvim/test/fixtures/protocol-frames/message-users.json
nvim/test/fixtures/protocol-frames/plan-component.json
nvim/test/fixtures/protocol-frames/progress-counts-component.json
nvim/test/fixtures/protocol-frames.json
nvim/test/fixtures/protocol-frames/items.json
nvim/test/fixtures/protocol-frames/sessions.json
nvim/test/fixtures/protocol-frames/remote-via.json
nvim/test/fixtures/protocol-frames/events-quiet.json
nvim/test/fixtures/protocol-frames/vboard.json
hub/test/review-qa.test.ts
hub/test/session-host-routing.test.ts
hub/test/role-integrity.test.ts
nvim/test/fixtures/protocol-frames/thread.json
hub/test/roles-template-component.test.ts
hub/test/web-auth.test.ts
hub/test/host-reboot.test.ts
hub/test/clock.test.ts
hub/test/task-worktrees-lifecycle.test.ts
hub/test/config-reload-component.test.ts
qa/briefs/E-1538.md
hub/test/host-create-ready.test.ts
hub/test/account-network-preload.ts
hub/test/claude-code-sessions-lifecycle.test.ts
hub/test/host-ssh-contract.test.ts
hub/test/session-host.test.ts
hub/test/discord-workbench-fixture.ts
hub/test/approval-records.test.ts
hub/test/project-hub.test.ts
hub/test/opencode-native.test.ts
hub/test/nvim-items-rules.test.ts
hub/test/host-readiness-owner.test.ts
hub/test/adapter-generation.test.ts
hub/test/transport-forwards.test.ts
hub/test/subscription-hygiene.test.ts
hub/test/host-prepared.test.ts
qa/briefs/E-1533-stage-1.md
hub/test/host-runtime-owner.test.ts
hub/test/web-authority.test.ts
hub/test/host-reboot-native.test.ts
hub/test/web-area-state.test.ts
qa/briefs/E-418-stage-2.md
hub/test/host-scheduler.test.ts
hub/test/init-process.test.ts
hub/test/stage-qa.test.ts
hub/test/codex-adapter.test.ts
hub/test/telegram-marks-fixture.ts
hub/test/subscriptions.test.ts
hub/test/synthetic-provider.ts
hub/test/host-agent-restart.test.ts
hub/test/session-brief-component.test.ts
hub/test/host-relaunch-component.test.ts
hub/test/harness.ts
hub/test/session-resume-lifecycle.test.ts
hub/test/pid-identity.test.ts
hub/test/lead-handover-process.test.ts
hub/test/host-ssh-registry.test.ts
hub/test/session-brief.test.ts
hub/test/nvim-sessions-rules.test.ts
hub/test/auth-mode.test.ts
hub/test/rule-sessions.test.ts
hub/test/codex-host.test.ts
hub/test/opencode-launch-policy.test.ts
hub/test/session-resume-component.test.ts
qa/briefs/E-418-stage-3.md
hub/test/account-coalescing.test.ts
hub/test/permissions.test.ts
hub/test/git-maintenance-recovery.test.ts
hub/test/session-stop-races.test.ts
hub/test/cli-identity.test.ts
hub/test/aide-migration.test.ts
hub/test/session-archive.test.ts
hub/test/host-secret-admission.test.ts
hub/test/progress.test.ts
hub/test/lead-permissions.test.ts
hub/test/setup-remote-component.test.ts
hub/test/session-launch.test.ts
hub/test/worktree-host.test.ts
hub/test/host-relaunch-publication.test.ts
hub/test/host-clone-integration.test.ts
hub/test/inject-stalled.test.ts
qa/briefs/E-417.md
hub/test/session-credential-io.test.ts
hub/test/host-provision-gate.test.ts
hub/test/codex-workspace-git.test.ts
hub/test/session-usage.test.ts
qa/briefs/E-1538-stage-2.md
hub/test/host-allow-list.test.ts
hub/test/process-cleanup.test.ts
hub/test/roles-session-refresh.test.ts
hub/test/session-holds.test.ts
hub/test/host-relaunch-retry.test.ts
hub/test/cli-as-user.test.ts
hub/test/lead-permissions-component.test.ts
hub/test/opencode-adapter.test.ts
qa/briefs/E-611.md
hub/test/discord-users.test.ts
hub/test/host-registry.test.ts
hub/test/setup-hub.test.ts
hub/test/request-guard.test.ts
hub/test/suite-runner.test.ts
hub/test/claude-code-remote.test.ts
hub/test/approval-restart.test.ts
hub/test/claude-code-adapter.test.ts
hub/test/account-fixture-isolation.test.ts
hub/test/default-subscriptions.test.ts
hub/test/tracker-ready.test.ts
hub/test/startup-replies-fixture.ts
hub/test/hub-lock-identity.test.ts
hub/test/stop-classification-fixture.ts
hub/test/host-records.test.ts
hub/test/account-limited.test.ts
hub/test/lead-routing-process.test.ts
hub/test/host-runtime-join.test.ts
hub/test/opencode-remote.test.ts
hub/test/lead-permissions-process.test.ts
hub/test/codex-remote-agent.test.ts
hub/test/handover-process.test.ts
qa/briefs/E-1533-stage-3.md
hub/test/adapter-generation-forward.test.ts
hub/test/setup-accounts.test.ts
hub/test/discord-cards.test.ts
hub/test/hub-lock-readers.test.ts
hub/test/role-integrity-component.test.ts
hub/test/adapter-native-boundary.test.ts
qa/briefs/E-616.md
hub/test/config-set.test.ts
hub/test/task-worktrees.test.ts
hub/test/answer-users.test.ts
hub/test/roles-launch-permissions.test.ts
hub/test/adapter-composition.test.ts
hub/test/host-relaunch-native.test.ts
hub/test/roles-clauses.test.ts
hub/test/codex-remote.test.ts
hub/test/state-inventory.test.ts
hub/test/telegram-notices.test.ts
qa/briefs/T-268.md
hub/test/nvim-needs-you-rules.test.ts
hub/test/init-config.test.ts
hub/test/human-hold.test.ts
qa/briefs/E-1531.md
hub/test/session-async-processes.test.ts
qa/briefs/E-1538-stage-1.md
qa/briefs/E-419-stage-2.md
hub/test/tool-arguments.test.ts
hub/test/host-revoke.test.ts
qa/briefs/T-276.md
hub/test/crew-launch.test.ts
qa/briefs/E-419-stage-3.md
qa/briefs/E-414.md
qa/briefs/E-1531-stage-2.md
hub/test/user-invites.test.ts
hub/test/roles-editor.test.ts
qa/briefs/E-1006-stage-1.md
hub/test/host-agent.test.ts
qa/briefs/T-272.md
hub/test/subscription-frame.test.ts
hub/test/codex-native.test.ts
hub/test/default-subscriptions-lifecycle.test.ts
qa/briefs/E-1532-stage-4.md
qa/briefs/E-420.md
qa/cases/GRAPH-001.items.json
hub/test/host-destroy.test.ts
hub/test/telegram-approvals.test.ts
hub/test/accounts.test.ts
hub/test/session-host-placement.test.ts
qa/briefs/E-417-stage-1.md
qa/briefs/T-229.md
hub/test/plan-approval-reload.test.ts
hub/test/aide-component.test.ts
qa/briefs/T-269.md
hub/test/account-limits.test.ts
hub/test/fakes/telegram/fake-api.ts
qa/briefs/E-415.md
hub/test/claude-code-host.test.ts
hub/test/fakes/harness.ts
hub/test/inbox-requests.test.ts
hub/test/lead-handover.test.ts
hub/test/fakes/scripted-codex.ts
hub/test/claude-code-sessions.test.ts
hub/test/git-maintenance.test.ts
hub/test/fakes/discord/fake-api.ts
hub/test/computed-sessions.test.ts
hub/test/fakes/scripted-opencode.ts
hub/test/session-archive-merge.test.ts
hub/test/session-native-lifecycle.test.ts
qa/briefs/E-1006.md
hub/test/fake-harness.test.ts
hub/test/fake-ssh.test.ts
hub/test/host-push-on-ref-move.test.ts
hub/test/session-launch-component.test.ts
hub/test/telegram-users.test.ts
hub/test/codex-delivery.test.ts
hub/test/session-retry.test.ts
hub/test/host-spend.test.ts
hub/test/item-summary.test.ts
hub/test/inbox-workload.test.ts
hub/test/roles.test.ts
hub/test/secrets-environment.test.ts
hub/test/host-pools-config.test.ts
hub/test/project-probes.test.ts
hub/test/claude-code-schedule.test.ts
hub/test/verifier-resolver.test.ts
hub/test/host-git-daemon.test.ts
hub/test/codex-remote-cleanup.test.ts
hub/test/agents-journal.test.ts
hub/test/custom-roles-component.test.ts
hub/test/verifier-routing.test.ts
qa/briefs/E-418-stage-1.md
hub/test/session-holds-component.test.ts
hub/test/remote-discovery-host.test.ts
qa/briefs/E-1536-stage-3.md
hub/test/account-poller-clock.test.ts
hub/test/session-resume.test.ts
hub/test/roles-snapshot.test.ts
hub/test/host-revoke-native.test.ts
hub/test/lead-routing.test.ts
qa/briefs/E-417-stage-4.md
hub/test/visibility-events.ts
hub/test/heartbeat.test.ts
hub/test/asks.test.ts
qa/briefs/E-1531-stage-3.md
hub/test/host-prelude.test.ts
hub/test/plan-approval.test.ts
hub/test/visibility.test.ts
hub/test/orphan-servers.test.ts
hub/test/scenarios/setup.test.ts
hub/test/termination-ownership.test.ts
hub/test/scenarios/crew-launch.test.ts
hub/test/scenarios/hook-bridge.test.ts
hub/test/doctor.test.ts
hub/test/session-async-processes-lifecycle.test.ts
hub/test/session-events.test.ts
hub/test/claude-code-accounts.test.ts
hub/test/aide.test.ts
hub/test/web-authority-unit.test.ts
hub/test/topic-withdraw.test.ts
hub/test/host-relaunch.test.ts
hub/test/opencode-database.test.ts
hub/test/inbox-archive-workload.ts
hub/test/launch-files.test.ts
hub/test/host-boundary.ts
hub/test/host-survival-native.test.ts
hub/test/setup-flow.test.ts
hub/test/mod-bridge.test.ts
hub/test/gateway.test.ts
hub/test/tracker-native-boundary.test.ts
hub/test/tracker-ready-native.test.ts
hub/test/spoke-lazy-tools.test.ts
hub/test/host-attach-routing.test.ts
hub/test/startup-replies-scale.test.ts
hub/test/ask-chain.test.ts
hub/test/session-model.test.ts
hub/test/session-launch-lifecycle.test.ts
hub/test/host-flush-native.test.ts
hub/test/host-destroy-native.test.ts
hub/test/host-provision-recovery.test.ts
hub/test/transport-status.test.ts
hub/test/web-tunnel-guide.test.ts
hub/test/launch-admission.test.ts
hub/test/host-survival.test.ts
hub/test/roles-component.test.ts
hub/test/name-reservation.test.ts
hub/test/connection-snapshot.test.ts
hub/test/inbox-requests-component.test.ts
hub/test/fixtures/cli-usage/commands.json
hub/test/executor-prepare-component.test.ts
hub/test/fixtures/tracker-snapshot/items.json
.agents/skills/handover/SKILL.md
.agents/skills/qa/SKILL.md
