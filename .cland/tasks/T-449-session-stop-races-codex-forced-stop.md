---
id: T-449
kind: task
title: session-stop-races Codex forced-stop test reads probe.json before it is written (ENOENT under load)
state: closed
status: done
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
updated: 2026-10-15T12:29:54.384Z
closed: 2026-10-15T12:29:54.384Z
---

## Summary

`hub/test/session-stop-races.test.ts:147` ('Codex: manual forced stop succeeds when a captured descendant exits before its final identity probe') failed in integrated cover 4b6c160f at a3c8098a (A-2633), with ENOENT on the test project's probe.json, at peak load 17.7. Alone it passed 5/5 at the same head (2026-10-15 01:35Z). The test reads the probe file before the fake has written it. Wait for the file, or for the probe event, before reading.

## Acceptance criteria

- [x] C1. The read waits on the probe being written, and the file passes 5/5 beside a local full run.
  - done: impl-449 · 2026-10-15T11:12:17.197Z
  - verified: rev-30 [reviewer] · run rev-20261015-449-final · 2026-10-15T12:29:32.606Z · commit 5913f0fa6f02760dc60ff2c5e7226a827b1398bb

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

### impl-449 · 2026-10-15T11:50:09.373Z

First post-review Linux receipt A-2950, run c63e3ded at 5913f0fa: host/remote typecheck passed; 1716 pass, 1 fail, 3 skip. All 14 session-stop-races cases passed. Only failure is known T-465 at codex-adapter.test.ts:272, rateLimitsAt .402Z vs .217Z; all other compared values equal. Next step under E-482 gate rule is same-head droplet retry. Waiting for announced post-cover restart/budget restoration rather than accepting a local fallback.

### rev-30 · 2026-10-15T11:51:03.708Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-449-linux-first
commit: 5913f0fa6f02760dc60ff2c5e7226a827b1398bb
scope: evidence

Evidence review not clear pending accepted gate.

Medium — hub/test/codex-adapter.test.ts:272: A-2950 compares usage event and later snapshot; only rateLimitsAt differs (.402Z vs .217Z), failing `token and rate-limit notifications publish usage`. Direct T-465 description confirms the exact known race. This is outside T-449's changed file; no T-449 source defect established.

Standards: source review rev-20261015-449-source stands; no new findings.
Spec/evidence: session-stop-races.test.ts passes all 14 Linux cases, repaired manual/post-merge cases 3.630 s and 4.776 s. A-2920 supplies 5/5 loaded whole-file passes. C1 remains unverified pending accepted gate; no failed criterion mark for the unrelated T-465 defect.

Same-head c63e3ded/A-2950 exits 1: 1716 pass, 1 fail, 3 platform skips, 1720 total. Linux x64 c-8, Node v24.21.0, Neovim v0.12.5; typecheck green. Neovim smoke not reached. e6264b46 permits one same-head default-droplet retry; new submission is held until announced restart per Coordinator bef82ca8. No Reviewer tests or edits.

### impl-449 · 2026-10-15T12:29:05.750Z

Second same-head Linux receipt 37ac6bc7/A-2968: all 14 touched session-stop-races cases pass again; sole outside failure exact known T-481 executor-prepare.test.ts:165 undefined released.lifetimeMs. First c63e3ded/A-2950 only known T-465 rateLimitsAt mismatch; different failure. Both are overall red, 1716 pass/1 fail/3 platform skips each. Requested rev-30 final evidence verdict under e6264b46 with both receipts and A-2920 5/5 loaded evidence. Source remains reviewed 5913f0fa; no further tests or source changes.

### rev-30 · 2026-10-15T12:29:32.606Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-449-final
commit: 5913f0fa6f02760dc60ff2c5e7226a827b1398bb
scope: evidence

Final review clear under human gate rule e6264b46 (ask 9183a54c); no unresolved T-449 source findings. Source/current head remains 5913f0fa6f02760dc60ff2c5e7226a827b1398bb.

Standards: source review rev-20261015-449-source stands, no findings.
Spec: C1 verified. Probe read/parse waits for readiness with all identity/exit/stop assertions unchanged. A-2920 establishes 5/5 serial loaded whole-file passes, 14/14 each beside impl-393 local full run.

The accepted pair: first Linux c63e3ded/A-2950 has touched session-stop-races 14/14 green, sole known T-465 Codex :272 rateLimitsAt-only mismatch. Second Linux 37ac6bc7/A-2968 again has touched file 14/14 green, sole different known T-481 executor-prepare :165 undefined released.lifetimeMs (A-2968:3854–3857). Repaired manual/post-merge cases pass 3.630/4.776 s first and 4.406/5.202 s second. Both exact heads match review/current branch.

Both overall Linux receipts remain red, each 1716 pass/1 fail/3 platform skips, exit 1. e6264b46 explicitly accepts this different-known-failure pair with green own files as gate evidence. Neovim smoke not reached; hub-only diff, so mixed-diff nvim rule does not apply. No further tests required by this review.

Criteria: C1 verified.

### coord · 2026-10-15T12:29:54.384Z

Merged 6a4eb6992f943f07a5e53b3388ff0cd97e9ed825 onto dev.
