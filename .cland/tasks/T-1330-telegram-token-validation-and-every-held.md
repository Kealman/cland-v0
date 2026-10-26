---
id: T-1330
kind: task
title: Telegram token validation and every held secret registered with the remote redactor
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1328
topic: null
branch: null
created: 2026-10-26T07:54:42.430Z
updated: 2026-10-26T07:55:00.067Z
---

## Summary

A Telegram token is validated before any URL is built, and every token and key the project holds is registered with the shared remote redactor (T-1326, hub/src/remote/redact.ts). So log lines, errors, journal records and artifacts written by the gateway and the speech seam print them masked.

## What to build

Validate a Telegram token against `^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$` within 80 characters, refusing a malformed one without echoing it. A Discord token is opaque. On hub start and on reload, register every resolved secret with the redactor. Make the journal and artifact writes from the gateway and speech seam pass through it. Spec §3.3 and §3.12.

## Acceptance criteria

- [ ] C1. A malformed Telegram token is refused with a reason that does not contain it, before any URL is built (test).
- [ ] C2. An error, log line, journal record and artifact produced through the gateway that carried a registered token or key contain it only masked (test).
