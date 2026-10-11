---
id: T-199
kind: task
title: A lead's review or QA request reaches one verifier, not every holder of the role
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by: []
topic: null
branch: null
created: 2026-10-10T17:03:52.868Z
updated: 2026-10-11T07:13:43.462Z
---

## What to build

Since T-143 (37e693f) the Implementer clause tells the lead to send `review request T-<n>` to `reviewer`. Addressed by role, the hub delivers it to every live Reviewer: on 2026-10-10 impl-183's delta request at 0b5aa97 reached rev-10, rev-11 and rev-12, and rev-12 asked the Coordinator which one owns it. Two holds or two verdicts on one head are possible.

The request should reach one verifier: the item's previous reviewer when still live, otherwise one free pool member (crew policy `pool`, T-181). Either the hub resolves a role-addressed request to one holder, or the clause names the reviewer to pick and the tool exposes who that is.

## Acceptance criteria

- [ ] A lead's `review request` or `qa request` sent to the role is delivered to exactly one holder, the item's last reviewer (or QA) when live, otherwise a free one.
- [ ] The sender sees which holder got it.
- [ ] A protocol test covers three live Reviewers and a repeat request on the same item.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Interim: the Coordinator told the leads to address the previous reviewer by name.
