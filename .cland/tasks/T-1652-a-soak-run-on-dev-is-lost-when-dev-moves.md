---
id: T-1652
kind: task
title: "A soak run on dev is lost when dev moves during its host gate: it bundles the live root, not the submitted commit"
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1015
topic: null
branch: null
created: 2026-11-03T03:03:13.829Z
updated: 2026-11-16T07:29:03.951Z
---

## Summary

Soak run a19be651 (A-16141) was admitted at 2026-11-03T03:00:08Z on dev f6128ed4, from the live root. T-1594 landed at 03:01:59Z, during the 37 s T0 host gate. Droplet delivery then refused with "dirty or changed worktree cannot be bundled for droplet: HEAD changed", and the run ended "all exit 1" with no tests run. Soak delivery runs `checkWorktree` against the live root (`hub/src/executor/droplet/run.ts:33`). Demos already deliver the submitted commit with `committedOnly` (`hub/src/hub/demos.ts:81`), and T-1015 fixed the same race for periodic dev T3. On a busy merge queue, dev moves every ~30–40 min, so soak runs can keep being lost.

## What to build

Soak runs, and any other integrated-dev occasion admitted from the live root, bundle the submitted committed head (committed-only delivery), as T-1015 did for periodic T3. A delivery that still cannot be made records the run as not run for an infrastructure cause, not as exit 1.

## Acceptance criteria

- [ ] C1. A soak run admitted at dev commit A, with dev moved to B during its host gate, delivers A's tree to the droplet and runs (test).
- [ ] C2. A soak delivery that fails for an infrastructure cause is recorded as not run with that cause, never as a red exit, and starts no culprit search or incident (test).
