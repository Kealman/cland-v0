---
id: T-1810
kind: task
title: A login-release retry rewrites a destroyed host's provision back to destroying
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1779
found_by: droplet
topic: topic-1478
branch: t/T-1810-host-restart-reads-the-gone-host-s
created: 2026-11-11T04:44:47.089Z
updated: 2026-11-11T14:11:19.122Z
closed: 2026-11-11T14:11:19.122Z
---

## Summary

`hub/test/host-restart.test.ts::restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership` reads the gone host's provision and sometimes sees `destroying` instead of `destroyed`: once on the periodic dev T3 run 3fb22cf7 at 26dc219eb (Linux, A-18588), and 2 of 2 on macOS at T-1792's head dff15fef7 (A-18690, A-18693), while unmodified dev 10711a330 passed 5 of 5 alone (A-18699). impl-1792's timestamped trace (topic-1475, 2026-11-11 12:42Z) names the cause: the inherited `LoginReleaseOwner` retry calls Dispatcher `hooks.retry` → `destroyHostOnce`, which rewrites the provision from `destroyed` back to `destroying`, and the final `destroyed` save follows about 10 ms later. So this is a product defect from T-1779's release owner, not only a racing test read: a terminal provision state is rewritten by a retry, and timing decides whether a reader sees it.

## What to build

A retry of host release or destroy never rewrites a provision that has reached `destroyed`: `destroyHostOnce` (or the release owner's retry) recognises the already-destroyed provision and settles as done without a state write. The test then waits for the first `destroyed` with a named bound and asserts the state never leaves `destroyed` afterwards, through the case and the joined owner shutdown.

## Acceptance criteria

- [x] C1. A test reproduces the rewrite red before the fix: a release retry after the provision reached `destroyed` writes `destroying` (test).
  - done: impl-1810 · 2026-11-11T12:47:54.365Z
  - verified: rev-35 [reviewer] · run rev-35-1810-source-2 · 2026-11-11T12:56:07.786Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9
  - verified: rev-35 [reviewer] · run rev-35-1810-final-1 · 2026-11-11T13:24:03.183Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9
- [x] C2. After the fix a retry on a destroyed provision makes no state write and settles as done, and the provision's recorded transitions never leave `destroyed` once reached (test).
  - verified: rev-35 [reviewer] · run rev-35-1810-source-2 · 2026-11-11T12:56:07.786Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9
  - done: impl-1810 · 2026-11-11T13:21:25.716Z
  - verified: rev-35 [reviewer] · run rev-35-1810-final-1 · 2026-11-11T13:24:03.183Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9
- [x] C3. host-restart waits for the first `destroyed` with a named bound and asserts monotonic `destroyed` through shutdown, with every existing assertion kept (test).
  - done: impl-1810 · 2026-11-11T12:47:54.767Z
  - verified: rev-35 [reviewer] · run rev-35-1810-source-2 · 2026-11-11T12:56:07.786Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9
  - verified: rev-35 [reviewer] · run rev-35-1810-final-1 · 2026-11-11T13:24:03.183Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9
- [x] C4. host-restart passes five lone repetitions on macOS at the fix head and passes on Linux in the mode-free verify's changed-T3 run at the reviewed head, both recorded in an item comment (a local Linux container lacked ssh-keygen; diagnostic recorded).
  - done: impl-1810 · 2026-11-11T13:22:10.275Z
  - verified: rev-35 [reviewer] · run rev-35-1810-final-1 · 2026-11-11T13:24:03.183Z · commit 3ee73e112385461b3e4607bb445e60687146c7b9

## Comments

### coord · 2026-11-11T04:48:14.555Z

The periodic culprit search for 3fb22cf7 labelled host-restart "already-fixed on dev at 9eaec5315" because its failing-file rerun f345c8de passed there (A-18589, 9.7 s). Nothing between 26dc219eb and 9eaec5315 touches host-restart or its release path (T-1787 adds only storage writes), so the rerun pass is the flake's normal outcome, not a fix; this item stays open.

### coord · 2026-11-11T12:36:36.829Z

Second observation, 2026-11-11 12:36Z: impl-1792's native slot for T-1792 at dff15fef7 (macOS arm64 Node 24.21.0, host-restart alone in the standard environment) failed `actual destroying / expected destroyed`, the same line-73 race. T-1793 (15ee52343) has since changed host-restart.test.ts, so check that the race's read is still at line 73. Two failures out of roughly eight observed runs; raise the priority before stage-4 QA, whose brief will run host-restart natively.

### impl-1810 · 2026-11-11T12:39:13.121Z

Pre-fix experiment requested by Coordinator: unmodified dev base 10711a330, macOS arm64 Node v24.21.0, exact host-restart case alone in five fresh processes after stripping CLAND_*: 5/5 passed; test seconds 8.427934, 7.231815, 7.108718, 8.173490, 7.467099. Producer exit 0 and native close observed each time. No source changes; no red reproduced. T-1792 unchanged dff15fef7 reported 2/2 destroying-vs-destroyed failures. Reported split to Coordinator for ownership routing. T1/T2/Web/Linux unexecuted in this experiment.

### impl-1810 · 2026-11-11T12:45:07.911Z

C1 red before product fix at base 10711a330 plus test-only candidate: destroyed host release retry settles disk without a provision write failed (macOS arm64 Node24.21.0, T2 exact case, exit1/native close): actual writes [destroying,destroying,destroyed], expected []. Test time 0.199s. Rule20 consumer sweep before product change: shared suite importingTests transitive graph over all hub/web/nvim test files reaches 636, unknown 16 counted reached. Direct production paths: Dispatcher release-owner retry, host.stop/destroy, pool expiration; daemon restored leases; host-restart reconciliation; HostHealth loseHost; provision lease expiry. No wire shape, parser, auth or list row change. Existing destroyed state becomes monotonic; pending login cleanup still runs. Migrate login-release test expecting destroying/incomplete to owner-close and retained binding receipts; native host-restart monotonic observer; host-destroy-native and host-stop reached. Other transitive consumers retain identical contracts and will be covered by selected verification; T4 deferred to stage. Explicit symbol/field consumers (includes docs, shipped skills, fixture/persisted readers and all tiers):
hub/test/login-reconcile.test.ts
docs/hub/host-health.md
docs/hub/logins.md
hub/src/host/login-release-policy.ts
hub/src/host/login-release.ts
hub/src/host/host-health.ts
hub/src/hub/dispatch.ts
hub/src/hub/daemon.ts
hub/src/adapters/sessions.ts
docs/hub/host-providers.md
hub/src/host/host-restart.ts
.agents/skills/implement/CHANGES/T-1749-idle-stop.md
hub/src/host/provision-host.ts
hub/test/login-exclusive-native.test.ts
hub/src/host/provision-records.ts
hub/test/login-release.test.ts
hub/src/host/login-release-owner.ts
hub/src/host/status.ts
hub/src/host/login-reconcile.ts
hub/test/host-restart-reconcile.test.ts
hub/test/host-restart.test.ts
hub/test/host-provision-gate.test.ts
hub/test/host-unreachable.test.ts
hub/test/login-write-back.test.ts
hub/test/host-lease.test.ts
hub/test/pool-idle-stop.test.ts
hub/test/pool-failures.test.ts
hub/test/host-destroy.test.ts
hub/test/login-exclusive.test.ts
docs/agents/tests/hub-test-login-exclusive.test.ts.md
docs/agents/tests/hub-test-pool-idle-stop.test.ts.md

Complete transitive graph reached set:
hub/test/account-coalescing.test.ts
hub/test/account-fixture-env.test.ts
hub/test/account-fixture-isolation.test.ts
hub/test/account-limited.test.ts
hub/test/account-limits.test.ts
hub/test/account-poller.test.ts
hub/test/accounts.test.ts
hub/test/adapter-composition.test.ts
hub/test/adapter-generation-forward.test.ts
hub/test/adapter-generation.test.ts
hub/test/adapter-native-boundary.test.ts
hub/test/agents-filters.test.ts
hub/test/agents-journal.test.ts
hub/test/aide-claims-lifecycle.test.ts
hub/test/aide-claims.test.ts
hub/test/aide-component.test.ts
hub/test/aide-import-cli.test.ts
hub/test/aide-migration.test.ts
hub/test/aide.test.ts
hub/test/answer-users.test.ts
hub/test/approval-records.test.ts
hub/test/approval-restart.test.ts
hub/test/artifact-cli-lifecycle.test.ts
hub/test/artifact-cli.test.ts
hub/test/artifact-delete.test.ts
hub/test/artifact-folders.test.ts
hub/test/artifact-host.test.ts
hub/test/artifact-lifecycle.test.ts
hub/test/artifact-upload.test.ts
hub/test/artifact-user.test.ts
hub/test/artifacts-git.test.ts
hub/test/artifacts.test.ts
hub/test/ask-chain.test.ts
hub/test/ask-outcomes.test.ts
hub/test/asks-cli.test.ts
hub/test/asks.test.ts
hub/test/auth-mode.test.ts
hub/test/case-deadlines.test.ts
hub/test/claude-agent-launch.test.ts
hub/test/claude-capture-concurrency.test.ts
hub/test/claude-code-accounts.test.ts
hub/test/claude-code-adapter.test.ts
hub/test/claude-code-environment.test.ts
hub/test/claude-code-host.test.ts
hub/test/claude-code-remote-files.test.ts
hub/test/claude-code-remote.test.ts
hub/test/claude-code-schedule.test.ts
hub/test/claude-code-sessions-lifecycle.test.ts
hub/test/claude-code-sessions.test.ts
hub/test/claude-component-fixture.test.ts
hub/test/cli-as-user.test.ts
hub/test/cli-identity.test.ts
hub/test/cli-session-credential.test.ts
hub/test/cli.test.ts
hub/test/codex-adapter.test.ts
hub/test/codex-delivery.test.ts
hub/test/codex-host.test.ts
hub/test/codex-native.test.ts
hub/test/codex-remote-agent.test.ts
hub/test/codex-remote-cleanup.test.ts
hub/test/codex-remote.test.ts
hub/test/codex-sandbox-host.test.ts
hub/test/codex-workspace-git.test.ts
hub/test/computed-sessions.test.ts
hub/test/config-reload-component.test.ts
hub/test/config-reload.test.ts
hub/test/config-set.test.ts
hub/test/connection-resume.test.ts
hub/test/connection-resync.test.ts
hub/test/connection-snapshot.test.ts
hub/test/cover-quiet.test.ts
hub/test/crew-launch.test.ts
hub/test/crew.test.ts
hub/test/custom-roles-component.test.ts
hub/test/daemon.test.ts
hub/test/default-subscriptions-lifecycle.test.ts
hub/test/default-subscriptions-workflow.test.ts
hub/test/default-subscriptions.test.ts
hub/test/demo-cap.test.ts
hub/test/demo-provisioning.test.ts
hub/test/demo-release-component.test.ts
hub/test/demo-release.test.ts
hub/test/demo.test.ts
hub/test/dev-t3-search-component.test.ts
hub/test/discord-artifacts.test.ts
hub/test/discord-cards.test.ts
hub/test/discord-commands.test.ts
hub/test/discord-inbound-media.test.ts
hub/test/discord-messages.test.ts
hub/test/discord-messenger.test.ts
hub/test/discord-pairing.test.ts
hub/test/discord-render.test.ts
hub/test/discord-users.test.ts
hub/test/doctor-cli.test.ts
hub/test/doctor-isolation.test.ts
hub/test/doctor-remotes.test.ts
hub/test/doctor.test.ts
hub/test/edges-component.test.ts
hub/test/edges.test.ts
hub/test/epic-close.test.ts
hub/test/events-quiet.test.ts
hub/test/events.test.ts
hub/test/executor-admission-lock.test.ts
hub/test/executor-deletion-confirmation.test.ts
hub/test/executor-deletion-watchdog.test.ts
hub/test/executor-droplet-component.test.ts
hub/test/executor-droplet.test.ts
hub/test/executor-health.test.ts
hub/test/executor-liveness.test.ts
hub/test/executor-prepare-component.test.ts
hub/test/executor-prepare-retry.test.ts
hub/test/executor-prepare.test.ts
hub/test/executor-reap-confirmation.test.ts
hub/test/executor-recovery-collection.test.ts
hub/test/executor-retirement-component.test.ts
hub/test/executor-run.test.ts
hub/test/executor-safety-component.test.ts
hub/test/executor-safety.test.ts
hub/test/executor-snapshot-confirmation.test.ts
hub/test/executor.test.ts
hub/test/fake-claude-cleanup.test.ts
hub/test/fake-harness.test.ts
hub/test/fake-ssh.test.ts
hub/test/fixture-endpoints.test.ts
hub/test/fixture-orphans-lifecycle.test.ts
hub/test/fixture-orphans.test.ts
hub/test/fixture-socket-lifecycle.test.ts
hub/test/fixture-socket-path.test.ts
hub/test/fixture-worker-lifecycle.test.ts
hub/test/follows-native.test.ts
hub/test/follows.test.ts
hub/test/freshness.test.ts
hub/test/gateway-secrets.test.ts
hub/test/gateway-state.test.ts
hub/test/gateway.test.ts
hub/test/git-maintenance-cli.test.ts
hub/test/git-maintenance-startup.test.ts
hub/test/git-maintenance.test.ts
hub/test/handover-integrity-component.test.ts
hub/test/handover-integrity.test.ts
hub/test/handover-process.test.ts
hub/test/handover.test.ts
hub/test/harness-framing.test.ts
hub/test/harness-import.test.ts
hub/test/heartbeat.test.ts
hub/test/homebrew-publication.test.ts
hub/test/hook-bridge-doctor.test.ts
hub/test/host-agent-restart.test.ts
hub/test/host-agent.test.ts
hub/test/host-allow-list.test.ts
hub/test/host-attach-routing.test.ts
hub/test/host-attach.test.ts
hub/test/host-clone-integration.test.ts
hub/test/host-contract-coverage.test.ts
hub/test/host-create-admission.test.ts
hub/test/host-create-entry.test.ts
hub/test/host-create-ready.test.ts
hub/test/host-destroy-native.test.ts
hub/test/host-destroy.test.ts
hub/test/host-flush-native.test.ts
hub/test/host-flush.test.ts
hub/test/host-launch-layout.test.ts
hub/test/host-lease-lock.test.ts
hub/test/host-lease.test.ts
hub/test/host-local-contract.test.ts
hub/test/host-local-liveness.test.ts
hub/test/host-orphans.test.ts
hub/test/host-prepare.test.ts
hub/test/host-prepared.test.ts
hub/test/host-provision-gate.test.ts
hub/test/host-provision-recovery.test.ts
hub/test/host-push-facts.test.ts
hub/test/host-push-on-ref-move.test.ts
hub/test/host-readiness-owner.test.ts
hub/test/host-reboot-controller.test.ts
hub/test/host-reboot-native.test.ts
hub/test/host-reboot.test.ts
hub/test/host-records.test.ts
hub/test/host-registry.test.ts
hub/test/host-relaunch-component.test.ts
hub/test/host-relaunch-native.test.ts
hub/test/host-relaunch-publication.test.ts
hub/test/host-relaunch-retry.test.ts
hub/test/host-relaunch.test.ts
hub/test/host-restart-reconcile.test.ts
hub/test/host-restart.test.ts
hub/test/host-revoke-native.test.ts
hub/test/host-revoke.test.ts
hub/test/host-runtime-delivery.test.ts
hub/test/host-runtime-join.test.ts
hub/test/host-runtime-owner.test.ts
hub/test/host-secret-admission.test.ts
hub/test/host-ssh-contract.test.ts
hub/test/host-ssh-registry.test.ts
hub/test/host-status.test.ts
hub/test/host-stop.test.ts
hub/test/host-supervisor.test.ts
hub/test/host-survival-native.test.ts
hub/test/host-survival.test.ts
hub/test/host-unreachable.test.ts
hub/test/host-watchdog.test.ts
hub/test/hub-cards-voice.test.ts
hub/test/hub-cards.test.ts
hub/test/hub-lock-heartbeat.test.ts
hub/test/hub-lock-identity.test.ts
hub/test/hub-lock-readers.test.ts
hub/test/hub-priority.test.ts
hub/test/hub-status-component.test.ts
hub/test/human-hold.test.ts
hub/test/human-marks.test.ts
hub/test/human-routing.test.ts
hub/test/hygiene.test.ts
hub/test/import-github-lifecycle.test.ts
hub/test/import-github.test.ts
hub/test/in-process-spoke.test.ts
hub/test/inbox-actions.test.ts
hub/test/inbox-query.test.ts
hub/test/inbox-requests-component.test.ts
hub/test/inbox-requests.test.ts
hub/test/inbox-verifier-load.test.ts
hub/test/inbox-workload-soak.test.ts
hub/test/inbox-workload.test.ts
hub/test/init.test.ts
hub/test/inject-stalled.test.ts
hub/test/item-lead.test.ts
hub/test/item-summary-lua-soak.test.ts
hub/test/item-summary-lua.test.ts
hub/test/item-summary-scale.test.ts
hub/test/item-summary.test.ts
hub/test/journal-async.test.ts
hub/test/journal-flush.test.ts
hub/test/journal-subagents.test.ts
hub/test/launch-admission.test.ts
hub/test/launch-files.test.ts
hub/test/launch-recovery.test.ts
hub/test/launch-settlement.test.ts
hub/test/lead-handover-process.test.ts
hub/test/lead-handover.test.ts
hub/test/lead-launch.test.ts
hub/test/lead-permissions-component.test.ts
hub/test/lead-permissions-process.test.ts
hub/test/lead-permissions.test.ts
hub/test/lead-routing-process.test.ts
hub/test/lead-routing.test.ts
hub/test/lifecycle-serialization.test.ts
hub/test/login-add-component.test.ts
hub/test/login-add.test.ts
hub/test/login-binding.test.ts
hub/test/login-capacity-list.test.ts
hub/test/login-exclusive-native.test.ts
hub/test/login-exclusive.test.ts
hub/test/login-key-spawn.test.ts
hub/test/login-keys.test.ts
hub/test/login-list.test.ts
hub/test/login-provision-bind.test.ts
hub/test/login-reconcile.test.ts
hub/test/login-release.test.ts
hub/test/login-snapshot-cli.test.ts
hub/test/login-wait.test.ts
hub/test/login-write-back.test.ts
hub/test/measure-memory.test.ts
hub/test/merge-checkout-lifecycle.test.ts
hub/test/merge-checkout.test.ts
hub/test/merge-gate.test.ts
hub/test/merge-policy.test.ts
hub/test/merge-queue.test.ts
hub/test/merge-recovery-native.test.ts
hub/test/merge-recovery.test.ts
hub/test/merge.test.ts
hub/test/message-users.test.ts
hub/test/models.test.ts
hub/test/name-reservation.test.ts
hub/test/names.test.ts
hub/test/nvim-agents-filters-rules.test.ts
hub/test/nvim-artifacts-rules.test.ts
hub/test/nvim-crew-rules.test.ts
hub/test/nvim-inbox-requests-rules.test.ts
hub/test/nvim-item-prefixes-rules.test.ts
hub/test/nvim-items-rules.test.ts
hub/test/nvim-needs-you-rules.test.ts
hub/test/nvim-sessions-rules.test.ts
hub/test/open.test.ts
hub/test/opencode-adapter.test.ts
hub/test/opencode-database.test.ts
hub/test/opencode-host.test.ts
hub/test/opencode-launch-policy.test.ts
hub/test/opencode-native.test.ts
hub/test/opencode-remote-cleanup.test.ts
hub/test/opencode-remote.test.ts
hub/test/orphan-servers-perf.test.ts
hub/test/orphan-servers.test.ts
hub/test/orphan-sweep-lock.test.ts
hub/test/outbox-gateway.test.ts
hub/test/outbox.test.ts
hub/test/pairing-approval.test.ts
hub/test/pairing-codes.test.ts
hub/test/permissions.test.ts
hub/test/pid-identity.test.ts
hub/test/plan-approval-reload.test.ts
hub/test/plan-gate.test.ts
hub/test/planned-stage.test.ts
hub/test/poller-lease.test.ts
hub/test/pool-failures.test.ts
hub/test/pool-idle-stop.test.ts
hub/test/pool-scale.test.ts
hub/test/pool-spend-cap.test.ts
hub/test/prepared-project.test.ts
hub/test/presence.test.ts
hub/test/process-cleanup.test.ts
hub/test/progress.test.ts
hub/test/project-clock.test.ts
hub/test/project-hub-lifecycle.test.ts
hub/test/project-hub.test.ts
hub/test/project-probes.test.ts
hub/test/prompt-races.test.ts
hub/test/publish-component.test.ts
hub/test/publish.test.ts
hub/test/push-component.test.ts
hub/test/push.test.ts
hub/test/qa-lint-build.test.ts
hub/test/qa-lint-cli.test.ts
hub/test/quarantine-runner.test.ts
hub/test/release-item.test.ts
hub/test/release-t3-component.test.ts
hub/test/release.test.ts
hub/test/remote-cli.test.ts
hub/test/remote-discovery-cli.test.ts
hub/test/remote-discovery-host.test.ts
hub/test/remote-docs-pairing.test.ts
hub/test/remote-fixture-lifecycle.test.ts
hub/test/remote-neutral.test.ts
hub/test/remote-scripted.test.ts
hub/test/remote-state-migration.test.ts
hub/test/remote-state.test.ts
hub/test/remote-workbench.test.ts
hub/test/request-guard-component.test.ts
hub/test/request-guard.test.ts
hub/test/resilience-component.test.ts
hub/test/resilience.test.ts
hub/test/review-qa.test.ts
hub/test/role-integrity-component.test.ts
hub/test/role-integrity.test.ts
hub/test/role-launch.test.ts
hub/test/roles-component.test.ts
hub/test/roles-session-refresh.test.ts
hub/test/roles-snapshot-cli.test.ts
hub/test/roles-snapshot.test.ts
hub/test/roles-template-component.test.ts
hub/test/roles-timing.test.ts
hub/test/roles.test.ts
hub/test/routing.test.ts
hub/test/rule-cli.test.ts
hub/test/rule-sessions-component.test.ts
hub/test/rule-sessions.test.ts
hub/test/scenarios/crew-launch.test.ts
hub/test/scenarios/droplet-verify.test.ts
hub/test/scenarios/hook-bridge.test.ts
hub/test/scenarios/hub-lifecycle.test.ts
hub/test/scenarios/message-tracer.test.ts
hub/test/scenarios/release.test.ts
hub/test/scenarios/remotes.test.ts
hub/test/scenarios/setup.test.ts
hub/test/scenarios/stage-close.test.ts
hub/test/scenarios/startup-smoke.test.ts
hub/test/scenarios/ticket-flow.test.ts
hub/test/secrets-environment.test.ts
hub/test/secrets.test.ts
hub/test/session-archive-merge.test.ts
hub/test/session-archive.test.ts
hub/test/session-async-processes-lifecycle.test.ts
hub/test/session-async-processes.test.ts
hub/test/session-brief-component.test.ts
hub/test/session-brief.test.ts
hub/test/session-credential-io.test.ts
hub/test/session-events-component.test.ts
hub/test/session-events.test.ts
hub/test/session-holds-component.test.ts
hub/test/session-holds.test.ts
hub/test/session-host-placement.test.ts
hub/test/session-host-routing.test.ts
hub/test/session-host.test.ts
hub/test/session-launch-component.test.ts
hub/test/session-launch-lifecycle.test.ts
hub/test/session-launch.test.ts
hub/test/session-model.test.ts
hub/test/session-native-lifecycle.test.ts
hub/test/session-pool-placement.test.ts
hub/test/session-resume-component.test.ts
hub/test/session-resume-lifecycle.test.ts
hub/test/session-resume.test.ts
hub/test/session-retry.test.ts
hub/test/session-stop-races-cleanup.test.ts
hub/test/session-stop-races-component.test.ts
hub/test/session-stop-races.test.ts
hub/test/session-usage.test.ts
hub/test/setup-cli.test.ts
hub/test/setup-favourite.test.ts
hub/test/setup-flow.test.ts
hub/test/setup-handover.test.ts
hub/test/setup-hub-component.test.ts
hub/test/setup-hub.test.ts
hub/test/setup-pairing-component.test.ts
hub/test/setup-remote-component.test.ts
hub/test/setup-remotes.test.ts
hub/test/shared-defects-report.test.ts
hub/test/skills-onboarding.test.ts
hub/test/skills-qa.test.ts
hub/test/skills-tracker-jq.test.ts
hub/test/skills-tracker.test.ts
hub/test/speech-command.test.ts
hub/test/spoke-artifact-budget.test.ts
hub/test/spoke-footprint.test.ts
hub/test/spoke-identity.test.ts
hub/test/spoke-lazy-tools.test.ts
hub/test/spoke-stdio.test.ts
hub/test/spoke-unix-edge.test.ts
hub/test/stage-closure-component.test.ts
hub/test/stage-qa.test.ts
hub/test/startup-cleanup.test.ts
hub/test/startup-deadline-component.test.ts
hub/test/startup-ready-component.test.ts
hub/test/startup-replies-scale.test.ts
hub/test/startup-smoke.test.ts
hub/test/startup-task-pages-soak.test.ts
hub/test/state-inventory.test.ts
hub/test/store-and-forward.test.ts
hub/test/subscription-frame.test.ts
hub/test/subscription-hygiene.test.ts
hub/test/subscriptions.test.ts
hub/test/suite-admission-close.test.ts
hub/test/suite-admission-cost.test.ts
hub/test/suite-admission-responsive.test.ts
hub/test/suite-admission.test.ts
hub/test/suite-cache-recovery.test.ts
hub/test/suite-cancel.test.ts
hub/test/suite-candidate-remote.test.ts
hub/test/suite-candidate.test.ts
hub/test/suite-check.test.ts
hub/test/suite-close-component.test.ts
hub/test/suite-close-recovery.test.ts
hub/test/suite-close.test.ts
hub/test/suite-coverage.test.ts
hub/test/suite-dry-run.test.ts
hub/test/suite-human-component.test.ts
hub/test/suite-human.test.ts
hub/test/suite-hung-component.test.ts
hub/test/suite-preflight.test.ts
hub/test/suite-protocol.test.ts
hub/test/suite-queue-policy.test.ts
hub/test/suite-recovery.test.ts
hub/test/suite-release-cache.test.ts
hub/test/suite-remote-process.test.ts
hub/test/suite-runner-contract.test.ts
hub/test/suite-selection-component.test.ts
hub/test/suite-selection-report.test.ts
hub/test/suite-selection.test.ts
hub/test/suite-soak-component.test.ts
hub/test/suite-stage-cover.test.ts
hub/test/suite-timeouts.test.ts
hub/test/suite-wait-metrics.test.ts
hub/test/suite.test.ts
hub/test/surface.test.ts
hub/test/system-processes.test.ts
hub/test/task-attribution.test.ts
hub/test/task-card-component.test.ts
hub/test/task-card.test.ts
hub/test/task-migrate.test.ts
hub/test/task-plan.test.ts
hub/test/task-prefixes.test.ts
hub/test/task-size.test.ts
hub/test/task-worktrees-lifecycle.test.ts
hub/test/telegram-approvals.test.ts
hub/test/telegram-artifacts.test.ts
hub/test/telegram-cards.test.ts
hub/test/telegram-catchup.test.ts
hub/test/telegram-commands.test.ts
hub/test/telegram-gap.test.ts
hub/test/telegram-graceful-restart.test.ts
hub/test/telegram-inbound.test.ts
hub/test/telegram-liveness.test.ts
hub/test/telegram-marks-setup.test.ts
hub/test/telegram-messenger.test.ts
hub/test/telegram-mute.test.ts
hub/test/telegram-notices.test.ts
hub/test/telegram-pacing.test.ts
hub/test/telegram-pairing.test.ts
hub/test/telegram-polling-restart.test.ts
hub/test/telegram-polling.test.ts
hub/test/telegram-rendering.test.ts
hub/test/telegram-users.test.ts
hub/test/telegram-voice-answers.test.ts
hub/test/telegram-voice-command.test.ts
hub/test/telegram-voice.test.ts
hub/test/termination-ownership.test.ts
hub/test/territory-cli.test.ts
hub/test/territory-lock.test.ts
hub/test/territory-task-branch.test.ts
hub/test/test-admission.test.ts
hub/test/thread-runs-store.test.ts
hub/test/thread-runs.test.ts
hub/test/tier-tripwire-runner.test.ts
hub/test/tool-arguments-spoke.test.ts
hub/test/tool-arguments.test.ts
hub/test/topic-model.test.ts
hub/test/topic-withdraw.test.ts
hub/test/topics-component.test.ts
hub/test/topics.test.ts
hub/test/tracker-async-component.test.ts
hub/test/tracker-async.test.ts
hub/test/tracker-component.test.ts
hub/test/tracker-conflict-captures.test.ts
hub/test/tracker-criteria.test.ts
hub/test/tracker-criterion-crash.test.ts
hub/test/tracker-criterion-write.test.ts
hub/test/tracker-hierarchy.test.ts
hub/test/tracker-levels.test.ts
hub/test/tracker-load.test.ts
hub/test/tracker-native-boundary.test.ts
hub/test/tracker-rank.test.ts
hub/test/tracker-ready-native.test.ts
hub/test/tracker-ready.test.ts
hub/test/tracker-status-component.test.ts
hub/test/tracker-status.test.ts
hub/test/tracker-summary.test.ts
hub/test/tracker.test.ts
hub/test/transport-config.test.ts
hub/test/transport-fake-contract.test.ts
hub/test/transport-forwards.test.ts
hub/test/transport-ssh-contract.test.ts
hub/test/transport-ssh.test.ts
hub/test/transport-status.test.ts
hub/test/user-invites.test.ts
hub/test/v01-migration.test.ts
hub/test/verdict-commit-component.test.ts
hub/test/verdict-commit.test.ts
hub/test/verdict-criteria.test.ts
hub/test/verdict-findings.test.ts
hub/test/verification-commands.test.ts
hub/test/verification-tree.test.ts
hub/test/verification-workers.test.ts
hub/test/verifier-routing-process.test.ts
hub/test/verifier-routing.test.ts
hub/test/verify-all.test.ts
hub/test/verify-prepare.test.ts
hub/test/verify-submission.test.ts
hub/test/verify-tool.test.ts
hub/test/visibility-component.test.ts
hub/test/visibility-volume.test.ts
hub/test/visibility.test.ts
hub/test/waiting-launch-restart.test.ts
hub/test/waiting-launch.test.ts
hub/test/web-artifacts.test.ts
hub/test/web-auth.test.ts
hub/test/web-authority.test.ts
hub/test/web-cookie-secure.test.ts
hub/test/web-edge.test.ts
hub/test/web-release-publication.test.ts
hub/test/web-signin.test.ts
hub/test/web-tunnel-guide.test.ts
hub/test/web-upload.test.ts
hub/test/worktree-cli.test.ts
hub/test/worktree-host.test.ts
nvim/test/artifact-browser.test.ts
nvim/test/artifact-upload.test.ts
nvim/test/client.test.ts
nvim/test/closed-pages.test.ts
nvim/test/criteria.test.ts
nvim/test/explorer-card.test.ts
nvim/test/explorer-compose.test.ts
nvim/test/explorer-roots.test.ts
nvim/test/explorer.test.ts
nvim/test/graph-layout.test.ts
nvim/test/layers.test.ts
nvim/test/message-users-live.test.ts
nvim/test/palette.test.ts
nvim/test/qa-shipped.test.ts
nvim/test/qa.test.ts
nvim/test/remotes.test.ts
nvim/test/rulebook.test.ts
nvim/test/sessions-lifecycle.test.ts
nvim/test/shell.test.ts
nvim/test/startup-budget.test.ts
nvim/test/telegram-marks.test.ts
nvim/test/ui.test.ts
web/test/accounts.test.ts
web/test/area-slots.test.ts
web/test/artifacts.test.ts
web/test/asks.test.ts
web/test/board.test.ts
web/test/composer.test.ts
web/test/connection.test.ts
web/test/events.test.ts
web/test/folds.test.ts
web/test/graph.test.ts
web/test/inbox.test.ts
web/test/item-card.test.ts
web/test/item-criteria.test.ts
web/test/items-actions.test.ts
web/test/items-order.test.ts
web/test/items.test.ts
web/test/key-contexts.test.ts
web/test/message-users.test.ts
web/test/messages.test.ts
web/test/notifications.test.ts
web/test/pairing.test.ts
web/test/palette.test.ts
web/test/passkeys.test.ts
web/test/phone-approvals.test.ts
web/test/phone-asks.test.ts
web/test/phone-composer.test.ts
web/test/phone-disconnected.test.ts
web/test/phone-inbox.test.ts
web/test/phone-install.test.ts
web/test/phone-more.test.ts
web/test/phone-notifications.test.ts
web/test/phone-sessions.test.ts
web/test/phone-thread.test.ts
web/test/phone.test.ts
web/test/plan.test.ts
web/test/readme.test.ts
web/test/remote-via.test.ts
web/test/remotes.test.ts
web/test/session-actions.test.ts
web/test/session-drawer.test.ts
web/test/session-launch.test.ts
web/test/sessions.test.ts
web/test/shell.test.ts
web/test/signin.test.ts
web/test/smoke.test.ts
web/test/telegram-marks.test.ts
web/test/thread-artifacts.test.ts
web/test/thread-runs.test.ts
web/test/topics.test.ts
web/test/uploads.test.ts
web/test/verification.test.ts
web/test/withdraw.test.ts
Unknowns treated reached:
hub/test/web-notifications.test.ts: Error: incomplete import graph: vm loader [hub/test/web-notifications.test.ts]
hub/test/init-process.test.ts: Error: incomplete import graph: eval or indirect module loader [hub/test/init-process.test.ts]
hub/test/suite-task-selection.test.ts: Error: incomplete import graph: non-literal module specifier [hub/test/run-suite.ts]
hub/test/suite-accounting.test.ts: Error: incomplete import graph: indirect require [hub/test/suite-accounting.test.ts]
hub/test/suite-remote-budget.test.ts: Error: incomplete import graph: indirect require [hub/test/suite-remote-budget.test.ts]
hub/test/executor-safety-load.test.ts: Error: incomplete import graph: eval or indirect module loader [hub/test/executor-safety-load.test.ts]
hub/test/suite-runner.test.ts: Error: incomplete import graph: eval or indirect module loader [hub/test/web-repetitions.ts]
hub/test/task-worktrees.test.ts: Error: incomplete import graph: unsupported createRequire base [hub/test/task-worktrees.test.ts]
nvim/test/scenarios/workbench.test.ts: Error: incomplete import graph: unresolved module specifier yaml
nvim/test/plan.test.ts: Error: incomplete import graph: unresolved module specifier yaml
nvim/test/plan-component.test.ts: Error: incomplete import graph: unresolved module specifier yaml
hub/test/typecheck.test.ts: Error: incomplete import graph: unsupported createRequire base [hub/test/typecheck.test.ts]
hub/test/plan-approval.test.ts: Error: incomplete import graph: vm loader [hub/test/plan-approval.test.ts]
hub/test/sqlite-contention.test.ts: Error: incomplete import graph: eval or indirect module loader [hub/test/sqlite-contention.test.ts]
hub/test/mod-bridge.test.ts: Error: incomplete import graph: non-literal module specifier [hub/test/mod-bridge.test.ts]
hub/test/suite-admission-native.test.ts: Error: incomplete import graph: unsupported createRequire base [hub/test/suite-admission-native.test.ts]

### impl-1810 · 2026-11-11T12:50:40.284Z

C1/C2/C3 evidence at e55f4838b: A-18704 (durable artifact) contains deterministic pre-fix T2 red: terminal retry actual writes [destroying,destroying,destroyed], expected []; fixed login-release26/26 including zero-write regression, macOS arm64 Node24.21.0 host-restart5/5 (7.286,7.262,6.954,6.915,7.510s), host-destroy-native3/3, host-stop4/4. All producers closed; no browser. Includes full TMPDIR name sets and normalized671-path consumer inventory with tier/disposition/execution. Typecheck/wording pass; test lint report mode122 findings59 files, zero refusals. Linux Docker --init --network none arm64 Node24.21.0 prerequisite failed before acquisition: spawn ssh-keygen ENOENT; no Linux behaviour evidence and no C4 pass claimed. Coordinator revised C4 to macOS5 plus changed-T3 Linux mode-free verification and merge batch. Full T3/T4 deferred to merge/stage occasions. Source review requested at exact pushed head; documentation corrections held pending complete pass.

### impl-1810 · 2026-11-11T12:54:20.200Z

Publication receipt A-18707: synthetic bearer positive control rejected before static rescan; exact durable A-18704 bytes3234411 sha2560811d20f29139545e8a575ebf141de4a9ecf5d93485d95169ae0823d0046d8ca and A-18705 bytes3295035 sha25664274d68928325f6df683b69dcab0a11d09e6b3ef44d85942a4c792c3938f543 both scan pass, producer exit0. This is post-publication rescan; original packaging scans preceded publication without retained positive control. Raw reporter capture lacked write-time redactor; Coordinator a1d226cb applies accepted fake-only sentinel disposition under T-1808, no block. Four native socket dirs are known T-1806 per Coordinator adcda448; no deletion/closure inferred. Docs/comment-only review delta corrects binder receipt attribution and revised C4 split; runtime unchanged.

### rev-35 · 2026-11-11T12:54:39.343Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1810-source-1
commit: e55f4838b2acd65e82988b20f58135047a633647
scope: full
findings: [{"severity":"medium","text":"Standards rule16/rule20: the touched release-owner paragraph still assigns pending native bindings to startup reconciliation, although landed LoginReconciliation skips hasPendingBinding and the corrected shared paragraph assigns admitted binder receipts. Lead6babf802 confirms no supporting disposition. Correct this paragraph and the identified source-comment/shipped-skill consumers (login-release-policy.ts:6, implement/SKILL.md:329), retaining binder/reader receipt fencing and the skill CHANGES provenance; do not promise automatic pending-binding recovery.","file":"docs/hub/logins.md","line":151},{"severity":"medium","text":"Standards rule16 and Spec revised C4: new replay guidance still requests five Linux container repetitions after Coordinator replaced them with macOS5 plus Linux changed-T3 mode-free verify and merge-batch evidence. The container failed setup with spawn ssh-keygen ENOENT and supplied no behavior receipt. Lead2057ae5f confirms guidance has no historical exception. Update the guide to the approved evidence split and preserve the diagnostic/final assertions.","file":"docs/agents/tests/hub-test-host-restart.test.ts.md","line":35},{"severity":"low","text":"Evidence capture limitation: A-18705's retained launchers write raw reporter output without shared token/bearer redaction. Lead680c2448 reports assertPublishable ran before A-18704/A-18705 publication but no explicit pre-publication positive-control receipt was retained. Preserve original bytes and honest limits, record the static rescan/control and Coordinator disposition under the existing T-1808 capture-helper class; a later scan must not be relabeled pre-publication proof. No native/provenance-only rerun requested."}]
finding_counts: {"high":0,"medium":2,"low":1}

A-18708 completes the pinned e55f4838b source pass: Standards2medium docs +1low capture limitation; Spec same C4 docs mismatch, no additional production defect. Terminal branch runs retained login cleanup without provision writes/repeated machine release; T2 zero-write and T3 prearmed durable-destroy/monotonic-through-shutdown controls otherwise source-aligned. A-18705 normalizes671 paths and retains original red/green logs/launcher completion transcriptions; native observations are precommit support with no launch-time hash, not exact-head receipts. os.tmpdir unchanged;4 /tmp aliases explicitly dispositioned T1806 by adcda448. Linux container setup failed ssh-keygen ENOENT, not behavior evidence. No Reviewer tests or native work. C2/C4 failed for matching docs/guidance, no criteria verified. Hold released. Replacement3ee73e112 request arrived during verdict publication; it will receive its own fresh source pass, not inherit this result.

Criteria: C2 failed (Touched current ownership documentation still assigns pending bindings to startup reconciliation instead of admitted binder receipts.), C4 failed (New preservation guidance contradicts Coordinator-revised Linux changed-T3 verification and merge-batch evidence split.).

### rev-35 · 2026-11-11T12:56:07.786Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1810-source-2
commit: 3ee73e112385461b3e4607bb445e60687146c7b9
scope: full
findings: [{"severity":"low","text":"Known nonblocking capture limitation: A-18704/A-18705 contain raw reporter output without shared write-time token/bearer redaction. Initial packaging assertPublishable had no retained positive-control receipt. A-18707 honestly records a post-publication synthetic-control/exact-byte rescan exit0; both retained-byte sizes/SHA256 values match. Coordinator a1d226cb/33876cf8 explicitly accepts this fake-only T-1808 class. Original timing/provenance limits remain; no redacted-stream or prepublication-control claim."}]
finding_counts: {"high":0,"medium":0,"low":1}

A-18712 source2 CLEAR. Both A-18708 medium documentation findings resolved: pending binding receipt ownership correct in docs/comment/skill+CHANGES; Linux guide matches revised C4. Five-path delta is docs/comments only; independently confirmed stripped policy bytes equal and production/test bodies identical, satisfying Coordinator33876cf8 native carry authorization (A-18709). C1/C2/C3 verified from source, retained deterministic red and fixed MacT2/native receipts; precommit/no launch-hash limitation remains explicit. C4 Linux exact-head mode-free verify and merge batch outstanding. One low raw-capture/initial missing-control limitation retained as nonblocking T1808, explicitly accepted a1d226cb/33876cf8 after A-18707 postpublication positive-control exact-byte rescan exit0; sizes/hashes independently match. Four retained /tmp aliases accepted T1806 adcda448; no global-empty claim. Full671 path accounting/source-proof limits in artifact. No Reviewer tests/native/provider/browser. Hold released; mode-free verification may proceed at this stable reviewed head, final runtime settlement separate.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1810 · 2026-11-11T13:22:44.194Z

C4 done per Coordinator78a26e4a: accepted Mac5 (A-18704/A-18705 carry-over authorized by A-18709 stripped-comment diff and independently reviewed A-18712) plus exact reviewed-head Linux changed-T3 fe2368bf/A-18729 at3ee73e112 tree6fb9db555faa2f1cd1b1a72f468e7c34338bc289. Linux x64 droplet c-8 lon1 Node24.21.0; T0/allT1/fallback allT2/Web/changed host-restart T3 once;6015pass,0fail,0skip. New retry regression base0.129682s plus5/5load repetitions; host-restart base11.199s (all original assertions+monotonicity). Browser Headless Shell Google Chrome for Testing156.0.8078.4. Durations/test lint report mode. A-18732 streams34016log lines into exact-case/per-file reconciliation across671consumer paths; target login-release31completion records(26base including nested test+5load), host-stop4, host-restart1, host-destroy-native Linux unexecuted(native Mac3/3). Remaining full T3 merge-batch UNEXECUTED and required landing evidence; T4 stage/epic UNEXECUTED. No cache. Droplet lifetime1381s cost0.0959USD, not a test wall-time claim.

### rev-35 · 2026-11-11T13:24:03.183Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1810-final-1
commit: 3ee73e112385461b3e4607bb445e60687146c7b9
scope: evidence
findings: [{"severity":"low","text":"Known nonblocking capture limitation: A-18704/A-18705 contain raw reporter output without shared write-time token/bearer redaction. Initial packaging assertPublishable had no retained positive-control receipt. A-18707 honestly records a post-publication synthetic-control/exact-byte rescan exit0; both retained-byte sizes/SHA256 values match. Coordinator a1d226cb/33876cf8 explicitly accepts this fake-only T-1808 class. Original timing/provenance limits remain; no redacted-stream or prepublication-control claim."}]
finding_counts: {"high":0,"medium":0,"low":1}

A-18735 final task evidence CLEAR, C1–C4 verified. Same reviewed-head fe2368bf/A-18729 uncached Linux:6015 base tests/672 base files allpass;130 separate load tests/file finishes,26identities×5, allpass;0negative finish/skip/cancel/todo. New zero-write regression base+5/5, all26 login-release base cases, host-stop4; changed host-restart exact case once11.199242270s. All671 manifest lower/Web and all409 required-union lower/Web have positive case+file receipts. A-18732 audit3930 references including11 name hashes,0mismatch. Normalizedtree6fb9db555faa2f1cd1b1a72f468e7c34338bc289 independently matches Git exclusions. C4 corrected by Coordinator78a26e4a: accepted Mac5 carry plus reviewed-head Linux changedT3; fullT3 batch UNEXECUTED landing evidence enforced by queue, broaderT4/QA separate. Mac carry authorized33876cf8/docs-comment-only proof; precommit/no launch-hash limit retained. One accepted low T1808 capture limitation unchanged, A18707 rescan timing honest;4/tmpaliases accepted T1806. Executor/browser/report-mode/provenance and complete671-path disposition in artifact; no Reviewer experiments. Hold released; no further run or manual ready relay requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-11T14:11:19.122Z

Merged a38929ae8b2ed60cc7e2a50abd02735b7f3c6094 onto dev.
