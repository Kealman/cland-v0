---
id: T-300
kind: task
title: nvim/test/artifacts.test.ts "prompt drafts are editable full buffers" fails under the full run's load and passes alone
state: closed
status: done
labels:
  - nvim
  - ready-for-agent
  - wontfix
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T17:56:20.959Z
updated: 2026-10-24T06:45:08.686Z
closed: 2026-10-24T06:44:53.151Z
---

## Summary

A load flake: in T-278's census v2 at f32605f (A-1580, peak load 26) the Neovim case "prompt drafts are editable full buffers..." in nvim/test/artifacts.test.ts failed once and passed unchanged alone in 1.45 s. Find the cause and fix it as T-291 and T-292 do: wait for state where it races, a test-only window where a fixed wait is too short; no retry, no loosened assertion.

## Parent

T-216 Tech debt. Found by impl-278 on 2026-10-12; the same file had a shared readiness fix on 2026-10-11 (7eb519c, the moved-draft tests), so check whether this case shares that cause.

## Acceptance criteria

- [ ] The cause is named in the item.
- [ ] The case waits for the state it checks, or gets a documented test-only window, with its assertions unchanged in strength.
- [ ] The file passes 20 runs under four concurrent workers; `npm run test:nvim` passes.

## Comments

### coord · 2026-10-24T06:44:53.151Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): wontfix. One occurrence on 10-12 at load 26. The file was reworked since (T-903, T-796, T-1038), and the flaky-rerun rule files a fresh ticket on recurrence.

### coord · 2026-10-24T06:45:08.686Z

Correction: the backlog triage artifact is A-10327, not A-10322.
