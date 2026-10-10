---
id: T-184
kind: task
title: "The gate reads the plan: QA policy per stage or override, qa_default, qa-required retired and migrated, ready from the policy"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by:
  - T-183
topic: null
branch: null
created: 2026-10-10T15:38:37.537Z
updated: 2026-10-10T17:51:54.689Z
---

## Parent

T-114, slice 2 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

An item's QA policy from its stage or its override, `[plan] qa_default` outside any plan, `qa-required` retired with the labelled items migrated, `ready` from the policy, and QA-marked criteria.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: an item in a stage with `scope: none` merges on review; one in a `per-item` stage is refused without its QA verdict.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
