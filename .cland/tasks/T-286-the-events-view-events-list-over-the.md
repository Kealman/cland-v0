---
id: T-286
kind: task
title: "The events view: events.list over the journal, ␣E, day groups and paging"
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: E-274
blocked_by: []
topic: topic-169
branch: t/T-286-the-events-view-events-list-over-the
created: 2026-10-12T11:57:19.740Z
updated: 2026-10-12T13:03:28.752Z
---

## Summary

A new frame, `events.list`, pages the journal from its end into events-view rows, and a new Neovim view on `␣E` shows them newest first, grouped by day, 200 at a time, with `A` for 200 older rows, `za` per day, Enter on the subject and the `gi`/`gt`/`gs` jumps. The view also opens from the inbox's events line and from the palette.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**What the journal records.** The view shows the events the hub announces, from the journal (ADR 0007). Today the journal lacks some of them. Announced events are not journaled with their text, so artifact and usage events leave no record. A suite's record (`verification-timing`) has no result. A `notification` record has no item or session. The hub journals what the view needs through its existing log tap, with no new seam:

- one record per announced event, with its kind, its subject and its one line, written whether or not any session subscribes;
- a suite's result: its branch, its item, its outcome and its counts;
- the subject of a notification: its item or session, and a verdict's result.

The rows map onto the view's eight kinds: session, task, verdict, suite, release, artifact, usage and topic. Records written before this ticket are read where they carry enough to make a row: launches, stops, deaths, claims, merges, topic records, releases and notifications. Older periods may lack suite and artifact rows; the README says so, and no backfill from `hub.db` is made (the Coordinator's decision of 2026-10-12). Usage events exist today only when a subscription threshold is crossed, so the usage kind may stay empty in this epic; no default threshold is added here (the per-session usage records of "Status, fields and instrumentation" come later).

**`events.list`.** `{type:"events.list", before?, limit?}` returns at most 200 rows (the limit may be lower) older than the cursor, newest first, with a cursor for the next older page and whether more remain. A row is its time, its kind, its subject (an item, a session, a topic or an artifact, with its id) and one line. The frame reads the journal backwards from its end in fixed-size chunks. It never reads the whole file and never loads it into memory. On a journal of 135 thousand records the first page answers in well under a second. Rows that a test can only build by reading the whole file are out of scope. Paging is stable while new records append: a page after a cursor never repeats or skips a row. The hub pushes each new row to UI clients as it journals it, in the same shape, as it pushes `inbox` events.

**The view.** `␣E` opens the events view in the centre from anywhere, and `␣␣` goes back. The palette has an "Events view" action. In the inbox, a line below the sections, "△ events · e opens the events view", opens it on `e` or Enter; the next ticket makes it count new events. Keep this inbox change to that one line: the four-sections ticket rewrites the inbox renderer in parallel. The view shows rows newest first, grouped by day under day rules ("── Mon 12 Oct · today ──"), as the thread draws them. A row is its time, its kind's glyph, its kind, its subject and its line. The glyphs are those of `docs/design/main-screen/Events.dc.html`: ▶ launched or resumed, ■ stopped, ○ idle, ⇄ handover, ⚑ claimed, ◐ ◉ ● status and criteria, ▤ plan changed, ✓ clear or passed, ✗ failed, ◈ release, A artifact, $ usage, and ⚠ for a warning. The view opens with the newest 200 rows. A last line says "the newest 200 rows · A pages 200 older ones in from the journal"; `A` appends the next 200 below. `za` folds and unfolds a day. Live rows arrive at the top without moving the cursor off its row.

**From a row.** Enter opens the subject: the item view for an item (the card replaces it when "The explorer and the card" lands), the session, the topic or the artifact. `gi`, `gt` and `gs` jump to the row's item, topic or session where it has one, and otherwise say it has none.

**Demo.** `␣E` opens today's rows newest first under today's day rule, and `A` loads the 200 before them.

Out of scope: dimmed bookkeeping, merged ×N rows, warning class rules beyond D17's verdicts and deaths, filters, `gM`, the last look and the count on the events line (the next ticket); the retirement of the inbox's notification list.

**Constraints.**

- Tests go through the hub's frame protocol first: a real hub on a temporary project whose journal is seeded with many records, plus a real spoke announcing events. The fake harnesses come second. Neovim runs headless on the stub hub. Keep the journal-seeding helper in the new test file, not in `hub/test/harness.ts`: the hub lane (T-268) is rewriting the harness at the same time.
- No new seams inside the hub.
- Neovim is the host with no plugins (ADR 0005).
- Every key and the palette action go through the action registry.
- Suites run through `cland verify`.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.
- `events.list` pages from the end of the journal without reading the whole file.

## Acceptance criteria

- [x] C1. Announced events (session, task, topic, artifact and usage), suite results with their branch and outcome, and notifications with their subject are journaled through the log tap; `events.list` maps them and the older records that carry enough onto rows of the eight kinds.
  - done: impl-286 · 2026-10-12T12:23:16.165Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-2 · 2026-10-12T12:36:49.291Z · commit 6e9530f062be7e40757730cf40a8c778968d3551
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-3 · 2026-10-12T12:44:31.352Z · commit 95ea58ede05a44dc561b693917f0e8d585e3243f
- [x] C2. `events.list` returns at most 200 rows older than its cursor, newest first, with the next cursor; a test proves it reads only the journal's tail (for example a bound on the bytes read on a large seeded journal), and pages neither repeat nor skip rows while records append.
  - done: impl-286 · 2026-10-12T12:23:16.434Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-2 · 2026-10-12T12:36:49.291Z · commit 6e9530f062be7e40757730cf40a8c778968d3551
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-3 · 2026-10-12T12:44:31.352Z · commit 95ea58ede05a44dc561b693917f0e8d585e3243f
- [x] C3. `␣E` from any view, `e` or Enter on the inbox's events line and the palette action open the view; `␣␣` returns to the previous view.
  - done: impl-286 · 2026-10-12T12:23:16.611Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-2 · 2026-10-12T12:36:49.291Z · commit 6e9530f062be7e40757730cf40a8c778968d3551
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-3 · 2026-10-12T12:44:31.352Z · commit 95ea58ede05a44dc561b693917f0e8d585e3243f
- [x] C4. The view groups rows by day under day rules, shows the newest 200, `A` appends 200 older rows, `za` folds a day, and a pushed row appears at the top live.
  - done: impl-286 · 2026-10-12T12:34:56.144Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-2 · 2026-10-12T12:36:49.291Z · commit 6e9530f062be7e40757730cf40a8c778968d3551
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-3 · 2026-10-12T12:44:31.352Z · commit 95ea58ede05a44dc561b693917f0e8d585e3243f
- [x] C5. Enter opens a row's item, session, topic or artifact, and `gi`, `gt` and `gs` jump from it.
  - done: impl-286 · 2026-10-12T12:23:16.911Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-2 · 2026-10-12T12:36:49.291Z · commit 6e9530f062be7e40757730cf40a8c778968d3551
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-3 · 2026-10-12T12:44:31.352Z · commit 95ea58ede05a44dc561b693917f0e8d585e3243f
- [x] C6. Targeted tests pass (hub frame tests on a real hub with a seeded journal, nvim headless tests on the stub hub, read with `screenstring()`), and `hub/README.md` documents `events.list` and the push and `nvim/README.md` the view and its keys.
  - done: impl-286 · 2026-10-12T12:23:17.052Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-2 · 2026-10-12T12:36:49.291Z · commit 6e9530f062be7e40757730cf40a8c778968d3551
  - verified: rev-23 [reviewer] · run rev-2026-10-12-286-3 · 2026-10-12T12:44:31.352Z · commit 95ea58ede05a44dc561b693917f0e8d585e3243f

## Comments

### impl-286 · 2026-10-12T12:16:51.719Z

Implemented the journal-backed frame and centre view. Targeted real-hub tests cover tail-only reads of 135,000 records, stable byte cursors under appends, all eight kinds and persisted/live artifact announcements. Headless stub tests cover opening routes, day rules, 200-row paging, folds, live selection, four subject types and gi/gt/gs. Finishing documentation and final branch integration before requesting review.

### rev-23 · 2026-10-12T12:30:01.234Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-286-1
commit: f3da6a0e684806ed4767f3d1e87ef5ae82721eae

Medium: nvim/lua/cland/events.lua:50 discards live rows while a subject view is open; layout.back (layout.lua:449) restores Events without enter/load, so Enter → new event → ␣␣ omits that row and older paging cannot recover it. Preserve/reconcile the newest rows on return while keeping selection and loaded older pages; cover the round trip headlessly.
Low: hub/src/hub/journal.ts:412 recognizes only the word handover; current no-note handover notifications say handed the role over (core.ts:1602–1612), yielding ● instead of ⇄. Direct eventRow invocation confirmed the mismatch.
Evidence: A-1506 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1506-t-286-review-not-clear-at-f3da6a0.md. Standards: no actionable findings. C4 failed; other criteria inspected but no verified marks on this not-clear verdict. Full cland verify remains pending; targeted passes are reported in A-1505.

Criteria: C4 failed (Events received while a subject view is open are discarded; ␣␣ restores cached Events without fetching the missing newer rows.).

### rev-23 · 2026-10-12T12:36:49.291Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-286-2
commit: 6e9530f062be7e40757730cf40a8c778968d3551

No high, medium or low findings remain from A-1506. Hidden Events retains live rows and restores selection/older pages on Back; the headless regression covers the complete subject round trip with a delivery barrier. Actual no-note handovers now render ⇄ with frame regression coverage. C1–C6 checked using the prior full source review, this delta and updated targeted evidence A-1508 (hub 3/3, headless 2/2, typecheck). Evidence A-1510: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1510-t-286-review-clear-at-6e9530f.md. Full verify remains held by the Coordinator for the unrelated roles.test.ts fix; no full-suite green is claimed, and the eventual new head requires a delta/evidence check.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-12T12:44:31.352Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-286-3
commit: 95ea58ede05a44dc561b693917f0e8d585e3243f

No findings. Delta from clear 6e9530f is exactly the canonical 811f0d2 patch: four deepEqual expectations in hub/test/roles.test.ts add permissions: null while preserving all existing fields and exact assertions. Every T-286 implementation/test/doc file is unchanged. C1–C6 checked and reverified for this exact head using A-1510/A-1508 and this delta; clean worktree confirmed. Evidence A-1513: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1513-t-286-final-head-delta-clear-at-95ea58e.md. Full cland verify all is being submitted; no full-suite pass is claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-286 · 2026-10-12T13:03:07.538Z

Full verification 855ba4b0-a4ed-4d7b-8324-20b36a7a8602 passed at 95ea58ede05a44dc561b693917f0e8d585e3243f: typecheck and full hub/Neovim suite, 1,628 tests passed, 0 failures/cancelled/skipped. Durable log A-1517: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1517-suite-855ba4b0-a4ed-4d7b-8324-20b36a7a8602-all-at-95ea58e.log. Final-head delta review is clear (rev-2026-10-12-286-3), C1–C6 verified.

### coord · 2026-10-12T13:03:28.752Z

Merged e8a8b196ee8a85f9400e0bf466d9ba1e9ef42f3a onto dev.
