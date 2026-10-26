---
id: T-1338
kind: task
title: Renew or remove the sixteen duration allowances that expire on 2026-10-31 and 2026-11-01 before they refuse every verify run
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: null
branch: t/T-1338-renew-or-remove-the-sixteen-duration
created: 2026-10-26T12:12:39.576Z
updated: 2026-10-26T12:12:45.494Z
---

## Summary

Sixteen duration allowances in hub/test/durations.json expire at 00:00 UTC on 2026-10-31 (nine) and 2026-11-01 (seven), all owned by E-880. `hub/src/suite-durations.ts` throws "expired duration allowance" once one expires, which refuses every verify run, the merge queue and the covers included. Renew or remove each one before 2026-10-30.

## What to build

For each of the sixteen keys, check the test's current timing in the last green covers and runs: Linux A-12333 and A-12360, macOS A-12338 and A-12224.
- **Still needed:** if the test still exceeds its tier budget, renew it within the owner's span limit. Set "seconds" to 1.5x the worst recent passing sample, rounded up to milliseconds, set "added" to today and "expires" to 2026-11-25. Append a dated renewal note with the samples to "reason". Keep the owner E-880.
- **No longer needed:** if the test now fits its budget in every recent sample, remove the stanza.
- **Never** change a test or its assertions here.
The keys are the `allow` entries with "expires" "2026-10-31" or "2026-11-01". As of dev 89107fe1 they are in suite-cover, homebrew-publication, qa-lint-build, startup-replies-scale, dev-t3-search-component, suite-cancel (2), codex-adapter, suite-recovery, launcher-input-load, explorer-outline-load, claude-code-sessions-lifecycle, suite-timeouts (3) and executor-safety-load.

## Acceptance criteria

- [ ] C1. No duration allowance in hub/test/durations.json expires before 2026-11-02, each renewed stanza names its recent samples and the 1.5x rule, each removed one is listed in the item with the samples showing it fits its budget, and the durations lint passes (test).
