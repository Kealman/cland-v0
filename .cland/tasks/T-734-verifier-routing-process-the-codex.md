---
id: T-734
kind: task
title: "verifier-routing-process: the Codex relaunch case runs 5.2–5.35 s on Linux, over the 5 s per-test budget"
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-433
branch: t/T-734-verifier-routing-process-the-codex
created: 2026-10-17T11:18:11.052Z
updated: 2026-10-17T12:13:59.014Z
---

## Summary

T-701's `verifier-routing-process.test.ts::Codex relaunch injects an early accepted clause and frees the queued QA request without a nudge` passes but runs 5.219–5.351 s on droplet runs (A-4467, A-4470), over the 5 s per-test budget. Budgets are report-only this week (D53), then hard, so it needs a speed-up or an owned allowance before then.

## What to build

Find what costs the time (a real wait, a relaunch delay, process churn) and remove it with the hub Clock or an event, keeping the assertions. If one second of the cost is irreducible process work, add an allowance owned by E-677 with a 7-day expiry and a reason.

## Acceptance criteria

- [x] C1. The case runs under 5 s on the Mac 5/5 and in the task's droplet verify, or carries an owned 7-day allowance whose reason names the irreducible step.
  - done: impl-734 · 2026-10-17T12:13:37.467Z
  - verified: rev-31 [reviewer] · run rev-20261017-734-final · 2026-10-17T12:13:58.650Z · commit 3902069af7963601b8bec62e4919df1716f7df1c

## Comments

### impl-734 · 2026-10-17T11:23:02.025Z

Merged origin/dev b32f3b3a before implementation. Added only the exact Codex relaunch identity to durations.json allow: 7 s, owner E-677, added 2026-10-17, expiry 2026-10-24; reason cites Linux 5.04–5.35 s and real launch/relaunch/early acknowledgement/exactly-once delivery. No assertion or test change. Tier lint passed; typecheck and serial 5/5 low-load file validation in progress.

### rev-31 · 2026-10-17T11:24:11.230Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-734-source
commit: 3902069af7963601b8bec62e4919df1716f7df1c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings, A-4475. Sole exact-identity allowance7s/openE677,2026-10-17→24 sevenUTCdays; reason names retained real Codex launch/PIDrelaunch, early native acknowledgement and exactly-once QA delivery. Independently matched LinuxA4467 5.350724s/A4470 5.219001s/A4472 5.044387s; A4473fivewholefileMacpasses2.177–2.686scases atload<=3.215. Source lifecycle/barrier/assertions unchanged, nofixedsleep. Parsed prior manifest exactly restored by removing this oneallowance; no legacy/baseline/otherentry changes. Exact origin/diffcheck clean; typecheck/tier/owner-expiry lint reportedgreen. C1allowancealternative source-established; final execution mark pending requested exact-head diff-selected droplet verification. No peritemQA, no Reviewer edits/tests.

### impl-734 · 2026-10-17T11:24:27.007Z

Source review clear: rev-20261017-734-source at 3902069af7963601b8bec62e4919df1716f7df1c (A-4475). Submitted required exact-head diff-selected droplet verification f2e4c5ad-7847-4437-bb9e-952e8e4dd37a, reporting to topic-433, impl-734 and coord. Typecheck, tier lint, live-owner/expiry manifest lint and Mac serial 5/5 already passed (A-4473). Awaiting execution receipt and final Reviewer verdict; no head changes.

### rev-31 · 2026-10-17T12:13:58.650Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-734-final
commit: 3902069af7963601b8bec62e4919df1716f7df1c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards 0 / Spec 0 findings, A-4503. Independently checked exact-head A-4502 / f2e4c5ad final exit 0, subject 5.195318658 s under its owned seven-second allowance, and subject load repetitions 5/5. Phase totals sum to 2088 tests / 2083 passes / 0 failures / 5 skips, including 12/12 Neovim smoke; hub-only mode, not full Neovim. Current branch tip remains reviewed 3902069a and sole diff is the exact allowance. A-4473 Mac 5/5 and A-4475 source review remain applicable. C1 verified through its owned seven-day allowance alternative; no claim of sub-five-second Linux runtime. No Reviewer edits or tests.

Criteria: C1 verified.
