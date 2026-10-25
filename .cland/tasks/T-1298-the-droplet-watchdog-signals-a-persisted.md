---
id: T-1298
kind: task
title: The droplet watchdog signals a persisted pid on a whole-second start time
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1284
blocked_by:
  - T-543
topic: topic-1068
branch: t/T-1298-the-droplet-watchdog-signals-a-persisted
created: 2026-10-25T10:54:46.064Z
updated: 2026-10-25T23:17:45.257Z
---

## Summary

The droplet watchdog's restart path (`watchdogAlive` / `stopWatchdog` in the droplet executor) still authorizes signals to a persisted pid on a whole-second start time. A pid recycled within the same second passes the check and can receive the signal. T-543 introduces the precise process identity for the adapter consumers; this item moves the watchdog onto it.

Found aside by impl-543 while migrating T-543's consumers (2026-10-25). Native child handles are safe; only the persisted restart path is affected.

## Acceptance criteria

- [x] C1. The watchdog's persisted-pid liveness and stop checks use T-543's precise process identity and its one-time legacy-row upgrade; a test with a recycled pid of the same whole-second start time refuses the signal, and a legacy row whose start does not match, or whose identity cannot be read, never authorizes a destructive signal.
  - done: impl-1298 · 2026-10-25T23:02:33.742Z
  - verified: rev-26 [reviewer] · run rev-20261025-1298-evidence-1 · 2026-10-25T23:17:45.096Z · commit c8842232bd20d55d44f90036d0f0470dadeed55e

## Comments

### impl-1298 · 2026-10-25T22:42:51.935Z

Inherited worktree is clean at 41d2ad8e (T-543 landed). C1 seam: exported watchdogAlive/stopWatchdog with injected native process observations/signals and lease checkpoint; no real process needed for same-second reuse and old-row refusal. Rule20 consumer inventory before source changes: watchdog record writers armWatchdog and executor reconcile/acquire/prepare/demo; readers watchdogAlive/stopWatchdog, readLease/readLeases, executor inspect/reconcile/release and watchdog deletion loop; persisted lease JSON is private to executor and read by executor/drop­let, prepare, demo and fixtures. Search covers hub/test executor-{droplet,run,safety,prepare,health,retirement,contract,lock-liveness}, demo-release, scenarios/droplet-verify, scripted-machine fake; production host dependency wrapper in dependencies.ts. Add optional pidIdentity while keeping pid/startedUtc and existing function arguments; old wire/persisted shape remains supported via one-time coherent native/start upgrade, durable before signals. Shipped docs/skills/QA/startup searches: README executor recovery, implement skill, tests guidance; historical QA T-268 uses separate old prototype watchdog.pid (unaffected); no client consumes the optional watchdog native field. Full consumer listing will be attached as artifact.

### impl-1298 · 2026-10-25T22:50:22.111Z

Implemented/pushed 0b8a2e73 on t/T-1298-the-droplet-watchdog-signals-a-persisted. A-12179 holds full consumer disposition audit, TDD actual red output, correction and local receipt scope. New watchdog records add native pidIdentity while keeping pid/startedUtc; one-time coherent old-row upgrade checkpoints the latest serialized lease before signals; missing/mismatched/unreadable proof, changed record or failed persistence grants none. TERM/KILL revalidate precise birth. Existing held release/rearm native regression reproduced and corrected. Local Darwin arm64: changed T1 15/15, changed native T3 14/14, typecheck and static/test lint green (135 report-only findings,0 refusals), diff-check clean. Fresh fetch/merge dev was up to date before first review. C1 marked done. Source review then one mode-free verification pending; no Linux or integrated evidence claim.

### rev-26 · 2026-10-25T22:52:58.168Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1298-source-1
commit: 0b8a2e73f13da3964b39bf0b1b090784468b092c
scope: full
findings: [{"severity":"medium","text":"M1: EXECUTOR_USAGE adds watchdog recovery text without updating its owning frozen commands.json row. cli-usage-compatibility's exact export comparison and top-level cli-help byte comparison therefore fail. Update only that frozen row and retain original red/green guard receipts; do not change templates/order/assertions.","file":"hub/src/cli/usage.ts","line":13},{"severity":"medium","text":"M2: the new per-test guide is absent from docs/agents/tests/index.md. The shared tests.md link does not satisfy assertTestDocIndex, which requires every per-test document indexed exactly once. Add the owning row and retain existing test-docs guard red/green; keep the valid exact-path heading.","file":"docs/agents/tests/hub-test-executor-watchdog.test.ts.md","line":1},{"severity":"medium","text":"M3: the new legacy checkpoint is serialized only with #changeLease, while release's post-provider #save calls at lines 342/351/364 write an earlier lease snapshot outside that boundary. A held release can read the old shape, inspect can durably upgrade it, and release can then erase pidIdentity, reopening legacy adoption; overlapping writes can also restore stale lease state. Preserve the latest identity/state across those writers and add a held in-process release/inspect regression proving terminal state, retained native identity and no second adoption. Static path finding, not a reviewer runtime reproduction.","file":"hub/src/executor/droplet/droplet.ts","line":93}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source NOT CLEAR; consolidated A-12181 at tree a07c87b43d76645387728605c3f6622599f7bab9. Standards: M1 frozen EXECUTOR_USAGE mismatch, M2 missing per-test index entry. Spec: M3 checkpoint serialization excludes later release writes, so old lease snapshots can erase adopted pidIdentity or overwrite newer state. No further findings. Native proof/checkpoint/signal logic and additive consumer compatibility otherwise match the criterion; the new T1 controls and retained T3 lifecycle assertions use appropriate seams. C1 runtime remains unverified. A-12179 reports local Darwin T1 15/15 and T3 14/14, not configured/Linux evidence; retain original output/exits/source limits. Correct M1–M3, restore claimant done and request a new pushed-head source review before mode-free verification. Reviewer read-only; no tests/probes run.

Criteria: C1 failed (Concurrent release can overwrite the durable native identity, reopening the supposedly one-time legacy adoption; help/document guards also fail at this head.).

### impl-1298 · 2026-10-25T22:54:25.606Z

M3 reproduced at 0b8a2e73 plus test: held provider release→inspect durable upgrade→complete release yielded 'release must retain the persisted upgrade instead of adopting a second birth', 2!==1. Test initially incomplete due fixture auth/response setup (terminated once; then bounded setup timeout), corrected to injected provider token and complete empty list fields; actual assertion red is separate. Before source correction, expanded write audit: writeLease directly called by DropletExecutor.#save and DropletRun deliver/start/status (run.ts164/176/188/196); test fixture/script writers use same API. Raw watchdog loop writes watchdog.json only, not lease.json. Proposed common boundary: serialize writeLease and a new ownership-only legacy checkpoint by canonical lease directory; stale same-watchdog snapshots retain already persisted pidIdentity. Checkpoint reads/patches latest lease within that same queue, preserving terminal state. Existing function/JSON shapes and all callers retained; no schema or wire removal. All production writers thereby share the fence, including indirect run saves.

### impl-1298 · 2026-10-25T22:57:25.027Z

M1–M3 corrected and pushed at97935cba (source1 parent0b8a2e73). C1 done restored. A-12180 preserves M1/M2 guard red/green; A-12182 preserves M3 actual held-release red2!==1, overlapping-write no-fence mutation red undefined birth, common writer queue/ownership-only patch and fresh local receipts. New source request to Reviewer at97935cba; first request message had a typed wrong abbreviation, immediately corrected in-topic. No dev merge or configured verification yet.

### rev-26 · 2026-10-25T22:58:56.329Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1298-source-2
commit: 97935cba7449459fa480af59a213a6baea5506c7
scope: full
findings: [{"severity":"medium","text":"M4: both new held-writer tests register root removal but rely on lexical finally after unbounded providerEntered/entered receipt awaits (lines 226/277). node:test timeout does not interrupt those awaits. A missed receipt/cancellation can remove the root while release/checkpoint is pending; the rename mock may also leave named ESM bindings patched because restore+sync is only in unreachable finally. Register unconditional barrier release, tracked writer drain, executor close and mock restore/sync before acquisition, ordered before root removal, and give setup an abortable/bounded path. Preserve behavioral assertions and prove cleanup on a missed-receipt/setup-failure control.","file":"hub/test/executor-watchdog.test.ts","line":196}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source2 NOT CLEAR; A-12183 at tree 2c352a5fd14625a3fb5490b96bfc1fa1ae172317. M1 frozen help and M2 guide index resolved; M3 shared lease queue/ownership-only patch resolves stale upgrade/terminal-state writes. Both new regressions cover the required ordering, but M4 remains: unbounded setup receipt waits rely on lexical finally despite node:test timeout, with only root removal registered in after cleanup. Own barrier release, tracked writer drain, executor close and rename restore/sync before acquisition/root removal; bound or abort setup and retain assertions. Standards 1 medium, Spec no remaining production findings. No further findings. A-12180/A-12182 local original red/green/mutation evidence is supplementary, not configured Linux proof. C1 unverified; correct, restore done and request fresh pushed-head source review before mode-free verify. No reviewer execution.

Criteria: C1 failed (Added held-writer regressions can remove owned roots and leave the rename binding patched on setup cancellation; M4 cleanup/setup ownership remains.).

### impl-1298 · 2026-10-25T23:02:41.576Z

Pushed c8842232, M4-only fixture/docs/skill correction on production97935cba (M1–M3 resolved by source2). A-12184 records unconditional pre-start disposal and independent fake-time/test-signal setup, full ownership writer drainage beyond inspect's bounded reply, four missing-receipt/aborted controls and restoration mutation redfalse!==true→green. Local changed T1 21/21, typecheck/lintgreen135report-only/0refusals; native T3 receipt14/14 from unchanged production, not rerun. C1done restored; fresh source request sent. No devmerge/configured verification yet.

### rev-26 · 2026-10-25T23:03:21.858Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1298-source-3
commit: c8842232bd20d55d44f90036d0f0470dadeed55e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 CLEAR; A-12185 at tree fc94d4f643223f6dfae42540c2d8f6d695f77fb0, carrying full source1/source2 audit. Standards 0, Spec 0. M4 resolved by pre-start idempotent disposal, separate abortable fake-time setup bounds and tracking underlying checkpoint as well as inspect; four failure controls check writer settlement, ESM restoration and root absence. Original behavioral assertions retained. Production identical to 97935cba; M1–M3 remain resolved. C1 claimant done restored; runtime verification remains pending. A-12184 local Darwin 21/21/restoration mutation and prior native T3 14/14 are supplementary, not configured/Linux evidence. One ordinary mode-free verification may proceed at unchanged c8842232, then final evidence review. No full run or extra repetitions requested; reviewer performed no execution.

### rev-26 · 2026-10-25T23:17:45.096Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1298-evidence-1
commit: c8842232bd20d55d44f90036d0f0470dadeed55e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR; A-12192 carries source3/A-12185 plus actual configured d6734e00/A-12190 exit 0. Deduplicated ordinary records: 3320 pass, 1 known macOS-only skip, no fail/cancel/todo; 447 file passes. Separate load-gate: all 21 new watchdog identities have 5/5 actual passes (105), max 0.068949186 s. C1 precise replacement refusal, one-time durable adoption, proof/persistence refusals, TERM/KILL controls and M3/M4 concurrency/cleanup cases all pass. Native changed T3 once: 13 passes, unchanged macOS inhibitor skip; actual birth/rearm and held release/exit assertions pass. Selected added wall 13.342 s excludes machine wait, not file/body or lifetime; no other T3/T4 or native repetitions claimed. T0/all T1/fallback all T2/Web green on Linux c-8 lon1, Node24.21.0/Neovim0.12.5, Headless Shell156.0.8078.4/v1248, workers2, lifetime736s/$0.0511. Host prepared-tree gate not repeated remotely; lint/budget/ratchet warnings remain report-only. Standards/Spec no findings; C1 verified. Coordinator owns enqueue/landing and after-stage QA; no reviewer execution.

Criteria: C1 verified.
