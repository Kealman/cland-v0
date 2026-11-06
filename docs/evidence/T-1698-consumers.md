# T-1698 consumer sweep

Performed before production changes; recorded in the item comment. Searches covered
imports and field/function names across production, clients, all test tiers, QA,
startup probes and shipped skills. T-1614's inventory was also read.

Changes: Sessions admission/retry/failure/warning; TaskWorktrees locked admission
and owner checks; agent worktree preparation and optional receipt reply; SSH Host
result; shared checkout receipt parser/validator. Agent direct worktree operations
also accept the optional receipt. Existing prepared recovery owns only newly
created checkout cleanup: reused checkout ownership is never promoted to deletion.

Additive JSON fields: HostWorktreeRecord.checkout and retained; intent.retryable.
Store serialization and ProcessTable completion keep the full current/retained
records; no schema/lease wire changes. Task launch preserves these fields when
reusing current ready ownership. Prune refuses outstanding retained obligations.
Branch lease transfer keeps existing territory lock and TSV readers unchanged.
Listing/flush continue to use the current owner; named retained obligations appear
in persisted owner records and session warning/reply notes.

CLI/web/nvim/spoke/setup and request schemas continue the existing optional host
wire shape. Old agents and stored intents without the optional receipt remain
accepted for initial relaunch but cannot authorize retry. Unedited T-1614 tests
and session-resume provide old-wire and persisted-record compatibility. Coordinator decision8a85dc4d authorizes migrating only the refused-case f2/f3
retry expectations and their spawn count in host-relaunch.test.ts; all other native
preservation files remain unedited; no permission or CLI flag changes.

The launch brief already names public resume and SSH native seams; no additional
seam approval required. New tests preserve exact native readiness and final HEAD
assertions. Unknown preparation has no retryable launch-failure receipt.

## Search inventory

- `docs/hub/ssh-host.md`
- `hub/src/hub/store.ts`
- `hub/src/hub/dispatch.ts`
- `.agents/skills/implement/CHANGES/T-1599-consumers.md`
- `docs/hub/declining-an-accepted-verifier-request-t-1494.md`
- `hub/src/hub/worktrees.ts`
- `qa/briefs/E-1532-stage-2.md`
- `hub/src/territory.ts`
- `hub/src/adapters/sessions.ts`
- `hub/src/adapters/processes.ts`
- `docs/hub/per-user-state.md`
- `docs/hub/adapters-and-sessions.md`
- `hub/src/host/test-host.ts`
- `hub/src/host/host.ts`
- `hub/src/host/registry.ts`
- `hub/src/host/relaunch-state.ts`
- `hub/src/host/ssh-host.ts`
- `hub/src/host/flush.ts`
- `hub/src/host/agent/server.ts`
- `hub/src/host/agent/prepared.ts`
- `hub/src/host/agent/operations.ts`
- `hub/src/host/agent/watch.ts`
- `hub/src/host/agent/prepared-checkout.ts`
- `hub/src/host/agent/worktrees.ts`
- `hub/src/host/legacy-worktree-git.ts`
- `hub/src/host/task-worktrees.ts`
- `hub/src/host/branch-leases.ts`
- `hub/test/host-ssh-contract.test.ts`
- `hub/test/host-contract.ts`
- `hub/test/durations.json`
- `hub/test/host-prepared.test.ts`
- `hub/test/host-relaunch-component.test.ts`
- `hub/test/territory-task-branch.test.ts`
- `hub/test/host-push-on-ref-move.test.ts`
- `hub/test/host-registry.test.ts`
- `docs/agents/tests/hub-test-host-relaunch-component.test.ts.md`
- `hub/test/tiers.json`
- `hub/test/host-push-facts.ts`
- `hub/test/worktree-host.test.ts`
- `hub/test/host-relaunch-retry.test.ts`
- `hub/test/host-clone-integration.test.ts`
- `hub/test/host-relaunch-publication.test.ts`
- `hub/test/host-relaunch-native.test.ts`
- `hub/test/host-agent-files.test.ts`
- `hub/test/host-ref-watch-recovery.test.ts`
- `qa/briefs/E-1531.md`
- `qa/briefs/E-1531-stage-2.md`
- `qa/briefs/E-1532-stage-4.md`
- `qa/briefs/E-1531-stage-3.md`
- `docs/agents/host-agent.md`
- `hub/test/host-push-facts.test.ts`
- `hub/test/host-relaunch.test.ts`
- `hub/test/host-flush-native.test.ts`
- `docs/evidence/T-1614-consumers.md`
- `docs/agents/tests/hub-test-host-relaunch-native.test.ts.md`
- `docs/agents/tests/index.md`
- `docs/agents/tests/hub-test-host-relaunch-publication.test.ts.md`
- `docs/agents/tests/hub-test-host-relaunch-retry.test.ts.md`
- `docs/agents/tests/hub-test-host-relaunch.test.ts.md`
