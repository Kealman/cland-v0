---
id: T-1449
kind: task
title: "Telegram: a retryable media download shows 'could not be stored; retrying' even when the retry succeeds"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-29T17:47:47.016Z
updated: 2026-10-29T17:47:47.016Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L6, topic-1195, A-13884), on the real @cland_app_bot. The human sent a photo and saw «photo-142.jpg could not be stored; retrying». The retry then succeeded: exactly one A-2/photo-142.jpg in General, `artifact.upload` ok, and the image opens. The human's words: «в целом отправилось и координатор получил, но какое-то сообщение о том что запроцессить не смогло, возможно не важное». The warning comes from the retryable getFile/download error path (telegram.ts:513–524 at 189d5100). The actual error code wasn't captured.

## What to build

Don't alarm the human about a transient failure that recovers: send the "could not be stored" line only after the retries are exhausted. If an early notice is kept on purpose, edit it into the outcome once the retry succeeds. Record the retryable error's class and code in the hub log, with no token or URL, so the next one can be diagnosed.

## Acceptance criteria

- [ ] C1. On the fake Bot API, a first `getFile` or download failure followed by success sends no failure line to the chat and stores the artifact once; the test fails before the fix.
- [ ] C2. Exhausted retries still send one clear failure line naming the file.
- [ ] C3. The hub log records the retryable error's class and code without token-bearing URLs.
