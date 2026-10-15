---
id: T-449
kind: task
title: session-stop-races Codex forced-stop test reads probe.json before it is written (ENOENT under load)
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-290
branch: t/T-449-session-stop-races-codex-forced-stop
created: 2026-10-15T01:25:43.927Z
updated: 2026-10-15T11:13:01.950Z
---

## Summary

`hub/test/session-stop-races.test.ts:147` ('Codex: manual forced stop succeeds when a captured descendant exits before its final identity probe') failed in integrated cover 4b6c160f at a3c8098a (A-2633), with ENOENT on the test project's probe.json, at peak load 17.7. Alone it passed 5/5 at the same head (2026-10-15 01:35Z). The test reads the probe file before the fake has written it. Wait for the file, or for the probe event, before reading.

## Acceptance criteria

- [x] C1. The read waits on the probe being written, and the file passes 5/5 beside a local full run.
  - done: impl-449 · 2026-10-15T11:12:17.197Z

## Comments

### impl-449 · 2026-10-15T11:09:25.591Z

Baseline targeted file passed 14/14 beside impl-393's local full verification. Existing eventually helper retries errors within the existing 15s harness bound, so the fix waits for readable/parseable probe JSON and leaves all identity, exit code, stop and signal assertions outside the retry. Skipping artificial reproduction/minimisation: task already supplies the exact ENOENT site and integrated failure receipt; this is an existing test synchronization repair, not a product-code bug. Will record five serial loaded file runs.

### impl-449 · 2026-10-15T11:12:17.731Z

Fixed with existing eventually helper around probe JSON read, retaining all assertions and the existing default wait bound. Loaded evidence A-2920 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2920-t-449-5-5-loaded-session-stop-races-runs.log): 5/5 serial session-stop-races.test.ts runs, 14/14 each, beside impl-393 local full verification; queue checked before each file. Baseline also 14/14. Fetched and merged origin/dev (already up to date). No new test identities or duration allowances needed.

### rev-30 · 2026-10-15T11:13:01.950Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-449-source
commit: 5913f0fa6f02760dc60ff2c5e7226a827b1398bb
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings against repo test guidance or baseline smells; uses existing bounded eventually helper for readiness.
Spec: hub/test/session-stop-races.test.ts:147–148 now waits for readable/parseable probe JSON before use, handling absence or an in-progress write. Every assertion at :149–157 stays outside the retry, including real identity, descendant exit, ps code, stop/follow-up success, parent death, stopped state and signal-skipped evidence. Fake probe and lifecycle staging unchanged; both manual/post-merge variants covered.

A-2920 establishes 5/5 serial loaded file passes, each 14/14 with zero failures/skips/cancellations, with impl-393 local full-run holder receipts before each file. C1 left unverified during source pass; final review awaits same-head post-source cland verify. No Reviewer tests or edits.
