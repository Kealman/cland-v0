---
id: T-1798
kind: task
title: "nvim qa --timeout case flakes under load: the Neovim wrapper's pid wait is not load-tolerant"
state: closed
status: done
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1666
branch: t/T-1798-nvim-qa-timeout-case-flakes-under-load
created: 2026-11-09T20:40:55.555Z
updated: 2026-11-20T02:23:28.489Z
closed: 2026-11-20T02:23:28.489Z
---

## Summary

`nvim/test/qa.test.ts`, "a case that never returns is ended by --timeout: BLOCKED, exit 2, and no Neovim left spinning" (T3), failed once on macOS under suite load with `the Neovim wrapper never wrote its pid` after 12.5 s (qa.test.ts:41). The test's wait for the wrapper's pid file isn't load-tolerant. Alone it passes 5/5 at the same commit.

## Evidence

- E-1535 stage-1 macOS cover 4e602340 at dev 700f88ce (A-18177). Peak 1-minute load was 13.18 in T3, and swap was 5.4 GB of 6 GB used. The same tree's Linux cover 70a2f91e (A-18172) is green. Five solo runs on macOS at 700f88ce: 5/5 pass.
- This is the third distinct timing-class failure in macOS covers at this tree, after T-1796 and T-1797.

## Acceptance criteria

- [x] C1. The wait for the Neovim wrapper's pid uses the shared `testWaitMs()`/`eventually()` load-scaled bound (test).
  - done: impl-1798 · 2026-11-20T00:15:02.871Z
  - verified: rev-35 [reviewer] · run rev-35-1798-source-1 · 2026-11-20T00:18:53.039Z · commit 626a48820115600e0e2a807122585e491fe114dc
  - verified: rev-35 [reviewer] · run rev-35-1798-evidence-2 · 2026-11-20T01:05:06.503Z · commit 626a48820115600e0e2a807122585e491fe114dc
- [x] C2. The case passes 20/20 with 2 workers and a CPU burner on macOS (test).
  - done: impl-1798 · 2026-11-20T00:37:36.140Z
  - verified: rev-35 [reviewer] · run rev-35-1798-evidence-1 · 2026-11-20T00:41:43.762Z · commit 626a48820115600e0e2a807122585e491fe114dc
  - verified: rev-35 [reviewer] · run rev-35-1798-evidence-2 · 2026-11-20T01:05:06.503Z · commit 626a48820115600e0e2a807122585e491fe114dc

## Comments

### impl-1798 · 2026-11-20T00:13:25.466Z

Deterministic pid publication probe: old fixed 200 x 50 ms observer failed with Error: the Neovim wrapper never wrote its pid; shared hub/test/until.ts eventually/testWaitMs passed the same 10.5 s held publication. Exact BLOCKED, exit 2 and groupGone assertions unchanged. Probe patches and logs will be published; loaded C2 pending source review and quiet slot.

### rev-35 · 2026-11-20T00:18:53.039Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1798-source-1
commit: 626a48820115600e0e2a807122585e491fe114dc
scope: full
findings: [{"severity":"low","text":"L1 · Unchanged Bugs/XS aside, reported for filing/deduplication: groupGone treats any kill(-pgid,0) error as confirmed absence. Only ESRCH should establish gone; permission/probe errors stay unknown/fail. Static-only finding, not observed in retained runs; does not block the pid wait correction.","file":"nvim/test/qa.test.ts","line":80}]
finding_counts: {"high":0,"medium":0,"low":1}

Initial source review clear at626a48820115600e0e2a807122585e491fe114dc (basec352aade521e49d98875af1f557db8a200db457f), two-file change. A-21963 records Standards/Spec, consumer and evidence checks.

C1 verified: pidWrapper uses named eventually with testWaitMs; shared waitTimeoutMs applies load scaling once and respects configured override/droplet default. Timeout/SIGTERM/ordinary lifecycle callers retain return shape, positive pid predicate and original assertions. Product --timeout2/BLOCKED/exit2/group checks unchanged; matching guidance updated. A-21961 retains old-bound red/new-bound green with the same real pid held10.5s and joined publication, plus final30/30 T3/no skips. Lead reports until8/8 and full lint/typecheck0. Local macOSarm64/Node24.21/Neovim0.11.2, no browser/stress/full verify.

Low L1 is an existing groupGone error-classification aside, routed Bugs/XS; no blocking finding in changed code.

Marks: C1 verified; C2 remains unchecked/unverified pending prescribed macOS20/20 with2workers+CPU burner after source review, under the Coordinator's exclusive capacity. No Reviewer runtime/edit. Current configured/Linux/full-suite evidence remains pending.

Criteria: C1 verified.

### impl-1798 · 2026-11-20T00:37:50.499Z

C2 completed at reviewed 626a48820115600e0e2a807122585e491fe114dc: 20/20 exact timeout-case fresh processes, 2 workers (10 each), one CPU burner with positive progress in every round; macOS arm64 Node24.21.0 Neovim0.11.2. All code 0/signal null/no timeouts; every round tests1/pass1/fail0/cancelled0/skipped0. Exclusive quiet slot released. A-21973 contains raw logs, structured receipts and runner. Configured verification pending granted window.

### rev-35 · 2026-11-20T00:41:43.762Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1798-evidence-1
commit: 626a48820115600e0e2a807122585e491fe114dc
scope: evidence
findings: [{"severity":"low","text":"L1 retained unchanged aside: groupGone accepts any kill(-pgid,0) exception as absence. Coordinator filed T-2018 (Bugs/XS), outside T-1798. No permission/probe error was observed in these20 campaign runs.","file":"nvim/test/qa.test.ts","line":80}]
finding_counts: {"high":0,"medium":0,"low":1}

C2 campaign evidence clear at unchanged626a48820115600e0e2a807122585e491fe114dc. A-21978 audits A-21973's20 raw logs, structured receipts and runner; this is not final configured settlement.

All20 unique indices0–19: two lanes10each, every native close code0/signalnull/no timeout, CPU burner progress positive each round (min66841). Independently parsed terminal totals20tests/20pass/0fail/cancel/skip/todo, exact original timeout-case name every log. macOSarm64/Node24.21/Neovim0.11.2, no browser/remote; setup factor1 reflects available parallelism, not a high-ambient-load claim. Coordinator quiet/native grant and release checked; initial1mload2.42<5. Fresh disposable cwd/sealed env per process; successful close/join ordering read from runner. Missing per-child native PID/admission hashes are not invented.

Marks: C2 verified; C1 prior verification remains current. LowL1 now T-2018 remains outside scope. Same-head configured a49468c5 is admitted/pending after the separate Coordinator window; no configured pass or final ready claim. No Reviewer runtime/edit.

Criteria: C2 verified.

### impl-1798 · 2026-11-20T01:03:23.574Z

Configured verify a49468c5 exit0 at reviewed 626a48820115600e0e2a807122585e491fe114dc, A-22005: T0/T1/fallback all T2/changed T3 qa.test.ts/Web complete, 7086 pass/3 skipped/0 fail/0 cancelled. Linux x64 droplet c-8 ams3 Node24.21.0 Neovim0.12.5; browser binary unnamed in receipt. Remaining T3 deferred to merge batch, T4 not run. Duration budgets and lint advisories report-only. C2 separate local macOS20/20 reviewed evidence A-21973/A-21978. Hub ready event received; final same-head settlement with Reviewer.

### rev-35 · 2026-11-20T01:05:06.503Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1798-evidence-2
commit: 626a48820115600e0e2a807122585e491fe114dc
scope: evidence
findings: [{"severity":"low","text":"L1 retained unchanged aside: groupGone accepts any kill(-pgid,0) exception as absence. Coordinator filed T-2018 (Bugs/XS), outside T-1798; permission/probe errors are not positive absence receipts.","file":"nvim/test/qa.test.ts","line":80}]
finding_counts: {"high":0,"medium":0,"low":1}

Final same-head clear; A-22007 audits configured a49468c5/A-22005 at 626a48820115600e0e2a807122585e491fe114dc. Producer starts/finishes pair exactly:7086 passes/3 skips/0fail/0cancel plus731 separate file passes; all234T1/441T2/55Web files and changed Neovim T3 file complete, T0 exit0. Exact timeout, SIGTERM and isolation callers pass;3 sandbox-exec cases explicitly skip on Linux. Remaining271T3 merge-batch deferred;18T4 unexecuted. Linux x64 c-8 ams3 Node24.21/Neovim0.12.5; provenance names HeadlessShell1248/Chrome for Testing156.0.8078.4, canonical tree2a61e2ac distinct from Git tree483b672b, cache:null. Report-only advisories remain so. C1 source verification current; separate A-21973/A-21978 macOS20/20 two-worker+CPU-burner campaign establishes C2 at the same head, without a high-ambient-load or Linux stress claim. Verify C1/C2. L1 low retained: groupGone catch-all absence limitation filed T-2018, no high/medium finding. No Reviewer runtime or source changes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T02:23:28.489Z

Merged 93de390a41c2c07c4f19939032f9fff0c2db254b onto dev.
