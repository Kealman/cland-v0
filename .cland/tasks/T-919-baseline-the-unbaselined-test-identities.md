---
id: T-919
kind: task
title: "Baseline the unbaselined test identities from stage cover #2's logs (refresh refuses budget-red logs)"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-668
branch: t/T-919-baseline-the-unbaselined-test-identities
created: 2026-10-19T23:28:04.295Z
updated: 2026-10-19T23:44:39.074Z
closed: 2026-10-19T23:44:39.074Z
---

## Summary

Stage cover #2 at 15f9c308 had zero test failures on Linux (A-6792). It still failed on four hard `duration budget:` lines: test identities that are new since the last durations refresh, have no baseline, and ran 5.4–5.8 s against the 5 s default. Both covers report "budget missing baselines: 55". The documented stage-close refresh (`npm run test:durations -- <logs>`) refuses both logs as "not a green integrated log", so tests that hover near 5 s keep failing covers one at a time (T-910 C3, T-917, now four more).

## What to build

Give every identity observed in A-6792 (Linux) and A-6795 (macOS) that has no baseline and no allowance a baseline entry in `hub/test/durations.json`, at the per-test median of the two logs, as the refresh tool would write it. Then known identities follow their tier budget (report only for T3 at 10 s) instead of the hard 5 s new-test rule. If an identity is over its tier's hard limit even as known, give it an allowance with reason and owner E-677, 7-day expiry. Leave existing entries untouched. Either reuse `hub/test/durations.ts` (an explicit bypass of the green-log guard for this documented case, behind a flag the tool already has or a narrowly scoped new one with a test) or edit the manifest by script. Say which in the report.

## Acceptance criteria

- [x] C1. A replay of A-6792's and A-6795's budget checks against the new manifest shows no hard `duration budget:` line and at most 5 missing baselines (receipt in the report).
  - verified: rev-31 [reviewer] · run rev-20261019-919-source · 2026-10-19T23:32:11.944Z · commit 84e2ffe8ed71631ba8a3a8509d31035936f500f7
  - done: impl-919 · 2026-10-19T23:39:19.247Z
  - verified: rev-31 [reviewer] · run rev-20261019-919-final · 2026-10-19T23:41:22.806Z · commit 84e2ffe8ed71631ba8a3a8509d31035936f500f7
- [x] C2. Existing baseline and allowance entries are unchanged (diff limited to additions, listed in the report).
  - verified: rev-31 [reviewer] · run rev-20261019-919-source · 2026-10-19T23:32:11.945Z · commit 84e2ffe8ed71631ba8a3a8509d31035936f500f7
  - done: impl-919 · 2026-10-19T23:39:19.831Z
  - verified: rev-31 [reviewer] · run rev-20261019-919-final · 2026-10-19T23:41:22.806Z · commit 84e2ffe8ed71631ba8a3a8509d31035936f500f7
- [x] C3. The durations tests and lint pass, and a mode-free verify at the reviewed head is green.
  - done: impl-919 · 2026-10-19T23:39:20.542Z
  - verified: rev-31 [reviewer] · run rev-20261019-919-final · 2026-10-19T23:41:22.806Z · commit 84e2ffe8ed71631ba8a3a8509d31035936f500f7

## Comments

### impl-919 · 2026-10-19T23:30:14.754Z

Implemented additions-only recovery by one-off script (no refresh guard change). Sources A-6792/A-6795 plus Coordinator-requested A-6796, all at 15f9c308c74bc4f168f1796c62c5c609db9d7514. Added 361 exact test baselines and 56 file baselines from per-log medians then median across logs, six-decimal rounding. No new allowances: every added test/file median fits its tier. Existing entries, allowances, budgets and source commit unchanged. Full additions + production check replay receipt: A-6800, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6800-t-919-final-three-log-replay-and-additions-receipt.json. Recovery script A-6799, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6799-t-919-final-three-log-baseline-recovery-script.mjs. Replay: hard failures Linux 4→0, macOS 0→0, periodic 1→0; missing file baselines 55→0, 55→0, 37→0. Durations tests passed (17/17, 4.201s), refresh tests (3/3, .201s), runner-budget tests (3/3, .106s). npm run check passed; lint's existing census is report-only. Runner lifecycle tests in progress; review follows then mode-free verify at reviewed head.

### impl-919 · 2026-10-19T23:30:51.754Z

Committed/pushed 84e2ffe8ed71631ba8a3a8509d31035936f500f7 after merging current origin/dev. Source review requested from reviewer (delivered). Runner lifecycle tests complete: 15/15, 29.511s, A-6803 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6803-t-919-durations-runner-lifecycle-tests-15-of-15-passed.log. Recovery script A-6802 pins the pre-change manifest for replay after commit: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6802-t-919-reproducible-recovery-script-pinned-to-pre-change-manifest.mjs (supersedes A-6799). Awaiting source clear before mode-free verify.

### rev-31 · 2026-10-19T23:32:11.945Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-919-source
commit: 84e2ffe8ed71631ba8a3a8509d31035936f500f7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6808 independently verifies all 361 test and 56 file additions against the three authorized logs (Coordinator 141de62f adds A-6796). Median within log then across logs and six-decimal values match exactly; file sums/counts match. Every old baseline/allowance value and relative key order preserved; budgets/version/source commit unchanged, only three artifact refs appended. No added allowance or production/refresh-guard change. Independent budget-rule replay corroborates A-6800: A-6792 hard 4→0, missing55→0; A-6796 hard1→0, missing37→0; A-6795 hard0→0, missing55→0. All added medians within normalized tier budgets; existing report-only overruns remain visible. C1/C2 source verified. C3 awaits fresh same-head configured mode-free green; local durations/refresh/budget tests and raw A-6803 runner15/15 reported/inspected as noted. Reviewer executed only read-only source/log computations.

Criteria: C1 verified, C2 verified.

### impl-919 · 2026-10-19T23:38:49.360Z

Same-head mode-free verification f59f1c07-8efe-4dfd-a3d9-9eba04eec5c8 is green at reviewed head 84e2ffe8ed71631ba8a3a8509d31035936f500f7: 1,912/1,912 pass, no failures/skips/cancellations; all T1 + fallback all T2 in both packages. T3 remains deferred to periodic dev/integrated occasions (configured batches T1 only). Linux x64 droplet c-8 lon1, lifetime 351s, cost $0.0244. Durable log A-6812 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6812-suite-f59f1c07-8efe-4dfd-a3d9-9eba04eec5c8-auto-at-84e2ffe.log. Awaiting reviewer's final same-head verdict; source unchanged.

### rev-31 · 2026-10-19T23:41:22.806Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-919-final
commit: 84e2ffe8ed71631ba8a3a8509d31035936f500f7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear. A-6816 records the independent complete A-6812 audit: mode-free f59f1c07-8efe-4dfd-a3d9-9eba04eec5c8 at 84e2ffe8 passed 1912/1912 ordinary tests, zero fail/cancel/skip/TODO, zero resource mismatches, hard duration failures or missing-baseline diagnostics. Host check/typecheck/lint passed. Refresh 3/3 and runner-budget 3/3 pass within that run. Manifest-only change produces no new load-gate identities. Retained original A-6813 durations.test.ts passes 17/17 in 4.201351750 s; this corrects the timing transcription in A-6816. Retained A-6803 durations-runner.test.ts passes 15/15 in 29.511301459 s. Those T3 files were not executed by the task gate; Linux T3 remains periodic/integrated evidence. C1/C2 additions-only and three-log replay conclusions from A-6808 remain unchanged. All claimant done marks confirmed. C1–C3 verified at this exact commit; no findings.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T23:44:39.074Z

Merged 2c79d42a811d43a89d5e31e34c24fb7ea9b2caac onto dev.
