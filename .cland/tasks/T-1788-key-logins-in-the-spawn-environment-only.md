---
id: T-1788
kind: task
title: Key logins in the spawn environment only
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1778
  - T-1783
topic: topic-1470
branch: t/T-1788-key-logins-in-the-spawn-environment-only
created: 2026-11-09T12:44:11.572Z
updated: 2026-11-11T01:41:27.788Z
closed: 2026-11-11T01:41:27.788Z
---

## Summary

A launch on a pool host whose harness uses a key login gets the key only in that harness's spawn environment, sent over `agent.sock`. The key is never in argv, a file on the host, a process row, `hub.db`, a frame, a log line, the journal or an error, and the redactor covers it. One key login runs on any number of hosts at once.

## What to build

The key travels from the store to the spawn and nowhere else:
- **Per launch.** The hub decrypts the key in memory (T-1783) and passes it through a secret environment on the spawn request. Adapters forward it to the host's spawn and never store it; it never enters the account environment.
- **OpenCode** receives it as `OPENCODE_API_KEY` (question 5).
- **The host agent.** Today its admission plan file, `launches/<id>/plan.json`, carries the whole spawn environment until the bootstrap reads it. That file stops carrying environment values: the bootstrap uses the environment it was spawned with, so no file on the host ever holds the key.
- **The redactor** registers each key value at hub start and at every key add.

A resume or relaunch re-reads the key file.

## Acceptance criteria

- [x] C1. An OpenCode session launched on a fake host with a key login receives the sentinel key in its environment, and its process row's account environment holds no part of it (test).
  - done: impl-1788 · 2026-11-10T23:42:21.713Z
  - verified: rev-36 [reviewer] · run rev-36-1788-final-1 · 2026-11-11T00:13:16.452Z · commit 7207e75cb10b7e738aa5e456820e3faaa2b8417e
  - verified: rev-36 [reviewer] · run rev-36-1788-final-2 · 2026-11-11T01:02:04.974Z · commit 57ea802879e5a88028ddf698521d2cc93157c8a0
- [x] C2. With the sentinel key launched on two fake hosts at once, a search of every launched argv, every file under both fake host directories, the process rows, `hub.db`, the hub log and the journal finds no byte of it, and `.cland/auth` holds ciphertext only (test).
  - done: impl-1788 · 2026-11-10T23:42:22.171Z
  - verified: rev-36 [reviewer] · run rev-36-1788-final-1 · 2026-11-11T00:13:16.452Z · commit 7207e75cb10b7e738aa5e456820e3faaa2b8417e
  - verified: rev-36 [reviewer] · run rev-36-1788-final-2 · 2026-11-11T01:02:04.974Z · commit 57ea802879e5a88028ddf698521d2cc93157c8a0
- [x] C3. The host agent's admission plan file holds no environment value, and a launch still starts with its full environment (test).
  - done: impl-1788 · 2026-11-10T23:42:22.373Z
  - verified: rev-36 [reviewer] · run rev-36-1788-final-1 · 2026-11-11T00:13:16.452Z · commit 7207e75cb10b7e738aa5e456820e3faaa2b8417e
  - verified: rev-36 [reviewer] · run rev-36-1788-final-2 · 2026-11-11T01:02:04.974Z · commit 57ea802879e5a88028ddf698521d2cc93157c8a0
- [x] C4. An error raised while spawning with a key login names the login and never the key, and the redactor masks the key in any frame (test).
  - done: impl-1788 · 2026-11-10T23:42:22.707Z
  - verified: rev-36 [reviewer] · run rev-36-1788-final-1 · 2026-11-11T00:13:16.452Z · commit 7207e75cb10b7e738aa5e456820e3faaa2b8417e
  - verified: rev-36 [reviewer] · run rev-36-1788-final-2 · 2026-11-11T01:02:04.974Z · commit 57ea802879e5a88028ddf698521d2cc93157c8a0
- [x] C5. A key login is never attached or detached: a host stop leaves it `ready` and unchanged (test).
  - done: impl-1788 · 2026-11-10T23:42:22.907Z
  - verified: rev-36 [reviewer] · run rev-36-1788-final-1 · 2026-11-11T00:13:16.452Z · commit 7207e75cb10b7e738aa5e456820e3faaa2b8417e
  - verified: rev-36 [reviewer] · run rev-36-1788-final-2 · 2026-11-11T01:02:04.974Z · commit 57ea802879e5a88028ddf698521d2cc93157c8a0

## Blocked by

- T-1778
- T-1783

## Notes

- Hot files: `hub/src/host/login-binding.ts`, `hub/src/host/login-keys.ts`, `hub/src/adapters/contract.ts` (the secret environment on the spawn request), `hub/src/adapters/opencode.ts`, `hub/src/host/agent/processes.ts`, `hub/src/host/agent/bootstrap.ts`, `hub/src/remote/redact.ts`, `docs/agents/host-agent.md` (the plan-file sentence).
- Tests: new `hub/test/login-key-spawn.test.ts` (T3: two fake hosts, the fake OpenCode, sentinel key); `hub/test/host-agent.test.ts` (T3, a new case for C3).
- Serves epic C5. C2 is the DoD's key search, on fake host directories; a real host's `/proc` is the live run's (see the report).

## Comments

### impl-1788 · 2026-11-10T22:49:37.640Z

Rule 20 consumer sweep before contract edits. Shared importingTests transitive graph: hub/src/adapters/opencode.test.ts, hub/src/hub/hygiene.test.ts, hub/src/hub/store.test.ts, hub/test/account-coalescing.test.ts, hub/test/account-fixture-env.test.ts, hub/test/account-fixture-isolation.test.ts, hub/test/account-limited.test.ts, hub/test/account-limits-unit.test.ts, hub/test/account-limits.test.ts, hub/test/account-poller-clock.test.ts, hub/test/account-poller.test.ts, hub/test/accounts.test.ts, hub/test/adapter-composition.test.ts, hub/test/adapter-generation-forward.test.ts, hub/test/adapter-generation.test.ts, hub/test/adapter-native-boundary.test.ts, hub/test/agents-checkpoint.test.ts, hub/test/agents-filters.test.ts, hub/test/agents-journal.test.ts, hub/test/aide-claims-lifecycle.test.ts, hub/test/aide-claims.test.ts, hub/test/aide-component.test.ts, hub/test/aide-import-cli.test.ts, hub/test/aide-migration.test.ts, hub/test/aide-permissions.test.ts, hub/test/aide.test.ts, hub/test/answer-users.test.ts, hub/test/approval-records.test.ts, hub/test/approval-restart.test.ts, hub/test/artifact-cleanup-unit.test.ts, hub/test/artifact-cli-lifecycle.test.ts, hub/test/artifact-cli.test.ts, hub/test/artifact-create-unit.test.ts, hub/test/artifact-delete.test.ts, hub/test/artifact-folders.test.ts, hub/test/artifact-host.test.ts, hub/test/artifact-lifecycle.test.ts, hub/test/artifact-upload.test.ts, hub/test/artifact-user.test.ts, hub/test/artifacts-git.test.ts, hub/test/artifacts.test.ts, hub/test/ask-chain.test.ts, hub/test/ask-outcomes.test.ts, hub/test/asks-cli.test.ts, hub/test/asks.test.ts, hub/test/auth-mode.test.ts, hub/test/case-deadlines.test.ts, hub/test/claude-agent-launch.test.ts, hub/test/claude-capture-concurrency.test.ts, hub/test/claude-code-accounts.test.ts, hub/test/claude-code-adapter.test.ts, hub/test/claude-code-environment.test.ts, hub/test/claude-code-host.test.ts, hub/test/claude-code-remote-files.test.ts, hub/test/claude-code-remote.test.ts, hub/test/claude-code-schedule.test.ts, hub/test/claude-code-sessions-lifecycle.test.ts, hub/test/claude-code-sessions.test.ts, hub/test/claude-component-fixture.test.ts, hub/test/claude-stop-owner-component.test.ts, hub/test/cli-as-user.test.ts, hub/test/cli-identity.test.ts, hub/test/cli-session-credential.test.ts, hub/test/cli.test.ts, hub/test/codex-adapter.test.ts, hub/test/codex-delivery.test.ts, hub/test/codex-host.test.ts, hub/test/codex-native.test.ts, hub/test/codex-remote-agent.test.ts, hub/test/codex-remote-cleanup.test.ts, hub/test/codex-remote.test.ts, hub/test/codex-sandbox-host.test.ts, hub/test/codex-workspace-git.test.ts, hub/test/computed-sessions.test.ts, hub/test/config-reload-component.test.ts, hub/test/config-reload.test.ts, hub/test/config-set.test.ts, hub/test/connection-resume.test.ts, hub/test/connection-resync.test.ts, hub/test/connection-snapshot.test.ts, hub/test/cover-quiet.test.ts, hub/test/crew-launch.test.ts, hub/test/crew.test.ts, hub/test/custom-roles-component.test.ts, hub/test/daemon.test.ts, hub/test/default-subscriptions-lifecycle.test.ts, hub/test/default-subscriptions-workflow.test.ts, hub/test/default-subscriptions.test.ts, hub/test/demo-cap.test.ts, hub/test/demo-provisioning.test.ts, hub/test/demo-release-component.test.ts, hub/test/demo-release.test.ts, hub/test/demo.test.ts, hub/test/dev-t3-search-component.test.ts, hub/test/dev-t3-search.test.ts, hub/test/discord-artifacts.test.ts, hub/test/discord-cards.test.ts, hub/test/discord-commands.test.ts, hub/test/discord-inbound-media.test.ts, hub/test/discord-messages.test.ts, hub/test/discord-messenger.test.ts, hub/test/discord-pairing.test.ts, hub/test/discord-render.test.ts, hub/test/discord-users.test.ts, hub/test/doctor-cli.test.ts, hub/test/doctor-isolation.test.ts, hub/test/doctor-remotes.test.ts, hub/test/doctor.test.ts, hub/test/durations-runner.test.ts, hub/test/durations.test.ts, hub/test/edges-component.test.ts, hub/test/edges.test.ts, hub/test/epic-close.test.ts, hub/test/events-quiet.test.ts, hub/test/events.test.ts, hub/test/executor-admission-lock.test.ts, hub/test/executor-deletion-confirmation.test.ts, hub/test/executor-deletion-watchdog.test.ts, hub/test/executor-droplet-component.test.ts, hub/test/executor-droplet.test.ts, hub/test/executor-health.test.ts, hub/test/executor-liveness.test.ts, hub/test/executor-prepare-component.test.ts, hub/test/executor-prepare-retry.test.ts, hub/test/executor-prepare.test.ts, hub/test/executor-reap-confirmation.test.ts, hub/test/executor-recovery-collection.test.ts, hub/test/executor-retirement-component.test.ts, hub/test/executor-run-rules.test.ts, hub/test/executor-run.test.ts, hub/test/executor-safety-component.test.ts, hub/test/executor-safety.test.ts, hub/test/executor-snapshot-confirmation.test.ts, hub/test/executor.test.ts, hub/test/fake-claude-cleanup.test.ts, hub/test/fake-harness-capabilities.test.ts, hub/test/fake-harness.test.ts, hub/test/fake-ssh.test.ts, hub/test/fixture-endpoints.test.ts, hub/test/fixture-orphans-lifecycle.test.ts, hub/test/fixture-orphans.test.ts, hub/test/fixture-socket-lifecycle.test.ts, hub/test/fixture-socket-path.test.ts, hub/test/fixture-store.test.ts, hub/test/fixture-worker-lifecycle.test.ts, hub/test/follows-native.test.ts, hub/test/follows.test.ts, hub/test/freshness.test.ts, hub/test/gateway-secrets.test.ts, hub/test/gateway-state.test.ts, hub/test/gateway.test.ts, hub/test/git-maintenance-cli.test.ts, hub/test/git-maintenance-startup.test.ts, hub/test/git-maintenance.test.ts, hub/test/handover-integrity-component.test.ts, hub/test/handover-integrity.test.ts, hub/test/handover-process.test.ts, hub/test/handover.test.ts, hub/test/harness-framing.test.ts, hub/test/harness-import.test.ts, hub/test/heartbeat-digest.test.ts, hub/test/heartbeat.test.ts, hub/test/homebrew-publication.test.ts, hub/test/hook-bridge-doctor.test.ts, hub/test/host-agent-files.test.ts, hub/test/host-agent-restart.test.ts, hub/test/host-agent.test.ts, hub/test/host-allow-list.test.ts, hub/test/host-attach-routing.test.ts, hub/test/host-attach.test.ts, hub/test/host-boot-source.test.ts, hub/test/host-clone-integration.test.ts, hub/test/host-contract-coverage.test.ts, hub/test/host-create-admission.test.ts, hub/test/host-create-entry.test.ts, hub/test/host-create-ready.test.ts, hub/test/host-destroy-native.test.ts, hub/test/host-destroy.test.ts, hub/test/host-flush-native.test.ts, hub/test/host-flush.test.ts, hub/test/host-launch-layout.test.ts, hub/test/host-lease-lock.test.ts, hub/test/host-lease.test.ts, hub/test/host-limit-poller.test.ts, hub/test/host-local-contract.test.ts, hub/test/host-local-liveness.test.ts, hub/test/host-login-disk.test.ts, hub/test/host-orphans.test.ts, hub/test/host-prepare.test.ts, hub/test/host-prepared.test.ts, hub/test/host-provision-gate.test.ts, hub/test/host-provision-records.test.ts, hub/test/host-provision-recovery.test.ts, hub/test/host-push-facts.test.ts, hub/test/host-push-on-ref-move.test.ts, hub/test/host-readiness-owner.test.ts, hub/test/host-reboot-controller.test.ts, hub/test/host-reboot-native.test.ts, hub/test/host-reboot.test.ts, hub/test/host-records.test.ts, hub/test/host-registry.test.ts, hub/test/host-relaunch-component.test.ts, hub/test/host-relaunch-native.test.ts, hub/test/host-relaunch-publication.test.ts, hub/test/host-relaunch-retry.test.ts, hub/test/host-relaunch.test.ts, hub/test/host-restart-reconcile.test.ts, hub/test/host-restart.test.ts, hub/test/host-revoke-native.test.ts, hub/test/host-revoke.test.ts, hub/test/host-runtime-delivery.test.ts, hub/test/host-runtime-join.test.ts, hub/test/host-runtime-owner.test.ts, hub/test/host-secret-admission.test.ts, hub/test/host-ssh-contract.test.ts, hub/test/host-ssh-registry.test.ts, hub/test/host-status.test.ts, hub/test/host-stop.test.ts, hub/test/host-supervisor.test.ts, hub/test/host-survival-native.test.ts, hub/test/host-survival.test.ts, hub/test/host-unreachable.test.ts, hub/test/host-watchdog.test.ts, hub/test/hub-cards-voice.test.ts, hub/test/hub-cards.test.ts, hub/test/hub-lock-heartbeat.test.ts, hub/test/hub-lock-identity.test.ts, hub/test/hub-lock-readers.test.ts, hub/test/hub-priority.test.ts, hub/test/hub-status-component.test.ts, hub/test/human-hold.test.ts, hub/test/human-marks.test.ts, hub/test/human-routing.test.ts, hub/test/hygiene.test.ts, hub/test/import-github-lifecycle.test.ts, hub/test/import-github.test.ts, hub/test/in-process-spoke.test.ts, hub/test/inbox-actions.test.ts, hub/test/inbox-query.test.ts, hub/test/inbox-requests-component.test.ts, hub/test/inbox-requests.test.ts, hub/test/inbox-verifier-load.test.ts, hub/test/inbox-workload-soak.test.ts, hub/test/inbox-workload.test.ts, hub/test/init-categories.test.ts, hub/test/init-first-commit.test.ts, hub/test/init-roots.test.ts, hub/test/init-settings.test.ts, hub/test/init-skills-report.test.ts, hub/test/init-skills-update.test.ts, hub/test/init.test.ts, hub/test/inject-stalled.test.ts, hub/test/item-lead.test.ts, hub/test/item-summary-lua-soak.test.ts, hub/test/item-summary-lua.test.ts, hub/test/item-summary-scale.test.ts, hub/test/item-summary.test.ts, hub/test/journal-async.test.ts, hub/test/journal-flush.test.ts, hub/test/journal-subagents.test.ts, hub/test/launch-admission.test.ts, hub/test/launch-files.test.ts, hub/test/launch-recovery.test.ts, hub/test/launch-settlement.test.ts, hub/test/lead-handover-process.test.ts, hub/test/lead-handover.test.ts, hub/test/lead-launch.test.ts, hub/test/lead-permissions-component.test.ts, hub/test/lead-permissions-process.test.ts, hub/test/lead-permissions.test.ts, hub/test/lead-routing-process.test.ts, hub/test/lead-routing.test.ts, hub/test/lifecycle-serialization.test.ts, hub/test/login-add-component.test.ts, hub/test/login-add.test.ts, hub/test/login-binding.test.ts, hub/test/login-exclusive-native.test.ts, hub/test/login-exclusive.test.ts, hub/test/login-host-pin.test.ts, hub/test/login-keys.test.ts, hub/test/login-list.test.ts, hub/test/login-provision-bind.test.ts, hub/test/login-records.test.ts, hub/test/login-release.test.ts, hub/test/login-selection.test.ts, hub/test/login-signin.test.ts, hub/test/login-snapshot-cli.test.ts, hub/test/login-snapshots.test.ts, hub/test/login-write-back.test.ts, hub/test/measure-memory.test.ts, hub/test/merge-batches.test.ts, hub/test/merge-checkout-lifecycle.test.ts, hub/test/merge-checkout.test.ts, hub/test/merge-gate.test.ts, hub/test/merge-policy.test.ts, hub/test/merge-queue-unit.test.ts, hub/test/merge-queue.test.ts, hub/test/merge-recovery-native.test.ts, hub/test/merge-recovery.test.ts, hub/test/merge.test.ts, hub/test/message-display-name.test.ts, hub/test/message-users.test.ts, hub/test/models.test.ts, hub/test/name-reservation.test.ts, hub/test/names.test.ts, hub/test/nvim-agents-filters-rules.test.ts, hub/test/nvim-artifacts-rules.test.ts, hub/test/nvim-crew-rules.test.ts, hub/test/nvim-inbox-requests-rules.test.ts, hub/test/nvim-item-prefixes-rules.test.ts, hub/test/nvim-items-rules.test.ts, hub/test/nvim-needs-you-rules.test.ts, hub/test/nvim-sessions-rules.test.ts, hub/test/open.test.ts, hub/test/opencode-adapter.test.ts, hub/test/opencode-database.test.ts, hub/test/opencode-host.test.ts, hub/test/opencode-launch-policy.test.ts, hub/test/opencode-native.test.ts, hub/test/opencode-remote-cleanup.test.ts, hub/test/opencode-remote.test.ts, hub/test/orphan-servers-perf.test.ts, hub/test/orphan-servers.test.ts, hub/test/orphan-sweep-lock.test.ts, hub/test/outbox-gateway.test.ts, hub/test/outbox.test.ts, hub/test/pairing-approval.test.ts, hub/test/pairing-codes.test.ts, hub/test/pairing-service.test.ts, hub/test/permissions.test.ts, hub/test/pid-identity.test.ts, hub/test/plan-approval-reload.test.ts, hub/test/plan-gate.test.ts, hub/test/planned-stage.test.ts, hub/test/poller-lease.test.ts, hub/test/pool-failures.test.ts, hub/test/pool-idle-stop.test.ts, hub/test/pool-scale.test.ts, hub/test/pool-spend-cap.test.ts, hub/test/prepared-project.test.ts, hub/test/presence.test.ts, hub/test/process-cleanup.test.ts, hub/test/progress.test.ts, hub/test/project-clock.test.ts, hub/test/project-hub-lifecycle.test.ts, hub/test/project-hub.test.ts, hub/test/project-probes.test.ts, hub/test/prompt-races.test.ts, hub/test/publish-component.test.ts, hub/test/publish.test.ts, hub/test/push-component.test.ts, hub/test/push.test.ts, hub/test/qa-lint-build.test.ts, hub/test/qa-lint-cli.test.ts, hub/test/quarantine-runner.test.ts, hub/test/release-item.test.ts, hub/test/release-t3-component.test.ts, hub/test/release.test.ts, hub/test/remote-cli.test.ts, hub/test/remote-discovery-cli.test.ts, hub/test/remote-discovery-host.test.ts, hub/test/remote-docs-pairing.test.ts, hub/test/remote-fixture-lifecycle.test.ts, hub/test/remote-neutral.test.ts, hub/test/remote-publications.test.ts, hub/test/remote-scripted.test.ts, hub/test/remote-state-migration.test.ts, hub/test/remote-state.test.ts, hub/test/remote-workbench.test.ts, hub/test/request-guard-component.test.ts, hub/test/request-guard.test.ts, hub/test/resilience-component.test.ts, hub/test/resilience.test.ts, hub/test/review-qa-component.test.ts, hub/test/review-qa.test.ts, hub/test/role-integrity-component.test.ts, hub/test/role-integrity.test.ts, hub/test/role-launch.test.ts, hub/test/roles-clauses.test.ts, hub/test/roles-component.test.ts, hub/test/roles-editor.test.ts, hub/test/roles-harnesses.test.ts, hub/test/roles-launch-permissions.test.ts, hub/test/roles-session-refresh.test.ts, hub/test/roles-snapshot-cli.test.ts, hub/test/roles-snapshot.test.ts, hub/test/roles-template-component.test.ts, hub/test/roles-template.test.ts, hub/test/roles-timing.test.ts, hub/test/roles.test.ts, hub/test/routing.test.ts, hub/test/rule-cli.test.ts, hub/test/rule-sessions-component.test.ts, hub/test/rule-sessions.test.ts, hub/test/scenarios/crew-launch.test.ts, hub/test/scenarios/droplet-verify.test.ts, hub/test/scenarios/hook-bridge.test.ts, hub/test/scenarios/hub-lifecycle.test.ts, hub/test/scenarios/message-tracer.test.ts, hub/test/scenarios/release.test.ts, hub/test/scenarios/remotes.test.ts, hub/test/scenarios/setup.test.ts, hub/test/scenarios/stage-close.test.ts, hub/test/scenarios/startup-smoke.test.ts, hub/test/scenarios/ticket-flow.test.ts, hub/test/secrets-environment.test.ts, hub/test/secrets.test.ts, hub/test/send-input.test.ts, hub/test/session-archive-merge.test.ts, hub/test/session-archive.test.ts, hub/test/session-async-processes-lifecycle.test.ts, hub/test/session-async-processes.test.ts, hub/test/session-brief-component.test.ts, hub/test/session-brief.test.ts, hub/test/session-credential-io.test.ts, hub/test/session-cwd.test.ts, hub/test/session-events-component.test.ts, hub/test/session-events.test.ts, hub/test/session-holds-component.test.ts, hub/test/session-holds.test.ts, hub/test/session-host-placement.test.ts, hub/test/session-host-routing.test.ts, hub/test/session-host.test.ts, hub/test/session-launch-component.test.ts, hub/test/session-launch-lifecycle.test.ts, hub/test/session-launch.test.ts, hub/test/session-model.test.ts, hub/test/session-native-lifecycle.test.ts, hub/test/session-pool-placement.test.ts, hub/test/session-resume-component.test.ts, hub/test/session-resume-lifecycle.test.ts, hub/test/session-resume.test.ts, hub/test/session-retry.test.ts, hub/test/session-stop-races-cleanup.test.ts, hub/test/session-stop-races-component.test.ts, hub/test/session-stop-races.test.ts, hub/test/session-usage.test.ts, hub/test/setup-cli.test.ts, hub/test/setup-favourite.test.ts, hub/test/setup-flow.test.ts, hub/test/setup-handover.test.ts, hub/test/setup-hub-component.test.ts, hub/test/setup-hub.test.ts, hub/test/setup-pairing-component.test.ts, hub/test/setup-remote-component.test.ts, hub/test/setup-remotes.test.ts, hub/test/setup-trust-lock.test.ts, hub/test/setup-trust.test.ts, hub/test/shared-defects-report.test.ts, hub/test/shared-defects.test.ts, hub/test/skills-onboarding.test.ts, hub/test/skills-qa-catalogue.test.ts, hub/test/skills-qa.test.ts, hub/test/skills-tracker-jq.test.ts, hub/test/skills-tracker.test.ts, hub/test/speech-command.test.ts, hub/test/spoke-artifact-budget.test.ts, hub/test/spoke-footprint.test.ts, hub/test/spoke-identity.test.ts, hub/test/spoke-lazy-tools.test.ts, hub/test/spoke-stdio.test.ts, hub/test/spoke-unix-edge.test.ts, hub/test/stage-closure-component.test.ts, hub/test/stage-qa.test.ts, hub/test/startup-cleanup.test.ts, hub/test/startup-deadline-component.test.ts, hub/test/startup-ready-component.test.ts, hub/test/startup-replies-scale.test.ts, hub/test/startup-smoke.test.ts, hub/test/startup-task-pages-soak.test.ts, hub/test/state-inventory.test.ts, hub/test/store-and-forward.test.ts, hub/test/subscription-frame.test.ts, hub/test/subscription-hygiene.test.ts, hub/test/subscriptions.test.ts, hub/test/suite-admission-close.test.ts, hub/test/suite-admission-cost.test.ts, hub/test/suite-admission-responsive.test.ts, hub/test/suite-admission.test.ts, hub/test/suite-cache-recovery.test.ts, hub/test/suite-cache.test.ts, hub/test/suite-cancel.test.ts, hub/test/suite-candidate-remote.test.ts, hub/test/suite-candidate.test.ts, hub/test/suite-check.test.ts, hub/test/suite-close-component.test.ts, hub/test/suite-close-recovery.test.ts, hub/test/suite-close.test.ts, hub/test/suite-coordinator.test.ts, hub/test/suite-cover.test.ts, hub/test/suite-coverage.test.ts, hub/test/suite-dry-run.test.ts, hub/test/suite-duration-budget.test.ts, hub/test/suite-human-component.test.ts, hub/test/suite-human.test.ts, hub/test/suite-hung-component.test.ts, hub/test/suite-landed-load.test.ts, hub/test/suite-log-backfill.test.ts, hub/test/suite-persistence.test.ts, hub/test/suite-preflight.test.ts, hub/test/suite-progress.test.ts, hub/test/suite-protocol.test.ts, hub/test/suite-queue-policy.test.ts, hub/test/suite-queue.test.ts, hub/test/suite-recovery.test.ts, hub/test/suite-release-cache.test.ts, hub/test/suite-remote-log.test.ts, hub/test/suite-remote-process.test.ts, hub/test/suite-runner-contract.test.ts, hub/test/suite-scheduling.test.ts, hub/test/suite-selection-component.test.ts, hub/test/suite-selection-report.test.ts, hub/test/suite-selection.test.ts, hub/test/suite-soak-component.test.ts, hub/test/suite-soak.test.ts, hub/test/suite-stage-cover.test.ts, hub/test/suite-stage-rules.test.ts, hub/test/suite-summary.test.ts, hub/test/suite-task-selection.test.ts, hub/test/suite-tier-report.test.ts, hub/test/suite-timeouts.test.ts, hub/test/suite-wait-metrics.test.ts, hub/test/suite.test.ts, hub/test/surface.test.ts, hub/test/system-processes.test.ts, hub/test/task-attribution.test.ts, hub/test/task-card-component.test.ts, hub/test/task-card.test.ts, hub/test/task-migrate.test.ts, hub/test/task-plan.test.ts, hub/test/task-prefixes.test.ts, hub/test/task-size.test.ts, hub/test/task-worktrees-lifecycle.test.ts, hub/test/telegram-approvals.test.ts, hub/test/telegram-artifacts.test.ts, hub/test/telegram-cards.test.ts, hub/test/telegram-catchup.test.ts, hub/test/telegram-commands.test.ts, hub/test/telegram-gap.test.ts, hub/test/telegram-graceful-restart.test.ts, hub/test/telegram-inbound.test.ts, hub/test/telegram-liveness.test.ts, hub/test/telegram-marks-setup.test.ts, hub/test/telegram-messenger.test.ts, hub/test/telegram-mute.test.ts, hub/test/telegram-notices.test.ts, hub/test/telegram-pacing.test.ts, hub/test/telegram-pairing.test.ts, hub/test/telegram-polling-restart.test.ts, hub/test/telegram-polling.test.ts, hub/test/telegram-rendering.test.ts, hub/test/telegram-users.test.ts, hub/test/telegram-voice-answers.test.ts, hub/test/telegram-voice-command.test.ts, hub/test/telegram-voice.test.ts, hub/test/termination-ownership.test.ts, hub/test/territory-cli.test.ts, hub/test/territory-lock.test.ts, hub/test/territory-task-branch.test.ts, hub/test/test-admission-outcome.test.ts, hub/test/test-admission.test.ts, hub/test/thread-runs-store.test.ts, hub/test/thread-runs.test.ts, hub/test/tier-tripwire-runner.test.ts, hub/test/tool-arguments-spoke.test.ts, hub/test/tool-arguments.test.ts, hub/test/topic-model.test.ts, hub/test/topic-withdraw.test.ts, hub/test/topics-component.test.ts, hub/test/topics.test.ts, hub/test/tracker-async-component.test.ts, hub/test/tracker-async.test.ts, hub/test/tracker-component.test.ts, hub/test/tracker-conflict-captures.test.ts, hub/test/tracker-criteria.test.ts, hub/test/tracker-criterion-crash.test.ts, hub/test/tracker-criterion-write.test.ts, hub/test/tracker-hierarchy.test.ts, hub/test/tracker-levels.test.ts, hub/test/tracker-load.test.ts, hub/test/tracker-native-boundary.test.ts, hub/test/tracker-rank.test.ts, hub/test/tracker-ready-native.test.ts, hub/test/tracker-ready.test.ts, hub/test/tracker-status-component.test.ts, hub/test/tracker-status.test.ts, hub/test/tracker-summary.test.ts, hub/test/tracker.test.ts, hub/test/transport-config.test.ts, hub/test/transport-fake-contract.test.ts, hub/test/transport-forwards.test.ts, hub/test/transport-records.test.ts, hub/test/transport-ssh-contract.test.ts, hub/test/transport-ssh.test.ts, hub/test/transport-status.test.ts, hub/test/user-invites.test.ts, hub/test/users.test.ts, hub/test/v01-migration.test.ts, hub/test/verdict-commit-component.test.ts, hub/test/verdict-commit.test.ts, hub/test/verdict-criteria.test.ts, hub/test/verdict-findings.test.ts, hub/test/verification-commands.test.ts, hub/test/verification-tree.test.ts, hub/test/verification-workers.test.ts, hub/test/verifier-resolver.test.ts, hub/test/verifier-routing-process.test.ts, hub/test/verifier-routing.test.ts, hub/test/verify-all.test.ts, hub/test/verify-prepare.test.ts, hub/test/verify-submission.test.ts, hub/test/verify-tool.test.ts, hub/test/visibility-component.test.ts, hub/test/visibility-volume.test.ts, hub/test/visibility.test.ts, hub/test/waiting-launch-restart.test.ts, hub/test/waiting-launch.test.ts, hub/test/web-artifacts-unit.test.ts, hub/test/web-artifacts.test.ts, hub/test/web-auth-unit.test.ts, hub/test/web-auth.test.ts, hub/test/web-authority.test.ts, hub/test/web-cookie-secure.test.ts, hub/test/web-edge.test.ts, hub/test/web-phase.test.ts, hub/test/web-release-publication.test.ts, hub/test/web-signin.test.ts, hub/test/web-tunnel-guide.test.ts, hub/test/web-upload.test.ts, hub/test/worktree-cli.test.ts, hub/test/worktree-host.test.ts, nvim/test/artifact-browser.test.ts, nvim/test/artifact-upload.test.ts, nvim/test/client.test.ts, nvim/test/closed-pages.test.ts, nvim/test/criteria.test.ts, nvim/test/explorer-card.test.ts, nvim/test/explorer-compose.test.ts, nvim/test/explorer-roots.test.ts, nvim/test/explorer.test.ts, nvim/test/graph-layout.test.ts, nvim/test/layers.test.ts, nvim/test/message-users-live.test.ts, nvim/test/palette.test.ts, nvim/test/qa-shipped.test.ts, nvim/test/qa.test.ts, nvim/test/remotes.test.ts, nvim/test/rulebook.test.ts, nvim/test/sessions-lifecycle.test.ts, nvim/test/shell.test.ts, nvim/test/startup-budget.test.ts, nvim/test/telegram-marks.test.ts, nvim/test/ui.test.ts, web/test/accounts.test.ts, web/test/area-slots.test.ts, web/test/artifacts.test.ts, web/test/asks.test.ts, web/test/board.test.ts, web/test/composer.test.ts, web/test/connection.test.ts, web/test/events.test.ts, web/test/folds.test.ts, web/test/graph.test.ts, web/test/inbox.test.ts, web/test/item-card.test.ts, web/test/item-criteria.test.ts, web/test/items-actions.test.ts, web/test/items-order.test.ts, web/test/items.test.ts, web/test/key-contexts.test.ts, web/test/message-users.test.ts, web/test/messages.test.ts, web/test/notifications.test.ts, web/test/pairing.test.ts, web/test/palette.test.ts, web/test/passkeys.test.ts, web/test/phone-approvals.test.ts, web/test/phone-asks.test.ts, web/test/phone-composer.test.ts, web/test/phone-disconnected.test.ts, web/test/phone-inbox.test.ts, web/test/phone-install.test.ts, web/test/phone-more.test.ts, web/test/phone-notifications.test.ts, web/test/phone-sessions.test.ts, web/test/phone-thread.test.ts, web/test/phone.test.ts, web/test/plan.test.ts, web/test/readme.test.ts, web/test/remote-via.test.ts, web/test/remotes.test.ts, web/test/session-actions.test.ts, web/test/session-drawer.test.ts, web/test/session-launch.test.ts, web/test/sessions.test.ts, web/test/shell.test.ts, web/test/signin.test.ts, web/test/smoke.test.ts, web/test/telegram-marks.test.ts, web/test/thread-artifacts.test.ts, web/test/thread-runs.test.ts, web/test/topics.test.ts, web/test/uploads.test.ts, web/test/verification.test.ts, web/test/withdraw.test.ts
Unknowns counted reached: nvim/test/scenarios/workbench.test.ts, nvim/test/plan.test.ts, nvim/test/plan-component.test.ts, hub/test/sqlite-contention.test.ts, hub/test/suite-admission-native.test.ts, hub/test/mod-bridge.test.ts, hub/test/plan-approval.test.ts, hub/test/typecheck.test.ts, hub/test/task-worktrees.test.ts, hub/test/suite-runner.test.ts, hub/test/executor-safety-load.test.ts, hub/test/suite-remote-budget.test.ts, hub/test/suite-accounting.test.ts, hub/test/init-process.test.ts, hub/test/web-notifications.test.ts
Explicit field/frame/plan consumers:
qa/briefs/E-417-stage-2.md
docs/hub/logins.md
qa/briefs/E-1532.md
qa/briefs/E-1532-stage-6.md
docs/hub/ssh-host.md
hub/test/durations.json
qa/briefs/E-414-stage-1.md
qa/briefs/E-418.md
qa/briefs/E-419-stage-1.md
qa/briefs/E-1536.md
qa/briefs/E-1532-stage-2.md
hub/src/adapters/codex.ts
hub/src/adapters/opencode.ts
hub/src/adapters/claude-code.ts
qa/briefs/E-1534-stage-1.md
hub/src/adapters/contract.ts
qa/briefs/E-1532-stage-3.md
qa/briefs/E-417-stage-3.md
hub/test/mod-bridge.test.ts
hub/test/host-prepared.test.ts
qa/briefs/E-419-stage-4.md
qa/briefs/E-1533.md
hub/test/opencode-launch-policy.test.ts
hub/test/host-secret-admission.test.ts
hub/src/tracker/index-db.ts
qa/briefs/E-1536-stage-4.md
qa/briefs/E-1538.md
hub/test/login-keys.test.ts
hub/test/fixtures/tracker-snapshot/items.json
qa/briefs/E-1533-stage-1.md
qa/briefs/E-418-stage-2.md
qa/briefs/E-1535-stage-2.md
qa/briefs/E-413.md
hub/test/host-relaunch-retry.test.ts
hub/test/host-relaunch.test.ts
qa/briefs/E-418-stage-3.md
qa/briefs/E-1536-stage-1.md
qa/briefs/E-417.md
hub/src/host/login-keys.ts
qa/briefs/E-1538-stage-2.md
qa/briefs/E-423.md
hub/src/host/logins.ts
hub/test/host-agent.test.ts
hub/src/host/agent/bootstrap.ts
hub/src/host/agent/server.ts
qa/briefs/E-1535-stage-1.md
hub/src/host/agent/processes.ts
qa/briefs/E-1533-stage-3.md
hub/test/fakes/harness.ts
hub/src/host/login-binding.ts
qa/briefs/E-1536-stage-2.md
qa/briefs/E-413-stage-2.md
qa/briefs/E-1538-stage-1.md
hub/test/session-launch-component.test.ts
qa/briefs/E-414.md
hub/test/login-selection.test.ts
hub/test/host-login-disk.test.ts
qa/briefs/E-1533-stage-2.md
qa/briefs/E-418-stage-1.md
qa/briefs/E-1536-stage-3.md
qa/briefs/E-417-stage-4.md
qa/briefs/E-1531-stage-3.md
qa/briefs/E-417-stage-1.md
qa/briefs/E-387.md
qa/briefs/E-1534-stage-3.md
qa/briefs/E-1534.md
qa/briefs/E-414-stage-2.md
qa/briefs/E-1534-stage-2.md
qa/briefs/E-1531.md
qa/briefs/E-1531-stage-2.md
qa/briefs/E-419-stage-3.md
qa/briefs/E-1532-stage-4.md
qa/briefs/T-276.md
qa/briefs/E-414-stage-3.md
qa/briefs/E-419-stage-2.md
docs/evidence/T-1741-consumers.md

Migration: additive optional SpawnRequest.secretEnv; existing callers omitting it retain wire shape. Login selector adds ready OpenCode keys without binding. Agent prepared spawn environment becomes lifetime-only; crash recovery already refuses uncommitted operations and reconciles committing by launch id. Bootstrap reads process.env; legacy plans remain readable with ignored env. Other graph consumers unchanged; native host-create-ready, host-destroy-native, host-restart, host-restart-reconcile, host-unreachable, host-stop and login-write-back require preservation runs. No wire frame change or recorded Neovim regeneration required.

### rev-36 · 2026-11-10T23:04:45.490Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1788-source-1
commit: ec88661abd863b03ad8c1e26f7e1866352926698
scope: full
findings: [{"severity":"high","text":"Key-specific generic Error replacement erases HostMemoryFloorRefusal/AccountLimited/ToolForbidden and unknown-outcome classification used by Sessions waiting and ownership settlement. Preserve safe typed receipts/codes while masking diagnostics and naming the login; add refusal/unknown-outcome controls.","file":"hub/src/adapters/opencode.ts","line":374},{"severity":"high","text":"Searching raw key bytes inside JSON.stringify(entry) misses valid quote/backslash-containing keys after escaping, and raw event overwrite bypasses value redaction. No lower sanitizer exists. Redact decoded values including event before persistence, with escaped-sentinel positive controls.","file":"hub/src/hub/daemon.ts","line":183},{"severity":"medium","text":"Native test bypasses Sessions/OpenCodeAdapter and has no hub process rows/log/journal; separate T2 restart starts a new name with fake adapter. Missing required two-host composed launch/search and persisted-generation resume/relaunch after both hub+agent restart; no approved split-proof exception.","file":"hub/test/login-key-spawn.test.ts","line":24},{"severity":"low","text":"Guide still directs local Linux Docker repetitions despite Coordinator assigning this item's Linux evidence to reviewed-head mode-free droplet and stopping local Docker work; align execution guidance with that direction.","file":"docs/agents/tests/hub-test-login-key-spawn.test.ts.md","line":17}]
finding_counts: {"high":2,"medium":1,"low":1}

A-18505 contains the consolidated Standards (1 low) and Spec (2 high,1 medium) review. Implementer confirms typed error, decoded persistence and missing composition gaps; no omitted owner/exception. Pinned audit complete: repair, commit/push and request fresh source review before verification. C3/C4/C5 remain runtime-unverified. A-18503 working-tree macOS receipts are early signals only; Docker attempt incomplete. Final-head native preservation and mode-free Linux task evidence remain pending; full T3/T4/after-stage QA separate. No Reviewer tests/probes run.

Criteria: C1 failed (Required actual composed fake-host/OpenCode launch and process-row environment proof is split across bypassing doubles with no approved exception.), C2 failed (Decoded log/journal redaction misses escaped keys, and the two-host actual launch/persistence search composition is absent.).

### impl-1788 · 2026-11-10T23:13:19.006Z

Consolidated source repair f6bbcadcc: preserve typed key refusal/unknown identity and receipt fields, decoded log/event redaction with escaped-sentinel control, and actual two-host Sessions/OpenCodeAdapter/sshHost/agent persisted conversation restart proof. Fake server record adds optional keyDigest only with FAKE_OPENCODE_KEY_PROOF; previous fake record shape remains unchanged without that flag. New field consumers are confined to login-key-spawn.test.ts; existing catalog/file readers receive the prior shape. Local Docker reproduction excluded; reviewed-head droplet verification required. Early macOS evidence and allowances are qualified in the repair artifact. Final native slot remains after fresh source review.

### rev-36 · 2026-11-10T23:15:19.809Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1788-source-2
commit: f6bbcadcced7aa1816fd6af996a1bcb92ce99d23
scope: full
findings: [{"severity":"medium","text":"tempProject registers shared resource/hub/directory cleanup before loginFixtureOwners' independent later after hook. Native/agent joins and external Store/ProcessTable closure can follow root disposal on failure. Join that owner through the shared resource phase before directory removal, with forced early-failure cleanup control.","file":"hub/test/login-key-spawn.test.ts","line":36}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18508: Standards 1 medium, Spec 0 remaining source findings. A-18505 typed failure, decoded persistence, composed restart and stale-Docker fixes accepted on source inspection. Implementer confirms the new cleanup ordering gap. Pin audit complete; fixture correction/new committed head/fresh source review precede verification. Task still reports old failed C1/C2 implementation marks; restore after correction. C1–C5 runtime-unverified; A-18507 is qualified working-tree early evidence, and its report-mode Linux duration projection is not a measurement. No Reviewer tests run; full T3/T4/after-stage QA separate.

Criteria: C2 failed (Composed search/restart fixture does not own cleanup before root disposal; repair failure-path ordering before its evidence can establish the criterion.).

### impl-1788 · 2026-11-10T23:18:25.308Z

A-18508 repair: composed fixture owner disposal is registered in shared onCleanup resource phase; directory guard refuses root removal until the joined stack succeeds. Early-failure nested control leaves one actual native fake OpenCode server live, then requires independent SIGKILL native close, storage closes while root exists and removal afterwards. Red: SuppressedError during disposal plus false storage-close receipt; green full native file 4/4, composition and early failure each 5/5 alone on macOS Node24.21.0; TMPDIR prefixes [] to []. Working-tree early signal only, final reviewed-head native and mode-free Linux receipts remain pending. Existing duration allowance is unchanged (new early-failure worst1.075s).

### rev-36 · 2026-11-10T23:19:12.748Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1788-source-3
commit: df6db22bf9fc895bd6c52563ed30e78d940cf3a2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18509: cumulative source clear, Standards 0/Spec 0. Composed fixture owner disposal now joins in shared resource phase before root removal, with retained-root guard and nested early-end native-close/storage/root-disposition control. Earlier typed ownership/error, decoded log/event redaction and full composed persisted-resume fixes remain accepted. All five implementation marks restored; C1–C5 runtime-unverified. After directed final-head native slot completes/releases, mode-free verify may proceed at this exact head. Retain original outputs/commands/cwd/head/platform/native completions, classified generated outcomes and consumer union dispositions. Early working-tree receipts/projection not final proof; full remaining T3/T4/affected after-stage QA separate. No Reviewer tests/probes run.

### impl-1788 · 2026-11-10T23:23:07.549Z

Final reviewed-head native receipt A-18511 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18511-t-1788-reviewed-head-native-receipts): df6db22bf9fc895bd6c52563ed30e78d940cf3a2, local macOS arm64 Node24.21.0, no browser. Ten directed files/95 base cases plus 20 isolated repetition processes (five each new native identity) passed. Manifest preserves commands, original redacted outputs and native producer completion codes. Prefix TMPDIR inventory [] to [], clean tree/head unchanged. Declared output secret scan positive control and zero output matches exited0 before publication. Preservation lock released. Mode-free verify admitted 585384da-ef7b-48ad-8e49-d79b965839ff; Linux result not yet available. Full remaining T3 and T4/stage QA deferred per standing split.

### rev-36 · 2026-11-10T23:38:58.875Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1788-evidence-1
commit: df6db22bf9fc895bd6c52563ed30e78d940cf3a2
scope: evidence
findings: [{"severity":"medium","text":"Configured restart/list consumer fails 'login key: unavailable': startup applies launchable-ready key guard to legal non-ready metadata. Whole-hub refusal is unintended/unapproved. Preserve metadata/list restart compatibility and separate startup registration from unavailable launch admission.","file":"hub/test/login-list.test.ts","line":25},{"severity":"medium","text":"Configured bounded selection consumer fails 3 !== 2 after added key lookup. Resolve/migrate the bounded query contract and its key index without weakening decode/history/index/no-temp-sort or held-binding assertions.","file":"hub/test/login-selection.test.ts","line":52}]
finding_counts: {"high":0,"medium":2,"low":0}

A-18516 records actual A-18515 terminal errors and named failed finishes. Run585384da is red at reviewed df6db22b: T0/T1 passed, fallback T2 failed; changed T3/T4/Web unexecuted. Report scope5259=5257pass/2fail; broader completed-before-interruption counter separately5299/5297/2. Impl confirms both local reproductions and no approved non-ready-key startup refusal (25fc7d00); fix/index/consumer migration and fresh source review precede new verification. All C1–C5 remain runtime-unverified; no independent acceptance-case failure inferred from unexecuted phases. Local A-18511 separate; no shared-defect/intermittency or budget-failure classification. No Reviewer tests run.

### impl-1788 · 2026-11-10T23:40:24.163Z

Rule 20 query-consumer follow-up before repaired-head regression run: login-selection.test.ts pins Codex ready-disk=2 queries and held=1; both remain unchanged. OpenCode ready-key=2 uses dedicated partial login_ready_keys(harness,account,name), no scan/temp sort; OpenCode fallthrough ready-disk=3 is documented. login-snapshots.test.ts pins <=12 queries for save; unchanged and included in all-login regression run. No other login-* query-count assertion found by field/selectForLaunch/query/decode sweep. Existing 705-test transitive sweep still applies. keyNames consumer daemon startup now enumerates ready keys only; login-list legal creating-key metadata/restart consumer remains unchanged. New selector coverage excludes creating/signed-out key identities while retaining decode/history/index/no-sort assertions and both original fixed counts.

### rev-36 · 2026-11-10T23:43:44.438Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1788-source-4
commit: 7207e75cb10b7e738aa5e456820e3faaa2b8417e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18518: source clear, Standards0/Spec0. Ready-only startup enumeration preserves non-ready metadata restart/list consumer. Dedicated partial ready-key harness/account/name index and OpenCode-only lookup preserve original Codex query bounds; extended pinned/unpinned key cases keep one-record/zero-history decoding, positive control and no-scan/no-temp-sort assertions. Earlier source fixes retained. A-18517 current-head local18 login files/196 passes inspected, qualified Darwin27.0.0/arm64/Node24.21 targeted evidence. Prior configured585384da remains red. C1–C5 runtime-unverified. Remaining directed native consumers require current-head evidence or explicit authorized carry/disposition before fresh mode-free verification; A-18511 has no implicit carry. Full remaining T3/T4/after-stage QA separate. No Reviewer tests run.

### impl-1788 · 2026-11-10T23:46:52.957Z

Current reviewed-head local union at 7207e75cb10b7e738aa5e456820e3faaa2b8417e: A-18517 all18 login files/196 cases plus A-18519 remaining8 directed native files/90 cases =26 distinct files/286 base cases. A-18519 also captures20 fresh-process repetitions (five each native identity; repeated executions, not new cases). Both packets local darwin kernel27.0.0 arm64 Node24.21.0, no browser, duration budget report mode. All producer exits0, inventory[] to[], clean unchanged head, preservation slot released. Prior-head A-18511 has no carry. Fresh mode-free verify0a6aaafb-18c5-463c-8aff-790758a4587c admitted; await configured result. Prior585384da remains red; Web/changed T3/T4 were unexecuted in it. Remaining full T3 and T4/stage QA remain deferred per standing split.

### rev-36 · 2026-11-11T00:13:16.452Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1788-final-1
commit: 7207e75cb10b7e738aa5e456820e3faaa2b8417e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18528: final same-head evidence clear; C1–C5 verified. Independently checked A-18524 run0a6aaafb green5983/5983, named composed/native/redaction/error/stop and repair outcomes, eight new lower-tier identities each5/5, boundary3/closure5. A-18527 union721 independently reconciles475positive base file finishes +246T3/T4 deferrals, no missing lower/Web. A-18517/19 current-head local26files/286base outcomes (25T1/198T2/63T3), plus20repetition processes/25generated outcomes; all46 original output/source hashes and manifest command/completion linkage match. Native PID/env export limits retained. Source A-18518 remains applicable. Uncached Linuxx64 droplet/Node24.21/Nvim.12.5/CfT156 HeadlessShell1248; T0/allT1/fallbackT2/changedT3/mappedT4base/Web complete; report-only advisories retained. Full remaining LinuxT3/T4/repetitions/affected after-stageQA separate. Old585384da remains red; no prior-head carry or Reviewer test execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1788 · 2026-11-11T00:13:59.255Z

Publication-order incident for archived A-18526 (2026-11-11 00:10Z): artifact.create was scheduled after the scanner command completed but before its nonzero exit was checked. No matched value is recorded here. Scanner findings: [{"file": "original-graph.json", "ruleClass": "credential-shaped sk-prefix (tracked-filename false positive)", "line": 535, "column": 17, "byteOffset": 21897}, {"file": "per-file-union.jsonl", "ruleClass": "credential-shaped sk-prefix (tracked-filename false positive)", "line": 543, "column": 22, "byteOffset": 760773}, {"file": "repaired-graph.json", "ruleClass": "credential-shaped sk-prefix (tracked-filename false positive)", "line": 566, "column": 17, "byteOffset": 23032}, {"file": "tier-assignments.json", "ruleClass": "credential-shaped sk-prefix (tracked-filename false positive)", "line": 691, "column": 15, "byteOffset": 31031}]. These were the same tracked-filename false positive in four metadata outputs, not credentials. A-18526 was archived; A-18527 preserved decoded path identity with JSON escaping and was published only after the unchanged scanner positive-control/zero-match exit-0 receipt. Orchestration correction: scan and artifact creation are separate dependent steps; inspect exit_code===0 and the positive-control/zero-match receipt before making artifact.create callable. A nonzero/incomplete receipt ends the publication branch; never schedule publication merely because exec_command returned. Shared publish helper belongs to Coordinator follow-up.

### impl-1788 · 2026-11-11T00:32:10.799Z

Authorized rule-11 merge per Coordinator f06b870c-4649-4c89-a74c-7d2d2151d5db: merged current origin/dev e14c3bf6d into 7207e75cb, commit57ea802879e5a88028ddf698521d2cc93157c8a0. Resolved logins.ts keeping pending_bindings migration/triggers, login_capacity_launch, heldForLaunch, ready-key/name indexes and ready-only startup registration. All19 login-* files pass216 generated outcomes at this merge head (A-18533), hub typecheck and wording lint pass; clean tree, native slot released. Static merge graph over35 changed paths:696 resolved+15 unknown conservative consumers;247 T3/T4. Coordinator answer12b05623-5fcd-431b-970a-c2a262ee721d approves post-delta native previous10 directedfiles plus host-relaunch and waiting-launch-restart, current-head login native files accounted separately; broad T3/T4 stays merge/stage. No old receipt is claimed at the new merge head; fresh verification follows delta source clearance and native slot.

### rev-36 · 2026-11-11T00:33:42.697Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1788-delta-source-1
commit: 57ea802879e5a88028ddf698521d2cc93157c8a0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18534: authorized merge delta source clear, Standards0/Spec0. Coordinator f06b870c authorization and12b05623 directed native set independently read. Both-parent conflict review preserves pending_bindings backfill/triggers/capacity index/heldForLaunch and ready-key/name indexes/ready-only startup. Sessions account/demand admission and secret delivery coexist; prior assertions and documented waiting policy retained. A-18533 current merge-head19login files/216 local passes independently read, qualified macOS evidence. Old7207 configured receipt/verified marks are historical; no current-head criterion verified. Run directed12-file native set/current-head login support, exact TMPDIR inventory, then fresh mode-free verify after slot release at57ea. Final union must include prior+merge graphs/unknowns/explicit consumers; broader T3/T4/affected after-stageQA separate. No Reviewer test/probe/validator execution.

### impl-1788 · 2026-11-11T00:38:15.433Z

Delta-reviewed head57ea802879e5a88028ddf698521d2cc93157c8a0: A-18533 all19 login files216 outcomes + A-18535 approved12 native files109 outcomes, overlap key-spawn/write-back5 outcomes =>29 distinct files320 base outcomes. A-18535 also records20 fresh-process repetitions/25 generated outcomes, retained producer source, args/cwd/env-policy and status/signal linkage. Exact TMPDIR9858 names before/after identical, appeared[] disappeared[], fixture prefixes[] to[]. All producer exits0; local darwin27.0.0 arm64 Node24.21.0, no browser/stress. Source head/tree clean and unchanged; preservation slot released to T-1785. Publication gated programmatically on scan exit0 + positive control/zero matches. Fresh mode-free verification submitted after release, result pending. Previous source7207 and older receipts remain separately qualified, no implicit carry. Coordinator-approved broad T3/T4 deferrals stay merge/stage.

### impl-1788 · 2026-11-11T01:00:40.311Z

Fresh configured b88d380d-e14a-46d1-aa20-f72ed151f443 is green at delta-reviewed57ea802879e5a88028ddf698521d2cc93157c8a0/tree3597f41f3ee4cf57da8e599405623e710c9276bf:6006 passed,0failed/cancelled/skipped/todo. A-18544 original receipt; A-18545 final named-case, consumer and producer accounting. T0/allT1/fallbackallT2/Web/changedT3/selectedT4 completed on Linuxx64 droplet c-8 lon1, Node24.21.0, Neovim0.12.5, ChromeHeadlessShell1248/GoogleChromeforTesting156.0.8078.4; lifetime1109s/cost0.0770 perhub, diagnostics reportmode. Conservative consumer union723=477positive configured filefinishes+233T3/13T4 deferred, no missing lower/Web. Localcurrenthead base29unique files320outcomes,51producer linkages, exactTMPDIRsets9858identical. Head/tree cleanunchanged; no carryfrompriorhead, no newrun forpacket. Awaitreviewer current-head verification; fullremainingT3/T4/affectedstageQA stay separate.

### rev-36 · 2026-11-11T01:02:04.974Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1788-final-2
commit: 57ea802879e5a88028ddf698521d2cc93157c8a0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18546: merged-head final evidence clear; C1–C5 verified. Same-head b88d380d/A-18544 green6006/6006, named criterion/repair/capacity outcomes independently checked. A-18545 union723 reconciles477positive base file finishes +246T3/T4 deferrals, no missing lower/Web. A-18533/35 current-head local union29files/320base outcomes (25T1/229T2/66T3);31base producers/325executions include5overlaps, plus20repetition producers/25generated outcomes. All51 output/source hashes and manifest invocation/completion links match. Exact9858TMPDIR name sets identical; native PID/env export limits retained. Delta sourceA-18534 applies. Uncached Linuxx64droplet/Node24.21/Nvim.12.5/HeadlessShell1248CfT156; required selected phases/Web complete, report-only advisories retained. Old585384da remains red; old7207 green is not carried. Full remaining LinuxT3/T4/repetitions/affected after-stageQA separate. No Reviewer test execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-11T01:41:27.788Z

Merged 6252673e8cbf560c8de994c0147ac31f2551cecd onto dev.
