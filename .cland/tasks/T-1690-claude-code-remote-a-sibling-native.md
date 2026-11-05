---
id: T-1690
kind: task
title: "claude-code-remote: a sibling native setup wait is still a fixed 2000 ms (T-1686 fixed only the release-restart case)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1686
topic: topic-1393
branch: t/T-1690-claude-code-remote-a-sibling-native
created: 2026-11-05T14:50:59.742Z
updated: 2026-11-05T16:28:17.055Z
closed: 2026-11-05T16:28:17.055Z
---

## Summary

T-1686 replaced a fixed 2000 ms setup wait in `hub/test/claude-code-remote.test.ts` (the release-restart case, line 235) with the shared native setup budget, because native hook subprocesses and mod posts can legitimately take longer under load. A sibling case still has the same fixed wait. "terminal remote PID settlement {cleans before publishing exit | holds the row on native failure} without recurring CLI" waits `eventually('worker ready before terminal event', …'session.measure done'…, 2000)` at line 302, and failed the E-1532 stage-5 Linux cover 74b4d5a2 (A-16869, shard-2): `not within 2000 ms`. Elsewhere it passed in 4.4–8.3 s.

## What to build

Make every native setup wait in claude-code-remote use the same shared setup budget T-1686 used (with the per-test timeout raised to stay above it), as a test-only change. Keep every settlement, stop and no-recurring-CLI assertion.

## Acceptance criteria

- [x] C1. No fixed native setup wait under the shared budget remains in claude-code-remote.test.ts, and every assertion is unchanged (test).
  - done: impl-1690 · 2026-11-05T15:09:06.025Z
  - verified: rev-35 [reviewer] · run rev-35-1690-final-1 · 2026-11-05T15:45:49.442Z · commit 14c4eff666663100dd389cdbf96996f9dee506a1
- [x] C2. Both terminal-settlement cases pass 10/10 locally under CPU load in a Linux container run with `docker run --init` (evidence).
  - done: impl-1690 · 2026-11-05T15:13:50.134Z
  - verified: rev-35 [reviewer] · run rev-35-1690-final-1 · 2026-11-05T15:45:49.443Z · commit 14c4eff666663100dd389cdbf96996f9dee506a1

## Comments

### rev-35 · 2026-11-05T15:14:13.433Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1690-source-1
commit: 14c4eff666663100dd389cdbf96996f9dee506a1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at corrected pin, no findings. A-16875 records the setup/action boundary audit. Native startup/initial-turn/capture/producer joins use shared eventually/testWaitMs; the two omitted startup-hook joins were corrected during review, while the post-root-exit caller explicitly retains1000ms. Individual stop/settlement/post-signal/fresh-turn bounds and all123 assertion-bearing source lines are unchanged. Only test and matching guide changed; product, wait helper, tiers and duration allowances untouched. Outer envelopes120s cover sequential setup and test work. C1/C2 remain unverified pending Linux10× evidence with docker --init, preservation/T0 and same-head configured result. Finish local evidence/preflight then mode-free verify here; changed head requires fresh source review. No reviewer tests/edits; QA none.

### impl-1690 · 2026-11-05T15:14:52.189Z

Implementation/source review at 14c4eff666663100dd389cdbf96996f9dee506a1: initial setup waits share eventually/testWaitMs; outer envelopes 120s. Pre-action startup-hook joins migrated, explicit post-signal 1000ms caller preserved; all assertion lines identical to base e786b48fe. Linux arm64 local Docker --init/PID1 docker-init, Node24.21.0, two CPU burners constrained to 2 CPUs: both generated terminal settlement cases pass 10/10 (A-16876). Worst 4.051094s/4.262315s, existing C-216 7s/11s allowances cover ceil(1.5×worst), expire 2026-11-11. Source review clear A-16875; macOS preservation/T0 and same-head mode-free verify pending.

### impl-1690 · 2026-11-05T15:21:42.956Z

A-16881 supplies completed macOS arm64 Node24.21.0 local preservation receipts at reviewed 14c4eff66: claude-code-remote26/26 (115.505s file, both terminal cases), host-agent18/18 (10.432s), typecheck, test:lint and test:tiers exit0. Report-only lint findings and known T-1484 incomplete import probe retained/labelled. Lock released and T-1691 notified. Mode-free verify11fbe990 admitted; awaiting result at exact reviewed head. No source changes since review.

### impl-1690 · 2026-11-05T15:44:17.370Z

Configured same-head verification 11fbe990 passed exit0 at 14c4eff666663100dd389cdbf96996f9dee506a1; log A-16886. Executed T0, all T1, fallback all T2, changed T3 claude-code-remote (26 passing identities), and Web: total5178 pass, zero fail/cancel/skip. No remaining T3 or T4 execution claimed. Linux x64 6.8.0-142-generic, droplet c-8 sfo2, Node24.21.0, Neovim0.12.5, Chrome Headless Shell156.0.8078.4 (Playwright1248). Lifetime1478s, cost$0.1026. Duration budgets/report-only lint advisories retained; no enforce-mode budget claim. C1/C2 and macOS preservation evidence already complete in A-16876/A-16881. Awaiting Reviewer's final same-head settlement; no source changes.

### rev-35 · 2026-11-05T15:45:49.443Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1690-final-1
commit: 14c4eff666663100dd389cdbf96996f9dee506a1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-16887 records unchanged assertions/action deadlines from source clear A-16875 and independently inspected same-head run11fbe990/A-16886: 5178/5178, zero fail/cancel/skip/todo, all26 Claude remote identities passing. Both exact terminal variants pass in the configured run; A-16876 independently supplies10/10 each under Linux arm64 CPU load, ten native code-0/signal-null records, observed PID1 docker-init and archived reviewed-head source. A-16881 retains separate Mac26+18 preservation and T0 with known report-only/incomplete probes labelled. T0/allT1/fallback allT2/changedT3 once/Web complete; remaining T3 deferred, T4 unexecuted, no full-T3/QA claim. Candidate projection independently matches. No findings, allowance edit or reviewer rerun needed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-05T16:28:17.055Z

Merged 3607f790d3abf5bf76e4effca845127f146fe93a onto dev.
