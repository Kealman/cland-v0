---
id: T-286
kind: task
title: "The events view: events.list over the journal, ␣E, day groups and paging"
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-274
blocked_by: []
topic: topic-169
branch: t/T-286-the-events-view-events-list-over-the
created: 2026-10-12T11:57:19.740Z
updated: 2026-10-12T12:00:29.546Z
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

- [ ] Announced events (session, task, topic, artifact and usage), suite results with their branch and outcome, and notifications with their subject are journaled through the log tap; `events.list` maps them and the older records that carry enough onto rows of the eight kinds.
- [ ] `events.list` returns at most 200 rows older than its cursor, newest first, with the next cursor; a test proves it reads only the journal's tail (for example a bound on the bytes read on a large seeded journal), and pages neither repeat nor skip rows while records append.
- [ ] `␣E` from any view, `e` or Enter on the inbox's events line and the palette action open the view; `␣␣` returns to the previous view.
- [ ] The view groups rows by day under day rules, shows the newest 200, `A` appends 200 older rows, `za` folds a day, and a pushed row appears at the top live.
- [ ] Enter opens a row's item, session, topic or artifact, and `gi`, `gt` and `gs` jump from it.
- [ ] Targeted tests pass (hub frame tests on a real hub with a seeded journal, nvim headless tests on the stub hub, read with `screenstring()`), and `hub/README.md` documents `events.list` and the push and `nvim/README.md` the view and its keys.
