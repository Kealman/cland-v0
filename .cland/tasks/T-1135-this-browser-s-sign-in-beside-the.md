---
id: T-1135
kind: task
title: This browser's sign-in beside the profile
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1134
  - T-1131
topic: null
branch: null
created: 2026-10-22T15:16:15.619Z
updated: 2026-10-22T15:16:15.619Z
---

## Summary

The Accounts area opens with the human's profile block: this browser's sign-in, when it was made and when its cookie expires.

## Parent

E-418 (§3.6 beside the profile; v0.2 §3.7; tracer step 5).

## What to build

The profile is the human's own block at the top of the Accounts area, set apart from the accounts; it is not an account. It shows this browser's sign-in from the hub slice's request: when it was made, when it was last used and when the cookie expires. It names no other browser and offers no revoke; those stay with `cland web` in the CLI. The notification switches join this block in the switches slice, after E-417.

## Acceptance criteria

- [ ] C1. The profile block shows this browser's sign-in with its creation and its expiry 30 days later, matching the hub's record of the cookie (Web test).
- [ ] C2. A second browser context's sign-in does not appear in the first context's profile block (Web test).
- [ ] C3. `web/README.md` describes the profile block (docs).
