---
id: T-229
kind: epic
title: "Epic: Session lifecycle"
state: open
labels:
  - epic
  - v0.1.1
assignee: null
parent: T-227
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:48:08.410Z
updated: 2026-10-12T00:15:37.907Z
---

## Goal

Sessions stop, die, reconnect and hand over work in ways the hub records correctly: a clean stop is never a death, a stop is never refused on a stale identity, a role request never vanishes, and the hub's process and tracker ownership survive restarts and load.

## Contents

Ten known defects from the v0.1 run (tech debt T-216, decision D21): T-147, T-222, T-226, T-202, T-129, T-102, T-211, T-170, T-103 and T-137.

## Definition of done

QA runs the demo below on `dev` in a scratch project with the fake harnesses and records a clear verdict on this epic with each checkbox verified by its id.

- [ ] A post-merge or manual stop of a Codex, Claude Code or OpenCode session is recorded as stopped, never died, and `cland session stop` succeeds or names a real cause (T-147, T-222).
- [ ] A role-addressed review or QA request either reaches a verifier or tells the sender exactly why not, with no silent loss (T-226).
- [ ] Ownership and recovery hold across a hub restart and overlapping doctors: no orphaned processes, no stranded pending cleanup, and a pooled Implementer moves to its next item's worktree (T-129, T-102, T-211).
- [ ] Reopening a merged item no longer blocks `cland push` or strands a worktree; a nameless spoke retries into a clear refusal (T-170, T-202).
- [ ] A hung tracker write times out with a named error instead of stalling all tracker work, and OpenCode approvals show their command (T-103, T-137).
- [ ] hub/README.md and the affected skills describe the changed behaviour.

## Plan

```yaml
stages:
  - name: stop and routing
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-147
        - T-222
      - - T-226
      - - T-202
      - - T-249
  - name: ownership and recovery
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-129
        - T-102
      - - T-211
      - - T-170
  - name: tracker and approvals
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-103
      - - T-137
      - - T-252
```
