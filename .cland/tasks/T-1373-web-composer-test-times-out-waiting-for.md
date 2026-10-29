---
id: T-1373
kind: task
title: Web composer test times out waiting for the General row after reload on a loaded Linux droplet
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1211
branch: t/T-1373-web-composer-test-times-out-waiting-for
created: 2026-10-27T07:48:08.661Z
updated: 2026-10-29T18:39:45.343Z
---

## Summary

The E-1309 Linux stage cover e7616d5d at dev 18a6f01b (A-12644, shard-1) failed one Web case: web/test/composer.test.ts "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read". The error was `locator.click: Timeout 3000ms exceeded` waiting for `[data-object-id="general"]` (composer.test.ts:20, called from :187). The macOS cover at the same commit was green, and the case passed 5/5 alone on macOS afterwards. Trace: web/test-results/110535-0.zip on the droplet.

## What to build

Make the case wait for the reloaded shell's topic list to be ready before it clicks General, using the harness's own readiness signal rather than a fixed 3 s locator timeout, so it holds under a loaded two-worker Linux Web phase.

## Acceptance criteria

- [ ] C1. The case waits on an explicit post-reload readiness receipt before selecting General and passes 10/10 under the load gate's CPU load at two workers (test).

## Comments

### impl-1373 · 2026-10-29T18:37:55.797Z

Scope: test-only reload readiness at existing headless Web DOM/authenticated-frame seam. No shared contract changes. Inspecting existing harness readiness before changing the composer case; C1 also requires queued Linux two-worker CPU-load repetitions.

### impl-1373 · 2026-10-29T18:39:45.343Z

Red receipt on macOS: held post-reload topic frames reproduce `locator.click: Timeout 3000ms exceeded` waiting for `[data-object-id="general"]`, thread :20, case :199 (one selected case, exit 1). Prior attempt was incomplete: missing generated Web bundle; built bundle before valid red. Fix now separately awaits rendered target row with 15 s readiness bound and final visibility assertion before normal click. Regression retains all original draft/read/offline/replay checks.
