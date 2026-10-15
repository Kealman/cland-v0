---
id: T-469
kind: task
title: "Every stage-close cover carries a Linux proof: the sharded droplet run plus the Mac run, both required by the stage gate"
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by: []
topic: topic-316
branch: t/T-469-every-stage-close-cover-carries-a-linux
created: 2026-10-15T09:13:16.034Z
updated: 2026-10-15T19:20:23.567Z
---

## Summary

Retrospective A-2783, START 3: 6 of 6 droplet task runs went red on Linux-only tests, and those defects surfaced only after the switch. A stage closes only when its integrated cover has passed on both platforms: T-395's sharded droplet run (Linux) and the local Mac run.

## What to build

The stage gate (`#stageCurrent` and the plan's `after-stage` close) accepts the stage-close run as evidence only when it holds a green Linux droplet result (the T-395 `--occasion stage` run) and a green macOS result at the same tree. `cland verify --occasion stage` runs both, or names the one missing. hub/README.md and the plan-epic skill say so.

## Acceptance criteria

- [ ] C1. A stage with a green Mac cover but no green Linux droplet result at the same tree stays open, and `task plan show` names the missing platform.
- [ ] C2. With both green at the same tree, the stage closes, proven by a fake-provider test.
- [ ] C3. hub/README.md and the plan-epic skill describe the two-platform stage gate.

## Comments

### impl-469 · 2026-10-15T19:20:23.567Z

Implementation in progress: same-tree Linux stage and macOS full receipts now feed after-stage closure and QA freshness; plan and run reports name missing platforms/tree. Existing stage-QA fixtures now supply historical completed platform receipts; a fake-provider end-to-end test exercises Mac-only rejection, mismatched trees, both-platform closure, cache separation and next-stage activation. Typecheck passes. Targeted test window is shared with T-512/T-502 merge checks.
