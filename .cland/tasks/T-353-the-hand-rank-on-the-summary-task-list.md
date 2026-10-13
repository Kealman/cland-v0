---
id: T-353
kind: task
title: "The hand rank on the summary: task.list, task.view and the task event say when an item's file names its rank, so the card shows the raw rank only when it was set by hand"
state: open
status: planned
size: S
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-276
blocked_by: []
topic: null
branch: null
created: 2026-10-13T20:53:51.723Z
updated: 2026-10-13T20:54:02.130Z
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

- [ ] C1. A hub test on a temporary project: an item without a frontmatter rank has `rank = n × 10` and no `rank_set` in `task.list` and `task.view`. An item with a rank in its file has `rank_set: true`.
- [ ] C2. A `task.rank` move sets `rank_set: true` on each item whose file it wrote, and the `task` event a subscribed UI receives carries it.
- [ ] C3. A hand edit that removes the `rank:` line clears `rank_set` after the re-index.
- [ ] C4. `cland task view` prints `(default)` or `(set)` after the rank.
- [ ] C5. `hub/README.md` and `docs/agents/issue-tracker.md` with its template describe `rank_set`.
