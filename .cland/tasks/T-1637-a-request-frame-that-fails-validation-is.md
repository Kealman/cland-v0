---
id: T-1637
kind: task
title: A request frame that fails validation is reported as an unknown request type
state: open
status: backlog
size: XS
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: null
branch: null
created: 2026-11-02T16:48:05.147Z
updated: 2026-11-16T07:29:21.528Z
---

## Summary

`cland remote approve telegram 000000 --user alex` exits 1 with `cland: unknown request type "pairing.approve"`. `pairing.approve` is a known request: its frame validator (`hub/src/protocol.ts:1118`) refuses a code outside the 8-character pairing alphabet, and the dispatcher answers any invalid frame with `unknown request type` (`hub/src/hub/dispatch.ts:1599`, `1743`). This came up in E-1536 stage 3 QA row 15 at ad295a54. The human sees a message that hides the real cause: a malformed code.

## What to build

A known request type whose arguments fail validation is refused as `invalid_argument`, naming the field. For `pairing.approve`, the message names the code format (8 characters from the pairing alphabet). `cland remote approve` checks the code locally before sending. An unknown type keeps its current message.

## Acceptance criteria

- [ ] C1. `cland remote approve telegram 000000` exits 1 with a message naming the code format, not `unknown request type` (test).
- [ ] C2. A known frame type with an invalid field is refused as invalid_argument naming the field, and a truly unknown type still reads `unknown request type` (test).
