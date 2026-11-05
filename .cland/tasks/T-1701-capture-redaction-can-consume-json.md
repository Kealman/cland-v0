---
id: T-1701
kind: task
title: Capture redaction can consume JSON syntax around a redacted URL, leaving unparseable log lines
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-05T22:43:31.916Z
updated: 2026-11-05T22:43:31.916Z
---

## Summary

Capture redaction can break structured log lines. In A-16954 (`suite.log` line 3657), a serialized `suite timing` JSON line contained a Discord origin URL. The URL redactor replaced it with `[redacted]`, but its greedy pattern also consumed the closing JSON syntax, so the line no longer parses (JSON decode fails at character 111). Reported by rev-36 during T-1614's evidence review. It did not affect any test outcome.

## What to build

Make URL and secret redaction structure-preserving: redact only the URL or token span, never surrounding quotes, braces or commas. For JSON lines, prefer redacting parsed string values and re-serialising. Add a regression with a URL inside a JSON string value that must stay valid JSON after redaction.

## Acceptance criteria

- [ ] C1. A serialized JSON line containing a URL, or a credential-shaped token, inside a string value is still valid JSON after redaction, and the secret is gone (test).
- [ ] C2. The existing redaction positive controls for planted secrets still pass, and no secret leaks through the structure-preserving path (test).
