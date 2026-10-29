---
id: T-1373
kind: task
title: Web composer test times out waiting for the General row after reload on a loaded Linux droplet
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-27T07:48:08.661Z
updated: 2026-10-29T15:58:57.615Z
---

## Summary

The E-1309 Linux stage cover e7616d5d at dev 18a6f01b (A-12644, shard-1) failed one Web case: web/test/composer.test.ts "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read". The error was `locator.click: Timeout 3000ms exceeded` waiting for `[data-object-id="general"]` (composer.test.ts:20, called from :187). The macOS cover at the same commit was green, and the case passed 5/5 alone on macOS afterwards. Trace: web/test-results/110535-0.zip on the droplet.

## What to build

Make the case wait for the reloaded shell's topic list to be ready before it clicks General, using the harness's own readiness signal rather than a fixed 3 s locator timeout, so it holds under a loaded two-worker Linux Web phase.

## Acceptance criteria

- [ ] C1. The case waits on an explicit post-reload readiness receipt before selecting General and passes 10/10 under the load gate's CPU load at two workers (test).
