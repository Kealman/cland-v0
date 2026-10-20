---
id: T-1028
kind: task
title: launcher-component free-text case times out waiting for Insert mode under load-gate pressure
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-882
found_by: cover
topic: null
branch: null
created: 2026-10-20T20:13:05.016Z
updated: 2026-10-20T20:19:02.324Z
---

## Summary

`nvim/test/launcher-component.test.ts` "failed or empty model answers keep free text with a one-line reason" timed out waiting for Insert mode (`the launcher model field accepts Insert input: not within 15000 ms`, 15.33 s against its 2 s T2 budget) in the Linux stage cover 90cd4eeb at 44097bad (A-8033), while the load gate ran five repetitions of other Neovim files beside it. The test file and the launcher are unchanged since T-882, and the same case passed in stage cover 888e98da at 7c1aeae9 an hour earlier.

## What to build

Make the case wait on the state it asserts (the model field's mode or buffer state through a completion receipt, per rule 9) rather than a 15 s wall-clock poll, and check whether its 2 s T2 budget is realistic (T-882 history).

## Acceptance criteria

- [ ] C1. The case passes 20/20 under the load gate's parallel repetitions on a droplet, waiting on a state receipt, not a wall-clock poll (receipt named in the item).

## Comments

### coord · 2026-10-20T20:19:02.324Z

Flaky-rerun rule applied 2026-10-20 20:22Z: the case passed 5/5 alone on macOS arm64 locally at 44097bad (node --test --test-name-pattern, quiet machine); one resubmit of the Linux stage cover follows. Linux evidence of the flake: stage cover 90cd4eeb (A-8033).
