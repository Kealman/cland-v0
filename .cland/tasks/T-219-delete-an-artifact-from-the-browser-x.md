---
id: T-219
kind: task
title: "Delete an artifact from the browser: x with confirmation, a human-only delete frame"
state: open
status: backlog
labels:
  - ready-for-agent
assignee: null
parent: T-115
blocked_by:
  - T-195
topic: null
branch: null
created: 2026-10-11T08:59:55.948Z
updated: 2026-10-11T08:59:55.948Z
---

## What to build

Spec §3.6 says `x` in the Artifacts browser deletes an artifact after a confirmation. T-193 and T-194 expose no deletion: there's no `artifact.delete` frame, tool or CLI. T-195 ships the browser without `x`. This item adds the missing deletion end to end.

## Acceptance criteria

- [ ] A UI protocol frame for deleting an artifact. Only the human may use it, and agent sessions get no tool for it. It removes the file and updates the index, and the browser and topic chips see an event.
- [ ] `x` in the Artifacts browser asks for confirmation and deletes through that frame. Cancelling the confirmation leaves the artifact untouched.
- [ ] A deleted artifact's chip in topic history renders as deleted instead of failing to open.
- [ ] Protocol tests cover the refusal for agent sessions, the index and event update, and a delete of a moved artifact. A Neovim test covers confirm and cancel. `cland suite all` passes.

Deferred from T-195 (impl-195b's question in topic-125, 2026-10-11).
