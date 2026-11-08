---
id: T-1743
kind: task
title: Launches placed on a pool's host
state: closed
status: done
size: M
criterion_seq: 6
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
updated: 2026-11-08T03:07:12.033Z
closed: 2026-11-08T03:07:12.033Z
---

## Summary

`session.launch` reads the role's `pool` at each launch. For a pool other than `local`, the scheduler places the session on a ready host of that pool, by weight, densely or spread, and the session row names the host. A launch for a role bound to a pool missing from `config.toml` is refused, naming the configured pools, before any reservation. The Coordinator and the Aide stay on `local` (`checkRoleHost`). An explicit `host` in the frame pins the launch to that host and bypasses the pool.

## What to build

The tracer bullet from roles to a running session on a pool's host. Until T-1744, a pool with no host that can take the launch refuses it with "no host in pool <pool>". An explicitly pinned host with no room refuses the launch; a pinned launch never waits. The pool runtime takes membership from the provision records and used weight from the process table. It uses T-1737's injected create seam, so placement is testable with provided fake Hosts.

## Acceptance criteria

- [x] C1. With `[implementer.launch] pool = "agents"` and one ready fake host in `agents`, an Implementer launch runs on that host, and `cland session list` names it (test).
  - done: impl-1743 · 2026-11-08T01:02:02.068Z
  - verified: rev-35 [reviewer] · run rev-35-1743-final-1 · 2026-11-08T02:18:42.300Z · commit 28f1627e19b5ddd423199ee957407fc41a144eb0
  - verified: rev-35 [reviewer] · run rev-35-1743-merge-1 · 2026-11-08T02:22:25.604Z · commit 7d146244bb28b347b97571016ef219e182472b51
- [x] C2. A role with no pool, or `pool = "local"`, launches on the local host as before (test).
  - done: impl-1743 · 2026-11-08T01:47:39.802Z
  - verified: rev-35 [reviewer] · run rev-35-1743-final-1 · 2026-11-08T02:18:42.300Z · commit 28f1627e19b5ddd423199ee957407fc41a144eb0
  - verified: rev-35 [reviewer] · run rev-35-1743-merge-1 · 2026-11-08T02:22:25.604Z · commit 7d146244bb28b347b97571016ef219e182472b51
- [x] C3. With two ready hosts, successive launches go to the fuller host with room, and after `spread = true` is set they go to the emptiest (test).
  - done: impl-1743 · 2026-11-08T01:08:53.518Z
  - verified: rev-35 [reviewer] · run rev-35-1743-final-1 · 2026-11-08T02:18:42.300Z · commit 28f1627e19b5ddd423199ee957407fc41a144eb0
  - verified: rev-35 [reviewer] · run rev-35-1743-merge-1 · 2026-11-08T02:22:25.604Z · commit 7d146244bb28b347b97571016ef219e182472b51
- [x] C4. A launch for a role bound to a pool missing from `config.toml` is refused naming the configured pools, with no role reserved and no spawn (test).
  - done: impl-1743 · 2026-11-08T00:51:18.194Z
  - verified: rev-35 [reviewer] · run rev-35-1743-final-1 · 2026-11-08T02:18:42.300Z · commit 28f1627e19b5ddd423199ee957407fc41a144eb0
  - verified: rev-35 [reviewer] · run rev-35-1743-merge-1 · 2026-11-08T02:22:25.604Z · commit 7d146244bb28b347b97571016ef219e182472b51
- [x] C5. Changing a role's `pool` in `roles.toml` between two launches moves the second launch without a hub restart (test).
  - done: impl-1743 · 2026-11-08T01:38:48.610Z
  - verified: rev-35 [reviewer] · run rev-35-1743-final-1 · 2026-11-08T02:18:42.300Z · commit 28f1627e19b5ddd423199ee957407fc41a144eb0
  - verified: rev-35 [reviewer] · run rev-35-1743-merge-1 · 2026-11-08T02:22:25.604Z · commit 7d146244bb28b347b97571016ef219e182472b51
- [x] C6. A launch with an explicit `host` runs on that host whatever the role's pool, and is refused when that host has no room (test).
  - done: impl-1743 · 2026-11-08T01:08:53.968Z
  - verified: rev-35 [reviewer] · run rev-35-1743-final-1 · 2026-11-08T02:18:42.300Z · commit 28f1627e19b5ddd423199ee957407fc41a144eb0
  - verified: rev-35 [reviewer] · run rev-35-1743-merge-1 · 2026-11-08T02:22:25.604Z · commit 7d146244bb28b347b97571016ef219e182472b51

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

### impl-1743 · 2026-11-08T00:51:19.223Z

Implementation complete: scoped placement precedes checkout/spawn; ready membership is reread from SQLite; process weights plus in-flight milli-slot promises feed dense/spread scheduler. Explicit provisioned pins check capacity. Remote views add optional host; CLI falls back local for old wire shape. T2 ten pool controls pass, including C1-C6, concurrent capacity, rollback and ready->destroying. Runtime importer inventory A-17647; 398 T1/T2 importer cases pass, extra 27 role/scheduler/help/placement cases pass. T0 npm run check passed (known report-only findings remain). Coordinator-authorized origin/dev merge 4360256ac completed; post-merge hub typecheck passed. Native host-create-ready full file and hub/worktrees + suite-coverage are green; remaining native importer files running serially under preservation lock. No real provider/browser evidence; Linux and exact-head verification pending review.

### rev-35 · 2026-11-08T00:55:22.427Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1743-source-1
commit: 4b80f81b1e04776f50facd8a3f4bf77b60ac63f4
scope: full
findings: [{"severity":"high","text":"Finally releases placement promise even when an accepted native launch remains pending cleanup, while PoolRuntime counts only running rows. Unpublished/stopped recovery generations disappear from capacity and allow overfill. Retain/transfer weighted ownership through positive cleanup, including persisted recovery and deduplication; author confirms no owner.","file":"hub/src/adapters/sessions.ts","line":1389},{"severity":"medium","text":"Ready/provision identity is checked only at selection; checkout/stat/policy awaits can cross ready→destroying or lost registration before spawn. validateLaunchHost does not revalidate ready provision membership. Bind/revalidate exact eligibility at final native admission; author confirms between-launch test does not cover this interval.","file":"hub/src/adapters/sessions.ts","line":1386},{"severity":"medium","text":"Placement reserves an extra weighted slot before existing idle crew-pool reuse, although the candidate already consumes used capacity. A full remote host refuses reuse needing no additional native capacity. Coordinate exact reuse/handoff accounting; no approved exception.","file":"hub/src/adapters/sessions.ts","line":1384},{"severity":"medium","text":"Extra Store has only later raw t.after close; earlier shared fixture hook tears down hub/root before it closes. Register immediate shared resource-phase cleanup; author confirms no other owner.","file":"hub/test/session-pool-placement.test.ts","line":25}]
finding_counts: {"high":1,"medium":3,"low":0}

A-17654 complete full Standards/Spec pass records1high/3medium, all confirmed in8a3d4a93/c78f9c38. Fresh role/pool selection, pre-checkout frame routing, optional wire host and frozen help migration inspected; no other findings. C2/C4/C5 remain runtime-unverified. A-17650/51/52 original T0/398importer/27compat receipts retain A-17653 working-tree/pre-grouping source limits; initial red/green transcript-only. Native importer producer still active, not counted complete. Keep pin/evidence attribution, then combined corrected committed request before configured verify. No reviewer tests/native probes/provenance-only rerun/fullsuite/dev merge requested. After-stage affected QA separate.

Criteria: C1 failed (Selected ready provision membership can change during preparation without final admission revalidation.), C3 failed (Outstanding native cleanup can be omitted from capacity, and full-host idle reuse is incorrectly charged an extra slot.), C6 failed (Pinned host capacity can undercount accepted generations retained only by cleanup recovery.).

### rev-35 · 2026-11-08T01:06:30.534Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1743-source-2
commit: 28019770ad242e10f44190fc5771f17b00d3c8c2
scope: full
findings: [{"severity":"high","text":"Capacity census omits retainedHostGenerations with unknown native closure. Cross-host relaunch persists an old unknown generation before moving the current row; a ready returned source has no excluding owner and can be overfilled. Include/dedup exact retained generations until confirmed closure/reboot; author31d8adf6 confirms.","file":"hub/src/adapters/sessions.ts","line":574},{"severity":"medium","text":"Restart refusal relies on a second normal running fake row that async startup recovery may remove before the assertion, so the test depends on timing. Make the retained unknown generation alone fill capacity and prove restart retention independently; author identifies/confirms.","file":"hub/test/session-pool-placement.test.ts","line":183},{"severity":"medium","text":"Positive-absence eventually observer has no prearmed resource-phase stop/join; an early trigger failure can leave UI polling through teardown. Arm ordered cancellation/join before starting it, preserving actual closure assertions; author confirms.","file":"hub/test/session-pool-placement.test.ts","line":231}]
finding_counts: {"high":1,"medium":2,"low":0}

A-17662 complete corrected pass: all four A-17654 repairs resolved (pending-stop census/dedup, final ready validator, exact reuse credit, resource-phase Store close). Remaining1high/2medium confirmed in31d8adf6 andba677bc7; retained-generation accounting plus two control ownership/independence fixes needed. C1 readiness repaired but runtime-unverified; C2/C4/C5 unverified. A-17657 importer416/416,A-17658 controls18/18,A-17659 T0/A-17660 chronological source limits retained; post-extraction hub typecheck0 reported. Old native20-fileA-17656 not corrected coverage; corrected native queued. Fresh combined pin before verify, no reviewer tests/native probes/provenance-only full rerun/dev merge requested. After-stage affected QA separate.

Criteria: C3 failed (Returned ready source can omit an unknown retained native generation from capacity after cross-host handoff.), C6 failed (Explicit pins can undercount retained unknown source generations and exceed host capacity.).

### rev-35 · 2026-11-08T01:10:24.227Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1743-source-3
commit: 38af1cf96b86ffba86e0621f0dc82d2fb202d1e3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17665 corrected full source clear: all seven A-17654/A-17662 findings resolved. Final production3-line census includes indexed unknown retained generations per open nonlocalHost, dedups against running/pending owners, excludes confirmed/rebooted. Restart control independently fills half-slot with one retained failure; observer prearmed resource cancellation/join; provided-fixture tag prevents missing fake-directory readiness confound, positive post-closure admission checks actual capacity. Earlier final-ready identity validation/exact idle reuse credit/Store cleanup and full compatibility/help review carry. All C1–C6 runtime-unverified. Latest19control passes/typecheck0 reported; final T0/importers/native20-file run pending with source linkage limits retained,9db intermediate red not green. Finish authorized corrected-source checks then mode-free verify at this exact pin; no extra fullsuite/devmerge/provenance-only rerun requested. No reviewer tests/native probes. After-stage affected QA separate.

### rev-35 · 2026-11-08T01:31:32.625Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1743-evidence-1
commit: 38af1cf96b86ffba86e0621f0dc82d2fb202d1e3
scope: evidence
findings: [{"severity":"medium","text":"New host text inserted between existing harness/status columns breaks permissions.test.ts:95 legacy session-list text assertion. Preserve column compatibility while retaining host facts; no approved expectation migration.","file":"hub/src/cli/session.ts","line":17},{"severity":"medium","text":"Placement's earlier role ticket changes crew-before-role refusal precedence: two Coordinator controls now receive role-held messages instead of singleton crew refusal. Both actual configured assertions fail; author confirms task-local gap/no approved migration.","file":"hub/src/adapters/sessions.ts","line":1391},{"severity":"medium","text":"Earlier placement name validation overtakes existing item claim refusal for lead-preassigned-duplicate (25chars), failing the claim assertion. No approved precedence migration; repair task-local compatibility while preserving claim test semantics.","file":"hub/test/lead-launch.test.ts","line":79}]
finding_counts: {"high":0,"medium":3,"low":0}

A-17674 not-clear evidence audit of128cd055/A-17673 exact reviewed38af head. T0/T1 pass; fallbackT2 fails4 actual assertions, confirmed task-local byb567691d; selectedT3/mappedT4/Web unexecuted. Retained summaries4775/4771/4 and interruption4900/4896/4 kept separate; parsed4701base4697pass4fail. Linuxx64 .147 Node24.21/Nvim.12.5,cachednull; browsernull/unexecuted. Local417component/20native447pass evidence remains labelled; A-17672 child exit0 transcript/outer-wrapper failure-propagation and hardcoded-head limits retained, not configured green. C2failed, othercriteria unverified. Fresh corrected source review before resubmission; no unchangedsource/provenance-only rerun or devmerge requested. After-stage affected QA separate.

Criteria: C2 failed (Configured legacy-local compatibility is red: CLI column shape, singleton refusal precedence and Lead item-claim control all fail.).

### rev-35 · 2026-11-08T01:35:45.184Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1743-source-4
commit: 8b191c0a62bdd2a406579c51a1385f861813dd61
scope: full
findings: [{"severity":"medium","text":"Implicit role captured before fresh/account awaits is not bound into placed request; Sessions.launch recomputes a changed assignment and can launch new role on old role's pool/account/harness. Bind/revalidate captured implicit role through final admission; author830a5a5c confirms no owner.","file":"hub/src/adapters/sessions.ts","line":1390},{"severity":"medium","text":"New early crewAdmissions.set/delete can overwrite an existing #restartPool handoff reservation while placementAdmissions/launching are absent. Duplicate-name refusal can delete another operation's crew owner. Refuse already-owned name or enforce exact reservation ownership; author06cfb7a0 confirms.","file":"hub/src/adapters/sessions.ts","line":1399}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17680 complete correction pass: four configured compatibility signatures addressed without changing assertions—CLI host appended afterPID, crew-before-ticket and item-claim-before-name restored. Remaining2medium confirmed implicit-role binding and earlier crew-owner clobber gaps. Source3 capacity/ready/retained fixes unchanged; other criteria runtime-unverified. A-17676 red24/4 andA-17677 correction76/76 local evidence retained; hub typecheck0 reported,fullT0/importers/natives pending. A-17673 configured red remains; fresh combined source pin before retry. No reviewer tests/native probes/provenance-only rerun/devmerge requested. After-stage affected QA separate.

Criteria: C2 failed (Early placement admission can erase an existing idle-worker handoff's crew reservation, regressing established launch ownership.), C5 failed (Implicit role can change across placement I/O and launch with the previous role's selected pool/defaults.).

### impl-1743 · 2026-11-08T01:38:23.673Z

Source-4 correction consumer scope: captured implicit role uses existing LaunchRequest.role, store.roleOf, role ticket/crew maps, #reuse/#restartPool and adapter final authorize; no frame/record/reply shape changed. Original rule-20 sweep already lists production frame/worktree/CLI/role callers, skills, fixtures and all tiers. New held-read control reproduced old-pool/new-role admission (true !== false), then passed after captured-role binding + role validation across awaits/final authorization. New held-handoff duplicate-name control reproduced 'already running' instead of reserved-handoff refusal, then passed after refusing existing crewAdmissions ownership before any write. Original expectations remain unchanged.

### rev-35 · 2026-11-08T01:41:53.248Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1743-source-5
commit: 56a2032802504d1c49dded8ca6a8d99ef623235b
scope: full
findings: [{"severity":"medium","text":"Reverse ownership race: reuse can select an idle worker whose name is held by early placement, then #restartPool overwrites crewAdmissions and the earlier release deletes that newer owner. New guard protects only handoff-first. Exclude early-owned candidates and retain exact handoff ownership; authorc26e9c6f confirms.","file":"hub/src/adapters/sessions.ts","line":423},{"severity":"medium","text":"New gate-release/join cleanup restores global fs.readFile/ESM or adapter.stop only after awaited request succeeds; rejected/timed-out joins skip restoration. Earlier UI resource closes first. Put restoration in finally while joining held work, including analogous callback; author361a7ee5 confirms.","file":"hub/test/session-pool-placement.test.ts","line":296}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17681 complete source5 pass. Implicit role binding fixed; handoff-first guard fixed, but reverse order remains unexcluded. Two medium blockers: reuse eligibility ignores early-held worker name, and new cleanup callbacks skip global/adapter restoration on rejected join. C5 repaired in source; othercriteria runtime-unverified. Hub typecheck0 reported; T0/importers/natives ongoing, pin fixed until producer completion. Subsequent production exclusion needs new source review; test-only carry not applicable. No reviewer native run, extra fullsuite/devmerge/provenance-only rerun requested. After-stage affected QA separate.

Criteria: C2 failed (Reverse early-placement/handoff ordering can still erase another crew reservation.).

### rev-35 · 2026-11-08T01:49:36.862Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1743-source-6
commit: 28f1627e19b5ddd423199ee957407fc41a144eb0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17682 corrected full source clear. A-17681 blockers resolved: reuse excludes early-held names, early placement excludes exact #reusing identities through preparation and crew-owner checks, #launchNew guards earlier roleless name; cleanup restores global/adapter patches in finally around joins. Original four configured assertions unchanged. Prior implicit-role binding, deduplicated running/pending/retained capacity, final-ready validation/exact reuse credit/Store ownership and wire/help review remain intact.84focused passes/hub typecheck0 reported; final current-source T0/importer/native receipts pending. Frozen56a predecessor native is not current production coverage; no test-only carry used. C1–C6 runtime-unverified; complete authorized checks then mode-free verify at this pin. A-17673 stays red predecessor. No reviewer tests/native probes/extra fullsuite/devmerge/provenance-only rerun requested. After-stage affected QA separate.

### rev-35 · 2026-11-08T02:18:42.300Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1743-final-1
commit: 28f1627e19b5ddd423199ee957407fc41a144eb0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; C1–C6 verified. A-17696 records independent inspection of configured62ab921d/A-17694: 5487 aggregate passes, zero fail/cancel/skip/todo; 5349 distinct base timing rows all pass, six empty failure arrays, execution projection ebde963913a6efc4ed0ce1c4a9ae2e8c41974dd5 independently matches reviewed28f1627e. All21 placement identities base+5/5 load (105/105 distinct repetitions), including every C1–C6 case, retained/pending generation accounting, readiness/identity, implicit-role and both handoff-order/name controls. All four earlier failed compatibility assertions now pass unchanged. Native host-create role-pool case passes6.18910225s within existing13.6s allowance. Directed final local450/450 plus20 native commands exit0/signalnull and447 reported passes inspected in A-17687–A-17690, with explicit label/source/descendant provenance limits preserved. T0/allT1/fallback-allT2/changedT3 once/mappedT4 base/Web completed; remainingT3 and T4 repetitions not claimed. Linuxx64 droplet Node24.21/Nvim0.12.5, HeadlessShell1248 CfT156.0.8078.4, uncached/skips[]; report-only budget/lint notices retained. Prior A-17673 remains red. No outstanding findings. After-stage affected QA remains separate on dev.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-35 · 2026-11-08T02:22:25.604Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1743-merge-1
commit: 7d146244bb28b347b97571016ef219e182472b51
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17700 dev-merge delta clear; C1–C6 renewed. Parents28f1627e+77579ea01 independently checked. Combined resolution onlyREADME retains both pointers; shared test index/tiers preserve both additions. Placement source/wire/CLI/tests match reviewed28f exactly; incoming lease source matches dev parent. Semantic ready→destroying checkpoint remains before cleanup awaits, and unchanged final placement identity validator observes it. A-17697 root typecheck exit0 and A-17698 five-file69/69 pass (zero fail/cancel/skip), including ready-leaving control, inspected; A-17699 original command/completion/source-linkage limits retained. Coordinator1cf9174d explicitly authorizes prior62ab921d/A-17694 carry after these merge checks. Prior5487/5487 remains executed at28f, not a new run/cache hit at7d; A-17696 preserves full audit/platform/coverage limits. No findings. RemainingT3/T4 repetition limits and after-stage affected QA remain separately owned; no further rerun requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-08T02:22:33.178Z

Rule 6/7 carry (coord): enqueued at merge head 7d146244. Verify 62ab921d (A-17694) passed at 28f1627e. The merge with dev 77579ea0 had a README index conflict only, both lines kept. Shared runtime files equal the dev parent, and placement source/tests equal 28f1627e. Typecheck exit 0 (A-17697); 69/69 placement/pool/scheduler/provision/lease cases pass, including the ready->destroying control (A-17698); delta review clear.

### coord · 2026-11-08T03:07:12.033Z

Merged 273ddcbdd485e33aa382a90efedda992ac0e6a00 onto dev.
