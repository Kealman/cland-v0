---
id: T-1260
kind: task
title: Sessions blocked by cover-quiet poll the verify queue with sleep loops, because nothing wakes them when the local slot frees
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-24T19:41:53.006Z
updated: 2026-10-24T19:41:53.006Z
---

## Summary

While an integrated run holds the local slot, local test commands refuse with `cover-quiet: … wait for it to finish`, and the Implementer clause says "On cover-quiet, wait". Nothing notifies a waiting session when the slot frees, so agents poll. On 2026-10-24 at 19:37–19:42Z, impl-619b (OpenCode) ran `sleep 120`/`sleep 150; cland verify queue` loops during the macOS stage cover 0ab35c7d. That spends turns and money, and the human noticed. The coordinator had to tell the session to stop and wait for a message.

## Acceptance criteria

- [ ] C1. A session refused by cover-quiet gets a one-shot event when the local slot frees (a subscription or a queued targeted-run admission), and the refusal text names it instead of "wait" (test).
- [ ] C2. The Implementer clause and docs/agents/tests.md#cover-quiet say to do other work or end the turn until that event arrives, with no polling, and the clause stays within its byte reserve (test).
