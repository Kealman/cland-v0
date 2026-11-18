---
id: T-1951
kind: task
title: Local macOS full runs fail a different timing-sensitive test under peak load 12+ (project-hub-lifecycle leaked-timer, release-item version refusal)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1609
branch: t/T-1951-local-macos-full-runs-fail-a-different
created: 2026-11-17T21:02:06.583Z
updated: 2026-11-18T02:48:40.638Z
closed: 2026-11-18T02:48:40.638Z
---

## Summary

The local macOS stage cover 8f0a53a5 at ca5f70ca4 (A-20927, 2026-11-17, peak 1-minute load 12.15) failed two T3 cases. Both pass 5 of 5 alone at loads 4.88–5.36:
- hub/test/project-hub-lifecycle.test.ts:45, "projectHub cleanup fails when a hub timer is deliberately retained": "The input did not match the regular expression /projectHub leaked resources/". The child reported only "✖ leaked hub timer (2934 ms)".
- hub/test/release-item.test.ts, "item release refuses a dev package version different from its version" (5.3 s).

They are the fourth and fifth distinct macOS-only load flakes today; the others are T-1947 (aide-migration hang) and T-1949 (Discord history 2000 ms wait). Each of the day's four macOS stage covers has failed on a different test, while every Linux droplet cover and dev T3 passes. The hub on the same machine was at 75–105% CPU throughout (T-1950).

## What to build

Make both cases independent of wall-clock timing under load: wait on the producing receipt instead of a fixed deadline, and assert the leak report's structured outcome instead of matching text. Name each fixed wait you replace.

## Acceptance criteria

- [x] C1. Each case passes with its slow step deliberately delayed (fake or held) (test).
  - done: impl-1951 · 2026-11-18T01:00:41.428Z
  - verified: rev-39 [reviewer] · run rev-39-1951-final-20261118 · 2026-11-18T01:42:42.942Z · commit f490b60333fbc595148b35321b183a695617a889
- [x] C2. 20 of 20 runs of each file under the T3 runner at a 1-minute load of at least 8 pass, with the load recorded per run (native slot).
  - done: impl-1951 · 2026-11-18T01:00:42.928Z
  - verified: rev-39 [reviewer] · run rev-39-1951-final-20261118 · 2026-11-18T01:42:42.942Z · commit f490b60333fbc595148b35321b183a695617a889

## Comments

### impl-1951 · 2026-11-17T23:20:41.285Z

Confirmed named timing/reporting assumptions: release-item's first case has a 5,000 ms whole-test timeout including prepared fixture/native Git setup; both project-hub-lifecycle child controls parse the default Node reporter's stdout. Plan to preserve native child exit assertions and read structured test:fail error/cause assertion payload instead. Native-slot request posted in topic-1609; no native runs started.

### impl-1951 · 2026-11-18T00:59:59.428Z

C1/C2 evidence A-20979, durable folder /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20979-t-1951-baseline-reds-held-controls-and-20-20-native-t3-proofs (README.md, audit.md, 40 per-run logs, raw prior attempts/receipts, helper/auditor). Local macOS Node24.21.0, T3 runner, report-only tier/duration budgets; 20/20 each file, 40 native file-close receipts and 280 passing top-level case receipts independently audited; all starts[8,20). Same source across admission pauses, all helper PIDs closed. Earlier failed/incomplete attempts excluded and retained. C1 held-stream T1 case plus held native release setup pass; final reachable T1 file suite-load-diagnostics.test.ts7/7. No T0–T2/Web/otherT3/T4 claim from these native runs. Consumer scope: both negative lifecycle controls migrated to existing Node assertion outcome fields; hubResources/harness production contracts unchanged. Separate startup-cancellation hang is corroborating evidence for existing T-1947, no harness edits here. Staged capture removed after artifact copy. Running final full lint/typecheck before source review.

### rev-39 · 2026-11-18T01:07:22.385Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1951-source-20261118
commit: f490b60333fbc595148b35321b183a695617a889
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at f490b60333fbc595148b35321b183a695617a889. Standards and spec: no findings across the seven-file diff. Structured Node assertion outcomes replace default reporter text; release setup and CLI completion are separated, held setup is released/joined before disposal, and all final refusal/state assertions remain. Independently audited A-20979 raw logs: 20/20 per T3 file, 40 file completions, 280 passing top-level cases, starts [8,20), four source hashes match the pinned worktree. These are targeted local macOS receipts (Node24.21.0, no browser/remote, report-only tier/duration gates), not configured verification. C1/C2 run-dependent marks deferred to final same-head evidence verdict. No tests launched by reviewer.

### impl-1951 · 2026-11-18T01:28:14.022Z

Corroborating receipt reported by T-1947 (not independently rerun by T-1951): with its fixed shared harness, release-item's unchanged first case at load10.40 still produced 'test timed out after 5000ms', cancelled at5301.66ms; file now closed natively CLI exit1 at6383.87ms. This supports keeping T-1951's deadline change alongside T-1947's cleanup change. Reviewed head f490b6033 unchanged; configured run a82fffeb-352d-4494-a04d-74e150764f18 pending after host T0 exit0.

### rev-39 · 2026-11-18T01:42:42.942Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1951-final-20261118
commit: f490b60333fbc595148b35321b183a695617a889
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final review clear. Same-head configured run a82fffeb-352d-4494-a04d-74e150764f18 is finished/passed in task.view; A-21001 provenance pins f490b60333fbc595148b35321b183a695617a889 / tree eb688a920eb74cf4c60b028f4ecca293573048e5. Checked actual structured pass receipts for held reporter (base plus 5/5), both lifecycle controls and held release refusal. T0 host check passed; Linux x64 droplet Node24.21.0 T1/T2/Web and changed T3 (2 files/14 cases) passed. Chrome Headless Shell156.0.8078.4 / Playwright1248; duration/tier checks report-only; no cache. Remaining T3 and T4 not claimed. C1 verified from reviewed holds/final assertions and exact passing case receipts. C2 verified from independently audited A-20979 local macOS T3 evidence:20/20 each,40 file completions,280 top-level passes, starts[8,20), source hashes matched. No findings; source review A-20985 unchanged. No reviewer test execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T02:48:40.638Z

Merged 54e153e088ef44a9991bd45ded5f1b0a08a9f0af onto dev.
