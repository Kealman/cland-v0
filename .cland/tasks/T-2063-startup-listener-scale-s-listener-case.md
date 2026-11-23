---
id: T-2063
kind: task
title: startup-listener-scale's listener case fails "hub setup incomplete" when its 1,500-answer hub setup exceeds the 10 s load-scaled setup bound on a slow-disk droplet
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1717
branch: t/T-2063-startup-listener-scale-s-listener-case
created: 2026-11-23T18:29:37.144Z
updated: 2026-11-23T23:14:24.505Z
closed: 2026-11-23T23:14:24.505Z
---

## Summary

Linux stage cover 3e193ed3 (2026-11-23, dev 40f68c7d9, A-22671, shard 1 on cland-v0-8302a8b3) failed `hub/test/startup-listener-scale.test.ts › listener binds report each await while retained verdict freshness drains` after 15.9 s. The error was `Error: … hub setup incomplete; fixture retained`, raised from `stage-case-fixture.ts:22` through the `deadline.ts:24` timer. The case's hub setup is bounded by `testSetupWaitMs()` (10 s on that machine), and building the 1,500-answer fixture took longer. The shard's disk was slow: fsync 9.44 ms and SQLite 33.67 ms, against about 3–4 ms on healthy droplets. The work-only sibling's setup took 6.8 s against the same 10 s bound. The case passed in cover 77af614d, periodic run 6a592423 at the same commit, and batch 09681165.

## What to build

Size this case's setup bound from its fixture cost: a named, load-scaled setup budget for the 1,500-answer projectHub. Alternatively, make the setup cheaper, so a slow-disk droplet doesn't turn setup time into a red. Keep the case's census and listener assertions unchanged.

## Acceptance criteria

- [x] C1. On a slow-disk Linux droplet (fsync ≥ 9 ms), the listener case's setup completes within its bound, or the bound is derived from the fixture size and machine health, and the case passes 5/5 (evidence).
  - done: impl-2063 · 2026-11-23T22:32:05.289Z
  - verified: rev-35 [reviewer] · run rev-35-2063-evidence-1 · 2026-11-23T23:03:29.232Z · commit 17c115c9ea41bf49b97354ad465fc829fb6b7504

## Comments

### coord · 2026-11-23T22:06:37.027Z

Second occurrence: Linux stage cover 37b7f4fd (2026-11-23, dev 2665701ea, A-22692, shard 2 on cland-v0-93323017, fsync 11.55 ms, SQLite 31.57 ms) failed with the same `hub setup incomplete; fixture retained`. In that run the work-only sibling's setup took 7.59 s against the 10 s bound. Two consecutive stage covers were red on this case alone, and the one flaky-rerun resubmit is used. Pulled into 0.4.1 (E-1888 stage 4) under the human's standing yes for bug items, because the stage and epic covers can't go green while slow-disk droplets hit it.

### impl-2063 · 2026-11-23T22:08:36.471Z

Prepared a temporary fixture-owned SQLite commit-delay probe (9 ms per commit, first 1,500 commits only, native launch guard retained). The old setup bound is still unchanged for red-first reproduction. Coordinator approved controlled local emulation but native slot is held by epic cover 4e4ae4e1; waiting for its explicit release/grant. No native tests run yet.

### impl-2063 · 2026-11-23T22:32:05.169Z

C1 evidence: A-22698 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22698-t-2063-calibrated-setup-bound-red-five-greens-and-final-checks. macOS controlled 9 ms synchronous commit-stall emulation reproduced old 10 s setup failure, then passed 5/5 with fixture-sized/load-scaled 40 s budget. Every green recorded all 1,500 answers/reads and unchanged census/listener assertions. Final probe-free T3 file passed 4/4, including shared hub-setup expiry control and late-disposal close receipt. Full test:lint (including test:static) and typecheck exited 0 after origin/dev merge 0e04ae745; zero lint refusals. No pinned config/duration/help/shared contract changes; no T1 consumers reached by test-only diff. Linux receipt still pending post-review mode-free verify.

### rev-35 · 2026-11-23T22:35:05.621Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2063-source-1
commit: 17c115c9ea41bf49b97354ad465fc829fb6b7504
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22699 records source clear against the two-file diff from0e04ae745. Four named shared setup units derive from1500 answers and are sampled at acquisition; stageCase consumes the duration once (40s at5s fallback/factor2). The real and held-return acquisitions share waitForHubSetup; explicit1ms control preserves timeout, late-disposal and positive connection-close assertions. Census/listener/request assertions,120s backstop, tiers and allowances unchanged; matching guide updated. Coordinatorbf98aef2 explicitly approved this bounded design and hang control. A-22698 raw outputs confirm calibrated old-bound red and five local emulation passes with1500 answers/reads, setup15.487–15.506s<40s, plus final uninstrumented file4/4. This is authorized macOS synchronization emulation, not physical Linux fsync or a Linux pass; native exit codes/local gates are producer-reported. C1 remains unverified pending same-head configured Linux evidence. Read-only review; no findings or reviewer execution. Normal mode-free verification may proceed after Coordinator verify-window grant; no full task suite/new campaign or dev merge requested.

### impl-2063 · 2026-11-23T23:01:46.017Z

Linux verification completed: run 153ebad2-97ac-44e6-8845-17b74f02989f, A-22700, head 17c115c9ea41bf49b97354ad465fc829fb6b7504, exit 0 (7465 pass, 0 fail, 1 skipped macOS-only prerequisite). T0, all T1, fallback all T2, 8 selected T3 files and Web completed; remaining T3 deferred to merge batch; T4 not run. Droplet linux x64 6.8.0-149-generic, Node 24.21.0, c-8 sfo2, lifetime 1444 s, cost $0.1002. Chrome Headless Shell 1248 / Google Chrome for Testing 156.0.8078.4. Budgets report mode. Target listener setup 6067.004/40000 ms, case pass 14.103209984 s; work-only setup 4442.988/40000 ms, case pass 9.686500378 s; both cleanup controls pass. All 1500 answers/reads and census assertions recorded. Physical fsync 5.55 ms, so this is ordinary Linux evidence; slow-sync red/5-green emulation is A-22698. Same-head final settlement is with Reviewer.

### rev-35 · 2026-11-23T23:03:29.232Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2063-evidence-1
commit: 17c115c9ea41bf49b97354ad465fc829fb6b7504
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-22701 combines source/A-22699, approved fixture-size/load-derived budget and controlled five-green emulation/A-22698 with completed Linux153ebad2/A-22700. Four exact startup-listener-scale cases have matched passing start/finish receipts: listener14.103209984s/setup6067.004ms<40000; sibling9.686500378s/setup4442.988ms<40000; both positive-close controls pass. Census1500reads/published,3003summaries,27394/25888hydrated,0dependents and all three listener receipts checked independently. C1 verified through the Coordinator-approved derivation/calibration alternative; this droplet fsync5.55ms is not >=9ms and one Linux base execution is not five Linux repetitions. Local controlled probe epochs/native-exit reporting limits remain explicit. T0/all243T1/fallback445T2/selected8T3/55Web exit0;265T3 deferred,18T4 unexecuted. Aggregate7466tests/7465pass/1prerequisite skip/0fail/cancel/todo; separate5loaded prerequisite skips, existing3F2 finish-only entries separately accounted. Linuxc8sfo2 Node24.21/Nvim0.12.5 Headless1248/CfT156.0.8078.4; report-only budgets/lint. Read-only review, no findings or additional run/source change requested.

Criteria: C1 verified.

### impl-2063 · 2026-11-23T23:14:23.117Z

Additional integrated slow-disk Linux proof after ready: merge batch a9f8bcb9 / run d2ff2d02-b9e1-4214-9c89-10d51b41572f, candidate head 9250c91184873cc52bfd04cd150e5894ff3b022d, tree b692908a14b203832164c70057f874c679929e81, exit 0. A-22705 records target file on shard 2 cland-v0-75a9a139, linux x64 Node 24.21.0, physical fsync 57.31 ms, SQLite 224.03 ms. Raw log line 3043 records `load gate: hub/test/startup-listener-scale.test.ts::listener binds report each await while retained verdict freshness drains 5/5 passed`; the sibling and both controls also record 5/5. Base listener case passed in 23.470180624 s with all 1500 answers/reads and unchanged census receipts. This supplies actual slow-disk Linux 5/5 in addition to the earlier authorized local emulation. Batch ran 8 affected T3 files, reused member T1 proof, remaining T3 deferred; report-mode budgets. No new source changes or run submissions.

### coord · 2026-11-23T23:14:24.505Z

Merged b9403c7b8f2030d0c9174772ec943cf7ce3c1421 onto dev.
