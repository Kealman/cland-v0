---
id: T-1056
kind: task
title: Fold lines for runs of agent messages
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-837
branch: t/T-1056-fold-lines-for-runs-of-agent-messages
created: 2026-10-21T14:04:15.025Z
updated: 2026-10-22T08:33:52.001Z
closed: 2026-10-22T08:33:52.001Z
---

## Summary

Fold a run of agent messages into one hub-built fold line made of facts, sent with the history pages and updated by a delta as the run grows.

## Parent

E-413 (§3.4 "The fold line"; tracer step 4).

## What to build

A run is consecutive agent-to-agent messages with nothing between them that never folds: an ask, a verdict, an answer, or anything to or from the human or an Aide (v0.1 §3.14). The hub gives each run an id and its first message number. Its fold line names the first three sessions and a count of the rest, the number of messages, the latest message's kind and first words, and its age. A model never writes it. The line comes with the history pages and in a delta each time the run grows. `nvim/lua/cland/thread.lua`'s folds define the run boundaries.

## Acceptance criteria

- [x] C1. Four messages between a fake Implementer and a fake Reviewer arrive as one run whose fold line names both sessions, four messages, the latest step and its age (test).
  - done: impl-1056 · 2026-10-22T08:17:56.716Z
  - verified: rev-26 [reviewer] · run rev-20261022-1056-final-2 · 2026-10-22T08:29:09.526Z · commit 35323740a1e649c7561494159f5af834ab4b95da
- [x] C2. A fifth message updates the same run id in a delta, without a history re-read (test).
  - verified: rev-23 [reviewer] · run rev-20261022-1056-final · 2026-10-22T07:10:09.198Z · commit e15737c55b0b7372a1761517cdca8bf0946a03da
  - done: impl-1056 · 2026-10-22T08:17:56.794Z
  - verified: rev-26 [reviewer] · run rev-20261022-1056-final-2 · 2026-10-22T08:29:09.526Z · commit 35323740a1e649c7561494159f5af834ab4b95da
- [x] C3. An ask, a verdict, an answer, or a message to or from the human or an Aide ends a run, and the next agent message starts a new one (test).
  - verified: rev-23 [reviewer] · run rev-20261022-1056-final · 2026-10-22T07:10:09.198Z · commit e15737c55b0b7372a1761517cdca8bf0946a03da
  - done: impl-1056 · 2026-10-22T08:17:56.965Z
  - verified: rev-26 [reviewer] · run rev-20261022-1056-final-2 · 2026-10-22T08:29:09.526Z · commit 35323740a1e649c7561494159f5af834ab4b95da
- [x] C4. A history page that starts mid-run carries that run's id and its full fold line (test).
  - verified: rev-23 [reviewer] · run rev-20261022-1056-final · 2026-10-22T07:10:09.198Z · commit e15737c55b0b7372a1761517cdca8bf0946a03da
  - done: impl-1056 · 2026-10-22T08:17:57.038Z
  - verified: rev-26 [reviewer] · run rev-20261022-1056-final-2 · 2026-10-22T08:29:09.526Z · commit 35323740a1e649c7561494159f5af834ab4b95da
- [x] C5. `hub/README.md` describes runs and fold lines.
  - verified: rev-23 [reviewer] · run rev-20261022-1056-source-2 · 2026-10-22T06:59:34.374Z · commit e15737c55b0b7372a1761517cdca8bf0946a03da
  - verified: rev-23 [reviewer] · run rev-20261022-1056-final · 2026-10-22T07:10:09.198Z · commit e15737c55b0b7372a1761517cdca8bf0946a03da
  - verified: rev-26 [reviewer] · run rev-20261022-1056-source-3 · 2026-10-22T07:29:18.071Z · commit 4176f40d140331375fe06563af0d652cdcace94a
  - done: impl-1056 · 2026-10-22T08:17:57.115Z
  - verified: rev-26 [reviewer] · run rev-20261022-1056-source-4 · 2026-10-22T08:19:01.290Z · commit 35323740a1e649c7561494159f5af834ab4b95da
  - verified: rev-26 [reviewer] · run rev-20261022-1056-final-2 · 2026-10-22T08:29:09.526Z · commit 35323740a1e649c7561494159f5af834ab4b95da

## Comments

### impl-1056 · 2026-10-22T06:42:07.048Z

TDD at the brief's agreed T2 history/live-frame seams: C1 red was `one full run accompanies history: undefined !== 1`; C2 red was `the message delta carries the updated full run` (undefined); C3 red was a verdict incorrectly retaining a run id. Current four criterion tests pass locally on Darwin arm64 (~0.73 s file): complete factual line, same-id fifth-message delta, ask/verdict/answer/human/Aide boundaries plus midnight, and numeric/message-id mid-run pages with full metadata including first-three/+N. C4 passes using the existing full-run projection; no new reread behavior was needed. Persistence/legacy/byte-bound checks and docs are in progress; this is targeted development evidence, not queued verification.

### rev-23 · 2026-10-22T06:53:22.937Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1056-source
commit: a64440de3c07d775c60ca468950da22eeef844de
scope: full
findings: [{"severity":"medium","text":"M1 (Spec/C3): Retention deletes every run member/fact row for an affected topic, then rebuilds eligibility using today's roleOf(recipient) at1495. A surviving message sent to an Aide therefore becomes foldable if that recipient later changes role and an unrelated older message is pruned; previously separate runs merge and the Aide boundary receives runId. The current reopen/retention test deletes the Aide-boundary message too, so misses this. Preserve role-at-send/eligibility facts for retained messages while rebuilding run identities, and test pruning only an older unrelated row with the Aide boundary retained after its role changes.","file":"hub/src/hub/store.ts","line":1476},{"severity":"medium","text":"M2 (Spec/factual fold line): assignVerifierRequest rewrites a queued review/QA report's to_json from the role name to the selected session, but the new run facts were already appended at record and are never refreshed. Later #emitMessage(assigned) calls threadRuns, whose update only scans seq greater than its watermark, so both that delta and history can show message.to=['rev-23'] with participants/foldLine still naming 'reviewer'. Keep derived run participants synchronized with this existing durable recipient mutation (or apply a consistent never-fold rule), and add queued-verifier assignment coverage asserting the emitted message and full run agree without changing run identity or counts incorrectly.","file":"hub/src/hub/store.ts","line":1054}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear; fixed base689b6f95, A-8984. Spec M1 retention clears stored membership then reclassifies retained Aide recipients using current roles; test currently prunes the boundary too. M2 queued verifier assignment rewrites persisted recipients without updating derived run names; assigned message delta/history can contradict foldLine. No separate standards/lows; ordinary facts, mid-run byte pages, append/rollback/legacy paths otherwise sound. C3 failed,all C1–C5 unverified pending correction and source re-review before mode-free verify. A-8977 local summary supporting only,no independently inspected suite/raw runtime proof; no Reviewer test execution. After-stage QA separate.

Criteria: C3 failed (Pruning an unrelated older row rebuilds a retained Aide boundary with current recipient roles and can fold it (M1; A-8984).).

### impl-1056 · 2026-10-22T06:58:07.188Z

Fixed source review A-8984 M1/M2 at e15737c55b0b7372a1761517cdca8bf0946a03da, pushed; no dev merge. M1 regression now retains former-Aide boundary while pruning an older unrelated row, then reopens (red actual run:first, expected undefined). Per-message run_eligible survives derived retention rebuild. M2 real queued-review assignment regression failed stale participants [impl,reviewer,rev] versus [impl,rev]; assignment now recomposes only the affected run, preserving id/firstSeq/count/latest tail. T2 file 5/5 at 0.831s; T1 3/3 at 0.316s; existing verifier-routing 11/11 at 1.646s locally on Darwin arm64. Root typecheck and static/lint pass; existing 132 findings/59 files remain report-only, 0 refusals. A-8984 criteria failure addressed; fresh source review requested before verification.

### rev-23 · 2026-10-22T06:59:34.374Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1056-source-2
commit: e15737c55b0b7372a1761517cdca8bf0946a03da
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-8989 re-audits M1/M2 over A-8984/fixed689b6f95. Per-message eligibility survives retention; queued assignment refreshes only affected run facts from durable recipients, preserving id/count/tail. Corrected Store retention/reopen and public queued-assignment tests cover both exact gaps. A-8987 captured M2 red/T2 5/5/T1 3/3 local green inspected; M1 red excerpt labelled partial, verifier/typecheck/lint summarized only. No findings; C5 docs source-verified. C1–C4 pending fresh exact-head configured mode-free receipt, no Linux/load/T3/T4/QA pass inferred. After-stage QA separate.

Criteria: C5 verified.

### impl-1056 · 2026-10-22T07:09:46.513Z

Green exact-head configured run 17ba1a5f-3e25-4b73-8fb6-6eb4141b7eab (A-8996) at e15737c55b0b7372a1761517cdca8bf0946a03da. Linux x64 6.8.0-142-generic, c-8 lon1 droplet, Node v24.21.0/Neovim v0.12.5, lifetime 514s/$0.0357. T1 exit0 (57s), fallback all T2 across hub/Neovim exit0 (321s), Web exit0 (45s); base 2417/2417, no failures/cancellations/skips. Original log confirms all eight owned run identities 5/5 load receipts. Host gate c9b9416c reused, not repeated. Existing lint132/59, generic tier/duration/ratchet diagnostics are report-only; enforced owned-new-identity/load gates pass without new allowance. Missing duration baselines are projections, not timings. T3/T4 remain deferred to periodic/integrated/close occasions, absent from task/batch tiers. Awaiting Reviewer's final same-head settlement; cover-quiet obeyed, head unchanged, claim retained, no merge.

### rev-23 · 2026-10-22T07:10:09.198Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1056-final
commit: e15737c55b0b7372a1761517cdca8bf0946a03da
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-8997 audits original A-8996/17ba1a5f against A-8989 source. Census2417ordinary tests/368files+40scoped load tests/files pass,zero fail/cancel/skip. All8 owned identities have ordinary+5distinct passing load ids+explicit5/5; C1–C4 and M1/M2 proved,max load0.586348s. C5 source docs current; allC1–C5 verified,no findings. Linux c-8lon1,T1/all hub+NeovimT2/actualWeb exit0; hostc9b9416c reused,lint/duration/ratchet report-only,13missing baselines,Web40.79s no enforcing40s-budget pass. No T3/T4/stage/QA claim; retain claim under Coordinator freeze.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1056 · 2026-10-22T07:27:40.664Z

Under Coordinator decision 132ce777, merged origin/dev 3dfc2737 at pushed merge head 4176f40d140331375fe06563af0d652cdcace94a. Only manual conflict was store.ts type import; retained both ThreadRun and AskOutcome. No own source redesign. T-1057 outcomes, T-1054 marks and runs now coexist. Local Darwin arm64 targeted tests at merge head: thread-runs5/5 (0.956s), thread-runs-store3/3 (0.338s), ask-outcomes3/3 (0.390s), human-marks2/2 (0.398s), store28/28 (0.477s), total41/41. Root typecheck/build/static/lint passed, existing132 report-only findings/59files,0refusals. A-9011 retains raw targeted stdout. Requesting delta source review before a new mode-free configured run; A-8996 is historical at previous head.

### rev-26 · 2026-10-22T07:29:18.071Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1056-source-3
commit: 4176f40d140331375fe06563af0d652cdcace94a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear; A-9012 incorporates rev-23 A-8989/A-8997 against first parente15737c5 and Coordinator132ce777-authorized dev3dfc2737. Sole manual combined hunk preserves both ThreadRun/AskOutcome type imports. Ask outcome/card/read paths and unchanged run classification/projection preserve each other; marks use separate meta/model delta. Retained eligibility/assignment fixes, wire types/conformance, README/test guidance and manifests retained; C5 docs reverified. Standards0;Spec0. A-9011 localDarwinarm64 targeted41/41 is supporting only; check/build/static/lint success summarized, report-only132/59/0refusals. Historical A-8996 is stale for this merge; C1–C4 await fresh mode-free configured receipt at unchanged4176f40d. No T3/T4/integrated/stageQA claim.

Criteria: C5 verified.

### impl-1056 · 2026-10-22T07:39:37.626Z

Run806b26c3 at4176f40d failed/interrupted (A-9018): Linux droplet T1 exit0, fallback allT2 exit0, Web exit1; base2427pass/2fail. Actual palette failure: `Error: PageDown reveals open-other: not within 6000 ms` at web/test/palette.test.ts:212,1024×600 subtest. Additional enforced new-identity duration gate: Items help…8.595s>5s. Reported S Bugs/shared-defect candidate to lead T-1056, because this is merged T-1095 test code. Holding diagnosis and head unchanged until Coordinator posts shared fix/disposition; no green receipt or ready claim at4176f40d.

### rev-26 · 2026-10-22T07:40:25.278Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1056-evidence-1
commit: 4176f40d140331375fe06563af0d652cdcace94a
scope: evidence
findings: [{"severity":"medium","text":"Configured run806b26c3/A-9018 exits1: `PageDown reveals open-other: not within 6000 ms` at1024×600, plus enforced parent8.595s>5s. Actual Web failure blocks final acceptance; shared-defect candidate from merged dev, not a diagnosed run-logic defect.","file":"web/test/palette.test.ts","line":212}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-9020 audits original A-9018 at unchanged4176f40d. Actual Web failure quoted in findings; T1/allT2 exit0, Webexit1. Ordinary2427pass/2fail/0skip; interruption2467pass/2fail includesload, not ordinary. All8 owned run identities have base+5/5 passes,max0.585644s, so no new thread-run source finding. Linuxx64 c8lon1 droplet535s/$0.0371; generic diagnostics report-only, 5s new-identity enforcement and assertion are failures. No T3/T4/full-lifecycle/stageQA pass. Bugs/S shared candidate goes to lead T-1056 for Coordinator disposition; no autonomous retry/dev merge/fix. Earlier green e15737c5 historical; sourceclear not final-ready.

Criteria: C1 failed (Required configured receipt806b26c3 at4176f40d failed Web viewport assertion and enforced identity duration gate; owned C1/run assertions passed but final gate is unsatisfied.).

### impl-1056 · 2026-10-22T08:17:56.655Z

Applied exactly Coordinator-posted shared fix e2233f5e as pushed35323740a1e649c7561494159f5af834ab4b95da, no dev merge/other changes. Patch-id1a8fd0fa matches original exactly; only palette test +7.5s datedE-880 allowance. Root typecheck/static/lint pass locally; no new production source edits. Targeted palette attempt unavailable before assertions: actual `Error: playwright-core is not installed; run npm install` from fixture setup,2setup failures, no local browser pass. Requesting delta review before prepared Linux mode-free verification.

### rev-26 · 2026-10-22T08:19:01.290Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1056-source-4
commit: 35323740a1e649c7561494159f5af834ab4b95da
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared-fix delta source clear; A-9048 independently matches donor e2233f5e/pick patch-id1a8fd0fa under Coordinator d4096542. Only authorized palette test/duration files change. Native scrollend observer precedes keys, bounded completion preserves exact all32-row PageDown-only traversal, End last-row/Home top and viewport assertions. Matching7.5s identity allowance datedOct22–29,E-880,~1.5x measured Linux4.979509666s; no production/run-test/doc changes. C5 source reverified; C1–C4 await fresh mode-free configured execution. A-9047 local browser attempt unavailable: actual missing playwright-core setup error, no assertions/pass; summarized typecheck/static/lint success not a configured receipt. Donor passes not this-head proof. A-9018 remains failed; no runtime exception/T3/T4/full-lifecycle/stageQA claim. Standards0;Spec0.

Criteria: C5 verified.

### impl-1056 · 2026-10-22T08:28:47.896Z

Green exact-head configured run d53099cb-8d25-46e8-a46a-45ef589d8834 (A-9054) at35323740a1e649c7561494159f5af834ab4b95da. Linux x64 6.8.0-142-generic c-8 lon1 droplet, Nodev24.21.0/Neovimv0.12.5, lifetime508s/$0.0353. T1 exit0(54s), fallback allhub/NeovimT2 exit0(329s), actualWeb exit0(43s), base2429/2429/no failure/cancellation/skip. Original log confirms all8 owned run identities5/5 load passes; no owned tier-mismatch line. Shared fixed palette identity passed at4.545798689s under7.5s dated allowance (not a4sWebtier budget pass). Hostgate98805da1 reused, not repeated; generic lint132/59,tier/duration/ratchet diagnostics report-only and5missing baseline projections retained. T3/T4/stageQA not claimed. Head unchanged; awaiting Reviewer's final evidence settlement, claim retained.

### rev-26 · 2026-10-22T08:29:09.526Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1056-final-2
commit: 35323740a1e649c7561494159f5af834ab4b95da
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-9055 audits original A-9054/d53099cb at source-clear35323740.2429ordinary tests/371files+40scopedload tests/files pass,zero fail/cancel/skip. All8 run identities have base+5/5 explicit load proofs(max0.502511s),establishing C1–C4 and prior retention/assignment fixes; C5 source docs current. Former blocker palette now passes both viewport cases and parent4.545799s within posted7.5s allowance; no Web load claim. T1/all hub+NeovimT2/actualWeb exit0,Linuxc8lon1 Node24.21/Neovim0.12.5,workers2(Web4),508s/$0.0353. Host98805da1 reused not repeated; genericlint132/59,0refusals,tier/duration/ratchet report-only,5missing baselines retained. A-9018 stays historical failed; local missing-playwright setup not a pass. No T3/T4/full-lifecycle/stageQA claim. Standards0;Spec0.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-22T08:33:52.001Z

Merged 3f13960acdc277ffe2a567fc728fe3a6bb62c9a7 onto dev.
