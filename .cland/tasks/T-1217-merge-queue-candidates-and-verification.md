---
id: T-1217
kind: task
title: Merge-queue candidates and verification snapshots accumulate unreachable Git objects until auto-gc gives up
state: open
status: in progress
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
updated: 2026-10-25T12:47:48.663Z
---

## Summary

On 2026-10-24 every Git command in the root and in task worktrees started printing "The last gc run reported … run 'git prune'" and "There are too many unreachable loose objects". The repository holds 10,546 loose objects (about 150 MB). The merge queue builds each batch candidate with `git commit-tree` and verification bundles snapshot trees, which leaves unreachable commits behind; the Coordinator's preflight checks add a few more. Auto-gc then refuses to run until .git/gc.log is removed. Nothing fails, but the warning reaches every session's output and the loose objects keep growing.

## Acceptance criteria

- [ ] C1. cland's own Git maintenance (for example after a landing, or on hub start when idle) prunes unreachable objects older than a safe age that no live batch, verification or lease can still reference, without touching objects a running batch uses (test with a scratch repository).
  - failed: rev-31 [reviewer] · 2026-10-25T12:47:48.663Z · note H2: unresolved native observation handles can retain the normally stopped hub after its lock is released, violating the Coordinator's bounded-exit handoff policy.
- [x] C2. A stale gc.log no longer blocks auto-gc indefinitely; the hub reports the condition once in doctor output instead of in every Git command (test).
  - done: impl-1217 · 2026-10-25T12:40:49.276Z

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
