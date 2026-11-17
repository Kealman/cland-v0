---
id: T-1951
kind: task
title: Local macOS full runs fail a different timing-sensitive test under peak load 12+ (project-hub-lifecycle leaked-timer, release-item version refusal)
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T21:02:06.583Z
updated: 2026-11-17T21:02:06.583Z
---

## Summary

The local macOS stage cover 8f0a53a5 at ca5f70ca4 (A-20927, 2026-11-17, peak 1-minute load 12.15) failed two T3 cases. Both pass 5 of 5 alone at loads 4.88–5.36:
- hub/test/project-hub-lifecycle.test.ts:45, "projectHub cleanup fails when a hub timer is deliberately retained": "The input did not match the regular expression /projectHub leaked resources/". The child reported only "✖ leaked hub timer (2934 ms)".
- hub/test/release-item.test.ts, "item release refuses a dev package version different from its version" (5.3 s).

They are the fourth and fifth distinct macOS-only load flakes today; the others are T-1947 (aide-migration hang) and T-1949 (Discord history 2000 ms wait). Each of the day's four macOS stage covers has failed on a different test, while every Linux droplet cover and dev T3 passes. The hub on the same machine was at 75–105% CPU throughout (T-1950).

## What to build

Make both cases independent of wall-clock timing under load: wait on the producing receipt instead of a fixed deadline, and assert the leak report's structured outcome instead of matching text. Name each fixed wait you replace.

## Acceptance criteria

- [ ] C1. Each case passes with its slow step deliberately delayed (fake or held) (test).
- [ ] C2. 20 of 20 runs of each file under the T3 runner at a 1-minute load of at least 8 pass, with the load recorded per run (native slot).
