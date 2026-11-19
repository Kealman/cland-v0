---
id: T-1676
kind: task
title: Test cleanup leaves hub/spoke fallback endpoints, Codex placeholder cx-*.sock files and fixture-owner receipts in TMPDIR
state: open
status: ready
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
updated: 2026-11-19T05:50:44.672Z
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
  - done: impl-1676 · 2026-11-19T05:00:27.978Z
  - verified: rev-36 [reviewer] · run rev-36-1676-final-1 · 2026-11-19T05:50:44.357Z · commit 925ffa2ea5a467d1a9e572d65cd323fb998bd43d
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
