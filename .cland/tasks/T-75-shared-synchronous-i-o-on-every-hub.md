---
id: T-75
kind: task
title: "Shared synchronous I/O on every hub request: the permission check reads
  roles.toml and the journal writes with writeSync"
state: closed
status: done
labels:
  - ready-for-agent
  - hub
assignee: null
parent: E-19
blocked_by: []
topic: topic-32
branch: t/T-75-shared-synchronous-i-o-on-every-hub
created: 2026-10-09T15:35:43.178Z
updated: 2026-10-10T00:58:17.844Z
closed: 2026-10-09T18:05:23.225Z
---

## Parent

Part of T-19. Found on 2026-10-09 at 15:31Z and 15:35Z by impl-61 (T-61) and impl-60 (T-60) during their await audits, the request-path rule from the T-73 retrospective (A-96, class A). Both items left the shared code alone by the Coordinator's decision, so that two parallel items do not convert the same module.

## What happened

Two shared paths run on every hub request and do synchronous file I/O:
- The permission gate calls `RolesFile.get()`, which stats `.cland/roles.toml` and may read it with `statSync`/`readFileSync`.
- Daemon logging writes journal records with `writeSync`.

A slow disk or a large file stalls the event loop for every connected session, the class of stall T-67 removed for git and T-70 removed for `ps`.

## What to build

- Roles: keep the parsed roles file in memory and refresh it asynchronously (a watcher or an async stat on a timer), so a permission check reads memory only. A changed file is visible to the next check within a bounded delay; say how long in hub/README.md.
- Journal: decide, and write down in hub/README.md, whether the journal stays synchronous for durability. If it stays, measure its cost under the request timer and justify it. Otherwise, use an ordered async append queue that keeps write order and flushes on hub stop.
- An architecture test that fails when `statSync`, `readFileSync` or `writeSync` is reachable from the permission gate.

## Acceptance criteria

- [ ] A permission check performs no synchronous file system call, which a test proves.
- [ ] An edit to roles.toml takes effect within the documented delay, which a test proves.
- [ ] The journal decision is documented, and its cost under the request timer is tested.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Start after T-60 and T-61 merge: both touch the request paths next to it.

## Comments

### impl-75 · 2026-10-09T16:50:40.404Z

Confirmed seams with Coordinator: roles snapshot/permission dispatch, journal write/close through request timing, and T-70 native-boundary architecture guard. Choosing an ordered async journal with clean-stop drain; documenting crash-loss window and failure behavior. Roles will refresh asynchronously and keep the last parsed snapshot during checks.

### impl-75 · 2026-10-09T17:00:34.044Z

Committed a8bdb43dd3763937928daf50902071e64257e5f5. Targeted coverage passes: roles snapshots (4), async journal (5), shared native-boundary/session paths (4), roles integration (5), permissions integration (5), Agents journal integration (8). npm run typecheck and git diff --check pass. Evidence artifact A-125: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-125-t-75-implementation-and-verification.md. Final npm test queued on the machine-wide lock; parallel Standards/Spec skill reviews running.

### rev-6 · 2026-10-09T17:08:44.992Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-75-1
commit: a8bdb43dd3763937928daf50902071e64257e5f5

High: none.

medium (Standards) — hub/src/hub/journal.ts:166, with hub/src/cli/hub.ts:110/233: request audit logging still calls process.stderr.write while hub start redirects stderr to the regular hub.log file. Installed Node25.6.1 uses SyncWriteStream/writeSync for that sink, so synchronous filesystem I/O remains on every request. The guard's no-op/in-memory logger misses it. Invariant: every production request logging sink is async; include the production-equivalent process log in coverage.

medium (Spec) — hub/src/hub/journal.ts:159, with hub/src/hub/agents-topic.ts:137/158: queued append can leave the Agents checkpoint ahead of completed journal records. After crash or append failure, replay misses that checkpoint; if older notices were pruned it starts at zero and resurrects them, contradicting README371. Invariant: a lost unflushed checkpoint event must never cause replay of retention-pruned records. Coordinate durable queue progress and checkpoint/recovery state.

medium (Standards/Spec) — hub/src/hub/journal.ts:141/161: deferred append/error continuations have no resumed timing scope. A400ms synchronous journal-failed logger after rejected async append produces guard slow0. The new timing test covers only enqueueing and pending disk wait. Invariant: request-related synchronous journal continuations remain timed as one whole scope, excluding I/O wait.

Low: none additional. Roles snapshots, malformed/missing last-good retention and replay invalidation are sound. Ordered append/short writes, failure halt and clean-close drain otherwise match the documented decision.

Read-only probes: actual Journal/Agents/replay reproduce resurrection of old-pruned with a checkpoint whose append is held; fake-clock timing reproduces uncounted400ms failure reporting; in-memory HubBase/Dispatcher native guard passes allowed/refused/human paths and detects an in-memory planted statSync; installed Node source confirms file-backed stdio calls writeSync. No actual files or temporary files written. Exact head and clean status verified; diff check and TypeScript noEmit pass. No suite run, as requested.

Separate axes, invariant/sibling sweep and executable evidence: A-129, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-129-t-75-review-rev-6-75-1-at-a8bdb43.md.

### impl-75 · 2026-10-09T17:19:19.325Z

Fix round committed and pushed: 9e4792a08c558e12fff7256c6de490578bdeb673 (copied from git log -1). All three rev-6-75-1 mediums addressed: async production file log with real file-backed-stderr regression, recovery skips durable prefix when checkpoint append lost, and shared captured request timing for journal/roles continuations. Targeted tests: journal 7, snapshots 5, native/production/session 5, Agents integration 8, checkpoint crash 1 pass; typecheck/diff check pass. Old-head suite was interrupted and released its lock; fixed-head suite is next. Fix evidence artifact in topic-32.

### impl-75 · 2026-10-09T17:22:20.018Z

Skill review caught a two-restart checkpoint edge; fixed in 39f61f7d3d5f95a88a2bad6e0cd7634b28e5368d (from git log -1), pushed to origin. Recovery advances the durable prefix boundary after a missing checkpoint, so subsequent completed notices recover once while old pruned notices remain suppressed. Two new regressions were red then green; checkpoint tests 3 and Agents integration 8 pass; typecheck/diff check pass. Prior queued suite interrupted without touching T-74's holder; this head will be the final suite.

### rev-6 · 2026-10-09T17:25:33.342Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-75-2
commit: 39f61f7d3d5f95a88a2bad6e0cd7634b28e5368d

High: none.

medium (Standards/Spec) — hub/src/roles/config.ts:210/221: parsing/publication runs in one resumed scope, then a synchronous parse/logging throw immediately enters another scope for error handling, with no await between them. One continuation can exceed250ms while both measurements stay below it. Read-only probe of actual RolesFile with150ms malformed parsing and150ms error logging confirms300ms total, guard slow0 and last-good snapshot preserved. Invariant: one whole post-await continuation, including its synchronous catch handling, has one timing scope. Catch parse/publication errors within the same resumed callback; a native read rejection can use its separate failure continuation.

Low: none additional. All three rev-6-75-1 findings are closed: normal production logging now uses the async process queue; held checkpoint append preserves pruning and persisted old/empty boundaries recover later durable notices exactly once; the400ms journal failure logger now produces exactly one originating request/resumed slow event. Native guard still detects an in-memory planted statSync.

Sibling sweep covered dispatcher/transport/audit/adapter log closures, production CLI and daemon stop queues, journal append/short write/open/repair/error/close, roles publication/failure and repeated checkpoint recovery. File-backed stderr remains only the documented fatal/startup fallback; stdio transport uses its parent pipe. Journal close catch/finalize also use adjacent scopes, but finalize only clears/rethrows and is not an additional material finding.

Exact head and clean status verified; TypeScript noEmit and diff check pass. A-129 probes rerun with the new guard/Store.setMeta wiring; all previous defects pass. No actual files written or suite run; Coordinator reports targeted passes and fixed-head suite running.

Both axes and executable evidence: A-135, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-135-t-75-resolution-review-rev-6-75-2-at-39f61f7.md.

### impl-75 · 2026-10-09T17:30:33.694Z

rev-6-75-2 timing fix committed/pushed at 61183e06474d371bf9de51922417000f05523a27, copied from git log -1. Parse plus immediate reporting now share one scope; sibling Journal.close initiation/report and rejection/finalization scopes unified. 150+150 roles regression red0=>green1 (300ms); close sibling mutation also red0=>green1. Roles timing1/snapshots5 + journal8, typecheck/diff check pass. Fixed-head full suite next under the Coordinator’s latest instruction.

### rev-6 · 2026-10-09T17:32:28.068Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-75-3
commit: 61183e06474d371bf9de51922417000f05523a27

High, medium, low: none remaining in the requested delta. Standards clear; Spec clear.

Roles parse/publication errors and their immediate logging now run within one resumed callback, closing rev-6-75-2. The unchanged read-only probe measures150ms parse plus150ms failure logging as exactly one300ms roles.refresh/hub/resumed slow-request; last-good snapshot stays intact. Journal.close also combines native initiation errors and reporting in one scope, while asynchronous rejection is handled in its later continuation.

Read-only actual Journal/RequestGuard close matrix verifies synchronous close initiation+report aggregate300ms/one counter/one report; asynchronous close rejection, earlier append failure and clean close preserve failure/drain behavior without duplicate reports. No actual files written. Diff check and TypeScript noEmit pass; exact head and clean status confirmed. No suite run as requested; Coordinator reports fixed-head full suite running, whose result is separate.

Previous async production logging and durable checkpoint fixes remain unchanged and verified by A-135. Separate axes and runnable timing evidence: A-138, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-138-t-75-final-timing-review-rev-6-75-3-at-61183e0.md.

### impl-75 · 2026-10-09T17:51:19.586Z

Followup from final-suite failures: explicit fresh role reads preserve immediate launch/relaunch/human assignment edits; authorization is rechecked after that await. Journal synchronous native initiation failures and their reports share one timing scope; fresh failures retry and count once. Startup/listener stderr behavior is restored. Audit test observations drain both queues through bounded hub.status flushLogs; reservation crash recovery uses persisted store reservations, not diagnostic logs (core.ts reserveLaunchRole/releaseInterruptedLaunches); always-polling roles replace the former watch-fallback warning. Exact61183e0 Codex comparison failed profile3/3; base0401b3f passed3/3. Final targeted checks and skill review are underway before commit/full suite.

### rev-6 · 2026-10-09T18:01:13.963Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-75-4
commit: 7fc47c3d427638162d205d315446425b17dbec48

Standards: clear. Spec: clear. No high or medium findings in 61183e0..7fc47c3. Fresh roles ordering/retry, all five journal initiation/report timing boundaries, and the bounded drain barrier (including same-ID repetition) passed read-only probes. Changed expectations agree with A-142/A-143; typecheck and diff check passed. No full suite run, as requested.

Out of scope follow-up — hub/src/hub/sessions.ts:269: pre-existing statSync(cwd) remains on launch; the Coordinator explicitly assigned it to T-77, outside T-75's shared roles/journal/logging scope.

Evidence and standalone probes: A-148, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-148-t-75-resolution-review-rev-6-75-4-at-7fc47c3.md

### impl-75 · 2026-10-09T18:05:16.904Z

Completed implementation at 7fc47c3d427638162d205d315446425b17dbec48 (git log -1), pushed to origin. npm test exit0: Hub530/530 and Neovim94/94, zero failures/skips/cancellations; duration578.33s, lock wait20.19s. Hub-start, unchanged Codex immediate profile, unchanged stdio listener and all5 native/session-process tests pass. Typecheck and diff check pass; worktree clean. Final suite evidence A-149: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-149-t-75-final-npm-test-624-passing-tests-at-7fc47c3.log. Changed-test justifications and source references A-142: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-142-t-75-final-followup-regression-comparisons-and-changed-expectations.md; exact-head Codex comparison logs A-143. Implementation covers memory-only permission snapshots, rare fresh launch/relaunch/human assignment with post-await authorization, ordered async journal/process logging, whole continuation timing, pruning-safe checkpoint recovery and bounded log drain. Tracker mutations remain scoped to T-77. No merge performed.

### coord · 2026-10-09T18:05:23.224Z

Merged e2425ccbc0534c14ffb7ecc9f7075f220836da04 onto dev.

### coord · 2026-10-09T18:05:35.169Z

Merged by the Coordinator through `cland merge T-75`: squash e2425cc on dev. Gate: review rev-6-75-4 clear on 7fc47c3. Earlier rounds: rev-6-75-1 had three mediums (a file-backed stderr sink, the checkpoint running ahead of the journal, untimed continuations), rev-6-75-2 had one medium (split parse scopes), and rev-6-75-3 was clear on 61183e0. After that, the suite and impl-75's own sweep found five split timing starts, the launch profile regression, which a fresh() read now fixes, and listener diagnostics, which are back on stderr. Every changed test expectation is justified in A-142. Full suite on 7fc47c3: 530 hub + 94 Neovim passed (A-149). Out of scope and in T-77: the tracker's item writes, and the launch statSync at hub/src/hub/sessions.ts:269. impl-75 stopped. Live after the next hub restart.

### coord · 2026-10-09T18:22:38.035Z

Location correction, recorded by the Coordinator for rev-6 (the hub refuses non-verdict comments from a Reviewer). rev-6-75-4 and A-148 cite hub/src/hub/sessions.ts:269 for the pre-existing launch statSync. The verified location at 7fc47c3 is hub/src/adapters/sessions.ts:274. The verdict, clear, and its scope are unchanged. The follow-up is T-77, corrected there too.
