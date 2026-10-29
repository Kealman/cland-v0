---
id: T-1448
kind: task
title: "Discord: a General message that re-attaches an already-sent artifact loses its own text"
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-29T17:29:53.831Z
updated: 2026-10-29T17:29:53.831Z
---

## Summary

Found aside by impl-1447 while building T-1447 (topic-1201, A-13859). When a General message re-attaches an artifact already sent to Discord, the once-per-remote reference path posts only the header and the `▣ A-n … (sent above)` line. The message's own text or short caption is dropped whenever `artifactPlan` coalesces the caption. Telegram's behaviour should be checked the same way.

## What to build

The previous-artifact branch of Discord's publication renders the message text, then the sent-above reference line. Check Telegram's equivalent path too, and fix it if it drops text.

## Acceptance criteria

- [ ] C1. On the fake Discord, a General message with text plus an already-sent artifact posts the text and one sent-above reference line; the test fails before the fix.
- [ ] C2. Telegram's equivalent case is covered by a test, fixed if it also drops the text.
