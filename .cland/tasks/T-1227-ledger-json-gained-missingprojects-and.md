---
id: T-1227
kind: task
title: Ledger JSON gained missingProjects and the CLI dry-run test compares the old exact shape
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
regression_of: T-422
topic: topic-961
branch: t/T-1227-ledger-json-gained-missingprojects-and
created: 2026-10-24T10:40:12.945Z
updated: 2026-10-24T11:13:49.544Z
closed: 2026-10-24T11:13:49.544Z
---

## Summary

The Linux stage cover 4d0ec3dd at dev 44f220a5 (A-10755) fails hub/test/suite-dry-run.test.ts "CLI dry-run prints admission and planned tiers without queueing or reserving spend" (line 86): the scratch spend ledger now reads `{"version":1,"entries":[],"projects":[…],"missingProjects":[]}` while the test expects the old shape without `missingProjects`. T-422 (94b632aa) added the field; the test is T3, so neither T-422's verify nor its T1 batch ran it.

## Acceptance criteria

- [x] C1. The dry-run test asserts that dry-run reserves no spend and adds no entries, by reading the parsed ledger's entries and reservations, not by comparing the whole file byte for byte; it passes with T-422's ledger shape (test).
  - done: impl-1227 · 2026-10-24T10:42:34.454Z
  - verified: rev-23 [reviewer] · run rev-20261024-1227-final · 2026-10-24T11:06:22.760Z · commit 0c4b373b16feebc2995064e52932ccc5741fc79d
- [x] C2. A search of hub/test and nvim/test for other exact-string ledger comparisons finds none left, or each is migrated the same way (list in the ready report).
  - done: impl-1227 · 2026-10-24T10:42:34.654Z
  - verified: rev-23 [reviewer] · run rev-20261024-1227-source · 2026-10-24T10:46:13.677Z · commit 0c4b373b16feebc2995064e52932ccc5741fc79d
  - verified: rev-23 [reviewer] · run rev-20261024-1227-final · 2026-10-24T11:06:22.761Z · commit 0c4b373b16feebc2995064e52932ccc5741fc79d

## Comments

### impl-1227 · 2026-10-24T10:41:05.301Z

Working at the supplied CLI dry-run scratch-ledger seam. Root dependency link already exists. Auditing parsed/file ledger comparisons in hub/test and nvim/test alongside the regression reproduction.

### rev-23 · 2026-10-24T10:46:13.677Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1227-source
commit: 0c4b373b16feebc2995064e52932ccc5741fc79d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1227 full source review — clear

Head0c4b373b16feebc2995064e52932ccc5741fc79d/treead72d6a1e9f7069aae4a5b3ed8f19fdfba9a6898; fixed incorporated dev parent44f220a559e2f027daf9ba59a9f14098efbd99f7. Comparison git diff44f220a5...0c4b373b; one test-only commit/three files. Origin task ref matches. Run rev-20261024-1227-source, scope full; both axes in-session under Reviewer crew policy, findings [].

## Standards

Clear. No production/schema/helper/workload/timing/ownership changes. Existing native dry-run Git/CLI contract remains T3, init's sealed child-wrapper remains T3, deterministic spend ledger accounting remains T1. Existing scratch HOME/XDG/Git/provider sealing and process-before-directory teardown remain unchanged. Assertions now select facts appropriate to the seam; no new duplicate fixture/process or waits. Whitespace check passes. No separate baseline-smell finding.

## Spec

C1 source-sound: dry-run reads/parses the ledger without swallowing read errors, checks zero reservations from unsettled entries and requires empty accounting entries. It permits unrelated project/missingProjects registry bookkeeping while retaining all original queue/suites/run/lease/provider GET-only/no-droplet and invalid-manifest refusal checks. Repeated settlement still checks legacy/current final costs and now preserves the entire parsed entries array rather than unrelated registry bytes. Init helper tests separately retain version, entries and project facts.

C2 source-verified. Independently searched hub/test and nvim/test for spend.json/spendPath/SpendLedger/ledger reads and equality/baseline aliases (18 relevant files). A-10760 lists migrated and retained contracts. Remaining whole-file equality proves intentional byte preservation: unreadable sweep, retirement/migration/failure legacy preservation in executor-spend; held-lock shutdown in executor-admission-lock; deliberately corrupt ledger reporting in suite-close-component; opaque hub-owned state preservation on Neovim startup/migration in client-component. These must remain byte comparisons because their subjects are preserving files, not assumptions about the schema. Other accounting assertions inspect entries/costs/reservations/projects. No remaining schema-coupled comparison found. Retain this list in the ready report.

## Evidence

A-10765 retains local macOS arm64 original source attribution and native output/exits: targeted base dry-run red strictEqual shows actual missingProjects[] versus older whole-file expected shape; final correction tree committed unchanged as0c4b373b runs25/25 across executor-spend T1 and suite-dry-run/init-machine T3, no failures/skips, runner5712.826333ms. Dry-run1709.157125ms; init wrapper5633.616958ms includes sealed child self-tests. These are targeted native timings, not complete tier coverage or a duration-gate receipt. An intermediate check's TS2339 never-narrowing failure is retained; assertion-order correction followed with check exit0. Check excerpts retain report-only lint133/60files/zero refusals, not an invented overall wall time.

No new identity/cap changes. Existing init-wrapper allowance10.495778s remains untouched; configured T3 tier budget10s/80% headroom threshold will be assessed from actual selected Linux samples. C1 final runtime settlement awaits configured same-head verification, including changed-T3 duration selection under current policy. Local macOS target does not establish Linux passing/phase added-wall evidence. Source clearance permits configured mode-free submission at this exact unchanged head, reporting to Reviewer/lead. QA none/no per-item brief. Reviewer static source/Git/artifact reads only; no tests/probes/edits/install/Git mutation/browser/delegation. Standards zero findings; Spec zero findings.
Durable review A-10766.

Criteria: C2 verified.

### impl-1227 · 2026-10-24T10:59:06.449Z

Same-head mode-free verify fe4ba581 at0c4b373b passed847/847 on Linux/droplet (A-10778), report-mode lint/budgets. Changed T3:2files/5passing identities, observed added wall4.759s excluding machine wait; dry-run1.765s, init-machine wrapper4.405s. Evidence review requested from Reviewer; rev-26 routed to original source Reviewer rev-23. Post-result fetch origin/dev23066929; git merge-tree --write-tree HEAD origin/dev exited0 (prospective treedf374515), clean working tree; no merge/head change.

### rev-23 · 2026-10-24T11:06:22.761Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1227-final
commit: 0c4b373b16feebc2995064e52932ccc5741fc79d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1227 final evidence review — clear

Reviewed/runtime head 0c4b373b16feebc2995064e52932ccc5741fc79d, tree ad72d6a1e9f7069aae4a5b3ed8f19fdfba9a6898; fixed base 44f220a559e2f027daf9ba59a9f14098efbd99f7. Prior full source verdict A-10766 / rev-20261024-1227-source stands unchanged. Scope evidence; findings []; C1/C2 verified.

Configured mode-free run fe4ba581-16f5-42de-9a10-1520379fb649, original log A-10778, finished exit 0 at this exact head. Native progress has 847 passing test finish records and 140 passing file finish records, zero failed/cancelled/skipped. There are 842 top-level tests plus five nested tests (two init-skills-update and three Web smoke); this explains the difference from phase reports 836 T1 + 5 changed T3 + 1 Web parent. No repeated identities or load-gate finish records were recorded, so generic repetition headers do not establish extra executions.

Actual selection: all T1 (137 files, 836 top-level tests), empty selected T2 command exit 0, two changed T3 files/five identities in one base execution, and Web smoke only (one file/parent plus three children). Function coverage A-10636 at 89e5c304bef194c07caff3e41a82d0e62a2e2902 selected hub scope. This is not fallback all T2 or full Web, and not a complete T3/T4 cover. Actual suite wall times T1 66.56s, empty T2 0.05s, changed T3 4.83s, Web 3.10s remain distinct from phase envelopes 72/4/10/9s and projections.

C1 runtime proof: the dry-run identity passes in 1.765046792s while retaining zero accounting entries/reservations and all earlier no-queue/no-lease/no-provider-mutation assertions. Four suite-dry-run identities total 3.214747376s; its file finish is 4.188103441s. Init-machine's inherited-HOME preservation wrapper passes in 4.404860968s, file finish 4.581080205s. Both named test samples are below the T3 80% headroom threshold of 8s for a 10s budget. Selected changed-T3 added wall 4.759s is observed excluding machine wait; no new allowance stanza is required. Existing init-wrapper allowance remains unchanged. Local macOS original red/25-test correction/check records A-10765 remain separately attributed, not substituted for Linux.

Host T0 reports exit 0 / 57.327s and gate a9d858ccb1cd6e7698cd90ae5c3c33a541ba002e (not repeated). Independently confirmed this identifier is a Git tree, not a commit. It names the retained host check tree, not a remote candidate typecheck. Linux runtime head/tree remain as above.

Executor: droplet c-8 lon1 cland-v0-8d3b40c0, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, workers 2 (Web phase 4), lifetime 199s, cost $0.0138. Disk fsync 16.99ms, SQLite 34.85ms. Lint 133 findings/60 files, four missing duration baselines, tracker-summary 0.501s > 0.5s and incomplete-base ratchet diagnostics are report-only; no enforcing-budget clearance is claimed.

C2 carries forward the independent 18-file audit from A-10766 and migrated/retained contract list A-10760. Retained whole-file comparisons intentionally prove byte preservation for unreadable/corrupt/held-lock/legacy files, not obsolete schema shape. Include that list in the ready report.

Implementer's final read-only conflict receipt names fetched origin/dev 230669296771cf8f282ab2d050fc48603ce0de39, merge-tree exit 0/prospective tree df374515; head and clean worktree unchanged. No merge/deployment/stage QA claim. QA none/no item brief. Reviewer performed static source/Git/artifact reads only; no tests, probes, edits, installs, Git mutation, browser or delegation. Standards and Spec remain clear.

Durable final verdict: A-10793 / /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10793-t-1227-final-same-head-evidence-verdict.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T11:13:49.544Z

Merged 1ac99cb6a8356d1ae30d2fc5746045b57f57c92e onto dev.
