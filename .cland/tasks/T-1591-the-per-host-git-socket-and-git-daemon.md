---
id: T-1591
kind: task
title: The per-host git socket and git daemon --inetd
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1326
branch: t/T-1591-the-per-host-git-socket-and-git-daemon
created: 2026-11-02T03:33:53.201Z
updated: 2026-11-02T23:44:10.683Z
closed: 2026-11-02T10:21:29.150Z
---

## Summary

For each host the hub listens on a per-host git socket at 0600. Each connection gets its own `git daemon --inetd` over the territory, with half-open sockets on both ends. The environment is explicit: no `CLAND_TERRITORY_WRITE`, `CLAND_PUSH_HOST=<host>`, and `receive.fsckObjects`, `receive.autogc=false`, `receive.denyDeletes=true` and a `receive.maxInputSize` cap through `GIT_CONFIG_COUNT`. The host-side git proxy (Node built-ins) joins git's stdin and stdout to `git.sock`.

Hot files: `hub/src/host/git-daemon.ts` (new), `hub/src/host/git-proxy.ts` (new), `hub/test/host-git-daemon.test.ts` (new)

## Acceptance criteria

- [x] C1. In a scratch territory, a client using the git proxy on the per-host socket as `core.gitProxy` clones, fetches and pushes a `t/` task branch, and a fetch of a large pack completes without "unexpected disconnect while reading sideband packet" (test).
  - verified: rev-36 [reviewer] · run rev-36-1591-final-1 · 2026-11-02T06:28:32.533Z · commit f95a39fbb4a4d924178d2030a38a8299f27ae51f
  - done: impl-1591 · 2026-11-02T07:13:51.332Z
  - verified: rev-36 [reviewer] · run rev-36-1591-final-2 · 2026-11-02T07:35:32.361Z · commit 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d
- [x] C2. The daemon's environment lacks `CLAND_TERRITORY_WRITE` even when the hub's own environment has it set to `1`, and carries `CLAND_PUSH_HOST` and the four `receive.*` settings (test).
  - verified: rev-36 [reviewer] · run rev-36-1591-final-1 · 2026-11-02T06:28:32.533Z · commit f95a39fbb4a4d924178d2030a38a8299f27ae51f
  - done: impl-1591 · 2026-11-02T07:13:56.069Z
  - verified: rev-36 [reviewer] · run rev-36-1591-final-2 · 2026-11-02T07:35:32.361Z · commit 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d
- [x] C3. A push to `dev` or to the default branch through the socket is refused by the territory's hook, and a branch deletion is refused (test).
  - verified: rev-36 [reviewer] · run rev-36-1591-final-1 · 2026-11-02T06:28:32.533Z · commit f95a39fbb4a4d924178d2030a38a8299f27ae51f
  - done: impl-1591 · 2026-11-02T07:13:58.151Z
  - verified: rev-36 [reviewer] · run rev-36-1591-final-2 · 2026-11-02T07:35:32.361Z · commit 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d
- [x] C4. The per-host socket is a Unix socket at 0600, and no TCP port is opened for git on the hub's side (test).
  - verified: rev-36 [reviewer] · run rev-36-1591-final-1 · 2026-11-02T06:28:32.534Z · commit f95a39fbb4a4d924178d2030a38a8299f27ae51f
  - done: impl-1591 · 2026-11-02T07:13:59.710Z
  - verified: rev-36 [reviewer] · run rev-36-1591-final-2 · 2026-11-02T07:35:32.361Z · commit 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d
- [x] C5. Each connection's daemon exit is logged with its host, duration and exit code, the log carries no environment values, and the listener caps concurrent daemons per host (test).
  - verified: rev-36 [reviewer] · run rev-36-1591-final-1 · 2026-11-02T06:28:32.534Z · commit f95a39fbb4a4d924178d2030a38a8299f27ae51f
  - done: impl-1591 · 2026-11-02T07:14:02.404Z
  - verified: rev-36 [reviewer] · run rev-36-1591-final-2 · 2026-11-02T07:35:32.361Z · commit 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d

## Notes

Shared files: the git daemon's environment (sole owner); `TERRITORY_HOOK` untouched here (owned by 11)

## Comments

### impl-1591 · 2026-11-02T05:43:29.971Z

Consumer inventory before implementation: rg of git daemon / git.sock / gitProxy / CLAND_PUSH_HOST in hub/src, hub/test, web, shared, nvim, docs, qa and .agents finds no existing production listener/proxy API. New exported listener/proxy are consumed initially by host-git-daemon.test.ts; future transport/bootstrap own integration. Existing TERRITORY_HOOK in territory.ts is consumed unchanged (T-1597 owns migration); no existing wire/list/schema changes. Daemon environment is owned here; no role permissions or CLI changes.

### impl-1591 · 2026-11-02T05:50:07.648Z

Implementation committed as ef66c4621; origin/dev fetched with --no-auto-maintenance, merge already up to date; merge-tree clean. Final refinement tracks/drains half-open sockets and joins identity probes at native close. Targeted native Git cases passed on macOS/Node 24.21.0 (no browser, provider, TCP or SSH); final lint found new file missing from tiers.json, now registered T3. Remaining final checks wait for required load <=10. No full suite run before source review.

### rev-35 · 2026-11-02T06:00:59.789Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1591-source-1
commit: 6c81e0d33f772b90a2fb6b7e93a870127d71e5e0
scope: full
findings: [{"severity":"medium","text":"On chmod failure after listen, startup only awaits server.close and never destroys admitted sockets or stops/joins active daemons. A client accepted during the chmod await can hold the connection open, making startup hang with an owned Git child and no returned close handle. Fence admission until readiness or use the full owned shutdown on acquisition failure; cover a held chmod fault with an admitted client and native exit receipts.","file":"hub/src/host/git-daemon.ts","line":87}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Medium at git-daemon.ts:87: chmod failure after listen closes only the server, unlike normal close; admitted sockets/daemons are neither stopped nor joined, so a held client can strand acquisition and prevent a returned cleanup handle. Fence pre-readiness admission or reuse complete owned shutdown, with a bounded fault regression and native exit receipts. Full two-commit source review against c14994a24 in A-15609 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15609-t-1591-source-review-at-6c81e0d33.md). C5 failed, C1–C4 unverified. Explicit receive environment, half-open relay, native pack/ref/cap assertions and scope docs otherwise match the spec. No reviewer tests/browser; A-15602 local 3/3/typecheck/lint reports are not queued verification. Corrected head needs fresh source review before verification.

Criteria: C5 failed (A client admitted while startup awaits chmod is not stopped/joined on chmod failure; startup can hang without returning its ownership handle.).

### impl-1591 · 2026-11-02T06:04:01.181Z

A-15609 correction: startGitDaemon now shares one close/drain for normal stop and failed chmod acquisition; original error rethrown after successful cleanup, both errors retained if cleanup is incomplete. New optional second chmod-operation parameter is additive; consumer search for startGitDaemon/GitDaemonOptions finds only the T3 test plus docs (no production call sites yet), and omitted-argument positive controls remain. Regression reproduced old behavior with exact failure 'AssertionError: failed acquisition reports after owned cleanup' after bounded 10 s observation, then passed with shared cleanup. Native T3 file 4/4 passed locally on macOS/Node24.21.0 (7396.606875 ms file duration); typecheck/lint refresh before new source review. No dev merge since initial source review, no verification submitted.

### rev-36 · 2026-11-02T06:08:08.922Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1591-source-1
commit: f95a39fbb4a4d924178d2030a38a8299f27ae51f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards/Spec no findings. A-15609 acquisition leak resolved by same close path for failed chmod and normal stop: fence listener,destroy sockets,stop/join captured native owners and server. Original error follows successful drainage; incomplete cleanup aggregates both errors. Held-fault test observes exact admitted PID/native exit/socket removal before rejection; normal clone/large pack/ref/env/cap controls preserved. Optional chmod seam/default and consumer/docs/skill updates reviewed; full source otherwise matches prior scope. A-15619 local macOSNode24.21.0 native4/static summaries supplemental. C1–C5 await exact-head mode-free verify/four named native cases. No Reviewer tests/browser/edits;QA policy unchanged.

### rev-36 · 2026-11-02T06:28:32.534Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1591-final-1
commit: f95a39fbb4a4d924178d2030a38a8299f27ae51f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed head. A-15651 run c89b5377-3665-4d0b-b1cb-d9eb3add84f6 independently streamed: uncached exit0, 4703/4703; all four named native Git-daemon outcomes pass, assertion facts checked including failed-start child drainage. C1–C5 verified; no findings. Linux x64 droplet c-8 lon1 Node24.21.0/Neovim0.12.5; Web isolated Chrome Headless Shell1248 Chrome for Testing156.0.8078.4. T0/T1/fallback all T2/changed T3 file/Web complete; remaining T3 deferred to merge batch, T4/repetitions unexecuted. Budget/lint/ratchet and skip check report-only, missing0. No Reviewer execution; task coverage only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-36 · 2026-11-02T07:14:28.428Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1591-delta-source-1
commit: 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, no findings. Verified Coordinator2465aea1 authorized merge. Git implementation/proxy/native tests unchanged; both README Host sections retained. Incoming landed T-1584 attribution and T-1590 schema/startup/runtime delta inspected, no Git interaction finding. Full delta includes runtime changes, so docs-only waiver condition is not met: fresh mode-free verification required at this exact head. A-15707 localMac typecheck/native4 supplemental; prior A-15651 remains prior-head only. C1–C5 runtime marks not carried; task.view done0/verified0/stale5 requires lead refresh. No Reviewer execution.

### rev-36 · 2026-11-02T07:35:32.361Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1591-final-2
commit: 857a8c1576a2f5b4cba59ee8e4def809cadb5f7d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at merged delta-source-reviewed head. Independently streamed A-15731 run9e5cc8fa: uncached exit0,4713/4713, all four native Git cases pass; unchanged assertion facts establish C1–C5. Incoming host-records7/topic-withdraw7/web-authority-unit7/Webwithdraw6 all pass. C1–C5 verified, no findings. Linux x64 droplet Node24.21.0/Neovim0.12.5, isolated HeadlessShell1248 Chrome156.0.8078.4. T0/T1/fallback allT2/changedT3/Web completed; remainingT3batch/T4/repetitions unexecuted. Advisories/skip checks report-only, missing0. New-head run replaces stale evidence; predecessor A-15651 remains prior-head only. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-02T10:21:29.150Z

Merged d1eb35e34eca62ce4cd707c8fbceb9c7bce8a5cb onto dev.

### coord · 2026-11-02T23:44:10.683Z

Seam change recorded for T-1597 (branch leases), Coordinator decision 2026-11-02 23:43Z (topic-1351). `git-daemon.ts` now parses the first Git pkt-line of each connection. A `git-receive-pack` (push) connection holds the existing territory lock from admission through native daemon close, capped at 30 s. `git-upload-pack` (fetch or clone) takes no lock and stays concurrent. The socket test's branch-grant and raw lifecycle handshake are migrated to the lease API. Lock order is unchanged: grant and revoke, merges and host pushes share the one territory lock. Lock contention refuses with a retryable reason.
