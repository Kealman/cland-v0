---
id: T-264
kind: map
title: "The item explorer: from the decided principles to spec sections, mockups and a prototype"
state: open
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:11:53.038Z
updated: 2026-10-12T10:03:35.316Z
---

## Destination

Spec v0.1.2 sections 3.8 to 3.11 (the explorer, the item card and the summary, categories, the side panel at release scope) and the inbox form (3.7) final, with accepted mockups on the design canvas mirrored in docs/design/main-screen/ and a Neovim prototype on prototype/explorer, ready for the release's epics (/to-spec on T-228).

## Notes

This map stands on its own (a map cannot sit under a release); T-228 links to it. Charted on 2026-10-12 in the cland-design session from the human's observations (tickets T-243, T-244, T-245, T-237, T-247 under T-228) after three grilling rounds on the release. Settled while charting, recorded in docs/spec/v0.1.2.md §3.7 to §3.11: the explorer as an outline tree in the centre with the card following the cursor; rows per level; the explorer edits nothing by hand, its one action is a quick message to the Coordinator in the item's topic; `## Summary` with the first-paragraph fallback; categories as a root container kind with `idle_from`; the side panel's epic rows at release scope; the inbox as the now layer only. Skills: prototype (mockups on the canvas, then the Neovim prototype), research. Standing preferences: every artifact in English; mockups follow the vocabulary in docs/design/main-screen/README.md and are published on the design canvas (https://claude.ai/artifact/TuzGTeNLthjo2RLwMyhZfp); the prototype is throwaway on its branch, never merged; the human reacts to the mockups before the prototype starts; recorders apply resolutions one at a time.

## Decisions so far

- Summary fallback on the existing items, and prior art for tree explorers with a detail pane (T-258, .cland/tasks/T-258-summary-fallback-on-the-existing-items-and.md): the plain first paragraph reads as a summary for 63% of 264 items, the refined rule (first non-boilerplate section, first prose paragraph without provenance, two sentences, 50 words) for 87.5%; copy: folds in a model keyed by id, the cursor restored by id then neighbour then ancestor, the card in its own window following the cursor, scoping with a real back stack, counts from children; avoid: Vim folds over a rewritten buffer, line-number cursor restore, a detail that loads only on Enter. docs/research/explorer-prior-art.md on research/explorer-prior-art.
- Explorer mockups: the release root, an epic unfolded, the categories root (T-259, .cland/tasks/T-259-explorer-mockups-the-release-root-an-epic.md): three boards accepted with proposals P1 to P22; m is the one action; epic state derives from tasks; stage groups; direct tasks row; D everywhere; spec §3.8, §3.10, §3.11.
- Item card mockups: an epic and a task, with the quick message to the Coordinator (T-260, .cland/tasks/T-260-item-card-mockups-an-epic-and-a-task-with.md): two boards accepted; Enter focuses the card, the composer one line until m, container cards derive from the subtree; spec §3.9.
- Inbox mockup on the now-layer principle, and the events view (T-261, .cland/tasks/T-261-inbox-mockup-on-the-now-layer-principle.md): two boards accepted with proposals P1 to P18; four sections with leave rules, the request kind, the events view with ␣E, 200 rows, filters, coalescing; spec §3.7, GLOSSARY Event and Request.

## Not yet specified

- Search and filter inside the explorer (text, label, status) and the palette's `#` prefix on it.
- Large trees: what the explorer does with hundreds of done items and several releases (paging, lazy folds).
- The quick message to the Coordinator: how the Coordinator's clause reads it and acts (the composition and the keys are decided, §3.8); the prototype shows the composer.
- The summary fallback in code: detecting provenance sentences and lead-ins (§3.9); the explorer epic decides from the T-258 script.
- The migration mechanics of prefixes (§3.1) and categories (§3.10) as one command; the explorer epic's plan decides.
- What the card shows for a release, a map and a question, the kinds beyond epic and task.

## Out of scope

- The hub lane of v0.1.2 (T-256, T-246, T-240, T-255, T-253, T-254): decided on T-228, not in this map.
- Hand editing of items from the explorer: ruled out for v0.1.2 by the human on 2026-10-12; a later version may revisit.
