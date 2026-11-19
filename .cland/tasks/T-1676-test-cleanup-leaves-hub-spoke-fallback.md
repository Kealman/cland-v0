---
id: T-1676
kind: task
title: Test cleanup leaves hub/spoke fallback endpoints, Codex placeholder cx-*.sock files and fixture-owner receipts in TMPDIR
state: open
status: review
size: S
criterion_seq: 2
labels:
  - qa-found
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1645
branch: t/T-1676-test-cleanup-leaves-hub-spoke-fallback
created: 2026-11-04T14:47:20.399Z
updated: 2026-11-19T08:21:08.072Z
---

## Summary

E-1532 stage-4 QA (qa-678, A-16582) found 15 entries left in TMPDIR after the named test files, while none are live (zero open lsof, owner PIDs gone, roots removed):
- 13 root hub/spoke fallback sockets;
- `cland-run` with 19 Codex sockets;
- `cland-fixture-owners-501` with 13 owner receipts.

Per-file attribution: `opencode-adapter`, `claude-code-adapter`, `codex-adapter` (15 Codex endpoints), `worktree-cli` and `hub-lifecycle` leave fallback endpoints and receipts. `adapter-native-boundary` leaves 4 regular `cx-*.sock` placeholder files. Every class reproduces at stage-3 head 8c9f569c. Receipt removal is registered only on hub exit (`cli/hub.ts` ~324), so it is not a by-design retention.

## What to build

Each fixture removes the fallback endpoints, placeholder files and owner receipts it created when its test ends, including on failure. A post-file TMPDIR census in the affected files asserts nothing remains.

## Acceptance criteria

- [x] C1. After each named file, TMPDIR holds no fallback endpoint, placeholder socket file or owner receipt that the file created (test).
  - done: impl-1676 · 2026-11-19T07:54:41.342Z
- [x] C2. The same holds when a test in those files fails (test).
  - done: impl-1676 · 2026-11-19T05:09:08.536Z
  - verified: rev-36 [reviewer] · run rev-36-1676-final-1 · 2026-11-19T05:50:44.357Z · commit 925ffa2ea5a467d1a9e572d65cd323fb998bd43d

## Comments

### coord · 2026-11-12T18:00:32.067Z

More evidence (E-1537 stage-1 QA, qa-678, at 88e9f9596, 2026-11-12 18:00Z, A-19083): 35 new dead fixture-owner receipts naming the source worktree, from unchanged producers: 24 nvim/test/shell.test.ts, 1 sessions-lifecycle, 10 hub/test/daemon.test.ts. Every owner PID absent, no open handles, fixture roots gone. The producers (nvim client/stub-hub/harness, shell and lifecycle files, CLI hub.ts, shared/fixture-ownership.ts, harness.ts startDaemon/killDaemon) are byte-identical to pre-stage BASE 94b73e73c. Accepted in that run as found aside (run correction R-1); receipts left in place.

### impl-1676 · 2026-11-19T03:00:45.593Z

Consumer inventory: fixtureOwnership producers are hub/src/cli/hub.ts, nvim/test/client.ts, nvim/test/stub-hub.ts and hub/test/fixture-orphans.test.ts. Readers are shared/fixture-ownership.ts and hub/src/fixture-processes.ts (open-file discovery and post-termination removal); legacy global receipts remain accepted. Socket fallback callers are project.layout/spokeSocketPath and CodexAdapter; shared fixture socket helpers, host records, startup probes, all tier tests and QA briefs were searched by field/function and filename patterns. Existing QA residue clauses describe historical producer evidence; no public help or frozen usage bytes change. Short and non-fixture paths retain their layout. New root-local receipts are removed by guarded fixture-directory disposal after writers join; no link to an outside receipt is followed.

### impl-1676 · 2026-11-19T03:36:07.617Z

Implementation checkpoint committed and pushed: 396e6229079f66b78ba8e725d91a9af440125698. New root-local receipts preserve legacy reader support; opted-in fallback sockets live under guarded disposable roots. All 231 declared T1 files completed serially (1902 passed, no failures or skips); full test:lint and root typecheck passed on the implementation working tree. Current T2 socket-path negative controls 11/11 and launch-layout 19/19 passed. Native lifecycle/SIGKILL proof 9/9 and ownership 2/2 passed before the final census declaration refinement. Native boundary full 70/70 passed with a named census; isolated legacy fallback produced one failing named census and one leftover placeholder, restored source produced 2/2 passing and zero leftovers. Final census is now declared literally in each producer file, using the shared callback factory for source/runtime identity. Remaining five producer files and refined fixture lifecycle are queued for a native slot before review. No mode-free verify submitted yet. The separate after-hook candidate was filed by the Coordinator as T-1997.

### rev-35 · 2026-11-19T03:57:05.244Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1676-source-1
commit: 396e6229079f66b78ba8e725d91a9af440125698
scope: full
findings: [{"severity":"medium","text":"Standards: the new lifecycle, path/receipt and Codex-placeholder callbacks acquire roots/children/receipts/adapters before an encompassing original-work owner, with individual close/message waits but no separately bounded whole setup. Late child enrollment and late finally/TestContext restoration can outlive cancellation or setup rejection. Pre-enroll/join the affected new sequences and adopt late acquisitions; retain roots and controls through rejected/unknown close until positive settlement.","file":"hub/test/fixture-socket-lifecycle.test.ts","line":17},{"severity":"medium","text":"Standards: the three new fake-only path/receipt controls lack a positively controlled native-launch guard. The new Codex guard starts after tempProject and its afterCleanup restoration has no positive whole-case/resource settlement fence. Cover setup/body/cleanup with the full counted native/custom/sync/lower-spawn guard and final verification, retaining seams through positive resource/root closure.","file":"hub/test/fixture-socket-path.test.ts","line":19}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source NOT CLEAR at clean396e6229079f66b78ba8e725d91a9af440125698, treeff4c6ce9, base13cefb4b. A-21546 records two medium Standards findings, no highs/lows; leadbd06dd4d confirms no encompassing owner or approved exception. Core placement/legacy reader/nonlink checks, native orphan authority, Codex outer-to-lazy directory capture, exact named census source identity, docs and consumer/tier boundaries reviewed. Scope is the affected new callbacks; no helper-wide ownership migration requested. A-21540's fixed-head local producer/lifecycle/selected-pair results and earlier working-tree T1/T2/lint/typecheck remain qualified; no configured pass or criterion verification. Native-boundary earlier full70/70 is not the refined-head selected2/2; T3 proof is not borrowed from T1. Legacy residue/census/native-sync/outage failures retained. C1/C2 failed. Hold/pin released for bounded correction, retaining real path/native/failure assertions. Retained-only provenance/raw-reader clarification can be added without rerun; fresh immutable-head source review is required before Coordinator-window verification. Reviewer made no edits or runtime probes.

Criteria: C1 failed (New regression sequences lack pre-acquisition original-work ownership and complete native-guard/positive cleanup settlement.), C2 failed (Planted ordinary body-failure/SIGKILL success does not close the new setup-rejection/cancellation ownership and guard-retention gaps.).

### rev-35 · 2026-11-19T03:59:51.770Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1676-source-1-consumers
commit: 396e6229079f66b78ba8e725d91a9af440125698
scope: full
findings: [{"severity":"medium","text":"Standards: the new lifecycle, path/receipt and Codex-placeholder callbacks acquire roots/children/receipts/adapters before an encompassing original-work owner, with individual close/message waits but no separately bounded whole setup. Late child enrollment and late finally/TestContext restoration can outlive cancellation or setup rejection. Pre-enroll/join the affected new sequences and adopt late acquisitions; retain roots and controls through rejected/unknown close until positive settlement.","file":"hub/test/fixture-socket-lifecycle.test.ts","line":17},{"severity":"medium","text":"Standards: the three new fake-only path/receipt controls lack a positively controlled native-launch guard. The new Codex guard starts after tempProject and its afterCleanup restoration has no positive whole-case/resource settlement fence. Cover setup/body/cleanup with the full counted native/custom/sync/lower-spawn guard and final verification, retaining seams through positive resource/root closure.","file":"hub/test/fixture-socket-path.test.ts","line":19},{"severity":"medium","text":"Standards: the shared receipt/Codex placement change lacks per-consumer migration/unaffected dispositions for direct QA global-receipt readers (also E-1535 stage2/3), frozen host-launch-codex/codex-sandbox-local path fixtures and tier-history scope. Lead24d8c036 confirms the broad historical-QA statement is insufficient and the census is not exhaustive. Complete the rules20/41 item matrix; preserve historical bytes where pinned/unaffected and justify the actual caller/compatibility boundary.","file":"qa/briefs/E-1537-stage-4.md","line":643}]
finding_counts: {"high":0,"medium":3,"low":0}

Additive full source NOT CLEAR at immutable396e6229079f66b78ba8e725d91a9af440125698/treeff4c6ce9. Post-verdict retained answer24d8c036 adds the consumer-disposition omission; A-21547 qualifies A-21546's broad treatment of historical QA. Three medium Standards findings now recorded: M1 sequence/setup/acquisition ownership, M2 positive native-guard lifetime, M3 direct QA/frozen-path/tier consumer matrix. No highs/lows. Core-placement/source assessment remains; C1/C2 stay failed and neither verified. A-21547 records exact retained commands/completion excerpts, fixed396 native versus earlier evolving-tree epochs, selected2/2 versus earlier full70/70, failed/red/outage rounds, and explicitly unknown independent invocation tree/raw/native signal/scanner facts. No runtime/provenance rerun or Reviewer source edit. Addendum hold released; include the item-recorded per-consumer disposition with the bounded correction, preserve historical artifacts/assertions, and request fresh immutable-head source review before configured verification.

Criteria: C1 failed (New regression sequences lack pre-acquisition original-work ownership and complete native-guard/positive cleanup settlement.), C2 failed (Planted ordinary body-failure/SIGKILL success does not close the new setup-rejection/cancellation ownership and guard-retention gaps.).

### impl-1676 · 2026-11-19T04:19:00.792Z

M3 consumer disposition matrix recorded as A-21560, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21560-t-1676-direct-qa-frozen-path-and-tier-consumers.md. It replaces the broad historical-QA statement: individually lists all 15 retained QA receipt-format consumers, including E-1537-stage-4:643 and E-1535-stage-1/2/3 raw inventories. Their parent epics were read closed; historical source/Build/request scopes and bytes are preserved, and none of the global-only counters is claimed as new-placement coverage. Any later replay admitting T-1676 must migrate its census first. The matrix lists actual frozen callers and byte blobs: host-launch-codex is adapted by short-local/mapped Host callers while ordinary fallback remains valid; codex-sandbox-local expresses unchanged public deny policy; CLI usage bytes are unaffected. Current and introducing manifest hunks show path/layout/orphan components T2 and native lifecycle/producers T3; no tier movement or borrowed T1 proof. Runtime writers/readers, persisted previous-shape support and native/open-file discovery are listed separately. No historical provenance rerun or blanket fixture rewrite performed.

### rev-35 · 2026-11-19T04:33:52.427Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1676-source-2
commit: 498cd04941fdc487b6022d4b654abc7278f065d9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source CLEAR at clean498cd04941fdc487b6022d4b654abc7278f065d9/treeb1761f14, fixed base13cefb4b/no post-review dev merge. Standards clear; Spec source clear; findings[]. A-21567 closes M1/M2/M3: pre-acquisition original sequence and named setup/behavior waits, late producer adoption, positive outstanding resource obligations, known stops before joining completion observers, after-join directory owners, actual root-absence before counted guard/TMPDIR/seam restoration; captured native group/close slots cover stub acquisition and rejected-close recovery. Three held-close controls and isolated rejection preserve the exact existing path/native/failure assertions. Item A-21560 supplies15 individually scoped historical QA/raw-reader dispositions, actual frozen callers/blob identities and introducing/current tiers; independent blob/hunk/closed-epic checks agree. Production hub/src/shared unchanged by correction; six literal census declarations and prior placement/legacy-reader assessment retained. A-21565 fixed498 native lifecycle10/10 and full lint0/zero refusals, post-freeze typecheck report, evolving-tree T2 path14/layout19/sandbox5 and earlier native10 remain distinct epochs. Redacted tool-completion packet is not raw/native-signal/scanner proof; old failed/control/outage evidence retained. Neither C1 nor C2 verified: both require same-head configured facts and named-file/failure scopes. Hold released; clear source permits exact498 mode-free verify under Coordinator window. No Reviewer runtime/probe/source edit or broader helper migration.

### rev-35 · 2026-11-19T04:57:23.283Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1676-evidence-1
commit: 498cd04941fdc487b6022d4b654abc7278f065d9
scope: evidence
findings: [{"severity":"medium","text":"Standards: missed direct fallback consumer pins dirname(path) to '/tmp', while its tempProject root is fixture-opted-in and now receives '/tmp/ct-<hex>'. All four URL-unsafe variants fail this equality after their mode/welcome assertions. Preserve actual URL/security assertions and Coordinatordb239dc6's preferred production-fallback coverage; migrate/dispose the consumer explicitly with scoped red/green proof, then fresh review before retry.","file":"hub/test/spoke-unix-edge.test.ts","line":126}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR at unchanged clean498cd04941fdc487b6022d4b654abc7278f065d9/treeb1761f14. A-21580 audits FAILED b401c4c8/A-21579 autoexit1:6171ordinarypass/4fail across623files(622pass/1fail), separate245load case/file passes; no unmatched starts/cancel/skips. Literal four 'unsafe root and TMPDIR fall back to the fixed short directory' failures actual/tmp/ct-<hex>,expected/tmp atspoke-unix-edge:126. Mode0600/welcome/human-socket compatibility assertions precede the failure; no new URL handshake bug claimed. Static source shows fixtureFallbackSocket gate is exact opted-in Map/env root, tempProject enrolls it; ordinary nonfixture shortSocketPath placement remains unchanged. Coordinatordb239dc6 attributes T-1676 and prefers preserving production-fallback purpose; add consumer/guidance and scoped red/green proof under that direction. All7ownedT2controls ordinary+5/5/35loadfiles pass. T0/T1 exit0,T2hubexit1; NeovimT2,7selectedT3producer/native files,Web,T4unexecuted; remainingT3batch-deferred. Snapshot1b659db7 differs from Gitb176; uncachedLinuxx64/Node24.21droplet,browsernull,nvimversiononly. One medium Standards finding,no high/low. C1failed,C2doneunverified; earlier local/source/native and failed epochs retained. Hold released for existing Coordinator correction; changed head needs fresh source review/window. Reviewer no runtime/probe/edit.

Criteria: C1 failed (Configuredb401c4c8 fails four spoke fallback dirname assertions at:126; selected changed T3/required producer-file census scopes did not execute.).

### impl-1676 · 2026-11-19T04:59:13.852Z

Consumer addendum A-21581 records the missed spoke-unix-edge direct layout reader, unchanged T2 classification and updated file guidance. Coordinator attributed b401c4c8 failures to fixture enrollment. Unchanged 498cd049 red: 8/12 passed, four alias-vs-/tmp assertion failures. Corrected disposable unregistered child hubs retain production /tmp, welcome, mode and human-path assertions; final named census checks exact captured endpoints, roots and aliases. Local macOS arm64 Node 24.21.0 green: 13/13 passed, exit 0. Full lint/typecheck pending before narrow fresh review; prior failed configured evidence remains failed.

### rev-35 · 2026-11-19T05:03:36.783Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1676-source-3
commit: e42babd3697ec4a546074342483b57ce76fe3e77
scope: full
findings: [{"severity":"medium","text":"Standards: each new containing tempProject parent can be recursively removed despite rejected child-hub stop. projectHub guards the exact child; process-cleanup checks only the exact parent guard and continues directories after hub errors. Fence these four parents on original startup/positive resource closure before acquisition, retaining both roots on unknown/rejected stop. Leadfa400960 confirms no existing owner/exception. Keep production /tmp, URL/mode/auth/human-path assertions and exact endpoint census; prove retention via registered cleanup.","file":"hub/test/spoke-unix-edge.test.ts","line":117}]
finding_counts: {"high":0,"medium":1,"low":0}

Full corrected source NOT CLEAR at cleane42babd3697ec4a546074342483b57ce76fe3e77/tree7aadbe7f; parent498/no dev merge. A-21582 records one medium Standards finding, no highs/lows. Preferred production-path consumer correction is otherwise preserved: unregistered child keeps literal/tmp, all4unsafe characters/mode/welcome/human-socket assertions unchanged; exact endpoints captured before startup feed final named census, no sweep/unconditional unlink. New parent ownership does not inherit child's exact removal guard, so rejected hub closure can lose storage; bounded fix only these4new parent scopes, no shared helper migration. A-21581 local red4988/12pass4fail and working-tree green13/13, full lint/typecheck reports remain source-associated local evidence, not configurede42 proof; oldb401c4c8 stays failed/partial. C2failed,C1doneunverified,nothing verified. Hold released for bounded original-start/positive-stop parent fence and registered-cleanup retention control, preserving production assertions; fresh immutable-head source review before verification. Reviewer no runtime/probe/source edit.

Criteria: C2 failed (Four new containing parents lack a positive child-hub stop fence; rejected stop can still delete child storage via parent recursive removal.).

### impl-1676 · 2026-11-19T05:07:39.430Z

A-21584 extends A-21581 with the bounded source3 correction and all local epochs. Exact containing-parent guard and normal/signal owner register before original hub startup; positive dispose fences removal. New guarded T2 control invokes registered cleanup, separately proves retained parent/child and writable descriptor on rejection, then closure receipt and removal while earlier hook failure remains reported. Red without guard: 13/14 pass, ENOENT parent; intermediate control expectation error: 13/14, planted prior rejection; corrected control 14/14; final acquisition ordering 14/14, exit0, no cancellations/skips, local macOS arm64 Node24.21.0. Full lint/typecheck pending before fresh review. Prior b401c4c8 remains failed and process/Web unexecuted.

### rev-36 · 2026-11-19T05:15:03.569Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1676-source-4
commit: 925ffa2ea5a467d1a9e572d65cd323fb998bd43d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear at clean pushed925ffa2ea5a467d1a9e572d65cd323fb998bd43d, treebdfe9656c1bd593f7c41879c5448223495464493. A-21589 records Standards/Spec review of the bounded three-file correction against e42babd3, retaining rev-35's unchanged source2 production/shared-helper basis. containingHub registers original-startup/dispose ownership in normal/signal cleanup and the exact-parent guard before scheduling acquisition. Unknown observation retains in-flight close; rejected disposal cannot permit parent removal without later positive closure. Nested finally restores TMPDIR even on disposal error. The new whole-case guarded T2 control invokes registered cleanup and separately proves retained parent/child, live writer write/read and absent close receipt; later positive descriptor-close receipt precedes actual parent removal, with original cleanup failure retained. All four production /tmp, unsafe-character, socket-mode, authenticated-welcome and human-path assertions plus exact captured endpoint/root/alias census remain. No production/shared-helper/tier/dev-merge change. No findings. A-21584/A-21588 retain red/intermediate/green epochs and exact local commands/completion excerpts:14-case T2 run precedes comment/docs-only finalization; full lint/typecheck then validate eventual candidate before commit. No post-commit/native birth/signal/tree/raw-log facts inferred. Old b401c4c8/A-21579 stays failed/partial; local14/14 does not establish unexecuted process/Web scopes. C1/C2 remain done/unverified pending exact-head configured full named producer/lifecycle files, final censuses and failure controls. Reviewer no tests/probes/scanners or edits. Hold released; request the Coordinator's new mode-free verify window with this head fixed.

### impl-1676 · 2026-11-19T05:47:51.907Z

Configured run de227e4a-1253-40fd-b3ed-417945f32a98 at reviewed925ffa2ea finished auto/full exit0; A-21596. Hub aggregate7050/7050,0failed/cancelled/skipped. T0,T1,T2,changedT3,Web completed;7changedT3files137passing identities, one base execution/no repetitions; remaining T3 deferred to merge batch. Official timing records confirm all6producer final residue censuses plus lifecycle success/failure census,killed-worker orphan sweep,rejected-close retention and new spoke parent-retention control passed. Provenance Linuxx64/6.8.0-147-generic,Node24.21.0,Neovim0.12.5,droplet,uncached,Chrome Headless Shell1248/156.0.8078.4. Timing budgets and ratchet report-only. Droplet lifetime/cost unavailable in received report/log, not zero. No source changes or new tests; final same-head evidence verdict pending with reviewer.

### rev-36 · 2026-11-19T05:50:44.357Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1676-final-1
commit: 925ffa2ea5a467d1a9e572d65cd323fb998bd43d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged clean/pushed 925ffa2ea5a467d1a9e572d65cd323fb998bd43d, source tree bdfe9656c1bd593f7c41879c5448223495464493. A-21597 records the independent audit of de227e4a-1253-40fd-b3ed-417945f32a98/A-21596, finished/passed, owner exit0. C1: all six named T3 producer files completed and each literal final fixture-file-output census has structured pass (37637/37675/37815/37902/37951/37984); all four corrected /tmp spoke welcomes and its final census also pass. C2: selected native post-file success/failure censuses, rejected-close retention, killed-worker root-local receipt discovery and cleanup/recovery cases pass. The failure worker's expected native exit1/signalnull and each captured path's absence are asserted, not inferred from a headline. New registered-cleanup parent/writer retention control and T2 cancellation/setup/link/failed-owner/placeholder controls pass base plus five distinct load observations each. 7050 base passes = 6905 top-level +145 nested, zero fail/cancel/skip/todo;255 separate load passes. All729 base file envelopes pass:231 T1/436 T2/7 selected T3/55 Web. Selected T3 has137 identities, one base execution/file, no repetitions. T0/T1/T2/selected T3/Web exit0; unchanged fixture-orphans-lifecycle and remaining T3 deferred/unexecuted, T4 unexecuted, no coverage borrowed. Provenance40626 binds runtime tree d6b30b3084c5427070e49b7ddd8d08e26d7cbc52, cachednull, droplet Linuxx64 6.8.0-147-generic Node24.21/Nv0.12.5 and actual isolated HeadlessShell1248/ChromeTesting156.0.8078.4.106.046s is T0 host step only. Budget/ratchet/owner advice and130 lint findings63files remain report-only. Earlier b401c4c8/A-21579 and local/source red epochs remain failed/partial and separately scoped. No findings, new Reviewer runtime or whole-macOS-cover claim. C1/C2 verified; hold released.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-19T07:13:17.258Z

Merge-delta assessment (report-only)
{"reviewed":"925ffa2ea5a467d1a9e572d65cd323fb998bd43d","head":"107a1526c4c25ce8bf00cdec3e81f559cb0116f7","dev":"808a00be1bd05ffeebd32d5a17036409dd025fec","mergeBase":"13cefb4b05e6be0b36a3038761739add149b8777","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/agents/tests.md","docs/agents/tests/hub-test-fixture-socket-lifecycle.test.ts.md","docs/agents/tests/hub-test-fixture-socket-path.test.ts.md","docs/agents/tests/hub-test-host-launch-layout.test.ts.md","docs/agents/tests/hub-test-spoke-unix-edge.test.ts.md","docs/evidence/T-1676-spoke-consumer.md","hub/src/adapters/codex.ts","hub/src/project.ts","hub/test/adapter-native-boundary.test.ts","hub/test/claude-code-adapter.test.ts","hub/test/codex-adapter.test.ts","hub/test/fixture-residue-control.ts","hub/test/fixture-socket-lifecycle.test.ts","hub/test/fixture-socket-path.test.ts","hub/test/harness.ts","hub/test/host-launch-layout.test.ts","hub/test/opencode-adapter.test.ts","hub/test/scenarios/hub-lifecycle.test.ts","hub/test/spoke-unix-edge.test.ts","hub/test/worktree-cli.test.ts","shared/fixture-ownership.ts","shared/fixture-sockets.ts"],"devPaths":[".agents/skills/implement/CHANGES/T-1635-projected-closure.md",".cland/tasks/E-1883-merge-queue-verification-delivery-and.md",".cland/tasks/T-1635-a-landing-that-closes-an-item-can-turn.md",".cland/tasks/T-1652-a-soak-run-on-dev-is-lost-when-dev-moves.md",".cland/tasks/T-1676-test-cleanup-leaves-hub-spoke-fallback.md",".cland/tasks/T-1857-a-long-verify-result-truncates-its.md",".cland/tasks/T-1952-hub-startup-spends-64-s-between-binding.md",".cland/tasks/T-1956-a-batch-whose-members-already-landed-is.md",".cland/tasks/T-1957-cland-run-suites-has-no-retention-49-781.md",".cland/tasks/T-1958-232-released-leases-with-no-spend-entry.md",".cland/tasks/T-1960-artifact-lifecycle-test-ts-never-exits.md",".cland/tasks/T-1979-guardedleasecase-restores-seams-after.md",".cland/tasks/T-1988-retire-the-2026-11-18-duration.md",".cland/tasks/T-1993-the-duration-allowance-printer-names-the.md",".cland/tasks/T-1995-opendatabase-s-cleanup-close-can-throw.md",".cland/tasks/T-1996-suite-soak-component-s-periodic-cover.md",".cland/tasks/T-1997-a-failing-assertion-in-a-file-level.md",".cland/tasks/T-1998-the-per-run-write-census-misses-stream.md",".cland/tasks/T-204-incident-log-lost-suite-runs-and-stalled.md","docs/agents/tests.md","docs/agents/tests/hub-test-executor-droplet-component.test.ts.md","docs/agents/tests/hub-test-executor-lease-index.test.ts.md","docs/agents/tests/hub-test-item-summary-scale.test.ts.md","docs/agents/tests/hub-test-merge-batches.test.ts.md","docs/agents/tests/hub-test-startup-listener-scale.test.ts.md","docs/agents/tests/hub-test-startup-ready-component.test.ts.md","docs/agents/tests/hub-test-suite-accounting.test.ts.md","docs/agents/tests/hub-test-suite-bundle-native.test.ts.md","docs/agents/tests/hub-test-suite-close-component.test.ts.md","docs/agents/tests/hub-test-suite-cover.test.ts.md","docs/agents/tests/hub-test-suite-duration-budget.test.ts.md","docs/agents/tests/hub-test-suite-protocol.test.ts.md","docs/agents/tests/hub-test-suite-soak-component.test.ts.md","docs/agents/tests/hub-test-suite-soak.test.ts.md","docs/agents/tests/index.md","docs/hub/coordinator-subscription-procedure.md","docs/hub/implementation/running.md","docs/hub/running.md","docs/hub/standing-duration-allowance-owners.md","hub/README.md","hub/src/closed-item-wording.ts","hub/src/executor/droplet/droplet.ts","hub/src/executor/droplet/lease.ts","hub/src/executor/droplet/run.ts","hub/src/executor/droplet/spend.ts","hub/src/hub/core.ts","hub/src/hub/daemon.ts","hub/src/hub/demos.ts","hub/src/hub/dispatch.ts","hub/src/hub/merge-batch-territory.ts","hub/src/hub/server.ts","hub/src/hub/soak-quarantine.ts","hub/src/hub/suites.ts","hub/src/merge-closed-item-wording.ts","hub/src/suite-accounting.ts","hub/src/suite-duration-budget.ts","hub/src/suite-durations.ts","hub/src/suite-provenance.ts","hub/src/suite-selection.ts","hub/src/tracker/freshness.ts","hub/src/tracker/tracker.ts","hub/test/durations.json","hub/test/executor-droplet-component.test.ts","hub/test/executor-lease-fixture.ts","hub/test/executor-lease-index.test.ts","hub/test/fake-only-fixture.ts","hub/test/harness.ts","hub/test/item-summary-scale.test.ts","hub/test/lint-closed-item-wording.ts","hub/test/merge-batches.test.ts","hub/test/startup-listener-scale.test.ts","hub/test/startup-ready-component.test.ts","hub/test/suite-accounting.test.ts","hub/test/suite-billing-fixture.ts","hub/test/suite-bundle-native.test.ts","hub/test/suite-case-fixture.ts","hub/test/suite-close-component.test.ts","hub/test/suite-cover.test.ts","hub/test/suite-duration-budget.test.ts","hub/test/suite-protocol.test.ts","hub/test/suite-remote-log.test.ts","hub/test/suite-soak-component.test.ts","hub/test/suite-soak.test.ts","hub/test/suite-summary.test.ts","hub/test/tiers.json","hub/test/tracker-summary.test.ts","hub/test/web-verification-model.test.ts","qa/briefs/E-614.md","web/src/sessions/verification.ts"],"overlap":["docs/agents/tests.md","hub/test/harness.ts"],"dependency":{"status":"known","importers":["hub/src/adapters/codex.ts","hub/test/adapter-native-boundary.test.ts","hub/test/claude-code-adapter.test.ts","hub/test/codex-adapter.test.ts","hub/test/fixture-residue-control.ts","hub/test/fixture-socket-lifecycle.test.ts","hub/test/fixture-socket-path.test.ts","hub/test/harness.ts","hub/test/host-launch-layout.test.ts","hub/test/opencode-adapter.test.ts","hub/test/scenarios/hub-lifecycle.test.ts","hub/test/spoke-unix-edge.test.ts","hub/test/worktree-cli.test.ts"]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1676 · 2026-11-19T07:18:50.491Z

Batch correction census A-21646 now lists every declared T3/T4 fixture consumer after the Coordinator-authorized dev merge (250 T3,17 T4),105 directory-call test files and exact-root/data-subtree/recursive reader dispositions. Copy owners migrated: prepared-project roots and bare companion; fake DigitalOcean snapshot boot/capture; fake Host volume clone/snapshot. Ordinary source/skill/docs/task-only copies are outside runtime-root metadata scope. Managed ignore project.ts/ensureGitignore and init/provision read only layout.gitignore=.cland/.gitignore; nested owner file is not traversed. Red A-21647: exact selected cases at925ffa2ea exit1,8/8fail,0cancel/skip,local macOS Node24.21.0; release showed earlier copied-alias EEXIST,not batch sync-dirty. Merge/cherry-picks applied only by c151a576 authorization; e6f7d7abb includes ordered T-1999 fixes. New owner self-ignore/shared copy filter and Git/clone/copy positive control are implemented; broad native correction run still unexecuted. Static checks pending before freeze/slot request.

### impl-1676 · 2026-11-19T07:38:44.741Z

Fixed head e4c1036b751c957c22e10819c15d825e61930a4a committed/pushed and clean. A-21655 retains exact five-file native command/output: daemon,release,executor-run,executor-safety,fixture-socket-lifecycle;91/91pass,0fail/cancel/skip,tool exit0,local macOS arm64 Node24.21.0,runner428059.630875ms. New actual Gitstatus/add/commit/clone/copy/non-fixture control and all attributed failures pass; native slot released. A-21657 retains final full root typecheck0 and full lint0/0refusals/129report-only findings with completion excerpts/order. A-21646 consumer census covers all250declaredT3+17T4 and listing/copy dispositions; A-21647 preserves red. Other T3 and unchangedT4 unexecuted locally. Per Coordinator4b722b5d: fresh source review first, then Coordinator submits reviewed-head verify all on Linux, replacing normal mode-free verify. No configured receipt at this new head yet.

### rev-36 · 2026-11-19T07:45:32.369Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1676-source-5
commit: e4c1036b751c957c22e10819c15d825e61930a4a
scope: full
findings: [{"severity":"medium","text":"The claimed complete census omits all 22 object-form T3 manifest entries: final tiers.json declares 272 T3+17 T4, while rows contain 250 T3+17 T4. Missing files include original required Claude/Codex/OpenCode/hub-lifecycle producers and other shared fixture consumers. Reconcile both supported tier representations, add every missing filename's current relationship/executed-or-deferred disposition and correct counts/completeness claims; earlier-head passes cannot supply current proof. Full list and independent comparison in A-21660 (rules20/41/43).","file":"docs/evidence/T-1676-native-consumers.json","line":2}]
finding_counts: {"high":0,"medium":1,"low":0}

Source NOT CLEAR at clean pushed e4c1036b751c957c22e10819c15d825e61930a4a/tree174bdf28f9c8237ec736b5d1466b43904ae888ac. A-21660 consolidates one medium census finding and all22 missing names; no other findings. Reviewed authorized merge925+808, ordered patch-identical T-1999 fixes, private atomic owner ignore before runtime publication, shared copy filter at prepared roots/fake images/fake volumes, owned daemon correction/new native Git/copy control and docs. Copy-call search and source review found no additional defect. A-21655 named receipts independently inspected: five T3 files91/91pass, native runner428059.630875ms, local macOSarm64/Node24.21, no browser. A-21657 final precommit source-byte typecheck/lint exit0, zero refusals/129 report-only findings62files; complete raw static logs/per-check trees unavailable. These are not broad T3/configured proof. Earlier integrated76eb3120/A-21632 and localA-21647 remain failed/partial; earlier925 own green remains its own epoch. Other current T3/allT4 unexecuted. Coordinator4b722b5d's future reviewed-head verify-all plan is retained; actual manifest272 T3 supersedes its250 count, subject to recorded execution. C1 failed for incomplete changed-contract consumer census; C2 remains done/unverified, nothing verified. Hold released for inventory/count/disposition correction and fresh narrow source review; keep behavior/assertions fixed. No new native rerun or duplicate verify requested.

Criteria: C1 failed (Current shared storage/copy consumer census omits 22 object-form T3 entries, including original required producer files; current filename/execution dispositions are incomplete.).

### impl-1676 · 2026-11-19T07:54:41.818Z

Source5 inventory correction committed/pushed863db782229e3c398e6fdfb290d234396082555b,clean. Only docs/evidence/T-1676-native-consumers.json changed; behavior/assertions/manifests untouched. A-21661 rebuilt through production readTierAssignments includes272T3+17T4,all22object-form filenames with relationships and deferred dispositions,111directory-call test files with normalized tiers/current lines. A-21662 retains exact reconciliation command/completion:289rows,0missing/duplicate/mismatch;five-file A-21655 remains bound to priore4source,267T3deferred to Coordinator reviewed-head Linux verifyall,17T4unchanged/unexecuted. Closed-item wording lint exit0,0findings;gitdiffcheck0. No native/test rerun or new whole typecheck/full lint; prior A-21657 stays scoped to unchanged behavior at e4. Corrected272count supersedes old250premise in A-21646/A-21655 planning prose/source5 request,without rewriting native91/91 or failed receipts. Fresh narrow source review next.

### rev-36 · 2026-11-19T07:56:07.725Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1676-source-6
commit: 863db782229e3c398e6fdfb290d234396082555b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow source delta CLEAR at clean pushed863db782229e3c398e6fdfb290d234396082555b/tree0adadf895b8c672a2ad692465eedee8e5e3ec035, sole parente4c1036b7. A-21663 resolves source5 M1; only the consumer JSON changed, no behavior/assertion/manifest/runtime source or dev merge. Independent pinned-data comparison:272T3+17T4,289unique rows,0missing/extra/tier mismatch; all22object-form entries restored with raw declaration/current relationship/deferred disposition. Retained reconstruction uses exported production readTierAssignments; no parallel runtime tier parser. A-21661 bytes match committed JSON; existing dependency paths retained.111listing-consumer files unique, normalized tiers agree. Five A-21655 rows remain explicitly at prior e4 behavior head91/91;267T3 deferred and17T4 unexecuted. Superseded250-count/planning wording corrected without rewriting old receipts. A-21662 selected inventory/closed-wording/diff checks exit0 are not runtime or full static reruns. A-21660 remains source basis for unchanged code; prior failed rounds and e4 static/native epochs retained. No findings, Reviewer runtime or source edits. C1/C2 done, neither currently verified; earlier925 C2 verification remains stale. Hold released for Coordinator4b722b5d/65690f4c's single reviewed-head verify-all on Linux, replacing normal verify; no duplicate submission or extra local native rerun. Final same-head named producer/failure/census and actual complete-phase receipts remain pending.

### rev-36 · 2026-11-19T08:07:23.903Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1676-evidence-2
commit: 863db782229e3c398e6fdfb290d234396082555b
scope: evidence
findings: [{"severity":"medium","text":"Committed shared/fake-layout.ts hash remains e548769f... while the changed leaf hashes to1b9a81a3...; exact closure-equality case fails942e5084/A-21671. Frozen closure consumer was missed in source review. Coordinator02fe365a/8aac7b18 attributes to T-1676 and authorizes only regeneration/touched-file hash inspection, closure consumer census entry, single closure test plus full typecheck/lint, fresh narrow source review and then its new verify-all; preserve failed partial evidence and do not relax the assertion.","file":"hub/src/host/agent/closure.json","line":193}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR at unchanged clean863db782229e3c398e6fdfb290d234396082555b; A-21672 settles942e5084/A-21671 finished/failed, ownerall exit1. Literal12082 AssertionError [ERR_ASSERTION]: run node hub/bin/generate-host-agent-closure.ts;12092–12094 show shared/fake-layout.ts committed e548769f72e24860ad61534715bdd60f5d85499fb0363eb8d4f42168c0e3c70e versus current1b9a81a3d19b452f47b29f6049eda369ba207cfa9ed12fed7d567765fab885e9. Structured exact testfail2662,0.184834107s whole-case,filefail2680; this is not a duration advisory. Reviewer missed this frozen consumer in source5/6. Coordinator02fe365a confirms item attribution and narrow repair/check/review/new-run scope; hold released for it.1919base=1918pass/1fail,210separate loadpasses explain owner2129completed/2128pass/1fail; no duplicate finishes. T0exit0/106.415hoststep,T1exit1;231T1files230pass/1fail.436T2/272T3/55Web planned but unexecuted;T4 unexecuted. No current native producer/cleanup outcome inferred; C1/C2 remain done/unverified, no marks changed.129lint62files,budgets/ratchet/tripwires report-only. Provenance12257 exacthead/runtime tree9df488260bf2cd83dce22b848350955e34f4a7d8,cachednull,Linuxx64/Node24.21/Nv0.12.5,droplet c8ams3, browsernull;269976ms/$0.018748333333333332 executor accounting. Earlier925/e4 greens and integrated/local reds retain their epochs. Source6 normalized census remains correct; add frozen closure consumer without replacing old proofs. No Reviewer runtime/generator/edit. Fresh narrow immutable-head source review required before Coordinator's new verify-all; no same-head retry.

### impl-1676 · 2026-11-19T08:19:53.175Z

Bounded closure repair a00443f4ddd098cce660f1382a69dfb4a6e22c0d committed/pushed,clean. Canonical generator changed only shared/fake-layout.ts hash(e548769f→1b9a81a3);all48paths unchanged. No runtime implementation/assertion edits. Frozen closure producer/readers/downstream/historical QA dispositions added to consumer list A-21674. At exact committed head, host-agent-closure.test.ts alone exit0/5pass/0fail-cancel-skip;root typecheck0;full test:lint0/0refusals/129report-only findings. A-21673 retains exact commands,incremental completion objects,scope/unknown limits and commit-before-check ordering. No native/T3 or configured rerun. Failed942e5084 remainsfailed/partial;T2/T3/Web at this head await Coordinator newverifyall after fresh narrow source review. C1/C2 implementationdone,not currentlyverified.

### rev-36 · 2026-11-19T08:21:08.072Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1676-source-7
commit: a00443f4ddd098cce660f1382a69dfb4a6e22c0d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow source delta CLEAR at clean pusheda00443f4ddd098cce660f1382a69dfb4a6e22c0d/treef1584bab6f8c672a2ad692465eedee8e5e3ec035, sole parent863db7822; A-21675. Exactly closure.json plus appended frozenArtifactConsumers entry changed.48closure paths/order unchanged; sole hashreplacement shared/fake-layout.ts e548769f…→1b9a81a3… independently matches current file bytes and authorized touched-file-only correction. Canonical generator exit0 retained inA-21673; no Reviewer generator/run. Previous normalized289-row/111listing census and every existing key unchanged;A-21674 matches committed JSON. Added actual producer/source-byte agentBundle/deep-equal T1/T3restart/delivered verifier/whole-runtime/historical QA consumer dispositions. No runtime/assertion/schema or dev merge changes. A-21673 exact committed-head serial receipts:host-agent-closure T1 5/5pass/exit0 including exact equality and boundary controls;full root typecheck0;full lint0/zero refusals,129report-only findings62files. LocalmacOSarm64/Node24.21,no browser;unknown independent per-check trees/native close and whole static wall times stay unavailable. No findings. Source5/6 basis remains for unchanged code. Failed942e5084/A-21671 staysfailed/partial,T2/T3/Webunexecuted;old e4 native91/91 remains separate. C1/C2 done,not currentlyverified;earlier C2 verification stale. Hold released for Coordinator's new exact-reviewed-head verify-all, replacing normalverify. No duplicate Implementer submission/extra native rerun requested. Final same-head named producer/failure/census and complete-phase evidence pending.
