---
id: T-1227
kind: task
title: Ledger JSON gained missingProjects and the CLI dry-run test compares the old exact shape
state: open
status: review
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
updated: 2026-10-24T11:00:28.123Z
---

## Summary

The Linux stage cover 4d0ec3dd at dev 44f220a5 (A-10755) fails hub/test/suite-dry-run.test.ts "CLI dry-run prints admission and planned tiers without queueing or reserving spend" (line 86): the scratch spend ledger now reads `{"version":1,"entries":[],"projects":[…],"missingProjects":[]}` while the test expects the old shape without `missingProjects`. T-422 (94b632aa) added the field; the test is T3, so neither T-422's verify nor its T1 batch ran it.

## Acceptance criteria

- [x] C1. The dry-run test asserts that dry-run reserves no spend and adds no entries, by reading the parsed ledger's entries and reservations, not by comparing the whole file byte for byte; it passes with T-422's ledger shape (test).
  - done: impl-1227 · 2026-10-24T10:42:34.454Z
- [x] C2. A search of hub/test and nvim/test for other exact-string ledger comparisons finds none left, or each is migrated the same way (list in the ready report).
  - done: impl-1227 · 2026-10-24T10:42:34.654Z
  - verified: rev-23 [reviewer] · run rev-20261024-1227-source · 2026-10-24T10:46:13.677Z · commit 0c4b373b16feebc2995064e52932ccc5741fc79d

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
