---
id: T-1199
kind: task
title: Split docs/agents/tests.md into one file per test file under docs/agents/tests/ with an index
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-926
branch: t/T-1199-split-docs-agents-tests-md-into-one-file
created: 2026-10-24T06:46:04.520Z
updated: 2026-10-24T07:19:31.329Z
closed: 2026-10-24T07:19:31.329Z
---

## Summary

123 of 166 v0.2 landings edited docs/agents/tests.md (2,929 lines); parallel lanes conflicted on adjacent paragraphs and cost extra review and verify rounds (E-419 stage 2). Absorbs T-1070. Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. Every paragraph moves to the file named after its test file with an index listing them, and two branches that each document a different test merge without conflict in a scratch merge (test).
  - done: impl-1199 · 2026-10-24T06:57:24.166Z
  - verified: rev-23 [reviewer] · run rev-20261024-1199-final · 2026-10-24T07:14:30.179Z · commit 59d569a34ce2104abc21d296465423b59ef5c781
- [x] C2. Palette help expectations are split per area, so area items do not share one list (test).
  - done: impl-1199 · 2026-10-24T06:57:24.233Z
  - verified: rev-23 [reviewer] · run rev-20261024-1199-final · 2026-10-24T07:14:30.179Z · commit 59d569a34ce2104abc21d296465423b59ef5c781

## Comments

### impl-1199 · 2026-10-24T06:54:38.392Z

Implementation in progress: 78 per-test documents plus index; legacy heading anchors retained and guarded. C1 scratch native Git merge went red on the absent directory, then green after the split (local Darwin arm64, working tree). C2 Web test went red on missing palette-help/inbox.json after the bundle was built; with seven per-area literal fixtures, the complete palette file passes 11/11. Original prose block audit finds no absent blocks after only relative-link rebasing and extracting the existing palette sentence. npm run build passed; npm run check and documentation consumer checks follow.

### rev-23 · 2026-10-24T07:00:33.567Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1199-source
commit: 59d569a34ce2104abc21d296465423b59ef5c781
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1199 full source review — clear

Head 59d569a34ce2104abc21d296465423b59ef5c781; tree 407b992a4ec5848680467911073b94a240ea1157. Branch t/T-1199-split-docs-agents-tests-md-into-one-file. Fixed base 6e1d073b, containing the Coordinator-posted c4bd17b5 shared Web fixture fix. Comparison: git diff 6e1d073b...59d569a34ce2104abc21d296465423b59ef5c781; one owned commit, 93 files, 1,646 additions / 1,239 removals. Run rev-20261024-1199-source. Findings []; C1/C2 runtime pending.

## Standards

No findings. The change keeps shared tiers, budgets, fixture ownership, cover-quiet and other procedures in tests.md, with file-specific guidance in flattened repository-path documents and a separate index. The two layout headers explain where future prose belongs; an existing-test paragraph edit does not touch the index. Existing heading anchors remain as discoverable forwarding sections. No role clause or rule is introduced; the proposed project rule remains a proposal.

The T1 index/link/anchor guard reads repository files only. It checks document/index completeness, source filename mapping, source existence, relative links and their heading anchors, plus historical tests.md references from skills, briefs, READMEs and role sources. The native merge proof is correctly classified T3: it copies shipped documents into an owned scratch Git repository, edits different existing guidance files on two branches, merges them, checks no unresolved paths and retains both paragraphs. This is the requested real Git boundary rather than a new hub/browser seam. fixtureEnvironment supplies scratch HOME/XDG/Git identity and filters inherited credentials; hooks and commit signing are disabled. Each execFile command is bounded and awaited before scratch removal. The test uses the existing admission hook.

The palette keeps its existing Web identity and browser fixture. Expectations move to seven literal JSON files, one per area; the loader reads test-owned fixtures rather than deriving expected output from production definitions. Counts, Inbox keys, exact action facts and Topics/Sessions label lists are retained. The contextual dismiss uniqueness, physical-code navigation, focus and other palette assertions remain. No new product behavior, dependency, timeout or assertion relaxation is introduced.

Reviewed against AGENTS.md, docs/agents/tests.md, the originating criteria and Coordinator scope. Both Standards and Spec axes were performed in-session under the Crew's no-subagent policy. No Fowler smell warrants a finding.

## Spec

No findings. Independent read-only comparison accounts for all 320 original nonempty prose blocks after whitespace/link-path normalization and the explicit palette-sentence extraction. The sole initially unmatched block becomes exact after extracting that sentence; the extracted sentence remains in the palette guidance. No original block is unaccounted for. There are 78 migrated guidance documents, two notes for the new regression files, and one index. Independent source-tree checks found no broken file targets in those guidance links. The shared guide retains the historical 38 headings; source guard explicitly protects the legacy anchor set and references.

C1's source shape is satisfied: paragraphs are kept, guidance filenames identify the corresponding existing test file, the index lists them, and the scratch regression proves the intended independent-file merge while retaining both edits. C2's diff retains the old literal help expectations in independent area fixtures, so an area-specific change no longer edits the shared conditional count/label list. The shared area navigation loop remains test infrastructure, not an area expectation list.

The only source change outside documentation/guards/fixtures is the two-entry tier classification. The shared copied-tracker fix is already contained in the fixed base; it is not an unreviewed extra task mutation. Tracked task worktree is clean and remains at the reviewed head. Diff whitespace check passes.

## Evidence and verification limits

A-10335 reports local Darwin arm64 pre-review build/check/test:tiers passes and targeted docs/roles 30/30, selection/README 99/99, lint/tier 34/34, and palette Web 11/11. It distinguishes the T3 merge red/green from a browser setup failure before the bundle was built; that setup failure is not treated as palette red evidence. Receipts are attributed to the candidate working tree, not invented exact-head runtime or Linux evidence. Original command/stdout/exit/timing/cleanup records have been requested for durable preservation without transcription reruns.

Reviewer has inspected source, Git and artifacts only; no tests/probes, browser/GUI, edits, merge or delegation. No configured task result exists yet. Source clearance permits mode-free verification at this exact head; it does not verify C1/C2. Final settlement must check the same-head receipt, actual phases/platform, new-test timing/load scope where present, and retained original local T3 scratch-merge evidence because task policy may defer T3. Do not infer load repetitions from a generic header. QA policy none/after-stage; no per-item brief/QA criteria, and after-stage QA remains separate.

Standards: zero findings. Spec: zero findings.
Durable review A-10338.

### impl-1199 · 2026-10-24T07:13:18.078Z

Mode-free verification 0ea78feb-8135-48c4-8ef0-304ed3265ee3 passed at reviewed 59d569a34ce2104abc21d296465423b59ef5c781: T0/check plus all T1/T2 fallback and Web; 2786 tests, 2786 pass, zero fail/cancel/skip. Executor droplet c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, workers 2, lifetime 663 s, cost $0.0461. Log A-10349. Duration/tier budget diagnostics are report-only; T3/T4 did not run. C1's native Git proof remains the original local precommit T3 receipt in A-10343 with explicit source provenance. Post-run fetch found origin/dev e5523d26, two tracker-only commits ahead; git merge-tree --write-tree --name-only HEAD origin/dev exited 0 with no conflict paths (tree 5579fc03efe72a110c6325212f2889c614be7dd2). Task head unchanged; worktree clean; awaiting Reviewer's same-head final verdict.

### rev-23 · 2026-10-24T07:14:30.179Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1199-final
commit: 59d569a34ce2104abc21d296465423b59ef5c781
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1199 final evidence review — clear

Exact source-reviewed head 59d569a34ce2104abc21d296465423b59ef5c781, tree 407b992a4ec5848680467911073b94a240ea1157. Source review A-10338 carries forward without changes. Configured run 0ea78feb-8135-48c4-8ef0-304ed3265ee3 / A-10349 exits 0. Run rev-20261024-1199-final; findings []; C1 and C2 verified.

## Standards

No outstanding findings. Independent parsing of original suite-progress finish records confirms 2,786 ordinary tests and 418 ordinary files passed; actual load-gate scope adds ten test passes and ten file passes, five repetitions for each of the two new T1 documentation guards. No failures, skipped/cancelled tests or missing new-guard repetitions. No tier-mismatch records name test-docs.test.ts or palette.test.ts.

The new T1 index/source/link guard passed at 0.012199392 s, with load maximum 0.017885928 s. The legacy-anchor/reference guard passed at 0.035961309 s, with load maximum 0.056469453 s. These remain well below their T1 budget; no allowance is needed. The changed existing palette leaf (area help and every displayed shell chord by physical code/Cyrillic keys) passed at 2.075759980 s. Existing palette parent/file timings remain distinct from that leaf; the parent and file duration diagnostics do not create a new identity here. No assertions, waits or allowance amounts were changed after source review.

## Spec and criteria

C1 verified through A-10338's source migration audit, same-head configured T1 guards, and original local T3 scratch proof preserved in A-10343. All 320 original blocks were accounted for after link rebasing and the explicit palette-sentence extraction; the 78 moved documents, two new regression notes, index and 38 legacy headings are retained.

A-10343 preserves 17 original tool results plus original command sources and explicit precommit provenance. The native merge case failed before the document directory existed, then passed after splitting. Its final docs/roles command passed 30/30 and includes the unchanged scratch-merge test at 252.5255 ms, with both independent paragraphs and no-conflict assertions. Git children are individually bounded/awaited; successful Node command completion includes the awaited t.after removal. No separate rm log/PID census was emitted and none is invented. Initial green copied 70 documents; the final receipt used the completed 80-document set. This is local Darwin arm64 evidence at working trees based on b16fa823, not a new Linux T3 or exact-committed-head execution claim. The intervening base fast-forward to 6e1d073b changed tracker records and the shared Items fixture, leaving the T3 merge implementation unchanged. Its commands/results, source and timing attribution remain visible.

C2 verified through the source preservation of seven per-area literal fixture files plus the configured Linux rendered palette assertions and physical-code behavior. Existing literal counts, action keys/labels, Inbox key list, Topics/Sessions groups, contextual uniqueness and navigation assertions passed. Expected output is not generated from product definitions.

## Run provenance and limits

Linux x64 6.8.0-142-generic, Node 24.21.0 / Neovim 0.12.5; c-8 lon1 droplet cland-v0-91bd6a6b, workers 2 and Web runner 4, lifetime 663 s / $0.0461. Actual T1 completed (134 files); fallback all T2 completed across hub and Neovim (240 files), and Web completed (44 files). Actual suite wall durations: T1 55.01 s, T2 342.00 s, Web 150.94 s; Web shard 150.82 s. Projected tier figures are not wall measurements.

The raw receipt contains the complete host npm run check output, including zero lint refusals and 132 existing report-only findings in 59 files. Host gate 019e277c7bb0148b01ca3a5f797d2c6c8f6b1484 is independently confirmed to be a Git tree object; matching successful host check was reused, not run again on the droplet. Generic duration/lint/ratchet and projected Web wall diagnostics retain their report-only status; one missing duration baseline remains reported. No failed gate is hidden behind the passing assertion count.

Configured task policy deferred T3 to periodic/integrated occasions and did not run T4. The task receipt supplies no Linux T3/load proof for the native merge case, and no integrated/after-stage QA claim. Local original build/check, palette and targeted consumer outputs remain attributed to their precommit source states; A-10343 supersedes A-10342 without a transcription rerun.

Tracked task worktree remains clean at the reviewed head. The implementer reports a conflict-free native merge-tree against fetched dev e5523d26 with no head change; readiness must retain the normal current-dev conflict check. Reviewer did not fetch/merge, run tests/probes, operate a browser or edit source. QA policy none/after-stage with no per-item brief or QA criteria; after-stage QA remains separate.

Standards: zero findings. Spec: zero findings. Both criteria verified at this head from the attributed source and runtime evidence.
Durable review A-10350.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T07:19:31.329Z

Merged 356efd0e6f04acb229fe1916846795640e3b1215 onto dev.
