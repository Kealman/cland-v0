---
id: T-1182
kind: task
title: Web tests measure the narrow Sessions row before the phone layout switch lands
state: open
status: in progress
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-419
blocked_by: []
regression_of: T-1165
found_by: qa
topic: null
branch: t/T-1182-web-tests-measure-the-narrow-sessions
created: 2026-10-23T16:06:39.496Z
updated: 2026-10-23T16:06:57.952Z
---

## Summary

E-419 stage-1 QA (qa-s1-2026-10-23-1 at e53bc5a3, A-10096) failed web/test/sessions.test.ts "Sessions rows render merged facts, holds, waiting detail and physical selection keys": `P27 row is 52 px tall`, measured 88 px, at line 105, right after `page.setViewportSize({ width: 600 })`. The same test passed in both stage covers at that SHA. Since T-1165, the narrow row layout follows `[data-phone="true"]`, which React sets from `usePhone()` after the matchMedia change, so a measurement taken right after the resize can see the pre-switch layout.

## What to build

Make the narrow-row assertions wait until the page has switched to the phone layout (for example `[data-phone="true"]` on the shell) before measuring, in this test and in any other Web test that resizes across 640 px and then measures layout at once. Keep the single width seam; no second breakpoint in CSS.

## Acceptance criteria

- [ ] C1. Every Web test that resizes across 640 px and then measures layout first waits for the phone-layout switch; the change lists each such test (Web test).
- [ ] C2. The Sessions merged-facts test passes 20 of 20 runs at two workers on macOS, with a parallel CPU load running (Web test).
