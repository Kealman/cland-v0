---
id: T-1339
kind: task
title: secrets-environment's cancel case can read the stopping marker before its bytes are written
state: open
status: in progress
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by: []
regression_of: T-1329
topic: topic-1087
branch: t/T-1339-secrets-environment-s-cancel-case-can
created: 2026-10-26T12:44:47.486Z
updated: 2026-10-26T12:46:25.858Z
---

## Summary

hub/test/secrets-environment.test.ts::"cancelled command with a missing close receipt retains its root until native close and output drain" (T-1329) failed once on macOS at T-1331's merged head ab60aa31, with "expected 'signal handled', actual ''". It passed 5/5 alone on dev 22136129. The child writes its marker with `writeFileSync('stopping', …)`, and the test reads the file as soon as its wait observes the file, which can happen after the file is created but before the bytes are written.

## What to build

Make the child publish the marker atomically (write a temp file and rename it into place), or make the test wait until the marker's content equals the expected text. No product code changes.

## Acceptance criteria

- [ ] C1. The named case reads the marker only after its content is complete, shown by a test where the marker file exists before its content, and the case passes 10/10 sequential local runs plus any load-gate repetitions its mode-free verify selects (test).

## Comments

### impl-1339 · 2026-10-26T12:46:25.858Z

Implementation plan: retain the existing T3 owned generic-command seam (no production/shared-contract change). Make the cancellation fixture publish an empty stopping file and hold its content behind a filesystem handshake; assert the receipt remains pending while the file exists, then release content and retain all close/output/root assertions. Red first against the current existence-only watcher, then wait on exact contents. Coordinator revised C1 to ten sequential local case runs without artificial CPU load; mode-free verify supplies whatever additional repetitions it selects.
