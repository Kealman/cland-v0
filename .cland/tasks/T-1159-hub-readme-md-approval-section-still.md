---
id: T-1159
kind: task
title: hub/README.md approval section still says reconnects may re-key and relays are pending
state: open
status: planned
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-414
blocked_by: []
topic: null
branch: null
created: 2026-10-23T01:26:18.126Z
updated: 2026-10-23T02:19:35.766Z
---

## Summary

E-414 stage-2 QA (qa-676, E414S2-19 at d32c6a8f) found two stale statements in hub/README.md's approval section: line ~847 says "reconnects may re-key a pending request", while the Codex and OpenCode native reconnect tests keep stable ids; line ~857 says the state-only fallback stays TUI-only "until those implementations land", though both relays have landed and the capability rows read reliable.

## What to build

The approval section describes what is now true: native record ids survive reconnects for Codex and OpenCode, the TUI-only fallback applies to Claude Code and to requests that fail the adapter's checks or the payload cap, and no sentence describes the relays as future work.

## Acceptance criteria

- [ ] C1. hub/README.md's approval section states that Codex and OpenCode records keep their id across a reconnect and no longer says a reconnect may re-key a pending request (docs).
- [ ] C2. hub/README.md's approval section names when a record is TUI-only (Claude Code, a request failing the adapter's checks, a subject over the payload cap) and has no "until those implementations land" wording (docs).
