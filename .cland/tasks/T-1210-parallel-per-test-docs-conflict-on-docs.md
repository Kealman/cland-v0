---
id: T-1210
kind: task
title: Parallel per-test docs conflict on docs/agents/tests/index.md
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-942
branch: t/T-1210-parallel-per-test-docs-conflict-on-docs
created: 2026-10-24T08:09:00.298Z
updated: 2026-10-24T08:34:15.853Z
closed: 2026-10-24T08:34:15.853Z
---

## Summary

Since T-1199 (356efd0e) every lane that adds a per-test doc also adds a line to docs/agents/tests/index.md. On 2026-10-24 that conflicted twice within an hour: T-421 against T-339/T-337, and T-1018 against T-1184. Each conflict costs a dev merge, a delta review and a fresh verify (about 15 minutes).

## Acceptance criteria

- [x] C1. Two branches that each add a different per-test doc and its index entry, or each extend the same per-test doc, merge without a conflict and the result passes C2 with no follow-up edit, shown with a scratch Git repository (test).
  - done: impl-1210 · 2026-10-24T08:16:04.099Z
  - verified: rev-23 [reviewer] · run rev-20261024-1210-final · 2026-10-24T08:30:37.356Z · commit e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9
- [x] C2. The test-docs check still fails when an index entry is missing or duplicated, or names a file that does not exist; entry order is not checked (test).
  - done: impl-1210 · 2026-10-24T08:16:04.556Z
  - verified: rev-23 [reviewer] · run rev-20261024-1210-final · 2026-10-24T08:30:37.356Z · commit e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9

## Comments

### coord · 2026-10-24T08:11:40.703Z

Scope note (coord, 08:12Z): the conflicts are not only index.md. Two branches that each add guidance for the same test file collide add/add on the per-test doc itself: T-542 against T-1184 (hub-test-merge-batches.test.ts.md) and T-421 (hub-test-planned-stage.test.ts.md); T-1018 against T-1184 the same way. C1 should cover both forms: index lines, and two branches each creating or extending the same per-test doc.

### impl-1210 · 2026-10-24T08:13:44.114Z

Chosen seams (launch brief): shipped .gitattributes exercised through native Git merge/rebase and cland's merge-tree command in a sealed scratch repository; pure index-membership validation for missing, duplicate and dangling entries. Coordinator removed the ordering constraint, so union output must pass membership validation without edits.

### rev-23 · 2026-10-24T08:17:29.889Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1210-source
commit: e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1210 full source review — clear

Head e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9; tree 9a2fc5a1ec1ab27cc9f648ef95d81bf9042b0306. Fixed incorporated dev base aafdc9a490d560bc97673d788ffa180943b5ff62; comparison git diff aafdc9a4...e4dc1f9f. Implementation d43e48dd precedes a first-review tracker-only merge: independently checked d43e48dd..e4dc1f9f contains only five .cland/tasks files. Run rev-20261024-1210-source. Both Standards and Spec reviewed in-session, no subagents.

Standards: clear, no findings. The merge policy is tracked and narrowly scoped to /docs/agents/tests/*.md, leaving shared tests.md and other repository content on normal merge behavior. The helper extracts the same Notes targets as the pre-existing guard and compares sorted multisets; it neither deduplicates nor weakens source/header/link/anchor checks. T1 literal fixtures cover both row orders and missing, duplicate and nonexistent targets. The T3 tier remains appropriate because native Git merge/rebase/object merge behavior is the subject. Every command runs under the shared credential-filtered fixtureEnvironment in a disposable root with scratch HOME/XDG/Git settings; hooks/signing are disabled, execFile has a 5 s bound, each promise is awaited, and scratch removal occurs only in the after-hook following command completion. There is no hub, browser, compiler or installer. Test-specific and shared guidance match the change; no tier or budget relaxation. Diff whitespace check passes.

Spec: clear, no findings. Coordinator a876ec40-0f10-4e4f-9188-3e8b60252369 explicitly makes index order insignificant and requires union output to pass one-to-one membership without edits. The tracked built-in union driver covers index and shared per-test guidance. Three native scenarios copy the shipped attributes at the real documentation paths, branch from the same base, independently add distinct documents/index rows, both add the same new guidance document and both append to an existing document. Merge, rebase, and cland's exact merge-tree --write-tree --name-only -z command must succeed. The object-merge result is installed without editing, then the same membership helper validates the actual directory/index. Final assertions retain both branches' independent and shared-new/existing paragraphs. Existing source/link/header/historical-anchor guard remains. Documentation explicitly states union retains overlapping advice from both sides and source review checks the combined meaning; no automatic semantic reconciliation is promised.

C1 source design matches the required native seam and all conflict forms; C2 preserves missing/duplicate/dangling rejection with order ignored. Both runtime criteria remain pending same-head configured evidence plus the local T3 receipts; this is source clearance only.

A-10502 reports local macOS implementation-tree red/green: without attributes all three modes produced content/add-add conflicts, with attributes the seven tests pass (three T1 guard cases and four T3 merge cases). npm run check passed at the pre-tracker-merge source tree d43e48dd, report-only lint/no refusals. The later merge is tracker-only, as independently confirmed; these remain explicitly attributed pre-merge local receipts, not Linux or a full task-suite claim. Original stdout/native exits/timings/source/platform/cleanup attribution have been requested for durable retention from existing tool records without transcription reruns. No configured result yet. A fresh mode-free run may follow at exact e4dc1f9f.

QA policy none/after-stage, no QA criteria. Reviewer performed static source/Git/artifact inspection only: no tests/probes, native Git mutation, browser, edits, merge or delegation. Standards zero findings; Spec zero findings. Findings [].
Durable review A-10505.

### impl-1210 · 2026-10-24T08:29:29.351Z

Verification 86e2a1b3 passed at reviewed head e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9: droplet Linux x64 c-8 lon1, 2826/2826 tests, T1 + fallback all T2 in both packages + Web; budgets/lint report-only; T3 deferred (targeted local T3 proof in A-10507). Full log A-10533. T0 host gate at 259f3df7, not repeated; local source npm run check passed in A-10507. Fetched origin/dev fd959ce7 after receipt; merge-tree conflict check exited 0, no conflicts. Head unchanged, working tree clean; awaiting final same-head Reviewer settlement.

### rev-23 · 2026-10-24T08:30:37.356Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1210-final
commit: e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1210 final evidence review — clear

Head e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9; tree9a2fc5a1ec1ab27cc9f648ef95d81bf9042b0306. Run rev-20261024-1210-final. Source A-10505 carries forward, findings [].

A-10533 / mode-free86e2a1b3-1b64-41be-a72b-54554a768f22 exits0 at the exact reviewed head, matched independently to task.verify/current branch. Parsed native finishes:2826 ordinary test passes/418 file passes plus5 actual load-gate test/file passes, zero fail/cancel/skip. Completed T1, fallback all T2 across hub/Neovim and Web44files/223top-level tests. Linuxx64 6.8.0-142-generic droplet c-8lon1 cland-v0-402bf188, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime578s/$0.0402. Actual suite47.03/296.93/130.83s; Web shard130.73s. Host npm run check is retained; gate259f3df78f963a7c040758a377b172dddd20ffb3 resolves to a candidate tree object, reused rather than repeated on droplet. Phase envelopes50/301/135s and wall projections are separate.

C1 verified through source plus retained local native-Git evidence A-10507. At the implementation source ultimately committed d43e48dd (the subsequent e4dc merge changes tracker files only), sealed scratch merge, merge-tree and rebase reproduce content/add-add conflicts without attributes, then pass with the shipped union attribute. Final local seven-test command exits0,1522.684375ms; the three new native scenarios take292.486375/312.795542/329.027875ms. Each retains both branches' independent and shared-new/existing paragraphs and validates merged index membership without editing the result. Local Darwin targeted T3 is explicitly distinct from configured Linux coverage. Original red excerpts retain complete Git diagnostics but omit stack frames; working-tree hashes were not recorded. Awaited command completion/Node after-hooks support cleanup; no separate OS process-table receipt is claimed.

C2 verified through retained source checks and the configured Linux T1 guard. Missing/duplicate/dangling entries fail literal fixtures while either order passes. New identity passes0.002105551s plus5/5 actual repetitions max0.003332739s; existing source/link/header and historical-anchor cases pass0.011668017/0.036731390s. No affected-file tier mismatch found. Local/remote new samples are below allowance triggers, no allowance needed.

Budgets/test-lint133findings/60files, one missing baseline, incomplete-base ratchet and existing Web/scale warnings remain report-only. No T3/T4 ran on the configured occasion; T3 is deferred to periodic/integrated, absent batch tiers. No Linux T3/integrated or production queue-landing claim. A-10507 also preserves original local check exit0/static gates/no refusals without inventing a total check wall time.

A-10534 records post-run fetch origin/devfd959ce729d8913f57535e0b60e73470a6793275 and successful conflict-free merge-tree result7e85688b19ab26bed5f4918820ea803bb0f363f2; task head/worktree remained unchanged and clean, no dev merge. Both C1/C2 verified at this head. QA policy none/after-stage. Both axes completed in-session, zero findings. Reviewer inspected source/Git/artifacts only; no tests/probes, edits, browser, merge or delegation.
Durable review A-10537.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T08:34:15.853Z

Merged 8de5c988f803c96b843cc2ee55883336d703906f onto dev.
