---
id: T-1329
kind: task
title: Secret environment overrides win over the file and join the sessions' deny-list
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
created: 2026-10-26T07:54:41.838Z
updated: 2026-10-26T07:54:59.639Z
---

## Summary

`CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`, `ELEVENLABS_API_KEY` and `XAI_API_KEY` override the secrets file and join the sessions' environment deny-list beside `DIGITALOCEAN_TOKEN`. No session and no speech command inherits them.

## What to build

Resolve each secret as environment override first, then the file. Add the four names to the shared credential deny-list (`shared/executor-credentials.ts`) used for every child launch environment, including the speech command's (rule 15). Spec §3.3.

## Acceptance criteria

- [ ] C1. With all four overrides set in the hub's environment, the hub resolves each over the file's value, and a fake harness session's environment and a fake speech command's environment hold none of them (test).
