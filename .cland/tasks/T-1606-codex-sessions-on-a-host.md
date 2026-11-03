---
id: T-1606
kind: task
title: Codex sessions on a host
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
  - T-1601
topic: topic-1373
branch: t/T-1606-codex-sessions-on-a-host
created: 2026-11-02T03:33:56.906Z
updated: 2026-11-03T23:02:21.638Z
---

## Summary

A Codex session on a fake host starts its app-server through the agent with `--listen unix://` in the host's run directory. The hub reaches it through a per-session forward. The sandbox roots come from the host's realpath, and the network allow-list names the host's run directory instead of the hub's.

Hot files: `hub/src/adapters/codex.ts`, `hub/test/codex-remote.test.ts` (new)

## Acceptance criteria

- [x] C1. Through the frame protocol a Codex session launched on a fake host with the scripted Codex fake receives a delivery and reports its state (test).
  - done: impl-1606 · 2026-11-03T22:35:16.331Z
- [x] C2. The app-server socket is in the host's run directory and the hub's JSON-RPC client reaches it only through the per-session forward (test).
  - done: impl-1606 · 2026-11-03T22:43:12.474Z
- [x] C3. The thread policy's writable roots, `.git` directories and network allow-list socket directories come from the host's layout and realpath, with no hub-machine path, and no `danger-full-access` profile is used (test).
  - done: impl-1606 · 2026-11-03T22:58:42.340Z
- [x] C4. The `--version` check and the stop go through the host's agent, and the codex-adapter, codex-native and codex-workspace-git test files pass with no test edited.
  - done: impl-1606 · 2026-11-03T22:13:25.305Z

## Notes

Shared files: `hub/src/adapters/codex.ts`

## Comments

### coord · 2026-11-03T22:05:30.900Z

Seam note (coord decision 2026-11-03 22:05Z): T-1606 owns host sandbox-policy translation under its C3. Sessions builds a remote session's writable roots, .git and socket directories from the Host layout and realpath, resolved by the agent on the host, and passes them to the adapter as an explicit host policy. Local sessions are unchanged. An unresolved remote policy fails closed with a named refusal, never falling back to hub paths or danger-full-access. A planted hub-path scan covers the launched thread policy. The Sessions hunk stays small; T-1607 and T-1604 share the area, and the second to land merges dev on request.

### impl-1606 · 2026-11-03T22:08:59.869Z

Consumer inventory addendum: Sessions #launchPolicy consumers are #spawnLaunch and #resumeWork (fresh resume delegates launch); both remote paths use one helper, local construction unchanged. Host/wire shapes unchanged. codex-host scratch roots shortened for the 104-byte prerequisite; assertions retained. C4 preservation files unchanged. Coordinator authorized Sessions changes and absolute-root refusal.

### impl-1606 · 2026-11-03T22:11:20.802Z

Before review: shared fixture edits are prerequisite-only tempProject(t, cx-, /tmp), each backed by mkdtemp and ownDirectory cleanup. Files: codex-host, codex-sandbox-host, host-launch-layout. Actual prior refusal: Codex socket exceeds 104 bytes on host mapped: .../cland-proj-.../.cland/run/cx-....sock. No behavioral assertion removed. New frame case proves same named refusal contains the original overlong runDirectory and starts no native process. Remote missing-root refusal additionally checks Host.statDirectory because legacy Host.realpath echoes absent paths.

### coord · 2026-11-03T22:19:01.442Z

Coord decision 2026-11-03 22:19Z (reviewer aside b003e261): T-1606 fixes the pre-existing Sessions failed-launch recovery that dropped the remote Host. The recovery-pending process captures the admitted Host; #stopFailedLaunch and its file undo run only through it; a missing or revoked host gives cleanup-incomplete with the host named, with no local fallback. Regression tests: a failed remote handshake gets remote-only stop and undo; a same-numbered local PID is never signalled; a mirrored hub file survives; local recovery is unchanged.

### rev-35 · 2026-11-03T22:19:09.314Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1606-source-1
commit: 5f7d7772d8af4c23052984072af8fe2c0dd7f254
scope: full
findings: [{"severity":"medium","text":"Failed-launch forward release only runs when the original LaunchFiles snapshot is already empty. Durable LaunchRecoveryPending returns before rollback, Sessions rolls back a restored copy, and the settled callback only closes the client/deletes live state; forwards remain owned until adapter close. Deferred standalone recovery and confirmed #gone/unwatch retirement likewise lack terminal release. Own/drain these forwards on terminal cleanup, with failed-launch/confirmed-exit and cleanup-retry regressions.","file":"hub/src/adapters/codex.ts","line":414},{"severity":"medium","text":"Stop un-forwards and resolves without joining an already admitted live.connecting reconnect/native subscription flight. Transport install/cancel serialization does not drain the adapter's connection work; a held acquisition can finish and close its late client only after stop reports complete. Fence/join per-session work before release/completion and prove held forward/connect/subscription stop boundaries.","file":"hub/src/adapters/codex.ts","line":1360},{"severity":"medium","text":"The persisted-idle predicate searches the entire session.list JSON for quoted idle, which always matches adapters.codex.states.idle even when the process stays busy/unknown. Observe the exact launched sessionId's state, arm before transition, retain final assertion and a withheld-publication negative control.","file":"hub/test/codex-remote.test.ts","line":77}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear: three medium findings, no high/low. Standards: exact state receipt; Spec: terminal forward ownership and stop joining in-flight acquisition. Detail A-16363 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16363-t-1606-source-review-terminal-forward-ownership-and-exact-state-receipt.md. Remote Host path policy/absolute-root refusals and Unix budgets reviewed; local policy unchanged. C4 preservation files unedited; prerequisite scratch-root edits preserve assertions. A-16361 is supplemental working-tree macOS arm64 Node24.21 evidence, not reviewed-head Linux verification; synthetic Seatbelt is not real Codex sandbox enforcement. C1/C2 failed; C3/C4 remain unverified. Separately reported pre-existing Sessions recovery process missing host as S/Bugs to lead for Coordinator filing/shared-fix decision; not silently broadened into this policy hunk. Fresh source review before verify. No Reviewer tests/probes/browser/edits/Git mutations/delegation.

Criteria: C1 failed (The required persisted remote state proof always succeeds on the capabilities map, independent of the actual session state.), C2 failed (Per-session forwards are not drained on durable/deferred failed launch or confirmed exit, and stop may finish while reconnect acquisition is pending.).

### coord · 2026-11-03T22:28:34.366Z

Seam note (coord, 2026-11-03 22:29Z, stage 4): T-1606 adds the shared adapters/launch-settlement.ts (LaunchSettled = () => void | Promise<void>, a bounded single-flight helper, default 5000 ms) and updates adapters/launch-files.ts to await, retain and retry settlement results. Sessions awaits settlement before releasing the row and role. T-1607 and T-1603 reuse this seam for any async launch cleanup rather than adding their own.

### impl-1606 · 2026-11-03T22:29:26.671Z

Source-review corrections under Coordinator9a60b5c1/ba17b4e1: async settlement consumer inventory covers LaunchRecoveryPending/FailedLaunches and settled callbacks across production, colocated tests, all hub tiers, QA and skills. Production consumers: Codex (async), OpenCode (void unchanged), Sessions (await before row/role release and join recovery at shutdown). Direct callback consumers: codex-host two calls now await; opencode-host/session-archive construct unchanged void callbacks. Suite/Discord settled methods are unrelated. Existing persisted Host/wire/journal shapes unchanged. New shared launch-settlement.ts exports LaunchSettled and one bounded single-flight helper; launch-files.ts retains/reports/retries rejection or timeout. Other harness source/tests unchanged.

### rev-35 · 2026-11-03T22:41:14.221Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1606-source-2
commit: 689de11fd7ca73a6a5ba6fb082cb2fcce6a983ac
scope: full
findings: [{"severity":"medium","text":"Fixture t.after awaits Sessions.close before the later held-producer release hooks at99/144. Assertion/setup failure before explicit release can deadlock cleanup, and tempProject directory cleanup is registered earlier. Use ordered fixture-owned gate release, session drain, storage close, then root removal, with a forced-failure cleanup control. Lead confirmed ordering gap in ebd8032c.","file":"hub/test/codex-remote-cleanup.test.ts","line":57}]
finding_counts: {"high":0,"medium":1,"low":0}

Reworked source not clear for one medium test fixture cleanup finding; previous three medium production/state findings addressed in source. Scope full, no dev merge. Coordinator-authorized Host capture and shared LaunchSettled void|Promise/5000ms bounded single-flight retention/retry reviewed, including callback consumers and Sessions row/role release. Stop joins captured reconnect/subscription/liveness work; frame state selects exact sessionId with withheld-idle control. Detail A-16379 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16379-t-1606-re-review-release-held-fixture-producers-before-shutdown.md. Lead confirmed remaining hook-order issue and is preparing corrected fixture, not present at this head. C2 failed; no runtime criteria verified. A-16372 targeted source-linked macOS arm64 Node24.21 summaries are supplemental, not queued Linux evidence; synthetic Seatbelt not real Codex enforcement. Fresh source review before verify. No Reviewer tests/probes/browser/edits/Git mutations/delegation.

Criteria: C2 failed (The new held lifecycle regressions can hang failure cleanup or remove fixture roots before draining the held producer; ordered release/drain/removal proof is missing.).

### rev-35 · 2026-11-03T22:44:48.266Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1606-source-3
commit: 38f84b244dad779289a68288152be54d064fc1f5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; last medium fixture-order issue resolved. Fixture-owned registry releases all held producers in beforeDirectories, drains Sessions, checks producer completion files/open SQLite before storage close, and guards roots until both receipts. Two forced-failure controls exercise the registered cleanup, retain final root-absence assertions, original eight cases intact. hub/src byte-identical to source-reviewed689de11fd; prior production/state/Host-recovery/shared settlement fixes carry forward. Checked additive callback consumers and preserved unedited codex-adapter/native/workspace-git, OpenCode-host and local launch-recovery files; prerequisite root edits retain assertions. A-16382 local macOS arm64 Node24.21 candidate cleanup10/10 is supplemental, not queued Linux proof; synthetic Seatbelt not real Codex enforcement. C1–C4 remain unverified pending named same-head runtime evidence; final report must preserve executed/deferred tiers, exact source/native provenance and C4 file outcomes. Detail A-16383 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16383-t-1606-source-clear-after-ordered-fixture-cleanup.md. Configured verify may proceed at this head; any changed head requires new source review. Affected after-stage QA separate. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

### rev-35 · 2026-11-03T22:51:39.497Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1606-evidence-1
commit: 38f84b244dad779289a68288152be54d064fc1f5
scope: evidence
findings: [{"severity":"medium","text":"Required T1 state-path inventory rejects the new conditional temp policy: 'home/temp resolver: tmpdir()' and \"temporary path: '/tmp'\". Migrate the exact named expression/context inventory or use the established path seam; preserve the guard and planted violations. Queue stopped before task behavior tiers.","file":"hub/src/adapters/codex.ts","line":232}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at unchanged38f84b244. Actual A-16385:7576–7594 failure is AssertionError in state-paths-lint 'hub source conforms to the named state path inventory', actual ['adapters/codex.ts:232: home/temp resolver: tmpdir()', "adapters/codex.ts:232: temporary path: '/tmp'"] vs []. Source/inventory integration failure, not timing or remote behavior. Run8701e07c overallexit1,1362 completed/1361pass/1fail, no skips/todo; T0exit0,T1exit1. T2/T3/T4/Web unexecuted; browserbinary/versionnull. No behavior passes inferred from projections or prior local summaries. C3 failed; C1/C2/C4 unverified. Uncached Linuxx64 c-8sfo2 Node24.21/Nvim0.12.5 tree9e3a7eeed1ccb7924a6d07f21c94e67f15ae5452; budget/lint/ratchet/skip checks report-only,skips[]/missing0. Billing243s/$0.0169 not suite wall. Detail A-16387 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16387-t-1606-failed-evidence-codex-temporary-path-inventory.md. Corrected head needs fresh source review before verification. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

Criteria: C3 failed (T1 state-path inventory fails on Codex policy line232 tmpdir() and '/tmp'; queued policy/runtime evidence did not execute.).

### impl-1606 · 2026-11-03T22:55:08.919Z

8701e07c/A-16385 actual failure: state-path inventory flagged codex.ts tmpdir() and /tmp conditional nodes. Targeted red reproduced. Under Coordinator b490dba8, remote missing-runDirectory now refuses through one helper used by threadPolicy and socket preparation; only local uses tmpdir/discovery-relative fallback. Direct legacy remote helper consumer in codex-sandbox-host now supplies runDirectory and faithful distinct Git realpaths; local legacy shape/byte fixture unchanged. Remote frame /tmp uses an actual isolated symlink and scans canonical policy against planted hub root; also asserts named malformed-layout launch refusal before spawn. Exact inventory registration has positive and rejected-sibling controls. ADR0008 records the accepted host temp root. No dev merge after review.

### rev-35 · 2026-11-03T23:01:04.631Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1606-source-4
commit: db4ec9425c8bca198923ac1568ac72117979379f
scope: full
findings: [{"severity":"low","text":"The older sentence says legacy discovery-only callers remain unchanged, but the remote helper now requires runDirectory and its consumer was migrated. Qualify that compatibility statement as local callers, consistent with the next paragraph.","file":"docs/agents/tests/hub-test-codex-sandbox-host.test.ts.md","line":22}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low documentation qualification; no high/medium. Exact temp-path inventory registration replaces old parent context, with allowed/reversed/unrelated-expression controls retaining enforcement. Shared remote runDirectory guard covers exported policy/socket/preparation/relaunch; no remote undefined-layout hub tmpdir/discovery fallback. Host /tmp is canonicalized on Host with isolated real symlink/planted hub-root scan, as Coordinator b490dba8 explicitly accepted and ADR0008 records. Local policy byte fixture unchanged; direct remote helper consumer migrated. Earlier forwarding/recovery/async settlement/ordered cleanup source carries forward. A-16390 candidate macOS arm64 Node24.21 targeted source scan6/frame1/sandbox5/state-paths1 supplements are not Linux queue proof; exact-head workspace-git1/nativeexit0 is synthetic Seatbelt, not real Codex enforcement. Prior8701e07c/A-16385 remains failed T1 partial; no T2/T3/T4/Web pass. C1–C4 unverified pending same-head named verification/native facts. Detail A-16392 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16392-t-1606-source-clear-strict-remote-layout-and-exact-temp-inventory.md. No dev merge; changed head needs new source review. No Reviewer runtime tests/probes/browser/edits/Git mutations/delegation.

### rev-35 · 2026-11-03T23:02:21.638Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1606-source-5
commit: 6bfcb711cab21d27ddd28b53f8b916196f54ecad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Complete delta from source-clear db4ec9425 is one guide word, 'local', resolving the last low compatibility ambiguity. Read-only Git comparison confirms hub/src+hub/test identical to that reviewed parent; no dev merge. Previous full implementation review and qualified runtime evidence limits carry forward (A-16392). No criterion verified by prose/source pass; C1–C4 require named same-head runtime/native evidence. A-16385 remains failed historical evidence. Detail A-16394 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16394-t-1606-final-source-pin-local-legacy-guide-clarification.md. Configured verification may proceed at this exact head; affected after-stage QA separate. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.
