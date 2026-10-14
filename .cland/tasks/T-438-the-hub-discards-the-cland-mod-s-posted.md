---
id: T-438
kind: task
title: The hub discards the cland mod's posted at on mod-measure and stamps the receipt time
state: closed
status: done
size: XS
labels:
  - wontfix
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-14T19:17:51.814Z
updated: 2026-10-14T19:22:31.533Z
closed: 2026-10-14T19:22:31.533Z
---

## Summary

The cland mod posts `cland hook mod-measure` with `{at, rateLimits}` (T-363). `interpret('mod-measure')` (hub/src/adapters/claude-code.ts:132) keeps only the windows, so an account's reading `at` is the hub's receipt time. In E-272 QA run qa-2026-10-14-27-11 (M21d), the receipt time was 555 ms after the posted time. Keeping the mod's `at` would make 'newest reading wins' follow the harness's own clock. It would need a guard against future or skewed times.

## Acceptance criteria

- [ ] C1. A mod-measure reading keeps the posted `at` when it is not in the future and not older than the stored reading. Otherwise the hub falls back to the receipt time.
