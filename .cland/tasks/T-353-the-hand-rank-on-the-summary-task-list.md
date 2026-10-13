---
id: T-353
kind: task
title: "The hand rank on the summary: task.list, task.view and the task event say when an item's file names its rank, so the card shows the raw rank only when it was set by hand"
state: open
status: review
size: S
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-276
blocked_by: []
topic: topic-220
branch: t/T-353-the-hand-rank-on-the-summary-task-list
created: 2026-10-13T20:53:51.723Z
updated: 2026-10-13T21:43:31.208Z
---

## Summary

The hub sends every item's effective rank, the id times ten when the file names none, so a client cannot tell a rank set by hand from the default. Summaries and views gain `rank_set: true` when the item's frontmatter names a rank. The card (ticket T-354) shows the raw rank among its facts only then, as §3.9 asks.

## Parent

E-276: The explorer and the card. This is the one hub field the card reads that the merged E-270 work does not provide. Spec: `docs/spec/v0.1.2.md` §3.9 (the prototype's answers: "the raw rank appears among the facts only when set by hand"). Prototype: `nvim/EXPLORER-PROTOTYPE.md` open point 12 ("v0.1.2 items carry no explicit rank, so the facts read rank 2430"). ADR 0002: the file is the source of truth.

## What to build

**The field.** `IndexedItem` in `hub/src/tracker/index-db.ts` gains `rank_set?: true`.

- `#hydrate` sets it when the stored `rank` column is not null. The index already stores `fm.rank ?? null`, so no schema change and no reindex are needed.
- `rank` keeps its meaning: the effective rank from `effectiveRank`.
- The field reaches `task.list`, `task.view`, `Tracker.summary` and the `task` event through the existing spreads of `IndexedItem`.
- An item whose frontmatter names a rank, written by hand or by a `task.rank` move (which may write the moved item's siblings too), carries it. Every other item omits it.

**The CLI.** `cland task view` prints `rank 2430 (default)` or `rank 2435 (set)`. `cland task list --json` carries the field.

**Docs.** `hub/README.md`'s tracker section names `rank_set`. `docs/agents/issue-tracker.md` and its template `skills/templates/docs/agents/issue-tracker.md` say what it means in one sentence, beside rank.

**Demo.** `cland task list --under R-228 --json | jq '.items[] | {id, rank, rank_set}'` shows `rank_set: true` only on items whose files name a rank.

**Out of scope.** The card that reads it (ticket T-354). Any change to rank ordering or to `task.rank`.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). Extend `hub/test/tracker-rank.test.ts` or add a test beside it.
- No new seams inside the hub. New test helpers go in the test file, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` waits on the `flushLogs` barrier (T-291). This ticket reads neither.
- A list reads no item file. The field comes from the index row (T-321).
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. A hub test on a temporary project: an item without a frontmatter rank has `rank = n × 10` and no `rank_set` in `task.list` and `task.view`. An item with a rank in its file has `rank_set: true`.
  - done: impl-353 · 2026-10-13T21:39:11.250Z
- [x] C2. A `task.rank` move sets `rank_set: true` on each item whose file it wrote, and the `task` event a subscribed UI receives carries it.
  - done: impl-353 · 2026-10-13T21:39:12.115Z
- [x] C3. A hand edit that removes the `rank:` line clears `rank_set` after the re-index.
  - done: impl-353 · 2026-10-13T21:39:14.736Z
- [x] C4. `cland task view` prints `(default)` or `(set)` after the rank.
  - done: impl-353 · 2026-10-13T21:42:03.149Z
  - verified: rev-26 [reviewer] · run rev-20261013-353-source-2 · 2026-10-13T21:43:00.528Z · commit 5a0851a70b26c82194d50c1d071673419aadae0b
- [x] C5. `hub/README.md` and `docs/agents/issue-tracker.md` with its template describe `rank_set`.
  - done: impl-353 · 2026-10-13T21:39:16.088Z
  - verified: rev-26 [reviewer] · run rev-20261013-353-source-2 · 2026-10-13T21:43:00.528Z · commit 5a0851a70b26c82194d50c1d071673419aadae0b

## Comments

### impl-353 · 2026-10-13T21:36:53.317Z

Implementation started: preserve effective rank ordering and derive optional rank_set from the stored index rank; cover list/view/event/CLI and watcher re-index through the temporary-project protocol harness.

### rev-26 · 2026-10-13T21:41:05.015Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-353-source-1
commit: 83fa00d81177e1baaa7648e468e7c01a14613b80
scope: full

Medium — hub/src/tracker/tracker.ts:1364–1374 / hub/src/cli/task.ts:197: view spreads indexed rank_set while recomputing rank from the fresh file; hand add/remove before watcher re-index produces an incorrect set/default label. Derive the view flag from item.fm.rank and exclude indexed rank_set; retain index-only list/event behavior. Implementer confirmed in 6803f726 and will add frame regression/new head. Standards: no independent high/medium finding, no schema/order/write/harness changes or weakened tests; docs/template checked. A-2090 records both axes. No tests run by Reviewer; full verification awaits a clear corrected-head source verdict.

Criteria: C4 failed (Before watcher re-index, task.view combines fresh file rank with indexed rank_set, so CLI can print the wrong set/default label.).

### rev-26 · 2026-10-13T21:43:00.528Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-353-source-2
commit: 5a0851a70b26c82194d50c1d071673419aadae0b
scope: full

Source clear: no high/medium finding. tracker.ts:1365/1374 now excludes indexed rank_set and derives it from the same parsed file as effective rank, fixing C4's hand-save window. Index-only summaries/events and schema/order/rank writes unchanged. Real-hub frame regression holds native watcher delivery, proves lists remain indexed and views reflect both hand additions/removals; cleanup restores builtin export bindings. C4/C5 source checked: CLI set/default rendering and README/docs/template match. C1/C2/C3 protocol tests reviewed but execution marks remain pending accepted same-head full evidence. A-2091 reports 23/23 targeted and red/green; A-2093 records independent source review. Full verification and final verdict still required.

Criteria: C4 verified, C5 verified.

### impl-353 · 2026-10-13T21:43:31.208Z

Source clear at 5a0851a70b26c82194d50c1d071673419aadae0b. Full verification ce4282aa-4e75-47e6-bff5-4432a3a06ed7 submitted through the hub queue (launch-notice clarification of empty-holder wording), addressed to rev-26 and impl-353 in topic-220. Tree clean and head unchanged. Awaiting execution evidence and final verdict.
