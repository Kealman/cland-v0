---
id: T-228
kind: release
version: 0.1.2
title: "Release: v0.1.2"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:47:48.610Z
updated: 2026-10-12T08:59:33.434Z
---

## Goal

v0.1.2 "Working with items": the human works with items in cland as a full planning and tracking tool, not only watches status in the side panel. The core is the item explorer (T-243) with the human's item card (T-244), the release scope by epics (T-237, T-238), categories outside epics (T-245), id prefixes by kind (T-241) and done items distinct in the graph (T-242). Everything else is around that core.

## Notes

Formed by decision D21 (2026-10-11): what needs the human's grilling. Grilled with the human from 2026-10-12 in the cland-design session, breadth-first on the release as a whole; decisions land here and on the tickets, then in the spec; the explorer cluster is charted as a wayfinder map.

## Decisions so far

Round 1, 2026-10-12 (the human answered yes to all):

1. Goal as above; the release is named "Working with items".
2. Scope: everything under this item is in v0.1.2. T-248 is the human's own task (their terminals), not crew work, and does not hold the release. Two lanes: workbench (the core, T-247 inbox, T-239 sessions panel, T-257 stopped sessions) and hub (T-256 remote executors, T-246 queue UX, T-240 accounts and limits, T-255 per-model performance, T-253, T-254).
3. Order: the hub lane starts with T-256 so the rest of the build runs its suites on cloud VMs; the workbench lane starts with the explorer core.
4. Fog and AFK work: one wayfinder map for the explorer cluster (mockups on the canvas and a Neovim prototype, as in v0.1); in parallel, AFK: a prototype run of the suite on a DigitalOcean 8 vCPU VM (T-256), research on harness limits and account selection (T-240), research extracting per-model task data from the journal (T-255).
5. The DigitalOcean token lives in the human's shell environment (`DIGITALOCEAN_TOKEN` in `~/.zshrc`); the prototype reads it and never stores it; its VMs are tagged and swept.
6. D23 accepted: detection and the bounded stop stay as shipped in v0.1.1; the fail-fast exit is T-253, ordinary tech debt, not raised.
7. Crew as in v0.1.1 (Implementers on Codex gpt-6.1-sol, Claude Code roles on sonnet, Reviewer pool 2); plan approval `human` for the explorer epic only, `none` for the rest.

Round 2, 2026-10-12 (the human answered yes to all; recorded in docs/spec/v0.1.2.md §3.1 to §3.7 and on each ticket):

1. T-241: the number is the identity, the prefix follows the kind (R-, E-, T-, Q-, M-, S-, C-), one shared counter, any prefix resolves, migration renames files and frontmatter references only.
2. T-238: planned derives from the epic plan (the current stage), the hub moves the next stage; by hand without a plan; the release scope shows only its own items, the rest under the all filter and a count line.
3. T-242: done nodes in a done colour with a green glyph, no strikethrough; containers carry done/total and the count in work; the same for done rows elsewhere.
4. T-239: the latest hold and +N; a pending request shows dimmed until the hold.
5. T-257: resume through the harness, d archives, automatic archival of crew sessions (one hour after merge or close, else 24 hours), never Aides, more shows the latest 20, cland session prune.
6. T-246: no general queue API; the verify line becomes the queue summary and opens the queue view; the human's npm test goes through the queue unless --force.
7. T-247: the inbox is the now layer only, sections by kind, newest first, capped; events move to an events view; the form from a mockup in the explorer map.
8. The explorer map's destination: spec v0.1.2 sections for the explorer and the item card with accepted mockups and a Neovim prototype, ready for epics; the map holds T-243, T-244, T-237, T-245 and the inbox mockup; `docs/spec/v0.1.2.md` started as a draft.

## Open

Round 3: charting the explorer map breadth-first (structure and navigation, rows, the card and the summary source, editing, categories, keys and place, the side panel at release scope, mockups and prototype).

## Comments

### human · 2026-10-12T08:43:15.306Z

Round 1 of the v0.1.2 grilling (2026-10-12) recorded in the body: goal, scope and lanes, order, the wayfinder for the explorer cluster and the AFK prototype and research, the token, D23 accepted, the crew.
