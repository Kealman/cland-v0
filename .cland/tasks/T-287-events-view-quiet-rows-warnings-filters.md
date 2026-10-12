---
id: T-287
kind: task
title: Events view quiet rows, warnings, filters in ui.json, gM and the last look
state: open
status: in progress
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
updated: 2026-10-12T14:32:31.241Z
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

- [ ] Launches, stops, claims, status moves, criterion marks and topic closes are dimmed; five equal events on one subject within 60 seconds show as one row ×5.
- [ ] Not-clear verdicts, deaths, override-raised events and a red suite on `dev` show as warnings; a red suite on a task branch does not; no row repeats something still waiting in the inbox.
- [ ] `1`–`8`, `0`, `w`, `s` with each palette prefix and `F` filter the view as described, and the filter survives a workbench restart through `ui.json`.
- [ ] `gM` hides the subject's rows through the events-view mute list in `ui.json` and the view says how many subjects it hides; `gM` again restores them; the hub's `visibility` mutes and the inbox are unchanged by it.
- [ ] Opening the view sets the last look in `ui.json`; the inbox's events line counts the newer rows and warnings apart, reads "200+" past the cap, and drops to zero after the view opens.
- [ ] Targeted tests pass (hub frame tests of the classes, merging and filters on a real hub; nvim headless tests on the stub hub for the keys, `ui.json` and the events line), and `nvim/README.md` and `hub/README.md` describe the classes, the filters, `gM` and the last look.

## Comments

### impl-287 · 2026-10-12T14:32:31.241Z

Implementation started: hub classes/coalescing/filtering first, then events view preferences, keys, mutes and last-look count. Inbox edits will stay on the events line.
