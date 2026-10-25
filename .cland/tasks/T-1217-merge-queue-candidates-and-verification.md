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
updated: 2026-10-25T11:31:35.892Z
---

## Summary

On 2026-10-24 every Git command in the root and in task worktrees started printing "The last gc run reported … run 'git prune'" and "There are too many unreachable loose objects". The repository holds 10,546 loose objects (about 150 MB). The merge queue builds each batch candidate with `git commit-tree` and verification bundles snapshot trees, which leaves unreachable commits behind; the Coordinator's preflight checks add a few more. Auto-gc then refuses to run until .git/gc.log is removed. Nothing fails, but the warning reaches every session's output and the loose objects keep growing.

## Acceptance criteria

- [ ] C1. cland's own Git maintenance (for example after a landing, or on hub start when idle) prunes unreachable objects older than a safe age that no live batch, verification or lease can still reference, without touching objects a running batch uses (test with a scratch repository).
  - failed: rev-31 [reviewer] · 2026-10-25T11:11:26.170Z · note H1: maintenance's silent30s detached collector conflicts with15s startup supervisor, risking hub kill and orphaned collector ownership.
- [ ] C2. A stale gc.log no longer blocks auto-gc indefinitely; the hub reports the condition once in doctor output instead of in every Git command (test).
  - failed: rev-31 [reviewer] · 2026-10-25T11:11:26.170Z · note M1/M2: matching changed help and per-test documentation disagree with retained frozen-byte/exact-heading guards.

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
