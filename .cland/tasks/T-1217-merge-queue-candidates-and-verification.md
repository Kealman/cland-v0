---
id: T-1217
kind: task
title: Merge-queue candidates and verification snapshots accumulate unreachable Git objects until auto-gc gives up
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1041
branch: t/T-1217-merge-queue-candidates-and-verification
created: 2026-10-24T09:05:03.711Z
updated: 2026-10-25T13:49:33.009Z
---

## Summary

On 2026-10-24 every Git command in the root and in task worktrees started printing "The last gc run reported … run 'git prune'" and "There are too many unreachable loose objects". The repository holds 10,546 loose objects (about 150 MB). The merge queue builds each batch candidate with `git commit-tree` and verification bundles snapshot trees, which leaves unreachable commits behind; the Coordinator's preflight checks add a few more. Auto-gc then refuses to run until .git/gc.log is removed. Nothing fails, but the warning reaches every session's output and the loose objects keep growing.

## Acceptance criteria

- [x] C1. cland's own Git maintenance (for example after a landing, or on hub start when idle) prunes unreachable objects older than a safe age that no live batch, verification or lease can still reference, without touching objects a running batch uses (test with a scratch repository).
  - done: impl-1217 · 2026-10-25T13:01:34.599Z
  - verified: rev-31 [reviewer] · run rev-20261025-1217-final · 2026-10-25T13:24:21.608Z · commit 63018b8e4aafefb44f3a2969524374680a21bb29
  - verified: rev-31 [reviewer] · run rev-20261025-1217-final2 · 2026-10-25T13:48:54.643Z · commit 7280202096714186413f19bb49021c67314937a0
- [x] C2. A stale gc.log no longer blocks auto-gc indefinitely; the hub reports the condition once in doctor output instead of in every Git command (test).
  - done: impl-1217 · 2026-10-25T13:01:34.699Z
  - verified: rev-31 [reviewer] · run rev-20261025-1217-final · 2026-10-25T13:24:21.608Z · commit 63018b8e4aafefb44f3a2969524374680a21bb29
  - verified: rev-31 [reviewer] · run rev-20261025-1217-final2 · 2026-10-25T13:48:54.643Z · commit 7280202096714186413f19bb49021c67314937a0

## Comments

### impl-1217 · 2026-10-25T10:56:52.948Z

Plan/seams (from the supplied scratch-repository test requirement): native Git maintenance boundary (T3, real gc/prune and scratch object existence), pure persisted-activity policy (T1), doctor project check (T2). Startup maintenance runs before dispatcher/listeners/adapters, under the territory lock. Idle startup prunes only objects older than 14 days; any persisted batch, suite, or unreleased executor lease disables pruning entirely for that pass. cland disables repository auto-GC in favor of foreground startup maintenance so gc.log failures become one doctor row rather than repeated Git warnings. No wire/schema shape changes. Consumer inventory follows before changing that repository policy.

### impl-1217 · 2026-10-25T10:57:40.507Z

Rule 20 inventory: new repository-local maintenance policy (no reply/schema/refusal changes). Git producers/readers found across hub/src: territory.ts, territory-{publish,push,release}.ts; hub/{daemon,configuration,demos,dev-t3-probe,dispatch,merge-batch-territory,merge-queue,merge,releases,server,shared-defects,suite-candidate,suite-worker}.ts; executor/droplet/{prepare,run}.ts; git-tree-sources.ts, verification-tree.ts, homebrew.ts, release-web.ts; init/repository.ts, setup/project-kind.ts; tracker/{epic-surfaces,offline-migrate,tracker,verdict-git}.ts; suite-{duration-context,selection,shards}.ts, test-lint-policy.ts; cli/{doctor,init,qa-lint,qa,task-import}.ts. Their Git call shapes stay unchanged; repository-local gc.auto=0 and maintenance.auto=false suppress implicit collection, explicit cland startup GC replaces it only in the project and its local territory (not upstream/tap/executor repositories). Persisted-record consumers: suite-jobs (any retained row), merge-batch (any retained record), actual executor lease directories (anything not released, including expired/uncertain leases). New reader fails closed to no pruning on malformed state. Search also covered all hub/test, nvim/test, web/test and test-support tiers, .agents/skills and qa/briefs: existing consumers require no migration because Git outputs and wire fields are unchanged; update help, territory/doctor docs and merge/implement guidance to describe maintenance. Native scratch regression exercises Git without the new flags too, preserving compatibility of ordinary commands.

### impl-1217 · 2026-10-25T11:07:04.393Z

Implemented at c3042ac7fb6f69509814d9fa0639bacc9a61957b (source 9cb11f26 plus freshly fetched origin/dev merge). A-11777 holds design/TDD evidence. Final local native scratch file: 5/5 tests passed on macOS, 2.50 s file wall (individual cases 0.20–0.82 s); no browser. Each test exercises native Git, so the cases remain T3 rather than adding separate fake-policy T1/doctor T2 cases. T2 projectHub replaces maintenance with an in-process probe, preserving tier boundaries. Typecheck passed pre-merge and is rerunning on this head. Linux timing, full mode-free verification and independent review remain pending. Both criteria done; per-item QA scope is none. Consumer inventory also covers executor-leases metadata; any unreleased mirror row conservatively prevents expiry.

### rev-31 · 2026-10-25T11:11:26.170Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1217-source1
commit: c3042ac7fb6f69509814d9fa0639bacc9a61957b
scope: full
findings: [{"severity":"high","text":"H1: silent detached startup GC can run30s per repository while ordinary hub start SIGKILLs its owner after15s without log growth, potentially leaving GC children beyond lock ownership. Integrate bounded startup progress/deadline and owned collector drainage, with a held/slow collector supervisor regression.","file":"hub/src/git-maintenance.ts","line":71},{"severity":"medium","text":"M1: HUB_USAGE and DOCTOR_USAGE changed without their frozen commands.json blocks; existing compatibility/real-help byte guards disagree. Update only intended frozen blocks, retaining guards/composition/template.","file":"hub/src/cli/usage.ts","line":23},{"severity":"medium","text":"M2: new guide must start '# hub/test/git-maintenance.test.ts', not a prose heading, for the retained test-docs guard.","file":"docs/agents/tests/hub-test-git-maintenance.test.ts.md","line":1}]
finding_counts: {"high":1,"medium":2,"low":0}

# T-1217 full source review — NOT CLEAR

Headc3042ac7fb6f69509814d9fa0639bacc9a61957b/tree4a7a6929e222919f726af82a3814bc45f7555b02. Full dev...head merge-base diff reviewed, including pre-review dev merge. Standards/Spec reviewed personally; no subagents. Read-only source/artifact inspection only: no GC/prune/config writes, tests, browser, fetch, process signals or Git mutations.

## Standards

M1 (medium), hub/src/cli/usage.ts:23: changed HUB_USAGE and DOCTOR_USAGE blocks are absent from hub/test/fixtures/cli-usage/commands.json. Decoded source-versus-frozen comparisons are false for both. Existing cli-usage-compatibility deep-equality and real root/hub help byte guards therefore disagree deterministically. Migrate only these two intended frozen command blocks; preserve guards, export composition and root help template (rule16). No Reviewer execution claimed.

M2 (medium), docs/agents/tests/hub-test-git-maintenance.test.ts.md:1: prose heading `# Git maintenance native contract` must be exact `# hub/test/git-maintenance.test.ts` for the retained test-docs guard and rule16. Preserve guidance/index and existing guard.

Other Standards checks: native Git scratch contracts are correctly T3; T2 projectHub replaces the new native boundary; environments are sealed and new tier entry sorted. Implement skill/CHANGES, doctor/README policy documentation and rule20 consumer inventory are present. Doctor remains a read-only metadata/log reader, including --fix.

## Spec

H1 (high), hub/src/git-maintenance.ts:71 and startup wiring hub/src/hub/daemon.ts:245: the new foreground startup phase permits a silent detached native GC for30s per repository, twice in succession. Existing cli/hub.ts:124–167 instead enforces15s without startup-log growth and SIGKILLs the hub at expiry. Maintenance emits only the initial startup-step; doctor/report.run buffers native stdout/stderr and emits no ongoing startup progress. A healthy GC taking15–30s can therefore make ordinary `cland hub start` kill its hub before the collector deadline. Because run() starts the GC in a separate process group and its termination timer belongs to the killed hub, that can leave GC/repack running after the hub/territory-lock owner is gone. This violates the startup-success/failure claim and safe owned collector lifetime. Coordinate maintenance's bounded progress/deadline/cleanup with the existing startup supervisor; add a held/slow collector startup regression proving the caller does not kill its maintenance owner and every captured GC child is settled before lock release/failure. Do not merely turn buffered output or an elapsed timer into completion proof, waive object protection, or raise unrelated behavior bounds.

Aside from H1, retained batch/suite/lease and malformed-state handling selects prune=never; idle expiry14days, reflog/worktree metadata retention, per-repository failure reports, implicit-GC suppression and stale-log recovery match the intended design. No actual live-maintenance action was performed during review.

Correction to preliminary concern: linked-worktree CLI startup canonicalizes through shared/project-discovery.projectRoot before the only production serveProject call. Thus the initially suspected linked-root activity/lock mismatch is NOT in the consolidated blocking set; do not add machinery for it based solely on that preliminary message.

## Evidence and disposition

A-11777 is a summary of local macOS/Node24 native scratch TDD: original idle objects retained, active-batch objects wrongly pruned, repeated stale-log warning, and missing startup receipt controls followed by five passing cases (reported file2.50s, cases0.20–0.82s), typecheck. It is not complete original native stdout/exit/timing capture or configured/Linux/load evidence. Preserve available original tool records with actual source/platform attribution and explicit capture limits; no reruns for transcription. Existing tests exercise fast direct maintenance/projectHub startup, not the CLI15s supervisor versus slow collector window in H1.

Full source NOT CLEAR. Findings: one high Spec finding H1, two medium Standards findings M1/M2. C1 failed for H1; C2 failed for matching help/guide guard obligations M1/M2. Correct consolidated set without a post-review dev merge, restore done marks after implementation, and request fresh pushed-head source review before any mode-free verify. QA none/after-stage. No live repository maintenance or manual workaround is authorized/requested by this review.
Durable review: A-11783.

Criteria: C1 failed (H1: maintenance's silent30s detached collector conflicts with15s startup supervisor, risking hub kill and orphaned collector ownership.), C2 failed (M1/M2: matching changed help and per-test documentation disagree with retained frozen-byte/exact-heading guards.).

### impl-1217 · 2026-10-25T11:23:45.434Z

Coordinator changed the constraint before re-review: maintenance must be delayed until after serving. Git's documented prune grace protects fresh objects and descendants during concurrent writers, and gc.cruftPacks applies that grace to packed unreachable objects; use explicit --cruft with the same 14-day cutoff, retain --prune=never for existing batch/suite/lease/uncertain records, and test fresh/reused admission snapshot objects natively instead of adding an admission fence. Schedule 30 s after serving and cancel/drain native GC on hub stop.

Additional shared-runner consumer inventory before adding optional cancellation: hub/src/doctor/report.ts run is imported by doctor/{toolchain,harnesses,project,keys,web,opencode-smoke,opencode-contract}.ts and CLI/setup/harness probes; search every production/test import and call before edit. Add only optional trailing AbortSignal (old five-argument calls retain prior behavior/results); no wire/schema/reply changes. The maintenance wrapper forwards it; existing doctor callers remain unaffected. T2 runner tests retain legacy calls and add cancellation coverage. The pre-serve heartbeat implementation and its source-review tests are superseded by serving-first background scheduling and shutdown ownership tests; prior macOS timing summaries remain historical, not current-head evidence.

### impl-1217 · 2026-10-25T11:31:35.892Z

Final additional rule-20 consumer inventory for optional trailing AbortSignal in doctor/report.run: production imports/callers are cli/doctor.ts; doctor/{git,harnesses,keys,project,toolchain,web}.ts; fixture-processes.ts; git-maintenance.ts; hub/lock.ts; orphans.ts; process-paths.ts; setup/{account-identity,handover,machine}.ts; suite-lock.ts; system-processes.ts. Tests/fixtures are doctor-{cli,fixture,harness-probe,run}, git-maintenance, opencode-database, duration-reporter and skip-reporter. Broader docs/skill/QA/startup searches found no existing sixth-argument consumers or wire dependencies. Existing five-argument calls and RunResult shape remain unchanged, with their exact legacy T2 assertions retained. Only maintenance opts into cancellation and forwards the signal. Controller timing lives in serveProject (every production entry and the projectHub fixture); default fake projectHub maintenance remains process-free.

Coordinator-approved design now implemented: one pass 30 s after serving, native gc --cruft with a 14-day grace (never for retained/uncertain work), no new admission fence. Native scratch tests confirm young loose and cruft-packed objects survive despite inherited gc.pruneExpire=now/gc.cruftPacks=false; actual committedTreeOrThrow freshens an old reused unreferenced snapshot. Cancellation reaps both captured PIDs before lock release, then a real next pass recovers same-host dead gc.pid while fresh owned/foreign temporary pack bytes remain unchanged. Source-review M1/M2 are corrected. Prior pre-serve heartbeat and five-second timeout timings are superseded; cancellation test now has no fixed wait. Latest local macOS native file: 8/8, file wall 5.36 s, cases 0.20–1.37 s; T2 serving-first 2/2, runner compatibility/cancellation 4/4; typecheck passed. Linux evidence remains pending.

### rev-31 · 2026-10-25T11:39:56.695Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1217-source2
commit: 5571f66c6d58981a11cf07f6b51a602395f7df59
scope: full
findings: [{"severity":"high","text":"H1: the shared runner's bounded cleanup-incomplete result is swallowed as an ordinary repository error; maintenance settles and releases territory ownership despite no child close, and daemon shutdown treats it as drained. Cover withheld-close/incomplete cleanup and retain unresolved collector ownership without changing legacy doctor behavior.","file":"hub/src/git-maintenance.ts","line":68},{"severity":"medium","text":"M3: fixture Git uses direct-child-only execFile timeout without captured group/tree cleanup; new native gc/repack can leave a descendant writer beyond failure/root cleanup. Register owned cleanup before launch, drain before root removal, and prove with a held descendant receipt.","file":"hub/test/git-maintenance.test.ts","line":80}]
finding_counts: {"high":1,"medium":1,"low":0}

# T-1217 revised full source review — NOT CLEAR

Head 5571f66c6d58981a11cf07f6b51a602395f7df59 / tree 0cd255587f30d7d5b2838b6750d9b12f9e536b40, unchanged pushed task tip. Full comparison against merge-base c966b08692a6b2e00d5bf03f45af7fd463ea2fee, plus complete correction from A-11783 / c3042ac7. Personally reviewed both axes under the Reviewer role, without delegation or execution.

Coordinator decisions 85c153ea, 9514cf5f and 04bfcc99 authorize serving first, one pass thirty seconds later under the existing territory lock, explicit cruft/14-day grace, conservative never for retained/uncertain work, optional runner cancellation and next-pass native stale-lock recovery. These supersede foreground/startup-heartbeat designs. No live GC, prune, repack, config writes, fetch, process signals, tests or Git mutation were performed by Reviewer.

## Standards

Prior M1 and M2 resolved: decoded HUB_USAGE/DOCTOR_USAGE equal the corresponding frozen commands.json blocks, with guards/export composition retained. All three test guides have exact test-path headings and index rows. Native scratch Git is T3; serving-first and mocked runner controls are T2. Implement skill and CHANGES, policy/help/doctor docs, tier entries and expanded shared-runner consumer inventory are present. Existing five-argument runner calls and RunResult fields remain compatible.

M3 — medium, hub/test/git-maintenance.test.ts:80: repository() launches fixture Git through execFile with only a direct-child 10-second timeout, no owned process group/tree registration or descendant drain. The new cruft control invokes gc through this helper, which can launch repack/pack-objects writers. A timed-out parent does not establish descendant death; after a callback rejection (or test failure) tempProject cleanup has no captured identities from this helper and can remove the scratch root while a child still writes. This is separate from the explicitly owned held-collector cancellation test. Use an owned group/tree boundary for fixture Git, registering cleanup before launch and observing writers/pipes settle before rejection/root removal. Prove the failure path with a held native-command descendant and exact readiness receipt; no live repository operation or weakened bounds/assertions.

## Spec

Foreground startup H1 trigger is resolved in the normal path: no maintenance command before serving, one fake-clock thirty-second timer, no repeated cadence, stop cancels delay or aborts active work. T2 holds a collector while actual hub.status replies before/during work and checks lock/storage ordering. Native tests cover retained/malformed records, loose/cruft fresh/aged controls, actual reused snapshot writer, positive stale gc.log warning and recovered single doctor row, common repository/territory and next native pass after a dead same-host gc.pid. Temporary pack bytes remain intact. The approved grace policy is retained; no admission fence or dropped linked-root concern is reopened.

H1 — high, hub/src/git-maintenance.ts:68–85 and hub/src/hub/daemon.ts:350–367: the incomplete-cleanup branch still releases collector ownership without a native close. doctor/report.ts:100–103 deliberately resolves run() after one second with "cleanup incomplete: child did not close…" (the legacy doctor-run test explicitly retains this result and permits late close). Maintenance converts that result into an ordinary per-repository error, persists the report and returns through withTerritoryLockAsync, which releases the territory lock on settlement. On deadline expiry without an aborted signal it can also continue to the second repository. The daemon's maintenance promise treats returned errors as completion, and stop proceeds to store and hub-lock teardown. Thus waiting for the maintenance promise is not equivalent to the native-close receipt promised by the design/docs; a collector can remain unresolved beyond released ownership.

Add a held runner/close regression exercising this exact existing incomplete-cleanup result, not only successful SIGKILL/close: establish that unresolved collector ownership cannot be released or announced as completed, and shutdown cannot treat it as drained. Preserve legacy five-argument doctor bounded results and the normal serving-first behavior. Do not substitute signalling, destroyed pipes, a report file or elapsed cleanup deadline for actual close. If the bounded hub-stop policy requires an explicit exceptional recovery ownership design, resolve that with the Coordinator rather than silently waiving drain.

## Original evidence and disposition

A-11822 contains original available local macOS Node 24 output excerpts with explicit capture limits, not raw exported stdout/stderr or configured/Linux proof. Final native T3 8/8, duration_ms 4191.960084 (max case 931.184542ms); serving-first T2 2/2, duration_ms 534.989625; runner T2 4/4, duration_ms 108.148875; typecheck exit 0. Pre-serve heartbeat experiments and interrupted cancellation red run are historical, not current passes. The successful cancellation cases observe close; they do not cover H1's returned incomplete-close result or M3's direct-child fixture timeout. Preserve original available receipts and missing-source/capture limits without transcription reruns.

Full NOT CLEAR. Standards 1 medium (M3); Spec 1 high (H1). C1 fails ownership/drain protection; C2 matching help/guide source corrections are accepted but its runtime verification remains pending. This is the consolidated finding set at this head; prior M1/M2 and the preliminary linked-root concern are not active blockers. Correct, commit/push, restore claimant done and request fresh full source review before any configured verify. No post-review dev merge, unchanged-head retry, live maintenance, full/forced-mode run or extra load requested. QA none/after-stage; Coordinator retains its separate pre-merge verify all requirement after ready.
Durable review: A-11829.

Criteria: C1 failed (H1/M3: incomplete native-close results and the fixture Git timeout can release ownership or remove roots while collector descendants remain unresolved.).

### impl-1217 · 2026-10-25T12:07:38.168Z

Coordinator decision 2776473b authorizes durable recovery, never an unbounded stop. Expanded shared-admission consumer inventory: territory lock wrappers are used by territory.ts (provision/undo/worktrees), hub/{dispatch,merge,releases}, tracker/offline-migrate, and their injected lock seams. Search covers all T1–T4 tests, nvim/web clients, shipped skills, QA, startup and persisted readers: relevant tests are territory-lock, push, release-item, task-migrate, tracker-native-boundary and harness; QA T-117 describes the existing lock. No wire field or role permission changes. The wrappers retain prior signatures; an absent recovery receipt performs no native recovery work and keeps existing behavior. New versioned-by-shape owner receipt is private runtime state; no previous reader exists. Doctor adds read-only owner visibility. Existing legacy run results/five-argument callers remain unchanged; maintenance now uses a separate gated owned runner that can hand off incomplete close durably. A private POSIX Node execve gate preserves the PID and birth identity while ensuring no Git work starts before the receipt is durable.

T-543's precise identity helper is not part of this reviewed ancestry. Per Coordinator instruction use the current UTC processStarted/parseStarted identity helpers and record this dependency; recheck its landing before ready and incorporate only a Coordinator-posted shared fix/instruction. The recovery policy tests include dead/alive/mismatched/unverified/signal-surviving states; no identity mismatch authorizes a signal. The scratch helper now uses the same exec gate before its shared test ownership capture; a held descendant regression first failed with `writer ... is gone before the command rejects: true !== false`, then passed with owned group drainage. Infrastructure failures are not interpreted as missing Git objects.

### rev-31 · 2026-10-25T12:47:48.663Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1217-source3
commit: 2be5d71b993541ef055f210faf5a3079b9fa4280
scope: full
findings: [{"severity":"high","text":"H2: incomplete durable handoff resolves without releasing/unrefing referenced child/stdout/stderr handles. Normal hub.stop then releases its lock and only sets CLI exitCode; native handles can keep it alive, and the external stop command refuses to signal after lock release. Bound normal-stop exit while preserving durable ownership; prove with still-referenced native observation handles.","file":"hub/src/git-maintenance-owner.ts","line":114}]
finding_counts: {"high":1,"medium":0,"low":0}

# T-1217 durable-handoff source review — NOT CLEAR

Reviewed 2be5d71b993541ef055f210faf5a3079b9fa4280 / tree c55533322d404182856830933b156169c31ec43b, unchanged pushed task tip. Full revised design and complete delta from 5571f66c / A-11829 inspected personally on both axes. No post-review dev merge. Coordinator 2776473b explicitly chooses durable recovery with bounded hub exit, rather than unbounded shutdown, and authorizes the current UTC identity helper pending T-543's separately directed integration. No stronger same-second identity guarantee is inferred.

## Standards

M3 resolved: the scratch helper registers beforeDirectories before spawn, captures shared owned detached-group identity while its exec gate is closed, then releases the command. Cancellation/deadline calls drain the owned group and observes actual child close before resolve/reject. The held writer control asserts both captured PIDs gone before rejection. Product-owned scratch roots veto removal through recovery while ownership remains unresolved. Native absence assertions now distinguish cat-file absence from infrastructure failure.

No new Standards finding. T1 14-case policy matrix moves repeated native permutations into injected observations while retaining a native retained-batch positive control; T2 serving and legacy-runner coverage and T3 owned native contracts remain appropriately placed. Exact headings, tier/index rows, changed help/frozen blocks and implement/CHANGES are maintained. Decoded HUB_USAGE/DOCTOR_USAGE still match frozen values. Consumer inventories cover both territory-lock signatures, persisted private owner receipt and doctor visibility; no role, wire or dependency change. Legacy doctor run remains compatible. The two sync/async recovery paths preserve existing caller types.

## Spec

Prior H1 ownership-loss branch is corrected by the approved durable handoff: a private fd gate captures PID/UTC birth/group and durably persists a token/root/repository owner before Git execve. Normal close reconciles actual group disappearance. An incomplete result retains ownership, breaks before another repository, rejects the pass and never announces maintenance completed. Both lock wrappers recover before the managed mutation, after acquiring their existing physical lock; restart recovery begins after serving. Matching alive groups are signalled and observed under a bound, mismatch never authorizes a signal, unknown/surviving groups retain receipts and report PID. Matching dead same-host gc.pid cleanup is guarded, replacement locks and all pack files preserved. Existing grace/retention and serving-first thirty-second design remain. T-543 integration is an explicit follow-up dependency under the Coordinator decision, not a new unapproved source migration.

H2 — high, hub/src/git-maintenance-owner.ts:114–124 (incomplete finish) with hub/src/cli/hub.ts:198–238 and :313–328: durable handoff does not release the parent's referenced native observation handles. When cleanup expires, finish resolves the command but leaves ChildProcess and stdout/stderr pipes referenced. That branch specifically has no observed native close. During normal socket hub.stop, daemon shutdown releases discovery/hub lock and serve returns 0; the CLI entry only sets process.exitCode. Open native child/pipe handles can therefore keep the supposedly stopped hub process alive indefinitely. The external stop command deliberately refuses to signal that PID after observing its released lock ("hub stopped, lock released, process still alive ... left it running"), so its SIGTERM two-second fallback does not rescue this path. This violates the explicit bounded-exit policy and risks the restart/bridge gap the revision is intended to prevent.

On a durable incomplete handoff, release or unref the parent's child/pipe observation resources (or supply an equivalently bounded normal-stop mechanism) while retaining the owner receipt and mutation gate; this must not be counted as collector death or normal completion. Keep native SIGKILL attempt and actual recovery proof. Add a normal hub.stop/CLI-exit regression with genuinely still-referenced held native observation handles. Current T2 uses a synthetic returned RunResult with no native handles. The native held-close test suppresses the JS close notification after the underlying real process/handles close, which tests durable ownership but not event-loop exit liveness. No unbounded wait or silent receipt deletion is authorized.

No other blocker found in the consolidated revised-source audit.

## Original evidence and disposition

A-11923 preserves available original local macOS Node24 output excerpts, not full raw stdout/stderr exports or exact-head configured/Linux evidence. T1 14/14 duration_ms 285.402792, startup T2 5/5 duration_ms 1073.9825, unchanged runner T2 4/4 duration_ms 73.812209, native T3 11/11 duration_ms 16055.99325 (maximum case 2686.847ms), typecheck exit0. The old incomplete-result and old direct-parent helper controls were observed red before corrections. Native real alive/mismatched first-mutation and held-close/group-death/next-pass controls provide meaningful local evidence. They retain original working-tree/platform/capture limits; no Linux/load/browser/all-tier proof or new duration allowance is invented. Preserve available original correction records without transcription reruns.

Full NOT CLEAR: Standards 0 / Spec 1 high (H2). C1 fails bounded stop during unresolved native ownership. C2 source help/doctor/retention corrections remain accepted but runtime verification is pending. Prior H1/M3 are resolved under the Coordinator's durable-handoff policy, not waived. Correct the consolidated H2 path, commit/push, restore done and request fresh exact-head source review before one ordinary configured mode-free verify. No dev merge, live maintenance or extra stress requested. Coordinator retains separate pre-merge verify all after ready; QA none/after-stage. Reviewer performed read-only source/artifact/metadata inspection only; no tests, native subjects, signals, GC, fetch or Git mutation.
Durable review: A-11929.

Criteria: C1 failed (H2: unresolved native observation handles can retain the normally stopped hub after its lock is released, violating the Coordinator's bounded-exit handoff policy.).

### impl-1217 · 2026-10-25T13:00:17.988Z

A-11929 H2 corrected: durable incomplete handoff now unrefs the ChildProcess and destroys the parent's observation pipes without clearing owner metadata or claiming death. New actual CLI/socket hub.stop regression first failed with 'normal hub.stop left the CLI alive past its bounded handoff; native hub outcome incomplete'; after correction, native CLI exit succeeds while collector/descendant remain alive, followed by real recovery and exact PID disappearance. Local macOS Node24 focused receipts: new T3 1/1 (1833.804334 ms case), existing native T3 11/11, startup T2 5/5, policy T1 14/14. Static lint exposed two narrow issues before review: deadline lacked its reasoned annotation and policy fixture imported T2 native cleanup. Replaced the latter with filesystem-only awaited cleanup, retaining all fake-policy assertions and T1 classification. No configured/Linux verification yet. T-543 currently ready but unmerged; approved current identity helper remains pending directed integration.

### rev-31 · 2026-10-25T13:04:13.198Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1217-source4
commit: 63018b8e4aafefb44f3a2969524374680a21bb29
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1217 corrected full source review — CLEAR

Exact head 63018b8e4aafefb44f3a2969524374680a21bb29 / tree 66a94465d9e26e9d0a90c80bf850a4fe4dec2ad3, unchanged pushed task tip. Direct correction after 2be5d71b / A-11929, no dev merge. Complete revised design carried from A-11783/A-11829/A-11929 and correction personally inspected on Standards and Spec. Both claimant criteria done; configured evidence absent.

## Standards

No findings. H2 adds one named T3 normal-CLI lifecycle contract, exact guide/index and sorted tier entry, matching policy/README/implement guidance and CHANGES. It retains real socket status/stop, native CLI close and independently observed collector PIDs. Shared fixture environment is applied after final overrides; every native group is owned and cleanup precedes directory removal. Its bounded exit observation is armed before stop with a reasoned task-specific deadline; no generic timeout/assertion relaxation. The preload accelerates only the post-serving maintenance timer, substitutes only the gated collector and intercepts its exact group signal; the guide distinguishes this from startup-delay performance evidence.

T1 policy fixtures now use awaited filesystem-only cleanup without importing native process cleanup, retaining all fourteen policy cases. No native writer is introduced into T1. Existing five-argument doctor-run semantics and compatibility cases are unchanged. Earlier M1/M2 help/guide corrections and M3 fixture group drainage remain intact; decoded HUB_USAGE/DOCTOR_USAGE match their frozen blocks. No wire, role, permission, dependency or packaging change. Shared-policy/lock/receipt consumer inventories and skill provenance updates are retained.

## Spec

H2 resolved. On durable incomplete handoff only, the owned runner unrefs ChildProcess and destroys parent stdout/stderr/gate observation streams before resolving. The durable owner and mutation refusal/recovery gate remain; this releases the stopped parent's event-loop references without claiming native collector death. The normal close and independent group-recovery paths are unchanged. Late close cannot erase a successor owner because the run is already settled.

The new real CLI regression records genuinely referenced PROCESSWRAP and multiple PIPEWRAP resources at its intercepted kill attempt, arms native CLI exit before ordinary socket hub.stop, and asserts actual code0/signal-null exit plus reaped hub PID. Both collector and descendant remain alive and their durable owner is still present after the hub exits. Independent native recovery then clears the receipt and observes both PIDs gone. This closes the previous synthetic-result/withheld-JS-close coverage gap while preserving actual owned cleanup on failure.

The complete accepted design remains: serving first; one thirty-second delayed pass; explicit cruft/14-day grace or never for retained/uncertain work; private gated exec with durable PID/UTC birth/group before Git starts; native-close/group checks or explicit durable handoff; terminal incomplete result before another repository; no false completed announcement; bounded identity-aware first-mutation and after-serving recovery in both territory lock paths; unknown/surviving owners refuse writes and report PID while reads serve; matching dead same-host gc.pid only, never manual pack deletion. Doctor remains read-only, including --fix. Approved Coordinator decision 2776473b chooses durable recovery rather than an unbounded stop. Preliminary linked-root concern is not reopened.

The current UTC identity helper and its precision limitation remain explicitly approved until T-543's directed integration. The claimant reports T-543 ready/unmerged on recheck; recheck before ready and follow only an explicit Coordinator integration instruction, with fresh source review for any changed head. No unproved same-second PID-reuse guarantee is claimed.

## Original evidence

A-11949 retains original available macOS arm64 Node24 correction excerpts with actual working-tree attribution and raw-capture limits. New normal CLI case reproduced H2 red: bounded handoff left CLI alive, actual native outcome incomplete, exit1, case3280.493917ms. After the correction the same case passes, exit0, case1833.804334ms / file2228.784625ms, with alive-collector/ref/death/recovery assertions retained.

Current native maintenance file11/11, duration_ms13540.8835, maximum case2175.778084ms; startup T2 5/5 duration_ms838.916542; policy T1 14/14 duration_ms258.710542. These total31 focused current correction cases. The separate unchanged doctor-run4/4 remains historical A-11923 evidence, not a new rerun. Corrected typecheck, child-environment, wording, skill provenance and final test lint exit0 are recorded; lint133 findings/60 files is report-only, zero refusals. Earlier first-static failures and preceding source controls remain disclosed. No local case reaches3s, but Linux timing is not inferred from local observations.

## Disposition

Source CLEAR, Standards 0 / Spec 0, findings empty. Prior H1/M1/M2/M3/H2 resolved, with durable exceptional ownership governed by the Coordinator decision rather than a death-receipt waiver. C1/C2 remain runtime-unverified until one ordinary mode-free configured verify at unchanged63018b8e, followed by exact-head evidence review of named policy/serving/normal-exit/native object/recovery/doctor outcomes and actual phase/provenance limits. If Linux measures a case at the policy allowance threshold, use the actual receipt and a fresh source review for any allowance correction; no invented timing or extra stress.

No post-review dev merge, forced/full run, live GC/prune/repack/config mutation or transcription rerun requested. Coordinator separately owns pre-merge verify all after ready; QA none/after-stage. Reviewer performed read-only immutable source/artifact/metadata inspection only, no tests, native probes/subjects, browser, process signals, fetch or Git mutation.
Durable review: A-11952.

### impl-1217 · 2026-10-25T13:19:42.458Z

Configured exact-head run6691053c at63018b8e passed: A-11966 original log, A-11968 independently parsed named-case audit. 3184 ordinary passing finish records plus105 passing load records (21identities×5); zero failures/cancels/skips. HostT0/LinuxallT1/fallbackallT2/changedT3(2files12cases once)/Web44files225tests completed; remainingT3 deferred, noT4. Required35 named policy/startup/native/normalCLI/doctor base cases pass, not merely exit0. Linuxx64 dropletc-8lon1 Node24.21 ChromeHeadlessShell156.0.8078.4; lifetime732s cost$0.0509. New maximum case2.785146291s, none>=3s; no allowance needed. Lint/duration/T3-growth warnings report-only, listed inA-11968. T-543 rechecked ready/unmerged; current helper limitation remains approved. Requested final evidence review; Coordinator owns premergeall.

### rev-31 · 2026-10-25T13:24:21.608Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1217-final
commit: 63018b8e4aafefb44f3a2969524374680a21bb29
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence CLEAR, Standards 0 / Spec 0. A-11975 carries full source4 A-11952 and independently audits original mode-free 6691053c/A-11966: 3184 ordinary passes plus 105 separate load finishes (21 identities × 5), all 35 required base cases, no failures/cancellations/skips. Twelve changed native T3 cases ran once, including normal real CLI exit with durable live collector handoff, independent recovery, pruning grace/retained-work controls and doctor/stale-log outcomes. Maximum new case 2.785146291 s; no new allowance. C1/C2 verified. Actual host T0/Linux all T1/fallback all T2/changed T3/Web passed; remaining T3 deferred and no T4/verify-all claim. Host gate.tree reuse, browser/executor provenance, original local capture limits and approved UTC identity-helper dependency retained. Lint/budgets/ratchet report-only: T3 +18.512 s would refuse growth under enforcement, retained for Coordinator planning. No source change; exact tree 66a94465d9e26e9d0a90c80bf850a4fe4dec2ad3. Coordinator's separate rule-6 pre-merge verify all remains outstanding; no live maintenance authorized.

Criteria: C1 verified, C2 verified.

### impl-1217 · 2026-10-25T13:29:48.920Z

Coordinator-authorized post-T1260 dev merge committed/pushed72802020 (dev14ac6e97). Only conflict resolutions: keep explicit checkHub env plus maintenance doctor row; keep markServing immediately after serving log, then maintenance recovery/scheduling. A-11977 will identify merged-tree local receipts if assigned (artifact delivery in topic);55focused cases passed individually, typecheck/child-env/testlint exit0 (133report-only findings/zero refusals). Prior63018b8e configured pass remains prior-head only. New source review before mode-free verification.

### impl-1217 · 2026-10-25T13:29:59.789Z

Artifact correction: actual returned merge evidence id is A-11979, durable path .cland/artifacts/A-11979-t-1217-authorized-dev-merge-and-focused-receipts-at-72802020.md. Disregard the guessed A-11977 reference in the preceding comment.

### rev-31 · 2026-10-25T13:33:01.484Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1217-source5
commit: 7280202096714186413f19bb49021c67314937a0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source CLEAR, Standards 0 / Spec 0; durable audit A-11982 carries full source4 A-11952. Exact tree 86b0d369e2725145507b469953eafc8282dbc6ff, parents 63018b8e and authorized dev14ac6e97. Independently read Coordinator 4ddc48ac/de16a39a. Doctor resolution forwards explicit env through checkProject/checkHub while retaining maintenance row; daemon resolution is serving log -> markServing -> maintenance recovery/schedule, preserving T-1224 startup anchor. T-1260 authenticated durable one-shot slot notifications/transactional removal and re-admission remain intact; maintenance retention metadata and teardown paths do not conflict. Eighteen task-specific files including owner/collector/territory and all native/policy/startup tests are byte-identical; incoming help, docs/index/tier/harness changes preserve task contributions and decoded intended frozen help rows agree. A-11979's 55 separate local focused passes/typecheck/static excerpts are retained with working-tree/platform/capture limits, not configured/Linux proof. Prior A-11966/A-11975 apply only to 63018b8e; C1/C2 remain runtime-unverified at new head. Current approved UTC-helper limitation unchanged. One ordinary mode-free configured verification at unchanged72802020 followed by evidence review; separate Coordinator rule-6 verify all after ready. No live maintenance, extra integration or Reviewer execution.

### impl-1217 · 2026-10-25T13:47:51.551Z

New merged-head runb49902c1/A-11987 passed atunchanged72802020:3243ordinarypass0fail/cancel/skip,105separateloadpass(21identities×5). A-11988 independently audits all35required named base cases plus20doctor matrix cases, including explicit-env regression. HostT0/LinuxallT1/fallbackallT2/changedT3(12once)/Web44files225tests completed; otherT3deferred/noT4/noallclaim. MaxnewLinuxcase2.859673092s so no>=3sallowance. Report-onlywarnings/hostgate-reuse/browser/executor/lifetime/cost documented. T-543freshlyready/unmerged. Final evidence review requested before fresh fetch/conflictcheck and new Coordinatorready.

### rev-31 · 2026-10-25T13:48:54.643Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1217-final2
commit: 7280202096714186413f19bb49021c67314937a0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence CLEAR; C1/C2 verified at tree86b0d369e2725145507b469953eafc8282dbc6ff. A-11989 carries source5/A-11982 and full source4/A-11952. Independently parsed original b49902c1/A-11987: 3243 ordinary passes plus 105 separate load passes (21 task identities × 5), zero failures/cancellations/skips/todo. All35 required policy/startup/doctor/native/normalCLI base identities pass; 12 changed T3 cases ran once. Maximum new case2.859673092s, no allowance. Current receipt establishes true normal CLI exit beside live durable collector ownership then independent recovery, protected object grace/retained work and stale-log/doctor outcomes. Explicit-env, startup-grace and durable slot-wakeup integration controls also pass. HostT0/allT1/fallbackallT2/changedT3/Web completed; remainingT3 deferred/noT4/noallclaim. Actual Linux/browser provenance, reused host gate TREE0c7cba4b, local capture limits and current approved UTC-helper limitation retained. Report-only lint133/60, seven budget warnings/eight missing baselines, actualWebwall156.414s vs40s and T3growth+19.161s would-refuse warning remain for Coordinator planning; not an enforced-budget pass. T-543 ready/unmerged on fresh read. Fresh conflict check/ready next; Coordinator separately owns enqueue/rule6all at this head. No live maintenance or Reviewer execution.

Criteria: C1 verified, C2 verified.

### impl-1217 · 2026-10-25T13:49:33.009Z

Ready report sent to Coordinator at unchanged 72802020 after final evidence A-11989. Fresh no-auto-maintenance fetch found dev 31e63e92; object-only merge-tree exited 0 with no conflicts (result e063f7b7). Clean tree; claim retained. Coordinator owns queued rule 6 verify all after stage covers and T-1265/T-543 reruns, then enqueue. No additional source changes or all-tier proof claimed.
