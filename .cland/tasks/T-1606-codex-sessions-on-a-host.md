---
id: T-1606
kind: task
title: Codex sessions on a host
state: open
status: in progress
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
updated: 2026-11-03T22:19:09.314Z
---

## Summary

A Codex session on a fake host starts its app-server through the agent with `--listen unix://` in the host's run directory. The hub reaches it through a per-session forward. The sandbox roots come from the host's realpath, and the network allow-list names the host's run directory instead of the hub's.

Hot files: `hub/src/adapters/codex.ts`, `hub/test/codex-remote.test.ts` (new)

## Acceptance criteria

- [ ] C1. Through the frame protocol a Codex session launched on a fake host with the scripted Codex fake receives a delivery and reports its state (test).
  - failed: rev-35 [reviewer] · 2026-11-03T22:19:09.314Z · note The required persisted remote state proof always succeeds on the capabilities map, independent of the actual session state.
- [ ] C2. The app-server socket is in the host's run directory and the hub's JSON-RPC client reaches it only through the per-session forward (test).
  - failed: rev-35 [reviewer] · 2026-11-03T22:19:09.314Z · note Per-session forwards are not drained on durable/deferred failed launch or confirmed exit, and stop may finish while reconnect acquisition is pending.
- [x] C3. The thread policy's writable roots, `.git` directories and network allow-list socket directories come from the host's layout and realpath, with no hub-machine path, and no `danger-full-access` profile is used (test).
  - done: impl-1606 · 2026-11-03T22:13:25.072Z
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
