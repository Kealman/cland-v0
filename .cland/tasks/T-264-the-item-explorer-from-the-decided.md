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
updated: 2026-10-12T09:11:53.038Z
---

## Destination

Spec v0.1.2 sections 3.8 to 3.11 (the explorer, the item card and the summary, categories, the side panel at release scope) and the inbox form (3.7) final, with accepted mockups on the design canvas mirrored in docs/design/main-screen/ and a Neovim prototype on prototype/explorer, ready for the release's epics (/to-spec on T-228).

## Notes

This map stands on its own (a map cannot sit under a release); T-228 links to it. Charted on 2026-10-12 in the cland-design session from the human's observations (tickets T-243, T-244, T-245, T-237, T-247 under T-228) after three grilling rounds on the release. Settled while charting, recorded in docs/spec/v0.1.2.md §3.7 to §3.11: the explorer as an outline tree in the centre with the card following the cursor; rows per level; the explorer edits nothing by hand, its one action is a quick message to the Coordinator in the item's topic; `## Summary` with the first-paragraph fallback; categories as a root container kind with `idle_from`; the side panel's epic rows at release scope; the inbox as the now layer only. Skills: prototype (mockups on the canvas, then the Neovim prototype), research. Standing preferences: every artifact in English; mockups follow the vocabulary in docs/design/main-screen/README.md and are published on the design canvas (https://claude.ai/artifact/TuzGTeNLthjo2RLwMyhZfp); the prototype is throwaway on its branch, never merged; the human reacts to the mockups before the prototype starts; recorders apply resolutions one at a time.

## Decisions so far

(none yet)

## Not yet specified

- The events view (§3.7): its form, keys and cap; decided with the inbox mockup or right after it.
- Search and filter inside the explorer (text, label, status) and the palette's `#` prefix on it.
- Large trees: what the explorer does with hundreds of done items and several releases (paging, lazy folds).
- The quick message to the Coordinator: what context rides with it, how the Coordinator's clause reads it, its keys; the prototype proposes.
- The migration mechanics of prefixes (§3.1) and categories (§3.10) as one command; the explorer epic's plan decides.
- What the card shows for a release, a map and a question, the kinds beyond epic and task.

## Out of scope

- The hub lane of v0.1.2 (T-256, T-246, T-240, T-255, T-253, T-254): decided on T-228, not in this map.
- Hand editing of items from the explorer: ruled out for v0.1.2 by the human on 2026-10-12; a later version may revisit.
