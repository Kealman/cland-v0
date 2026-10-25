---
id: T-1276
kind: task
title: A task landed through cland publish never counts as merged, so its plan stage cannot close
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: null
branch: t/T-1276-a-task-landed-through-cland-publish
created: 2026-10-25T09:21:11.429Z
updated: 2026-10-25T09:54:53.647Z
---

## Summary

T-1274 was published with `cland publish t/T-1274-… --item T-1274` (2026-10-25 08:54Z). Publish cherry-picked its three commits to GitHub and merged the branch into dev (f6c64386). Its dev commits carry the `Item: T-1274` trailer, and the item is closed and done. Yet `task plan show E-778` reports its stage "docs findings from the DoD run" as `merged: 0/1`, and the stage stays open even with a complete cover pair (f65c8159/d38d9c6e at tree 9e426a05). Stage closure counts only merge-queue landing receipts. A task whose branch has a branch field but landed through publish is neither "merged" nor "evidence-only".

## Acceptance criteria

- [ ] C1. A task whose branch `cland publish` merged into dev counts as merged for plan stage progress and closure, via a landing receipt written by publish or by recognising its publish record (test).
- [ ] C2. hub/README.md's publish section says how a published task counts toward its epic's plan (docs).
