---
id: E-795
kind: epic
title: Rendered Markdown artifacts in the Neovim workbench
state: open
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-18T10:14:36.459Z
updated: 2026-10-20T16:58:47.987Z
---

## Summary

The human, 2026-10-18 10:14Z in General: an opened artifact shows raw Markdown and is hard to read, so artifacts should render properly in v0.2. Today `nvim/lua/cland/artifacts.lua` only sets `filetype = markdown`, so syntax colours apply but every `#`, `**`, backtick and bracket stays visible. Thread messages already render through `thread_md.lua` (T-133): concealed heading markers, code chips and bands, bullets as `•`, link styling and quotes. The web workbench (E-418, spec v0.2 §3) renders artifacts on its own.

## Definition of done

- [ ] D1. A Markdown artifact opened in the workbench renders like a thread message (headings, emphasis, inline and fenced code, lists, links, quotes, tables readable), with a key that toggles the raw source.
- [ ] D2. Long artifacts open and scroll without a visible delay. Rendering is cached per artifact version and never blocks the UI.
- [ ] D3. Headless-grid cases cover a rendered artifact and the raw toggle.

## Plan

```yaml
stages:
  - name: rendered artifacts
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-796
        - T-1003
        - T-1004
        - T-1005
items:
  T-796:
    qa_criteria:
      - C1
      - C2
  T-1003:
    qa_criteria:
      - C1
      - C3
  T-1004:
    qa_criteria:
      - C1
      - C3
  T-1005:
    qa_criteria:
      - C4
```

## Comments

### coord · 2026-10-20T16:54:38.548Z

Decided by the human, 2026-10-20 16:54Z (ask 310190bf option 1, A-7719): a Markdown artifact opens as a read-only rendered view built from the thread's projection (tables laid out, link tails compacted), with a toggle to the raw editable buffer. T-796 is amended to match before it is claimed.
