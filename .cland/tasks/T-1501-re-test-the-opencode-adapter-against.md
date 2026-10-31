---
id: T-1501
kind: task
title: Re-test the OpenCode adapter against OpenCode 2.2.x (session form and message schema variants changed)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-31T05:17:30.173Z
updated: 2026-10-31T05:17:30.173Z
---

## Summary

The informational OpenCode check before the 0.3.1 release (`npm run check:opencode`, 2026-10-31 05:20Z) found the newest stable OpenCode 2.x at 2.2.5, while the adapter was built and tested against 2.0.24. It reports 12 schema differences in two operations. Ten are in `GET /api/session/{sessionID}/form` (`fields.items.anyOf` and `prefixItems[0].anyOf`: "a tested variant was removed or changed"). Two are in `GET /api/session/{sessionID}/message/{messageID}` (`data.anyOf`). The check doesn't block releases, and the adapter's behavioural tests run against the pinned/fake OpenCode.

## Acceptance criteria

- [ ] C1. The adapter's form and message readers are checked against OpenCode 2.2.x schemas, either updated to accept the changed variants with a fixture per variant or documented as unaffected, and `npm run check:opencode` reports the tested version or the residual differences with reasons.
