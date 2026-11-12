---
id: T-1814
kind: task
title: login add treats a dispatcher-synthesized sign-in completion as a close receipt and unmounts before the CLI's SSH has closed
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - needs-triage
assignee: null
parent: E-1535
blocked_by:
  - T-1791
topic: topic-1484
branch: t/T-1814-login-add-treats-a-dispatcher
created: 2026-11-11T16:36:28.908Z
updated: 2026-11-12T02:14:48.928Z
closed: 2026-11-12T02:14:48.928Z
---

## Summary

`cland login add` hands the harness sign-in to the human CLI over `ssh -t`; the hub records no SSH process or close receipt of its own. On a peer close (dispatch.ts near line 1467) or at hub shutdown (`#loginClosers`, near line 2259) the dispatcher synthesizes `complete(null)` for the pending add, and `prepareLoginSignIn` then unmounts and detaches the disk while the CLI's SSH child may still be running and writing the login file. The existing injected disconnect test asserts metadata cleanup only, not native ownership. impl-1790 found it while fixing the same gap for in-place sign-in in T-1790 (topic-1479, 2026-11-11 16:36Z), where owner loss now routes through `LoginSignIn.interrupt()` and keeps an exact-machine fence.

## What to build

Distinguish the CLI's own completion (sent on its pinned connection only after its child closed) from dispatcher-generated owner loss for login add, as T-1790 does for sign-in: owner loss neither unmounts nor detaches until a positive receipt (the owner's close report or the exact machine's deletion receipt) settles the disk, and the login's state says the add was interrupted.

## Acceptance criteria

- [x] C1. A peer close mid-add on a fake host leaves the disk mounted and attached, and records the interrupted add with its host (test).
  - verified: rev-35 [reviewer] · run rev-35-1814-final-1 · 2026-11-12T01:31:30.763Z · commit c111a20aab7ec0fb227c366324a8a810f0a1d783
  - done: impl-1814 · 2026-11-12T01:31:49.759Z
- [x] C2. A graceful hub stop mid-add does the same (test).
  - verified: rev-35 [reviewer] · run rev-35-1814-final-1 · 2026-11-12T01:31:30.763Z · commit c111a20aab7ec0fb227c366324a8a810f0a1d783
  - done: impl-1814 · 2026-11-12T01:31:49.970Z
- [x] C3. The CLI's own post-close completion keeps today's success and failure paths, and an exact-machine deletion receipt settles an interrupted add (test).
  - verified: rev-35 [reviewer] · run rev-35-1814-final-1 · 2026-11-12T01:31:30.763Z · commit c111a20aab7ec0fb227c366324a8a810f0a1d783
  - done: impl-1814 · 2026-11-12T01:31:50.298Z
- [x] C4. A "Create one" card sign-in whose run ends without the agent's close receipt is recovered by the same owner as the CLI add: interrupted with its exact machine captured, disk retained until that machine's deletion receipt or the owner's own close (test).
  - verified: rev-35 [reviewer] · run rev-35-1814-final-1 · 2026-11-12T01:31:30.763Z · commit c111a20aab7ec0fb227c366324a8a810f0a1d783
  - done: impl-1814 · 2026-11-12T01:31:50.644Z

## Comments

### impl-1814 · 2026-11-12T00:15:30.738Z

Rule 20 sweep before changes: shared suite transitive graph (unknowns counted reached):
{
  "reached": [
    "hub/test/account-coalescing.test.ts",
    "hub/test/account-fixture-env.test.ts",
    "hub/test/account-fixture-isolation.test.ts",
    "hub/test/account-limited.test.ts",
    "hub/test/account-limits-unit.test.ts",
    "hub/test/account-limits.test.ts",
    "hub/test/account-poller-clock.test.ts",
    "hub/test/account-poller.test.ts",
    "hub/test/accounts.test.ts",
    "hub/test/adapter-composition.test.ts",
    "hub/test/adapter-generation-forward.test.ts",
    "hub/test/adapter-generation.test.ts",
    "hub/test/adapter-native-boundary.test.ts",
    "hub/test/agents-checkpoint.test.ts",
    "hub/test/agents-filters.test.ts",
    "hub/test/agents-journal.test.ts",
    "hub/test/aide-claims-lifecycle.test.ts",
    "hub/test/aide-claims.test.ts",
    "hub/test/aide-component.test.ts",
    "hub/test/aide-import-cli.test.ts",
    "hub/test/aide-migration.test.ts",
    "hub/test/aide.test.ts",
    "hub/test/answer-users.test.ts",
    "hub/test/approval-records.test.ts",
    "hub/test/approval-restart.test.ts",
    "hub/test/artifact-cleanup-unit.test.ts",
    "hub/test/artifact-cli-lifecycle.test.ts",
    "hub/test/artifact-cli.test.ts",
    "hub/test/artifact-create-unit.test.ts",
    "hub/test/artifact-delete.test.ts",
    "hub/test/artifact-folders.test.ts",
    "hub/test/artifact-host.test.ts",
    "hub/test/artifact-lifecycle.test.ts",
    "hub/test/artifact-upload.test.ts",
    "hub/test/artifact-user.test.ts",
    "hub/test/artifacts-git.test.ts",
    "hub/test/artifacts.test.ts",
    "hub/test/ask-chain.test.ts",
    "hub/test/ask-outcomes.test.ts",
    "hub/test/asks-cli.test.ts",
    "hub/test/asks.test.ts",
    "hub/test/auth-mode.test.ts",
    "hub/test/case-deadlines.test.ts",
    "hub/test/claude-agent-launch.test.ts",
    "hub/test/claude-capture-concurrency.test.ts",
    "hub/test/claude-code-accounts.test.ts",
    "hub/test/claude-code-adapter.test.ts",
    "hub/test/claude-code-environment.test.ts",
    "hub/test/claude-code-host.test.ts",
    "hub/test/claude-code-remote-files.test.ts",
    "hub/test/claude-code-remote.test.ts",
    "hub/test/claude-code-schedule.test.ts",
    "hub/test/claude-code-sessions-lifecycle.test.ts",
    "hub/test/claude-code-sessions.test.ts",
    "hub/test/claude-component-fixture.test.ts",
    "hub/test/claude-stop-owner-component.test.ts",
    "hub/test/cli-as-user.test.ts",
    "hub/test/cli-identity.test.ts",
    "hub/test/cli-session-credential.test.ts",
    "hub/test/cli.test.ts",
    "hub/test/codex-adapter.test.ts",
    "hub/test/codex-delivery.test.ts",
    "hub/test/codex-host.test.ts",
    "hub/test/codex-native.test.ts",
    "hub/test/codex-remote-agent.test.ts",
    "hub/test/codex-remote-cleanup.test.ts",
    "hub/test/codex-remote.test.ts",
    "hub/test/codex-sandbox-host.test.ts",
    "hub/test/codex-workspace-git.test.ts",
    "hub/test/computed-sessions.test.ts",
    "hub/test/config-reload-component.test.ts",
    "hub/test/config-reload.test.ts",
    "hub/test/config-set.test.ts",
    "hub/test/connection-resume.test.ts",
    "hub/test/connection-resync.test.ts",
    "hub/test/connection-snapshot.test.ts",
    "hub/test/cover-quiet.test.ts",
    "hub/test/crew-launch.test.ts",
    "hub/test/crew.test.ts",
    "hub/test/custom-roles-component.test.ts",
    "hub/test/daemon.test.ts",
    "hub/test/default-subscriptions-lifecycle.test.ts",
    "hub/test/default-subscriptions-workflow.test.ts",
    "hub/test/default-subscriptions.test.ts",
    "hub/test/demo-cap.test.ts",
    "hub/test/demo-provisioning.test.ts",
    "hub/test/demo-release-component.test.ts",
    "hub/test/demo-release.test.ts",
    "hub/test/demo.test.ts",
    "hub/test/dev-t3-search-component.test.ts",
    "hub/test/dev-t3-search.test.ts",
    "hub/test/discord-artifacts.test.ts",
    "hub/test/discord-cards.test.ts",
    "hub/test/discord-commands.test.ts",
    "hub/test/discord-inbound-media.test.ts",
    "hub/test/discord-messages.test.ts",
    "hub/test/discord-messenger.test.ts",
    "hub/test/discord-pairing.test.ts",
    "hub/test/discord-render.test.ts",
    "hub/test/discord-users.test.ts",
    "hub/test/doctor-cli.test.ts",
    "hub/test/doctor-isolation.test.ts",
    "hub/test/doctor-remotes.test.ts",
    "hub/test/doctor.test.ts",
    "hub/test/durations-runner.test.ts",
    "hub/test/durations.test.ts",
    "hub/test/edges-component.test.ts",
    "hub/test/edges.test.ts",
    "hub/test/epic-close.test.ts",
    "hub/test/events-quiet.test.ts",
    "hub/test/events.test.ts",
    "hub/test/executor-admission-lock.test.ts",
    "hub/test/executor-deletion-confirmation.test.ts",
    "hub/test/executor-deletion-watchdog.test.ts",
    "hub/test/executor-droplet-component.test.ts",
    "hub/test/executor-droplet.test.ts",
    "hub/test/executor-health.test.ts",
    "hub/test/executor-liveness.test.ts",
    "hub/test/executor-prepare-component.test.ts",
    "hub/test/executor-prepare-retry.test.ts",
    "hub/test/executor-prepare.test.ts",
    "hub/test/executor-reap-confirmation.test.ts",
    "hub/test/executor-recovery-collection.test.ts",
    "hub/test/executor-retirement-component.test.ts",
    "hub/test/executor-run-rules.test.ts",
    "hub/test/executor-run.test.ts",
    "hub/test/executor-safety-component.test.ts",
    "hub/test/executor-safety.test.ts",
    "hub/test/executor-snapshot-confirmation.test.ts",
    "hub/test/executor.test.ts",
    "hub/test/fake-claude-cleanup.test.ts",
    "hub/test/fake-harness-capabilities.test.ts",
    "hub/test/fake-harness.test.ts",
    "hub/test/fake-ssh.test.ts",
    "hub/test/fixture-endpoints.test.ts",
    "hub/test/fixture-orphans-lifecycle.test.ts",
    "hub/test/fixture-orphans.test.ts",
    "hub/test/fixture-socket-lifecycle.test.ts",
    "hub/test/fixture-socket-path.test.ts",
    "hub/test/fixture-store.test.ts",
    "hub/test/fixture-worker-lifecycle.test.ts",
    "hub/test/follows-native.test.ts",
    "hub/test/follows.test.ts",
    "hub/test/freshness.test.ts",
    "hub/test/gateway-secrets.test.ts",
    "hub/test/gateway-state.test.ts",
    "hub/test/gateway.test.ts",
    "hub/test/git-maintenance-cli.test.ts",
    "hub/test/git-maintenance-startup.test.ts",
    "hub/test/git-maintenance.test.ts",
    "hub/test/handover-integrity-component.test.ts",
    "hub/test/handover-integrity.test.ts",
    "hub/test/handover-process.test.ts",
    "hub/test/handover.test.ts",
    "hub/test/harness-framing.test.ts",
    "hub/test/harness-import.test.ts",
    "hub/test/heartbeat-digest.test.ts",
    "hub/test/heartbeat.test.ts",
    "hub/test/homebrew-publication.test.ts",
    "hub/test/hook-bridge-doctor.test.ts",
    "hub/test/host-agent-restart.test.ts",
    "hub/test/host-agent.test.ts",
    "hub/test/host-allow-list.test.ts",
    "hub/test/host-attach-routing.test.ts",
    "hub/test/host-attach.test.ts",
    "hub/test/host-clone-integration.test.ts",
    "hub/test/host-contract-coverage.test.ts",
    "hub/test/host-create-admission.test.ts",
    "hub/test/host-create-entry.test.ts",
    "hub/test/host-create-ready.test.ts",
    "hub/test/host-destroy-native.test.ts",
    "hub/test/host-destroy.test.ts",
    "hub/test/host-flush-native.test.ts",
    "hub/test/host-flush.test.ts",
    "hub/test/host-launch-layout.test.ts",
    "hub/test/host-lease-lock.test.ts",
    "hub/test/host-lease.test.ts",
    "hub/test/host-limit-poller.test.ts",
    "hub/test/host-local-contract.test.ts",
    "hub/test/host-local-liveness.test.ts",
    "hub/test/host-orphans.test.ts",
    "hub/test/host-prepare.test.ts",
    "hub/test/host-prepared.test.ts",
    "hub/test/host-provision-gate.test.ts",
    "hub/test/host-provision-records.test.ts",
    "hub/test/host-provision-recovery.test.ts",
    "hub/test/host-push-facts.test.ts",
    "hub/test/host-push-on-ref-move.test.ts",
    "hub/test/host-readiness-owner.test.ts",
    "hub/test/host-reboot-controller.test.ts",
    "hub/test/host-reboot-native.test.ts",
    "hub/test/host-reboot.test.ts",
    "hub/test/host-records.test.ts",
    "hub/test/host-registry.test.ts",
    "hub/test/host-relaunch-component.test.ts",
    "hub/test/host-relaunch-native.test.ts",
    "hub/test/host-relaunch-publication.test.ts",
    "hub/test/host-relaunch-retry.test.ts",
    "hub/test/host-relaunch.test.ts",
    "hub/test/host-restart-reconcile.test.ts",
    "hub/test/host-restart.test.ts",
    "hub/test/host-revoke-native.test.ts",
    "hub/test/host-revoke.test.ts",
    "hub/test/host-runtime-delivery.test.ts",
    "hub/test/host-runtime-join.test.ts",
    "hub/test/host-runtime-owner.test.ts",
    "hub/test/host-secret-admission.test.ts",
    "hub/test/host-ssh-contract.test.ts",
    "hub/test/host-ssh-registry.test.ts",
    "hub/test/host-status.test.ts",
    "hub/test/host-stop.test.ts",
    "hub/test/host-supervisor.test.ts",
    "hub/test/host-survival-native.test.ts",
    "hub/test/host-survival.test.ts",
    "hub/test/host-unreachable.test.ts",
    "hub/test/host-watchdog.test.ts",
    "hub/test/hub-cards-voice.test.ts",
    "hub/test/hub-cards.test.ts",
    "hub/test/hub-lock-heartbeat.test.ts",
    "hub/test/hub-lock-identity.test.ts",
    "hub/test/hub-lock-readers.test.ts",
    "hub/test/hub-priority.test.ts",
    "hub/test/hub-status-component.test.ts",
    "hub/test/human-hold.test.ts",
    "hub/test/human-marks.test.ts",
    "hub/test/human-routing.test.ts",
    "hub/test/hygiene.test.ts",
    "hub/test/import-github-lifecycle.test.ts",
    "hub/test/import-github.test.ts",
    "hub/test/in-process-spoke.test.ts",
    "hub/test/inbox-actions.test.ts",
    "hub/test/inbox-query.test.ts",
    "hub/test/inbox-requests-component.test.ts",
    "hub/test/inbox-requests.test.ts",
    "hub/test/inbox-verifier-load.test.ts",
    "hub/test/inbox-workload-soak.test.ts",
    "hub/test/inbox-workload.test.ts",
    "hub/test/init-categories.test.ts",
    "hub/test/init-first-commit.test.ts",
    "hub/test/init-roots.test.ts",
    "hub/test/init-settings.test.ts",
    "hub/test/init-skills-report.test.ts",
    "hub/test/init-skills-update.test.ts",
    "hub/test/init.test.ts",
    "hub/test/inject-stalled.test.ts",
    "hub/test/item-lead.test.ts",
    "hub/test/item-summary-lua-soak.test.ts",
    "hub/test/item-summary-lua.test.ts",
    "hub/test/item-summary-scale.test.ts",
    "hub/test/item-summary.test.ts",
    "hub/test/journal-async.test.ts",
    "hub/test/journal-flush.test.ts",
    "hub/test/journal-subagents.test.ts",
    "hub/test/launch-admission.test.ts",
    "hub/test/launch-files.test.ts",
    "hub/test/launch-recovery.test.ts",
    "hub/test/launch-settlement.test.ts",
    "hub/test/lead-handover-process.test.ts",
    "hub/test/lead-handover.test.ts",
    "hub/test/lead-launch.test.ts",
    "hub/test/lead-permissions-component.test.ts",
    "hub/test/lead-permissions-process.test.ts",
    "hub/test/lead-permissions.test.ts",
    "hub/test/lead-routing-process.test.ts",
    "hub/test/lead-routing.test.ts",
    "hub/test/lifecycle-serialization.test.ts",
    "hub/test/login-add-component.test.ts",
    "hub/test/login-add.test.ts",
    "hub/test/login-binding.test.ts",
    "hub/test/login-capacity-list.test.ts",
    "hub/test/login-capacity.test.ts",
    "hub/test/login-card-recovery.test.ts",
    "hub/test/login-card-signin-owner.test.ts",
    "hub/test/login-card-signin-remote.test.ts",
    "hub/test/login-card-signin.test.ts",
    "hub/test/login-exclusive-native.test.ts",
    "hub/test/login-exclusive.test.ts",
    "hub/test/login-host-pin.test.ts",
    "hub/test/login-key-spawn.test.ts",
    "hub/test/login-keys.test.ts",
    "hub/test/login-list.test.ts",
    "hub/test/login-provision-bind.test.ts",
    "hub/test/login-reconcile.test.ts",
    "hub/test/login-records.test.ts",
    "hub/test/login-relaunch.test.ts",
    "hub/test/login-release.test.ts",
    "hub/test/login-remove.test.ts",
    "hub/test/login-resignin-native.test.ts",
    "hub/test/login-selection.test.ts",
    "hub/test/login-signed-out-native.test.ts",
    "hub/test/login-signed-out.test.ts",
    "hub/test/login-signin-recovery.test.ts",
    "hub/test/login-signin.test.ts",
    "hub/test/login-snapshot-cli.test.ts",
    "hub/test/login-snapshots.test.ts",
    "hub/test/login-wait.test.ts",
    "hub/test/login-write-back.test.ts",
    "hub/test/measure-memory.test.ts",
    "hub/test/merge-batches.test.ts",
    "hub/test/merge-checkout-lifecycle.test.ts",
    "hub/test/merge-checkout.test.ts",
    "hub/test/merge-gate.test.ts",
    "hub/test/merge-policy.test.ts",
    "hub/test/merge-queue-unit.test.ts",
    "hub/test/merge-queue.test.ts",
    "hub/test/merge-recovery-native.test.ts",
    "hub/test/merge-recovery.test.ts",
    "hub/test/merge.test.ts",
    "hub/test/message-display-name.test.ts",
    "hub/test/message-users.test.ts",
    "hub/test/models.test.ts",
    "hub/test/name-reservation.test.ts",
    "hub/test/names.test.ts",
    "hub/test/nvim-agents-filters-rules.test.ts",
    "hub/test/nvim-artifacts-rules.test.ts",
    "hub/test/nvim-crew-rules.test.ts",
    "hub/test/nvim-inbox-requests-rules.test.ts",
    "hub/test/nvim-item-prefixes-rules.test.ts",
    "hub/test/nvim-items-rules.test.ts",
    "hub/test/nvim-needs-you-rules.test.ts",
    "hub/test/nvim-sessions-rules.test.ts",
    "hub/test/open.test.ts",
    "hub/test/opencode-adapter.test.ts",
    "hub/test/opencode-database.test.ts",
    "hub/test/opencode-host.test.ts",
    "hub/test/opencode-launch-policy.test.ts",
    "hub/test/opencode-native.test.ts",
    "hub/test/opencode-remote-cleanup.test.ts",
    "hub/test/opencode-remote.test.ts",
    "hub/test/orphan-servers-perf.test.ts",
    "hub/test/orphan-servers.test.ts",
    "hub/test/orphan-sweep-lock.test.ts",
    "hub/test/outbox-gateway.test.ts",
    "hub/test/outbox.test.ts",
    "hub/test/pairing-approval.test.ts",
    "hub/test/pairing-codes.test.ts",
    "hub/test/pairing-service.test.ts",
    "hub/test/permissions.test.ts",
    "hub/test/pid-identity.test.ts",
    "hub/test/plan-approval-reload.test.ts",
    "hub/test/plan-gate.test.ts",
    "hub/test/planned-stage.test.ts",
    "hub/test/poller-lease.test.ts",
    "hub/test/pool-failures.test.ts",
    "hub/test/pool-idle-stop.test.ts",
    "hub/test/pool-scale.test.ts",
    "hub/test/pool-spend-cap.test.ts",
    "hub/test/prepared-project.test.ts",
    "hub/test/presence.test.ts",
    "hub/test/process-cleanup.test.ts",
    "hub/test/progress.test.ts",
    "hub/test/project-clock.test.ts",
    "hub/test/project-hub-lifecycle.test.ts",
    "hub/test/project-hub.test.ts",
    "hub/test/project-probes.test.ts",
    "hub/test/prompt-races.test.ts",
    "hub/test/publish-component.test.ts",
    "hub/test/publish.test.ts",
    "hub/test/push-component.test.ts",
    "hub/test/push.test.ts",
    "hub/test/qa-lint-build.test.ts",
    "hub/test/qa-lint-cli.test.ts",
    "hub/test/quarantine-runner.test.ts",
    "hub/test/release-item.test.ts",
    "hub/test/release-t3-component.test.ts",
    "hub/test/release.test.ts",
    "hub/test/remote-cli.test.ts",
    "hub/test/remote-discovery-cli.test.ts",
    "hub/test/remote-discovery-host.test.ts",
    "hub/test/remote-docs-pairing.test.ts",
    "hub/test/remote-fixture-lifecycle.test.ts",
    "hub/test/remote-neutral.test.ts",
    "hub/test/remote-publications.test.ts",
    "hub/test/remote-scripted.test.ts",
    "hub/test/remote-state-migration.test.ts",
    "hub/test/remote-state.test.ts",
    "hub/test/remote-workbench.test.ts",
    "hub/test/request-guard-component.test.ts",
    "hub/test/request-guard.test.ts",
    "hub/test/resilience-component.test.ts",
    "hub/test/resilience.test.ts",
    "hub/test/review-qa.test.ts",
    "hub/test/role-integrity-component.test.ts",
    "hub/test/role-integrity.test.ts",
    "hub/test/role-launch.test.ts",
    "hub/test/roles-component.test.ts",
    "hub/test/roles-session-refresh.test.ts",
    "hub/test/roles-snapshot-cli.test.ts",
    "hub/test/roles-snapshot.test.ts",
    "hub/test/roles-template-component.test.ts",
    "hub/test/roles-template.test.ts",
    "hub/test/roles-timing.test.ts",
    "hub/test/roles.test.ts",
    "hub/test/routing.test.ts",
    "hub/test/rule-cli.test.ts",
    "hub/test/rule-sessions-component.test.ts",
    "hub/test/rule-sessions.test.ts",
    "hub/test/scenarios/crew-launch.test.ts",
    "hub/test/scenarios/droplet-verify.test.ts",
    "hub/test/scenarios/hook-bridge.test.ts",
    "hub/test/scenarios/hub-lifecycle.test.ts",
    "hub/test/scenarios/message-tracer.test.ts",
    "hub/test/scenarios/release.test.ts",
    "hub/test/scenarios/remotes.test.ts",
    "hub/test/scenarios/setup.test.ts",
    "hub/test/scenarios/stage-close.test.ts",
    "hub/test/scenarios/startup-smoke.test.ts",
    "hub/test/scenarios/ticket-flow.test.ts",
    "hub/test/secrets-environment.test.ts",
    "hub/test/secrets.test.ts",
    "hub/test/send-input.test.ts",
    "hub/test/session-archive-merge.test.ts",
    "hub/test/session-archive.test.ts",
    "hub/test/session-async-processes-lifecycle.test.ts",
    "hub/test/session-async-processes.test.ts",
    "hub/test/session-brief-component.test.ts",
    "hub/test/session-brief.test.ts",
    "hub/test/session-credential-io.test.ts",
    "hub/test/session-cwd.test.ts",
    "hub/test/session-events-component.test.ts",
    "hub/test/session-events.test.ts",
    "hub/test/session-holds-component.test.ts",
    "hub/test/session-holds.test.ts",
    "hub/test/session-host-placement.test.ts",
    "hub/test/session-host-routing.test.ts",
    "hub/test/session-host.test.ts",
    "hub/test/session-launch-component.test.ts",
    "hub/test/session-launch-lifecycle.test.ts",
    "hub/test/session-launch.test.ts",
    "hub/test/session-model.test.ts",
    "hub/test/session-native-lifecycle.test.ts",
    "hub/test/session-pool-placement.test.ts",
    "hub/test/session-resume-component.test.ts",
    "hub/test/session-resume-lifecycle.test.ts",
    "hub/test/session-resume.test.ts",
    "hub/test/session-retry.test.ts",
    "hub/test/session-stop-races-cleanup.test.ts",
    "hub/test/session-stop-races-component.test.ts",
    "hub/test/session-stop-races.test.ts",
    "hub/test/session-usage.test.ts",
    "hub/test/setup-cli.test.ts",
    "hub/test/setup-favourite.test.ts",
    "hub/test/setup-flow.test.ts",
    "hub/test/setup-handover.test.ts",
    "hub/test/setup-hub-component.test.ts",
    "hub/test/setup-hub.test.ts",
    "hub/test/setup-pairing-component.test.ts",
    "hub/test/setup-remote-component.test.ts",
    "hub/test/setup-remotes.test.ts",
    "hub/test/shared-defects-report.test.ts",
    "hub/test/shared-defects.test.ts",
    "hub/test/skills-onboarding.test.ts",
    "hub/test/skills-qa.test.ts",
    "hub/test/skills-tracker-jq.test.ts",
    "hub/test/skills-tracker.test.ts",
    "hub/test/speech-command.test.ts",
    "hub/test/spoke-artifact-budget.test.ts",
    "hub/test/spoke-footprint.test.ts",
    "hub/test/spoke-identity.test.ts",
    "hub/test/spoke-lazy-tools.test.ts",
    "hub/test/spoke-stdio.test.ts",
    "hub/test/spoke-unix-edge.test.ts",
    "hub/test/stage-closure-component.test.ts",
    "hub/test/stage-qa.test.ts",
    "hub/test/startup-cleanup.test.ts",
    "hub/test/startup-deadline-component.test.ts",
    "hub/test/startup-ready-component.test.ts",
    "hub/test/startup-replies-scale.test.ts",
    "hub/test/startup-smoke.test.ts",
    "hub/test/startup-task-pages-soak.test.ts",
    "hub/test/state-inventory.test.ts",
    "hub/test/store-and-forward.test.ts",
    "hub/test/subscription-frame.test.ts",
    "hub/test/subscription-hygiene.test.ts",
    "hub/test/subscriptions.test.ts",
    "hub/test/suite-admission-close.test.ts",
    "hub/test/suite-admission-cost.test.ts",
    "hub/test/suite-admission-responsive.test.ts",
    "hub/test/suite-admission.test.ts",
    "hub/test/suite-cache-recovery.test.ts",
    "hub/test/suite-cache.test.ts",
    "hub/test/suite-cancel.test.ts",
    "hub/test/suite-candidate-remote.test.ts",
    "hub/test/suite-candidate.test.ts",
    "hub/test/suite-check.test.ts",
    "hub/test/suite-close-component.test.ts",
    "hub/test/suite-close-recovery.test.ts",
    "hub/test/suite-close.test.ts",
    "hub/test/suite-coordinator.test.ts",
    "hub/test/suite-cover.test.ts",
    "hub/test/suite-coverage.test.ts",
    "hub/test/suite-dry-run.test.ts",
    "hub/test/suite-duration-budget.test.ts",
    "hub/test/suite-human-component.test.ts",
    "hub/test/suite-human.test.ts",
    "hub/test/suite-hung-component.test.ts",
    "hub/test/suite-landed-load.test.ts",
    "hub/test/suite-log-backfill.test.ts",
    "hub/test/suite-persistence.test.ts",
    "hub/test/suite-preflight.test.ts",
    "hub/test/suite-progress.test.ts",
    "hub/test/suite-protocol.test.ts",
    "hub/test/suite-queue-policy.test.ts",
    "hub/test/suite-queue.test.ts",
    "hub/test/suite-recovery.test.ts",
    "hub/test/suite-release-cache.test.ts",
    "hub/test/suite-remote-log.test.ts",
    "hub/test/suite-remote-process.test.ts",
    "hub/test/suite-runner-contract.test.ts",
    "hub/test/suite-scheduling.test.ts",
    "hub/test/suite-selection-component.test.ts",
    "hub/test/suite-selection-report.test.ts",
    "hub/test/suite-selection.test.ts",
    "hub/test/suite-soak-component.test.ts",
    "hub/test/suite-soak.test.ts",
    "hub/test/suite-stage-cover.test.ts",
    "hub/test/suite-stage-rules.test.ts",
    "hub/test/suite-summary.test.ts",
    "hub/test/suite-task-selection.test.ts",
    "hub/test/suite-tier-report.test.ts",
    "hub/test/suite-timeouts.test.ts",
    "hub/test/suite-wait-metrics.test.ts",
    "hub/test/suite.test.ts",
    "hub/test/surface.test.ts",
    "hub/test/system-processes.test.ts",
    "hub/test/task-attribution.test.ts",
    "hub/test/task-card-component.test.ts",
    "hub/test/task-card.test.ts",
    "hub/test/task-migrate.test.ts",
    "hub/test/task-plan.test.ts",
    "hub/test/task-prefixes.test.ts",
    "hub/test/task-size.test.ts",
    "hub/test/task-worktrees-lifecycle.test.ts",
    "hub/test/telegram-approvals.test.ts",
    "hub/test/telegram-artifacts.test.ts",
    "hub/test/telegram-cards.test.ts",
    "hub/test/telegram-catchup.test.ts",
    "hub/test/telegram-commands.test.ts",
    "hub/test/telegram-gap.test.ts",
    "hub/test/telegram-graceful-restart.test.ts",
    "hub/test/telegram-inbound.test.ts",
    "hub/test/telegram-liveness.test.ts",
    "hub/test/telegram-marks-setup.test.ts",
    "hub/test/telegram-messenger.test.ts",
    "hub/test/telegram-mute.test.ts",
    "hub/test/telegram-notices.test.ts",
    "hub/test/telegram-pacing.test.ts",
    "hub/test/telegram-pairing.test.ts",
    "hub/test/telegram-polling-restart.test.ts",
    "hub/test/telegram-polling.test.ts",
    "hub/test/telegram-rendering.test.ts",
    "hub/test/telegram-users.test.ts",
    "hub/test/telegram-voice-answers.test.ts",
    "hub/test/telegram-voice-command.test.ts",
    "hub/test/telegram-voice.test.ts",
    "hub/test/termination-ownership.test.ts",
    "hub/test/territory-cli.test.ts",
    "hub/test/territory-lock.test.ts",
    "hub/test/territory-task-branch.test.ts",
    "hub/test/test-admission-outcome.test.ts",
    "hub/test/test-admission.test.ts",
    "hub/test/thread-runs-store.test.ts",
    "hub/test/thread-runs.test.ts",
    "hub/test/tier-tripwire-runner.test.ts",
    "hub/test/tool-arguments-spoke.test.ts",
    "hub/test/tool-arguments.test.ts",
    "hub/test/topic-model.test.ts",
    "hub/test/topic-withdraw.test.ts",
    "hub/test/topics-component.test.ts",
    "hub/test/topics.test.ts",
    "hub/test/tracker-async-component.test.ts",
    "hub/test/tracker-async.test.ts",
    "hub/test/tracker-component.test.ts",
    "hub/test/tracker-conflict-captures.test.ts",
    "hub/test/tracker-criteria.test.ts",
    "hub/test/tracker-criterion-crash.test.ts",
    "hub/test/tracker-criterion-write.test.ts",
    "hub/test/tracker-hierarchy.test.ts",
    "hub/test/tracker-levels.test.ts",
    "hub/test/tracker-load.test.ts",
    "hub/test/tracker-native-boundary.test.ts",
    "hub/test/tracker-rank.test.ts",
    "hub/test/tracker-ready-native.test.ts",
    "hub/test/tracker-ready.test.ts",
    "hub/test/tracker-status-component.test.ts",
    "hub/test/tracker-status.test.ts",
    "hub/test/tracker-summary.test.ts",
    "hub/test/tracker.test.ts",
    "hub/test/transport-config.test.ts",
    "hub/test/transport-fake-contract.test.ts",
    "hub/test/transport-forwards.test.ts",
    "hub/test/transport-records.test.ts",
    "hub/test/transport-ssh-contract.test.ts",
    "hub/test/transport-ssh.test.ts",
    "hub/test/transport-status.test.ts",
    "hub/test/user-invites.test.ts",
    "hub/test/users.test.ts",
    "hub/test/v01-migration.test.ts",
    "hub/test/verdict-commit-component.test.ts",
    "hub/test/verdict-commit.test.ts",
    "hub/test/verdict-criteria.test.ts",
    "hub/test/verdict-findings.test.ts",
    "hub/test/verification-commands.test.ts",
    "hub/test/verification-tree.test.ts",
    "hub/test/verification-workers.test.ts",
    "hub/test/verifier-resolver.test.ts",
    "hub/test/verifier-routing-process.test.ts",
    "hub/test/verifier-routing.test.ts",
    "hub/test/verify-all.test.ts",
    "hub/test/verify-prepare.test.ts",
    "hub/test/verify-submission.test.ts",
    "hub/test/verify-tool.test.ts",
    "hub/test/visibility-component.test.ts",
    "hub/test/visibility-volume.test.ts",
    "hub/test/visibility.test.ts",
    "hub/test/waiting-launch-restart.test.ts",
    "hub/test/waiting-launch.test.ts",
    "hub/test/web-artifacts-unit.test.ts",
    "hub/test/web-artifacts.test.ts",
    "hub/test/web-auth-unit.test.ts",
    "hub/test/web-auth.test.ts",
    "hub/test/web-authority.test.ts",
    "hub/test/web-cookie-secure.test.ts",
    "hub/test/web-edge.test.ts",
    "hub/test/web-phase.test.ts",
    "hub/test/web-release-publication.test.ts",
    "hub/test/web-signin.test.ts",
    "hub/test/web-tunnel-guide.test.ts",
    "hub/test/web-upload.test.ts",
    "hub/test/worktree-cli.test.ts",
    "hub/test/worktree-host.test.ts",
    "nvim/test/artifact-browser.test.ts",
    "nvim/test/artifact-upload.test.ts",
    "nvim/test/client.test.ts",
    "nvim/test/closed-pages.test.ts",
    "nvim/test/criteria.test.ts",
    "nvim/test/explorer-card.test.ts",
    "nvim/test/explorer-compose.test.ts",
    "nvim/test/explorer-roots.test.ts",
    "nvim/test/explorer.test.ts",
    "nvim/test/graph-layout.test.ts",
    "nvim/test/layers.test.ts",
    "nvim/test/message-users-live.test.ts",
    "nvim/test/palette.test.ts",
    "nvim/test/qa-shipped.test.ts",
    "nvim/test/qa.test.ts",
    "nvim/test/remotes.test.ts",
    "nvim/test/rulebook.test.ts",
    "nvim/test/sessions-lifecycle.test.ts",
    "nvim/test/shell.test.ts",
    "nvim/test/startup-budget.test.ts",
    "nvim/test/telegram-marks.test.ts",
    "nvim/test/ui.test.ts",
    "web/test/accounts.test.ts",
    "web/test/area-slots.test.ts",
    "web/test/artifacts.test.ts",
    "web/test/asks.test.ts",
    "web/test/board.test.ts",
    "web/test/composer.test.ts",
    "web/test/connection.test.ts",
    "web/test/events.test.ts",
    "web/test/folds.test.ts",
    "web/test/graph.test.ts",
    "web/test/inbox.test.ts",
    "web/test/item-card.test.ts",
    "web/test/item-criteria.test.ts",
    "web/test/items-actions.test.ts",
    "web/test/items-order.test.ts",
    "web/test/items.test.ts",
    "web/test/key-contexts.test.ts",
    "web/test/message-users.test.ts",
    "web/test/messages.test.ts",
    "web/test/notifications.test.ts",
    "web/test/pairing.test.ts",
    "web/test/palette.test.ts",
    "web/test/passkeys.test.ts",
    "web/test/phone-approvals.test.ts",
    "web/test/phone-asks.test.ts",
    "web/test/phone-composer.test.ts",
    "web/test/phone-disconnected.test.ts",
    "web/test/phone-inbox.test.ts",
    "web/test/phone-install.test.ts",
    "web/test/phone-more.test.ts",
    "web/test/phone-notifications.test.ts",
    "web/test/phone-sessions.test.ts",
    "web/test/phone-thread.test.ts",
    "web/test/phone.test.ts",
    "web/test/plan.test.ts",
    "web/test/readme.test.ts",
    "web/test/remote-via.test.ts",
    "web/test/remotes.test.ts",
    "web/test/session-actions.test.ts",
    "web/test/session-drawer.test.ts",
    "web/test/session-launch.test.ts",
    "web/test/sessions.test.ts",
    "web/test/shell.test.ts",
    "web/test/signin.test.ts",
    "web/test/smoke.test.ts",
    "web/test/telegram-marks.test.ts",
    "web/test/thread-artifacts.test.ts",
    "web/test/thread-runs.test.ts",
    "web/test/topics.test.ts",
    "web/test/uploads.test.ts",
    "web/test/verification.test.ts",
    "web/test/withdraw.test.ts"
  ],
  "unknown": [
    {
      "test": "nvim/test/scenarios/workbench.test.ts",
      "error": "Error: incomplete import graph: unresolved module specifier yaml"
    },
    {
      "test": "nvim/test/plan.test.ts",
      "error": "Error: incomplete import graph: unresolved module specifier yaml"
    },
    {
      "test": "nvim/test/plan-component.test.ts",
      "error": "Error: incomplete import graph: unresolved module specifier yaml"
    },
    {
      "test": "hub/test/sqlite-contention.test.ts",
      "error": "Error: incomplete import graph: eval or indirect module loader [hub/test/sqlite-contention.test.ts]"
    },
    {
      "test": "hub/test/suite-admission-native.test.ts",
      "error": "Error: incomplete import graph: unsupported createRequire base [hub/test/suite-admission-native.test.ts]"
    },
    {
      "test": "hub/test/mod-bridge.test.ts",
      "error": "Error: incomplete import graph: non-literal module specifier [hub/test/mod-bridge.test.ts]"
    },
    {
      "test": "hub/test/plan-approval.test.ts",
      "error": "Error: incomplete import graph: vm loader [hub/test/plan-approval.test.ts]"
    },
    {
      "test": "hub/test/typecheck.test.ts",
      "error": "Error: incomplete import graph: unsupported createRequire base [hub/test/typecheck.test.ts]"
    },
    {
      "test": "hub/test/web-notifications.test.ts",
      "error": "Error: incomplete import graph: vm loader [hub/test/web-notifications.test.ts]"
    },
    {
      "test": "hub/test/init-process.test.ts",
      "error": "Error: incomplete import graph: eval or indirect module loader [hub/test/init-process.test.ts]"
    },
    {
      "test": "hub/test/suite-accounting.test.ts",
      "error": "Error: incomplete import graph: indirect require [hub/test/suite-accounting.test.ts]"
    },
    {
      "test": "hub/test/suite-remote-budget.test.ts",
      "error": "Error: incomplete import graph: indirect require [hub/test/suite-remote-budget.test.ts]"
    },
    {
      "test": "hub/test/executor-safety-load.test.ts",
      "error": "Error: incomplete import graph: eval or indirect module loader [hub/test/executor-safety-load.test.ts]"
    },
    {
      "test": "hub/test/suite-runner.test.ts",
      "error": "Error: incomplete import graph: eval or indirect module loader [hub/test/web-repetitions.ts]"
    },
    {
      "test": "hub/test/task-worktrees.test.ts",
      "error": "Error: incomplete import graph: unsupported createRequire base [hub/test/task-worktrees.test.ts]"
    }
  ]
}
Explicit field/frame/function consumers across production, docs, skills, QA and all tiers:
docs/hub/logins.md
hub/test/login-card-signin-remote.test.ts
hub/src/hub/server.ts
.agents/skills/implement/SKILL.md
hub/src/hub/dispatch.ts
hub/src/hub/web-authority.ts
hub/src/hub/daemon.ts
hub/test/login-release.test.ts
hub/test/login-relaunch.test.ts
hub/test/login-remove.test.ts
hub/test/login-list.test.ts
hub/test/harness.ts
hub/src/protocol.ts
hub/test/login-terminal.test.ts
hub/test/login-card-signin-owner.test.ts
hub/test/login-snapshots.test.ts
hub/test/login-wait.test.ts
hub/src/cli/login-terminal.ts
docs/agents/session-permissions.md
hub/src/host/login-card-signin.ts
hub/src/host/logins.ts
hub/src/host/login-add.ts
hub/src/host/login-cards.ts
hub/src/host/provision-host.ts
hub/src/host/login-signin.ts
hub/test/login-add-component.test.ts
hub/test/login-add.test.ts
hub/test/login-signin.test.ts
.agents/skills/implement/CHANGES/T-1777-login-add.md
hub/test/login-signin-recovery.test.ts
docs/agents/tests/hub-test-login-wait.test.ts.md

Migration: add uses existing private sign_in active/interrupted record and exact-machine settlement; wire/public Login shapes unchanged, legacy injected pending without interrupt remains supported. Native login-add disconnect assertion changes; other graph consumers retain existing LoginRecords and renewal semantics. Card actual preparation gains interrupt; legacy no-interrupt fixture stays conservative. Production dispatcher, release, snapshot, removal and startup owners consume the same fence; no new deletion authority.

### impl-1814 · 2026-11-12T00:17:41.884Z

Rule 20 follow-up: initial sweep comment lists all 705 transitive consumers and 15 unknowns counted as reached plus explicit field/frame consumers. Coordinator accepted native scope login-add (CLI new-add native disk lifecycle), login-card-signin-remote (Host sign-in and Create one), login-resignin-native (shared renewal regressions). Adding host-stop because graceful hub stop drives the new interrupt path. No wire shape changes; prior injected pending without interrupt continues fallback compatibility.

### impl-1814 · 2026-11-12T00:25:23.960Z

Review supplements A-18914 and A-18915 normalize the reached+unknown+explicit union (742 unique paths, manifest tier/disposition per path) and preserve original available producer output with honest provenance limits. Finite local set T3: login-add, login-card-signin, login-resignin-native; T2: login-card-signin-remote, host-stop. login-terminal is a missed T3 direct native close boundary and will run after source-review fixes. Source remains pinned at 290a883e3 during complete review pass.

### rev-35 · 2026-11-12T00:30:24.578Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1814-source-1
commit: 290a883e319d34da78d406189522eb011a37bc16
scope: full
findings: [{"severity":"medium","text":"beginAddSignIn is durable before attach/mount, but rejected uncertain preparation can rethrow without returning a pending; Dispatcher installs no closer until return. Active/creating admission can survive peer loss/graceful stop until startup rather than shared interruption. Lead a643fcef confirms no earlier owner. Own admitted preparation failure through shared interrupt/exact-machine fencing, retaining positive-no-admission/cleanup distinctions; add held/rejected preparation peer/shutdown controls.","file":"hub/src/host/login-signin.ts","line":116},{"severity":"medium","text":"New-add preparation authorize does not assert addAdmission, and complete checks it only before its first await. Recovery/settlement during held attach or umount can allow later effects under a stale admission; current test only recovers before complete starts. Lead a643fcef confirms no sufficient exclusion. Revalidate captured admission and applicable authority before subsequent effects/publication across awaits, with held-boundary regressions and no second owner.","file":"hub/src/host/login-signin.ts","line":140},{"severity":"medium","text":"Reworked unknown-Create-one test teardown awaits owner.stop while cancel returns unresolved lost.promise. A failed setup/code-card assertion before lost.reject strands cleanup and storage closure; no earlier owner releases it (58806091). Prearm synthetic rejection/settlement before stop and prove adverse failure drainage.","file":"hub/test/login-card-signin-owner.test.ts","line":87},{"severity":"medium","text":"Current SSH Host guidance still prescribes new-login-without-interrupt creating retention/future T1814 recovery, and the owner test guide's prior paragraph36–38 still does so despite appended correction. Lead a643fcef confirms missed migrations. Replace superseded current descriptions with shared active/interrupted admission; keep legacy fixture compatibility explicitly conditional.","file":"docs/hub/ssh-host.md","line":378}]
finding_counts: {"high":0,"medium":4,"low":0}

A-18917 complete source1 NOT CLEAR, four medium findings confirmed a643fcef/58806091. Shared private sign_in and exact-machine owner otherwise retained, no wire/public Login change. Corrected A18916 conservative982rows=961manifest+21non-test preserves705graph+15unknown/prior paths, object.tier corrected, original enumeration omissions explicit/untraversed; not coverage. Finite T3 add/card/resignin plus missed direct login-terminal after fixes; remote/host-stop T2. A18913/15 precommit local outputs/reconstructed argv/cwd/outer0 inference, missing separate signal/bin/head attestation qualified; native unlocked discarded,16locked T1806dirs+6captures/no globalcleanup. Original prepublicationpositivecontrol+scan fact b1ebfea9 retained; rawwrite-time-redactor limit A18815/T1808, no fabricated protection/rerun. No criteria verified/configured pass. Clean290a883e3/tree02fa8a35. Holdreleased for consolidated fixes/fresh committed review before mode-free verify; no extra devmerge or Reviewer experiments.

Criteria: C1 failed (Admitted pre-return preparation failure can lack a peer-loss interruption owner; ordinary post-plan disconnect test does not cover it.), C2 failed (Graceful stop can leave an active admitted preparation without returned pending/closer after rejection.), C3 failed (Admission is not revalidated across held attach/umount before subsequent native/provider effects.), C4 failed (Reworked unknown-card regression can strand teardown on its unresolved close promise; current recovery guidance remains contradictory.).

### impl-1814 · 2026-11-12T00:37:07.541Z

Source1 consolidated fixes at c4fa78757: preparation rejection/connection abort records interruption before a pending plan exists; add admission and captured host authority revalidated across effect awaits; refused attach distinguished from unknown mount; unknown-card teardown prearmed and setup-failure variant proven; stale ssh-host and owner-guide instructions replaced. A-18918 holds exact-head finite behavioral receipts, lower-tier 68/68 and lint facts. A-18916 conservative manifest union preserved (all 961 roots + 21 explicit; omitted traversal roots remain reached/unknown). No extra dev merge. All six finite-set files reran at final head; e73fc166e..c4fa78757 source delta is dispatch.ts 1 insertion/1 deletion, no receipt carry. Full T3 merge batch and T4 stage/epic remain deferred.

### rev-35 · 2026-11-12T00:42:10.538Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1814-source-2
commit: c4fa78757d5f00cf60bb8e379b006d6e13cd9367
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18919 complete source2 CLEAR: all four source1 findings addressed; 0 Standards/0 Spec findings. Per-connection preparation abort plus shared catch interrupts admitted uncertain work before pending return; positive attach refusal remains failed/no interrupted fence. Durable admission and captured cleanup authority rechecked across held attach/umount, snapshot authorization, detach and publication. Prearmed card-loss teardown/setup-failure joins; current guidance corrected. Clean c4fa78757, no dev merge. A-18918 retained local exact-head outputs inspected: lower68/68, four finite T3 files11/11, remote+host-stop T2 12/12, status0/signalnull/no skips. A-18920 original wrapper supplies argv/cwd/exec/env and direct spawnSync status/signal; head literal linked to preceding observed HEAD/source stability, not dynamic wrapper Git attestation. Parent strips CLAND_* only; fixtureEnvironment owns child sealing. Slot-wide22 retained cland-h dirs+2 declared captures, no disappeared; not per-head/file attribution or global cleanup; T-1806 record-and-leave disposition. Raw-write-time-redactor limit accepted A18815/T1808 positive prepublication scan, no manufactured protection/rerun. A18916 conservative982 rows maintained. No criteria verified yet; mode-free exact-head Linux and positive case/file/consumer reconciliation required for final C1–C4. Remaining T3 merge batch/T4-stage/after-stage QA separate; no Reviewer runtime work.

### rev-35 · 2026-11-12T01:00:27.670Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1814-evidence-1
commit: c4fa78757d5f00cf60bb8e379b006d6e13cd9367
scope: evidence
findings: [{"severity":"medium","text":"Three declared T2 consumers retain old umount/detach expectations after captured host authority changes; A18921 has enforced failures after attach/mount/publish. Shared add admission now interrupts and retains captured machine before those boundaries. Lead56947824 confirms missed migration/no waiver; Coordinator4dff89fa requires same-case persisted exact-machine deletion settlement and guide update, preserving pre-capture refusal controls. Assert retained state/disk/fence and positive settlement rather than merely deleting cleanup expectations.","file":"hub/test/login-host-pin.test.ts","line":89}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18922 failed-evidence NOT CLEAR at unchanged c4fa78757. Independently scanned A18921 actual finishes: base5483pass/3fail +587filepass/1filefail; separate205loadtest+205loadfile passes. Exact failures login-host-pin:89 after attach/mount/publish, actual effects stop before old expected cleanup. T0/T1 complete0; fallbackT2 exit1; Web/changedT3 unexecuted/browsernull. Provenance treefab28ad042071820256cfbc7dac4f53750a7c1af Linuxx64 Node24.21 droplet c8lon1,912s/$0.0633. Report-only lint/budgets not enforcement failures. Original local/native support retained, not green replacement. Coordinator4dff89fa intended captured-machine retention bar and lead56947824 confirmation accepted; no new product defect established. Hold released for consumer+guide correction and fresh committed source review before new verify. No unchanged full/native/provenance rerun or extra dev merge requested; final criteria pending.

Criteria: C3 failed (Configured run fails three current host-pin ownership consumers; matching captured-machine deletion settlement must be established in the migrated cases.).

### impl-1814 · 2026-11-12T01:02:58.612Z

Failed-evidence consumer migrated at c111a20aa under Coordinator 4dff89fa: all three after-attach/mount/publish cases retain shared interrupted host/disk fence, refuse missing/replacement deletion receipts, release their actual directory-only fake machine and persist its positive deletion read, then prove volume detached and retry admissible. Create/replacement pre-capture behavior preserved. Delta from c4fa78757 is only login-host-pin T2 + its test doc, no production source/config/manifest change; native c4 receipts carry, no native rerun. Conservative consumer union A-18916 retained; this reached consumer now migrated. Fresh source review before retry.

### rev-35 · 2026-11-12T01:04:14.208Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1814-source-3
commit: c111a20aab7ec0fb227c366324a8a810f0a1d783
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18924 source3 CLEAR,0 Standards/0 Spec findings. Two-file T2/docs delta only,39insert12delete, clean head/no dev merge. Three host-pin cases now assert interruption/captured host/same disk/attached inventory/fence, refuse absent/replacement-birth receipts, obtain directory-only fake-provider positive machine deletion read and persist it before production settlement; detached inventory/fence-clear/retry asserted. Pre-capture create/replacement failed/no-fence behavior retained; guide updated. Existing early registered fixture ownership/FakeClock/sealed env retained; no process introduced. A18923 actual13/13 local positive summaries/status0/signalnull at this committed head inspected. Native production dependencies/four directed test bodies unchanged vs c4fa78757, accepted prior-head A18918/20 carry under standing T2/docs rule, not relabelled; no native/provenance rerun. Prior A18921 configured53fab283 remains failed. No criteria verified; mode-free same-head run and actual case/file+982consumer reconciliation required before final C1–C4. No Reviewer runtime work.

### impl-1814 · 2026-11-12T01:28:11.803Z

Run 1e207d4d passed at c111a20aa: 6184 tests, 6184 pass, 0 fail/skip. Linux droplet c-8 lon1, Node24.21.0, Chrome for Testing Headless Shell156.0.8078.4 (binary/provenance in A-18925/A-18926); lifetime1276s cost$0.0886. T0/allT1/fallback-allT2/Web/changedT3 login-add completed. A-18926 reconciles all982 consumer paths against positive file/case finishes; required T1/T2/Web files have positive finishes, named corrected host-pin attach/mount/publish cases pass. Budget/lint duration advisories report-only. Remaining T3 merge batch; T4 and stage QA deferred to occasions. Prior c4 local finite native carry preserved across source3 test-only T2/docs delta. Reviewer settling same-head evidence; no ready claim before final verdict.

### impl-1814 · 2026-11-12T01:29:47.490Z

A-18927 corrects A-18926 export normalization: never use its last-by-name/file joins as ordinary base evidence. Existing A-18925 streamed without rerun: 6184 base-test/684 base-file passes separately 205 load-test/205 load-file passes; all19 required identities retain event arrays (16 base1+load5, corrected host-pin3 base1 only). All982 consumer rows, unknowns and non-test consumers preserved; exact-head Linux/base/load, accepted c4 macOS native carry and deferred paths separated. Source unchanged.

### rev-35 · 2026-11-12T01:31:30.763Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1814-final-1
commit: c111a20aab7ec0fb227c366324a8a810f0a1d783
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18928 FINAL CLEAR allC1–C4. Source A18919/A18924 plus same-head1e207d4d/A18925 independently audited:6184base test+684base file passes;205load test+205load file passes separately,0negative/skip. Required19identities:16base1+load5, corrected host-pin3base1; all82 critical base cases pass. Git tree9b82387a50873a57103ec89a8c356483601eff17; normalized418ee87d58cf4156f2afa9d05cb99a4fc9deec50 independently reconstructed matches provenance; clean exact head. Corrected A18927 preserves982rows/unknowns/static fields, separates base/load replacing A18926 joins;1111 exported event comparisons match source.961tests:684current Linux full files(218T1/413T2/1T3/52Web),3additional accepted native carries,274remaining deferred(257T3/17T4),21static non-test. No missingT1/T2/Web. Linuxx64 Node24.21/nvim0.12.5,c8lon1,2workers1276s/$0.0886; HeadlessShell1248 ChromeTesting156.0.8078.4 exact binary in artifact. T0/T1/fallbackT2/changedT3/Web0; reportlint122/59 and duration/ratchet remain report-only. Mac c4fa78757 four directed native11cases retained across T2/docs-only delta, not relabelled; raw capture positive-prepub-scan/T1808 and slot-wide22T1806dirs+2captures/no globalcleanup limits explicit. Failed53fab283/A18921 retained. FullT3 batch/T4stage/afterQA separate, no Reviewer runtime work. No remaining findings; hold released.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-12T02:14:48.928Z

Merged 1dcb32ec4a7d124b034d8213f41c83432a0bebb4 onto dev.
