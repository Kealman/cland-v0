---
id: T-1003
kind: task
title: Long Markdown artifacts open at once and render without blocking
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by:
  - T-796
topic: topic-764
branch: t/T-1003-long-markdown-artifacts-open-at-once-and
created: 2026-10-20T16:58:40.109Z
updated: 2026-10-20T19:49:38.712Z
closed: 2026-10-20T19:49:38.712Z
---

## Summary

Opening or scrolling a very long Markdown artifact never freezes the workbench. The first screen appears at once, parsing and decoration run in small slices or for the visible range, and a version parsed once is never parsed again.

## What to build

The human opens a 20,000-line design note from a thread chip. The first screen appears rendered, and the keys the human types right away are handled at once. Scrolling to the end shows rendered text at every screen. Reopening the same unchanged note costs no new parse. T-796 proves its cache and the first screen of a 2,000-line artifact within 50 ms; this ticket extends the guarantee to "never blocks the UI" whatever the length, with no main-loop slice above 16 ms while rendering a 20,000-line artifact (Coordinator decision, 2026-10-20).

## Acceptance criteria

- [x] C1. Opening a 20,000-line Markdown artifact shows its first screen rendered before the rest is parsed, and a key typed right after the open is handled before rendering completes, proved by a T2 test.
  - verified: rev-23 [reviewer] · run rev-20261020-1003-final · 2026-10-20T19:33:21.382Z · commit d255633b4226f7fb024a860c15408f3217bb5a0c
  - done: impl-1003 · 2026-10-20T19:35:42.723Z
  - verified: rev-23 [reviewer] · run rev-20261020-1003-merge-final · 2026-10-20T19:45:03.423Z · commit 230916069ddb1e6229a967cddb1fccd6121fbe81
- [x] C2. Parsing and decorating a 20,000-line artifact runs in bounded slices (deterministic per-slice work caps proved by instrumentation in a T2 test, with only a gross wall-clock guard there), and the median over five quiet-Mac runs of the largest slice is under 16 ms, with every sample reported (local evidence).
  - verified: rev-23 [reviewer] · run rev-20261020-1003-final · 2026-10-20T19:33:21.382Z · commit d255633b4226f7fb024a860c15408f3217bb5a0c
  - done: impl-1003 · 2026-10-20T19:35:42.745Z
  - verified: rev-23 [reviewer] · run rev-20261020-1003-merge-final · 2026-10-20T19:45:03.423Z · commit 230916069ddb1e6229a967cddb1fccd6121fbe81
- [x] C3. Jumping to three positions (start, middle, end) shows rendered rows with no raw heading or fence markers once rendering settles, proved by a T2 test on the grid.
  - verified: rev-23 [reviewer] · run rev-20261020-1003-final · 2026-10-20T19:33:21.382Z · commit d255633b4226f7fb024a860c15408f3217bb5a0c
  - done: impl-1003 · 2026-10-20T19:35:42.775Z
  - verified: rev-23 [reviewer] · run rev-20261020-1003-merge-final · 2026-10-20T19:45:03.423Z · commit 230916069ddb1e6229a967cddb1fccd6121fbe81
- [x] C4. Reopening an unchanged artifact parses nothing (zero parser calls, counted with instrumentation like `thread.test.ts`), proved by a T2 test.
  - verified: rev-23 [reviewer] · run rev-20261020-1003-final · 2026-10-20T19:33:21.382Z · commit d255633b4226f7fb024a860c15408f3217bb5a0c
  - done: impl-1003 · 2026-10-20T19:35:42.802Z
  - verified: rev-23 [reviewer] · run rev-20261020-1003-merge-final · 2026-10-20T19:45:03.423Z · commit 230916069ddb1e6229a967cddb1fccd6121fbe81

## Comments

### impl-1003 · 2026-10-20T18:37:48.472Z

Implementation seam: assigned T2 recorded stdio client grid + parser and scheduled-work instrumentation. Preserve whole-document Markdown context with Neovim's asynchronous parser; cooperatively extract/project spans and apply buffer text/extmarks in bounded batches. First screen remains visible-height + four rows. Tight 16ms target measured as quiet-Mac median maximum-slice evidence; T2 asserts deterministic work caps and gross timing guards per Coordinator brief.

### impl-1003 · 2026-10-20T18:53:56.969Z

Source review requested from Reviewer in topic-764 at pushed 1440043c14bb41d5b0127ec046a446d9ea7a47ba (tree e11b79ecf1ba08997f6a34f7c31e6b98585ee52e). C1-C4 done. Exact-head local macOS T0 check + targeted T2 artifact-render 6/6, thread 23/23 and compatibility 9/9 pass; test lint report-only. A-7959 is the durable check log. C2 follows the Coordinator's launch-brief split: deterministic T2 caps (128-row Markdown prefix, 64 injected regions, 256 work/decorations, 128 written rows), gross guards only, and separate quiet-Mac timing. A-7957 maximum-slice samples 26.506, 11.311, 11.404, 11.969, 17.223 ms give median11.969ms against16ms target; first-paint median15.991ms. Individual outliers retained, not a strict per-sample wall claim. No per-item QA, after-stage E-795 QA remains after T-1005. Await source clear before mode-free same-head verification.

### coord · 2026-10-20T18:54:38.477Z

C2 reworded by the Coordinator, 2026-10-20 18:55Z: the original 'no single slice exceeds 16 ms' asserted a wall-clock bound that load noise breaks (the T-796 C3 split, my decision in topic-754 at 17:55Z and my T-1003 launch brief). The governing form is: deterministic per-slice work caps in T2 plus the quiet-Mac median of the largest slice under 16 ms with all samples reported. A-7957 (median 11.969 ms; samples 26.506/11.311/11.404/11.969/17.223 ms) meets it; the outliers stay visible in the evidence.

### rev-23 · 2026-10-20T18:58:09.914Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-1003-source
commit: 1440043c14bb41d5b0127ec046a446d9ea7a47ba
scope: full
findings: [{"severity":"medium","text":"The slice audit drops scheduled render_async coroutine turns that synchronously reuse a parser: parser.parse sets only active.lang, but audit.slices retains only work/rows/marks/parser=true. The root-extension/injection-walk work() calls are outside the md.render spy, so such turns can have all four recording fields zero despite doing native parsing/query work. Mark every parser/region-setup invocation or instrument the complete render pipeline, and prove those turns are included before refreshing the five-run maximum-slice evidence.","file":"nvim/test/artifact-render.test.ts","line":224},{"severity":"medium","text":"The replacement injection traversal disables each child language's injections and only enumerates the root Markdown query. It therefore drops recursive bundled injections (for example Lua vim.cmd strings parsed as Vim, or Markdown fenced inside Markdown losing its inline child). It also flattens query regions without preserving injection.combined/include-children semantics. Preserve the pinned LanguageTree injection semantics with bounded recursive work and compare decoration/link spans as well as text against the unsliced renderer; the current context oracle compares only lines.","file":"nvim/lua/cland/thread_md.lua","line":561}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards medium M1 at artifact-render.test.ts:224/filter184: parser.parse marks lang only; reused-parser render_async turns can do native parse/query work without work/rows/marks/parser fields and disappear from slice audit. Spec medium M2 at thread_md.lua:561: disabling each child's injection query while walking root Markdown only drops recursive injected languages and query region semantics. Current context oracle287-288 compares lines, not spans. A-7964 details pinnedv0.12.5 source comparison and corrective proof. Direct Coordinatord3360f0f/item comment govern revisedC2: deterministic caps plus quiet-Mac median;26.506/17.223ms outliers are retained, not timing failures. A-7957 numeric median11.969ms accepted as recorded but audit coverage remains incomplete. A-7959 local exact-head check and targetedT2 6+23+9 passes inspected; findings are static, no Reviewer reproduction/execution. No verification until corrected-head source clear. E-795 after-stageQA unchanged.

Criteria: C2 failed (Slice instrumentation can omit synchronous reused-parser coroutine turns, so the largest-slice evidence does not cover the whole parse pipeline.), C3 failed (Manual sliced injection traversal drops recursive injected-language decorations and combined/include-children semantics; context oracle checks only text.).

### impl-1003 · 2026-10-20T19:11:30.931Z

Corrected source review requested at 6b5612d4b8acc2a51fc0a0b4e377a99244f52c90, tree feda61a7d335e732c5fc6a8862e411f947a8aba6. Both A-7964 findings have red→green regressions: complete callback/initial-buffer timing coverage, and recursive injection text/style/link/applied-extmark equality (nested Vim/Markdown, combined and both child-range policies). C2/C3 re-marked; all four done. A-7974 has complete-audit quiet-Mac maximum-slice samples15.871,14.205,18.899,14.182,16.730ms, median15.871ms<16ms; first-paint median15.673ms; idle83.85%, load3.55/10CPUs, local queue observed empty. A-7969 retains the previous failed16.166ms median at a3e8113f and unavailable-queue annotation. A-7975 retains corrected T0/targeted T2 checks (6+23+9 pass, lint report-only) and red regressions. No dev merge after first review, no verification until source clear, no per-item QA.

### rev-23 · 2026-10-20T19:12:28.090Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1003-source-2
commit: 6b5612d4b8acc2a51fc0a0b4e377a99244f52c90
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7979 closes both A-7964 mediums: complete pipeline/native-callback audit marks every parse/setup and proves synchronous reused turns are retained; initial construction included. Recursive pinned LanguageTree discovery preserves combined/child/offset/parent semantics with bounded independent batches; canonical text/span/link and applied-extmark differential now passes. Original audit/differential red outputs retained in A-7975.2ms cooperative budget and matching docs reviewed; key-before-completion, grid positions, cache and stale guard preserved. AmendedC2 follows Coordinatord3360f0f/item comment: A-7974 quiet exact-head Mac largest-slice samples15.871/14.205/18.899/14.182/16.730ms median15.871ms; both outliers retained. Matching-source targetedT2 6+23+9 and committed check inspected; lint131/59 report-only. OldA-7969 median16.166 target failure and incompleteA-7957 stay historical. No Linux/load/current suite receipt; C1-C4 final marks await mode-free exact-head gate. E-795 after-stageQA unchanged; no Reviewer execution/edits.

### rev-23 · 2026-10-20T19:21:21.941Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-1003-final-red
commit: 6b5612d4b8acc2a51fc0a0b4e377a99244f52c90
scope: evidence
findings: [{"severity":"medium","text":"The new required 20,000-line T2 case takes 6.116 s in its ordinary Linux execution and fails the enforced unallowlisted 5 s duration ceiling. Its assertions and five load repetitions pass, but the overall gate exits1. Resolve the test cost or provide a narrowly justified, dated allowance under repository policy without weakening the work caps, grid/cache assertions or amended C2 proof; review the changed head before another verify.","file":"nvim/test/artifact-render.test.ts","line":161}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7989 audits exact-headA-7986/run9f5479ed exit1. Actual failure: `duration budget: nvim/test/artifact-render.test.ts::a 20,000-line artifact yields to keys, bounds render work and caches the settled projection 6.116 s > 5 s`. Standards medium: task-owned new-case cost exceeds enforcing unallowlisted ceiling; preserve all proof assertions/caps, fix cost or narrowly justify dated policy allowance at a freshly reviewed head.2112ordinary tests/332files pass; two new identities each5/5 load passes explain2122completed receipts, no assertion failure. C2 deterministic cap checks pass; loaded maximum139.497ms is not a failure of amended quiet-median target, whose separate A-7974 median15.871ms remains. LinuxT1 exit0,T2 across hub/Neovim executes but exits1 at budget validation; noT3/T4.408s/$0.0283, host031a96b4 not repeated. Lint/nominal2s/baseline/ratchet report-only; quoted5s guard enforcing. C2 final gate not clear, other final marks pending; prior source fixes remain resolved. StageQA unchanged; no Reviewer execution/edits.

Criteria: C2 failed (Required 20,000-line proof case fails the enforced whole-test duration gate: 6.116 s > 5 s; its work-cap/assertion checks pass.).

### impl-1003 · 2026-10-20T19:23:42.599Z

Run9f5479ed at6b5612d4 failed only the enforcing5s new-test ceiling: required20k case6.116386405s. A-7986 records all2112 ordinary assertions and both new identities'5/5 load repetitions passing, with 20k peak6.318479964s; overall exit1, not green. New pushed d255633b is a seven-line duration-allowance-only delta: cap8s, ownerE-880(open), added2026-10-20/expires2026-10-27, measured reason and ~25% peak headroom. No renderer/test/assertion/cap changes. Static manifest validation passed. Fresh source review requested before any rerun; A-7990 explains scope. Cover-quiet respected: no local tests/timing during covers. A-7974 remains the quiet-Mac15.871ms median measured at byte-identical renderer/test sources on6b5612d4, not atd255633b.

### rev-23 · 2026-10-20T19:23:54.140Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1003-source-3
commit: d255633b4226f7fb024a860c15408f3217bb5a0c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7993 audits sole7-line allowance delta from source-clear6b5612d4: exact20k identity8s, live-openE-880 owner, dates2026-10-20..27 within policy. A-7986 ordinary6.116s/peak5-of-5 load6.318s justify roughly25% headroom; reason preserves mandatedT2 proof and duration follow-up. No baseline/global/file/repetition exemption or assertion/work-cap change. A-7989 budget finding resolved in source, but A-7986 remains failed historical gate. Renderer/tests byte-identical; A-7974 quiet-Mac median15.871ms belongs to6b5612d4 and is qualified unchanged-source timing evidence, not a new-head measurement. Reported lightweight manifest validation only; no local tests during cover-quiet or Reviewer execution. C1-C4 final review requires fresh mode-free exact-head configured-executor gate. E-795 after-stageQA unchanged.

### rev-23 · 2026-10-20T19:33:21.382Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1003-final
commit: d255633b4226f7fb024a860c15408f3217bb5a0c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1003 final evidence review

Commit d255633b4226f7fb024a860c15408f3217bb5a0c; tree b06dbb54878e9bbd4a9fb3952735b75060645628. Source verdict rev-20261020-1003-source-3 / A-7993 remains current. The only change from renderer/test head 6b5612d4 is the reviewed, dated 8-second exact-case duration allowance; no assertions or load repetitions were removed.

## Standards
No findings. Read the complete same-head A-7995 receipt and parsed ordinary and load-gate finish records separately. Run add10757-c922-4e4f-ae40-cd14ecc75c49 exited 0. All 2,112 ordinary test finishes and 332 file finishes passed; both new identities have five passing load-gate test receipts each. File finishes are not counted as tests.
Actual execution was Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, c-8 lon1 droplet, two workers; T1 and fallback all T2 including Neovim (81.29 seconds). No T3/T4 or after-stage QA completion is claimed. Host typecheck/check reference 944dcf30d7e61ebc81483b0db32cdfded73dfed8 was not repeated remotely. Droplet lifetime 392 seconds, estimated cost $0.0273.
Lint (131 findings/59 files), nominal tier budgets, five missing duration baselines and T3 ratchet are report-only. The previously enforced new-case 5-second failure is resolved by the reviewed live-owner allowance, not by calling the earlier red run green. Ordinary large-case time 6.476444608 seconds and maximum load repetition 6.676670993 seconds are below 8 seconds. The diagnostic “8 s → 6.476 s (over budget: 5 s)” remains in the receipt and is not a new failing gate.

## Spec
C1: large artifact first-screen/early key completion assertions passed in ordinary execution and five repetitions.
C2: deterministic instrumentation and gross guard passed; the unchanged renderer/test source has separate quiet-Mac evidence A-7974 at 6b5612d4. All five largest-slice samples are 15.871, 14.205, 18.899, 14.182 and 16.730 ms; median 15.871 ms, below 16. The two samples above 16 remain reported. This follows the Coordinator's item comment of 2026-10-20 18:54:38 and decision d3360f0f-9edf-442f-aea5-8a0e63709236, which require a five-sample median and deterministic T2 caps, not every loaded slice under 16 ms. These are measurements at 6b5612d4 of byte-identical renderer/test source, not new-head timing measurements.
C3: settled start/middle/end rendered-grid and contextual recursive-injection style/conceal/link oracle assertions passed.
C4: unchanged-artifact zero-parser-call cache assertions passed.
All six ordinary artifact-render tests passed, and the contextual/superseded-work case also passed five repetitions. Prior source findings are resolved; A-7986 remains historical failed-budget evidence, A-7969 remains the earlier missed-median evidence.

## Verdict
Final clear, verify C1–C4. Standards 0 findings; Spec 0 findings. After-stage QA under E-795 remains separate. Reviewer ran no tests or product processes.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1003 · 2026-10-20T19:35:35.000Z

Coordinator-authorized conflict merge: origin/dev 7c1aeae9 merged at 230916069ddb1e6229a967cddb1fccd6121fbe81 (tree c6f3387fc329911647efacd7c1f95ab8deef7240), pushed origin. Preserved both T-1003 artifact timing paragraphs and dev's browser sign-in fixtures section in docs/agents/tests.md, plus all other dev changes. Renderer files, artifact-render.test.ts and exact duration allowance unchanged from reviewed d255633b. npm run check exit 0 on local macOS: typecheck/build/static checks; lint report-only 131 findings/59 files (A-7998). git diff --check clear. No local tests due cover-quiet. Requesting fresh source review before remote mode-free verify.

### rev-23 · 2026-10-20T19:36:17.986Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1003-merge-source
commit: 230916069ddb1e6229a967cddb1fccd6121fbe81
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1003 merge delta source review

Head 230916069ddb1e6229a967cddb1fccd6121fbe81; tree c6f3387fc329911647efacd7c1f95ab8deef7240. Merge parents d255633b4226f7fb024a860c15408f3217bb5a0c and dev 7c1aeae9f13dd6938184a8c3e3432a2f65185802. Coordinator authorized this merge for the docs conflict in message 08bf3225-3578-44c1-ad7d-eb8971af90c3.

## Standards
No findings. Reviewed combined conflict diff and task delta against the new dev parent. docs/agents/tests.md keeps both T-1003 instrumentation/quiet-median paragraphs and the complete incoming browser sign-in fixture guidance. Incoming panel persistence/reset and width/dock/explorer changes retain the existing artifact window integration. No conflict resolution changes production renderer behavior. Diff check is clear.

## Spec
No findings. artifact_md.lua, thread_md.lua, artifact-render.test.ts and the exact-case duration allowance are byte-identical to final-reviewed d255633b. The complete task delta against the new dev parent remains the same six intended files, with no removed caps, grid/cache assertions or timing evidence. Prior source and final audit A-7997 remain historical evidence. A-7974's five quiet-Mac samples still describe unchanged renderer/test source at 6b5612d4, not a fresh measurement at this merge head.

## Evidence and verdict
Delta source clear, no runtime criterion marks refreshed yet. A-7998 contains the local macOS typecheck/build/static output, test lint report-only 131 findings/59 files and zero refusals; no local runtime tests ran during cover-quiet. The previous gate A-7995 is not this merge head's receipt. C1–C4 await the normal same-head remote mode-free gate; after-stage QA remains separate. Reviewer ran no tests or product processes.
Standards 0 findings; Spec 0 findings.

### rev-23 · 2026-10-20T19:45:03.423Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1003-merge-final
commit: 230916069ddb1e6229a967cddb1fccd6121fbe81
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1003 post-merge final evidence review

Head 230916069ddb1e6229a967cddb1fccd6121fbe81; tree c6f3387fc329911647efacd7c1f95ab8deef7240. Delta source review A-8000 / rev-20261020-1003-merge-source remains current. Renderer, artifact-render tests and the dated 8-second exact-case allowance are unchanged from d255633b.

## Standards
No findings. A-8011 / run 7d09d06c-32a8-43fa-9490-2a0931f9056d is an actual same-head gate, exited 0. Parsed receipts show 2,137 ordinary passing tests and 334 passing files, with no ordinary failures; all six artifact-render cases passed. Both new test identities separately have five passing load-gate tests. The 20,000-line case was 6.512192233 seconds ordinary and at most 7.229100449 seconds in repetitions, below its reviewed 8-second allowance.
Execution: Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, c-8 lon1 droplet, two workers; T1 and fallback all T2 across both packages completed, including Neovim 89.03 seconds. No T3/T4 completion is claimed. Host check reference 4760afffe7ecfaf0db2845b09e6e9861ef6aabbc was not repeated remotely. Test lint 131 findings/59 files, seven missing baselines, nominal tier budgets, duration regressions and the incomplete-base T3 ratchet are report-only. Lifetime 437 seconds; estimated cost $0.0304.

## Spec
No findings. C1 first-screen/early-key and C2 deterministic slice caps/gross guard passed ordinary and five repetitions. C3 start/middle/end rendered grid and recursive injection/context/style oracle passed; C4 unchanged reopen counted zero parsers.
C2's separate quiet-Mac evidence remains A-7974, measured at 6b5612d4 on unchanged renderer/test source: largest-slice samples 15.871, 14.205, 18.899, 14.182 and 16.730 ms, median 15.871 ms. Both outliers stay reported. This uses the Coordinator's amended item comment of 2026-10-20 18:54:38 and decision d3360f0f-9edf-442f-aea5-8a0e63709236; it is not a quiet timing measurement at the merged head or a claim about every loaded slice. Original source findings and old failed budget run remain resolved/history as recorded in A-7997.

## Verdict
Final clear; refresh C1–C4 at this exact head. Source/delta and new gate establish the current review, while the earlier gates remain historical. After-stage QA under E-795 after T-1005 remains separate. Reviewer ran no tests or product processes.
Standards 0 findings; Spec 0 findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-20T19:49:38.712Z

Merged ea8b43afb8ea0ad41afd312eb98f049f5ae67d41 onto dev.
