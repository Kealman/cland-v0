---
id: T-287
kind: task
title: Events view quiet rows, warnings, filters in ui.json, gM and the last look
state: open
status: ready
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-274
blocked_by:
  - T-286
topic: topic-174
branch: t/T-287-events-view-quiet-rows-warnings-filters
created: 2026-10-12T11:57:19.803Z
updated: 2026-10-12T15:30:30.322Z
---

## Summary

The events view gets quieter and easier to scan. Bookkeeping rows are dimmed, equal events within 60 seconds merge into one row ×N, and warnings are classed (including a red suite on `dev`). The view gains filter keys kept in `ui.json` and `gM` to mute a subject in the events view. Opening the view sets the human's last look, behind the inbox's events line.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**Classes and merging, in the hub.** `events.list` and the pushed rows arrive already classed and merged:

- **Bookkeeping.** Launches, stops, claims, status moves, criterion marks and topic closes are marked bookkeeping, and the view dims them.
- **Warnings.** A not-clear verdict, a session death, an event a project override raises to now (it has no inbox row) and a red suite on `dev` are marked warnings and show an amber ⚠ in place of their glyph. A red suite on a task branch stays ordinary.
- **Merging.** Equal events on one subject within 60 seconds of each other merge into one row with ×N, as the §3.9 hygiene coalesces deliveries. A merge never spans a page boundary in a way that shows the same event twice.
- **No repeats.** Nothing still waiting in the inbox repeats in the view: a row whose event is a waiting ask, approval, plan approval, request or message is left out. What follows from it may show, such as a plan approved.

**Filters.** `events.list` takes a filter: kinds, warnings only, a subject (an item with its subtree, a session, a topic or an artifact) and the muted subjects. It returns the newest 200 rows that match. In the view:

- `1` to `8` pick a kind (session, task, verdict, suite, release, artifact, usage, topic);
- `0` shows all kinds;
- `w` shows warnings only;
- `s` picks a subject through the palette's prefixes (`@` session, `#` item with its subtree, `/` topic, `~` artifact);
- `F` clears the filter.

A header line shows the active filter, as the board draws it. The filter is kept in `ui.json` with the workbench's other preferences, so it survives a restart of the workbench.

**`gM` mutes a subject in the events view.** `gM` on a row adds the row's subject to an events-view mute list kept in `ui.json` under the events view's own key; `gM` again restores it. This list is the events view's alone (the Coordinator's decision of 2026-10-12): the hub's layer mutes of v0.1 §3.5 (`visibility`, which cover topics, sessions and artifacts and lower a layer everywhere) are not touched, so a mute here never changes the inbox or the layers. The view hides a muted subject's rows, passes the list to `events.list` as its muted subjects, and says how many subjects it hides.

**The last look.** Opening the view stores the human's last look, a timestamp in `ui.json`. A rule in the view marks it ("△ your last look · 09:40 · 16 new above") until the human leaves the view. The inbox's events line now reads "△ N new events since your last look · ⚠ M" in the watch colour. N counts the loaded rows newer than the last look and reads "200+" past the cap; M counts the warnings among them. The line drops to zero once the view opens. The line shows in the inbox's empty state too. Keep the inbox change to that one line's text and count: the inbox renderer is being rewritten by the four-sections ticket in parallel.

**Demo.** `w` shows only warnings. A burst of five equal events on one subject within a minute shows as one row ×5. The inbox's events line drops to zero once the view opens. After a workbench restart the view opens with the same filter.

Out of scope: the retirement of the inbox's notification list (the next ticket); the card that Enter will open for an item ("The explorer and the card"); any change to the hub's `visibility` mutes.

**Constraints.**

- Tests go through the hub's frame protocol first (a real hub with a seeded journal and real announced events) and the fake harnesses second. Neovim runs headless on the stub hub.
- No new seams inside the hub.
- Neovim is the host with no plugins (ADR 0005).
- `ui.json` keeps its lock and its other owners' fields.
- Every key goes through the action registry.
- Suites run through `cland verify`.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.
- `events.list` with a filter still pages from the end of the journal without reading the whole file.

## Acceptance criteria

- [x] C1. Launches, stops, claims, status moves, criterion marks and topic closes are dimmed; five equal events on one subject within 60 seconds show as one row ×5.
  - done: impl-287 · 2026-10-12T15:28:57.611Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-287-2 · 2026-10-12T15:30:28.664Z · commit a14ab6d017ff3b11d441d3f60dff34e5e2078a3d
- [x] C2. Not-clear verdicts, deaths, override-raised events and a red suite on `dev` show as warnings; a red suite on a task branch does not; no row repeats something still waiting in the inbox.
  - done: impl-287 · 2026-10-12T15:14:28.531Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-287-2 · 2026-10-12T15:30:28.664Z · commit a14ab6d017ff3b11d441d3f60dff34e5e2078a3d
- [x] C3. `1`–`8`, `0`, `w`, `s` with each palette prefix and `F` filter the view as described, and the filter survives a workbench restart through `ui.json`.
  - done: impl-287 · 2026-10-12T15:14:28.850Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-287-2 · 2026-10-12T15:30:28.664Z · commit a14ab6d017ff3b11d441d3f60dff34e5e2078a3d
- [x] C4. `gM` hides the subject's rows through the events-view mute list in `ui.json` and the view says how many subjects it hides; `gM` again restores them; the hub's `visibility` mutes and the inbox are unchanged by it.
  - done: impl-287 · 2026-10-12T15:14:29.215Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-287-2 · 2026-10-12T15:30:28.664Z · commit a14ab6d017ff3b11d441d3f60dff34e5e2078a3d
- [x] C5. Opening the view sets the last look in `ui.json`; the inbox's events line counts the newer rows and warnings apart, reads "200+" past the cap, and drops to zero after the view opens.
  - done: impl-287 · 2026-10-12T15:14:29.850Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-287-2 · 2026-10-12T15:30:28.664Z · commit a14ab6d017ff3b11d441d3f60dff34e5e2078a3d
- [x] C6. Targeted tests pass (hub frame tests of the classes, merging and filters on a real hub; nvim headless tests on the stub hub for the keys, `ui.json` and the events line), and `nvim/README.md` and `hub/README.md` describe the classes, the filters, `gM` and the last look.
  - done: impl-287 · 2026-10-12T15:14:30.287Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-287-2 · 2026-10-12T15:30:28.664Z · commit a14ab6d017ff3b11d441d3f60dff34e5e2078a3d

## Comments

### impl-287 · 2026-10-12T14:32:31.241Z

Implementation started: hub classes/coalescing/filtering first, then events view preferences, keys, mutes and last-look count. Inbox edits will stay on the events line.

### impl-287 · 2026-10-12T15:14:30.905Z

Implementation pushed at aa432f2887ae8b1b4a20c22a532939b2605c6e50. All 36 targeted tests, typechecks and shard lint pass; details in A-1542. origin/dev fetched and merged before full suite (current). Hub outage resolved; requesting exact-head review and full cland verification. Policy has no per-item QA or qaCriteria.

### rev-23 · 2026-10-12T15:22:06.798Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-287-1
commit: aa432f2887ae8b1b4a20c22a532939b2605c6e50

Medium: hub/src/hub/core.ts:358 live cache starts empty after restart and events.list never seeds it, so the first equal live row lacks replaces/count and duplicates a recent restored journal group instead of extending ×N.
Medium: nvim/lua/cland/events.lua:248 only the immediate replaces id maps to a row; R1→R2→R3 while Events is hidden loses R1, so Back moves the selected group to its day header. Preserve the full replacement identity chain and regression-test hidden selection with older pages.
Evidence A-1547: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1547-t-287-review-restored-groups-and-replacement-identity.md. Read C1–C6, spec/docs, production and tests. A-1542 reports 36 targeted checks passing; neither path above is covered. Full suite pending; no Reviewer test execution or edits.

Criteria: C1 failed (A first equal live event after restart does not join the restored journal group; multiple replacements also lose the original cursor identity.).

### impl-287 · 2026-10-12T15:28:17.989Z

Both C1 review regressions reproduced and fixed. A real hub restart test now verifies the first equal live row replaces a journal ×5 group with ×6 even when the group lies beyond the first 200 rows. Headless regression verifies hidden and same-batch replacement chains retain the selected group and 400 loaded rows. Existing real-hub and headless events tests and typechecks pass. Prior verification ff07948a was cancelled (A-1548) because the reviewed head required fixes.

### rev-23 · 2026-10-12T15:30:28.664Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-287-2
commit: a14ab6d017ff3b11d441d3f60dff34e5e2078a3d

No remaining high/medium findings. Startup restores recent journal groups beyond the first page before live announcements, preserving predecessor/count on the first equal event. UI aliases preserve the full replacement chain until visible cursors move. Real-frame restart and headless hidden/batched cursor regressions cover both A-1547 traces, including older pages. C1–C6 checked; classes, filters/persistence, independent mutes, last-look counts and READMEs retained. A-1542/A-1549 report targeted tests/typechecks passing. Full suite pending; cancelled A-1548 is not pass evidence. Evidence A-1552: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1552-t-287-re-review-clear-at-a14ab6d.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
