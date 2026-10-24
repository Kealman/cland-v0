---
id: T-538
kind: task
title: Tracker index hydrate re-queries the row's own kind to canonicalize an id it already has
state: open
status: review
size: S
criterion_seq: 2
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-941
branch: t/T-538-tracker-index-hydrate-re-queries-the-row
created: 2026-10-15T21:15:50.790Z
updated: 2026-10-24T08:14:44.286Z
---

## Summary
Found aside by impl-469 on T-469 (2026-10-15 21:15Z). In `hub/src/tracker/index-db.ts:423`, `#hydrate` receives the selected row's kind and n, yet canonicalizes the row's own id with another `select kind … where n` query. In one landing, the stage-budget trace counted 2,992 kind lookups and 1,848 hydrated label and blocker rows. Deriving the row's own canonical id from its existing columns removes those queries. Lookups for referenced ids stay as they are.

## Acceptance criteria
- [x] C1. `#hydrate` builds the row's own canonical id from its selected columns, with no extra query, while reference ids (blockers, parent, follows) still resolve as today.
  - done: impl-538 · 2026-10-24T08:13:40.566Z
  - verified: rev-26 [reviewer] · run rev-20261024-538-source-1 · 2026-10-24T08:14:44.286Z · commit 5774f10a3ebe83331c7f2bc475c814d103b90977
- [x] C2. A query-count test on a landing, or on a list of N items, shows the own-id lookups gone and every existing tracker test passes.
  - done: impl-538 · 2026-10-24T08:13:40.649Z

## Comments

### impl-538 · 2026-10-24T08:12:29.987Z

Test-first baseline at dev b49b3d91: new T1 list regression fails with `9 !== 1` (unlinked 8-item list: 9 reads, 8 kind lookups; linked: 15 reads, 14 kind lookups including 6 references). Existing fixture-owned sqliteProbe supplies reusable execution tracing. Hydration now formats its own id from selected kind/n; reference resolver calls unchanged.

### rev-26 · 2026-10-24T08:14:44.286Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-538-source-1
commit: 5774f10a3ebe83331c7f2bc475c814d103b90977
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at5774f10a/tree25895070, base0a980474 integrated before implementationcommit; nofindings on Standards/Spec. C1sourceverified: #hydrate ownid uses selectednonnullkind/n viaexistingprefixOf; list/get/children selecti.*, references parent/blockers/follows/regression_of stillcallunchangedcanonicalresolver; rankhandlingunchanged. T1in-memory fixture-ownedSQLiteprobe reused withoutglobalprototype mutation, countsactualget/all aftersetup andretains8mixedkind ownids,6referencebindings andmissingtargetvalues. Oneunlinkedread/0ownlookups and7reads/6referencequeries explicit. Docsheading/indexmatchcontract. A-10493 local13tracker-summary+8prefix/check0 narrative is targetedsupport, notfulltracker/configuredproof; preserveoriginalstdout/exits/nativetimings/sourceattributionwithouttranscriptionreruns. C2querycount/existingtracker runtimeawaitsame-headmode-freeconfiguredreceipt; noLinuxT3T4/QAclaim. A-10497: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10497-t-538-source-review-at-5774f10a.md. Proceedmode-freeverifyatunchangedhead.

Criteria: C1 verified.
