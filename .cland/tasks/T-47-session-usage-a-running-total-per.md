---
id: T-47
kind: task
title: "Session usage: a running total per session, the same meaning for every adapter"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T19:48:52.597Z
updated: 2026-10-08T19:48:56.312Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08, collecting the token numbers for the record.

## Problem

`hub.status` `harnesses[].usage` (and the sessions panel's `12.3k tok`, the item view's cost) mean different things per adapter:

- Codex: `tokens.total` is the thread's running total (rev-43: 1,556,962 tokens, 1,481,344 of them cached input).
- Claude Code: the mod's `turn.complete` usage of the **latest turn only** (coord-2: 36 input, 658 output, 305,891 cache read), so a long Coordinator session shows a few hundred tokens.
- OpenCode: `session.step.ended` of the **latest step only** (impl-43b: 55,282 input, 124 output, cost 0), so the panel showed `351 tok` for a session that did the whole item.

Nobody can read a session's cost from cland today, which the item view's cost field promises.

## What to build

- The hub keeps a running total per launched session (input, output, cache read, cache write, cost where reported) besides the latest turn, adding each Claude Code turn and each OpenCode step, and taking Codex's own total as it is.
- `HarnessProcess.usage` gains `total` (same shape for every adapter) and `last`; the sessions panel and the item view's cost show the total.

## Acceptance criteria

- [ ] Two turns of the fake Claude Code and two steps of the fake OpenCode sum into `usage.total`; Codex's total passes through
- [ ] The sessions panel shows the total (nvim test against the stub hub)
- [ ] `hub/README.md` documents `usage.total` and `usage.last`
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:48:56.312Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/46 (filed during the T-42 run; the numbers differ, the item is the source of truth).
