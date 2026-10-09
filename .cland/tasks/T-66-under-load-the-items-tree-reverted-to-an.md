---
id: T-66
kind: task
title: "Under load the items tree reverted to an earlier snapshot after live updates: a late full list overwriting newer events?"
state: open
labels:
  - slice-1
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T08:58:42.263Z
updated: 2026-10-09T16:49:19.682Z
---

## Parent

Part of T-19. Seen by qa-6 on 2026-10-09 during T-50's QA (branch 4c1f7cd, whose change is in the Codex adapter and touches no Neovim code), with the machine's load average above 140 (six Implementers, Reviewers and QA running suites at once).

## What happened

The full `npm test` failed once in nvim/test/shell.test.ts, the case "the tree follows task events: a claim, a new item, a removed file": the screen never showed T-13 gone within 10000 ms. The failure's screenshot showed the initial item list restored (T-13 present again, T-14 absent, T-7's claim absent) after earlier assertions in the same case had seen the updates applied. The isolated rerun (`node --test --test-name-pattern='the tree follows task events' nvim/test/shell.test.ts`) passed. A similar one-off failure hit the hub suite on main after T-49's merge at 07:52Z (not captured).

## Suspicion

A late answer to a full `task.list` (or an index rebuild) arrives after newer `task` events were applied and overwrites the tree with the older snapshot; under load the ordering flips. If so, the items panel must apply a snapshot only when it is newer than the events already applied (a sequence or timestamp from the hub), or re-apply the events after it.

## Acceptance criteria

- [ ] The race is reproduced at the stub-hub seam (a delayed snapshot after events) and the tree keeps the newer state
- [ ] `nvim/README.md` says how snapshots and events are ordered
- [ ] `npm run typecheck && npm test` pass

## Comments

### coord · 2026-10-09T09:06:45.969Z

Second occurrence, 09:05Z: impl-53's full suite on t/T-53-cland-init-territory (no Neovim change) failed the same case, "the tree follows task events" waiting for T-13's removal at shell.test.ts:1142, under the same load; the isolated rerun passed. Two sessions, two branches, same symptom: the race is in the items panel's handling of a late snapshot, not in any branch under test.
