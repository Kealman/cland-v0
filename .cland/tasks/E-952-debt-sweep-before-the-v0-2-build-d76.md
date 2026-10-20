---
id: E-952
kind: epic
title: Debt sweep after v0.1.4, released as v0.1.5 (D76, D78)
state: closed
criterion_seq: 2
labels:
  - epic
assignee: null
parent: R-866
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:41:28.312Z
updated: 2026-10-20T15:20:01.203Z
closed: 2026-10-20T15:20:01.203Z
---

## Summary

The human's D76 (2026-10-20, ask 89df1e19): bugs and tech debt found during v0.1.4 that do not affect a newcomer are fixed on `dev` after the v0.1.4 release and before the v0.2 build starts, and ship with v0.2's first release. There is no v0.1.5. The triage A-7125 sorted 37 items. This epic holds the crew-only fixes it kept, plus the items filed during the release itself (T-942, T-949, T-950, T-951).

## Goal

v0.2's feature epics start on a `dev` without known crew-side bugs or tech debt from v0.1.4.

## Definition of done

- [ ] C1. Every child is closed: merged with its own criteria verified, or closed with a recorded reason (fixed elsewhere, duplicate, or the human's decision).
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T15:19:44.808Z · commit 9ae9a20b1579bf2e47268e3e8e33f2cae20bde59
- [ ] C2. A stage cover on Linux and macOS is green at the dev tip after the last child lands.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T15:19:44.808Z · commit 9ae9a20b1579bf2e47268e3e8e33f2cae20bde59

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-820
        - T-794
      - - T-618
        - T-564
        - T-561
        - T-563
        - T-949
        - T-950
      - - T-576
      - - T-587
      - - T-757
      - - T-552
      - - T-808
      - - T-807
      - - T-768
      - - T-602
      - - T-607
      - - T-570
      - - T-764
      - - T-804
      - - T-942
      - - T-951
      - - T-954
      - - T-955
        - T-958
      - - T-956
      - - T-957
      - - T-959
      - - T-960
      - - T-961
        - T-962
      - - T-963
      - - T-964
      - - T-965
      - - T-966
      - - T-967
      - - T-970
      - - T-972
      - - T-974
```

## Comments

### qa-676 · 2026-10-20T15:19:44.808Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-2
commit: 9ae9a20b1579bf2e47268e3e8e33f2cae20bde59
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 | hub-api | PASS | M1-open.txt: no open descendants |
| M2 | hub-api | PASS | M2-closed.txt, M2-audit.md, children/: 39 closed; 38 landing commits with every criterion verified; T-564 closure reason |
| M3 | hub-api | PASS | M3-plan.txt: stage cover complete (Linux droplet, macOS), tree 5c3c28f21562a9eeacdd7a49b9e2a9fd7b88dfe4 |
| M4 | hub-api, evidence read | PASS | M4-suite.log / A-7695, M4-receipt.json, A-7696 and A-7697 shard logs |
| M5 | hub-api, evidence read | PASS | M5-suite.log / A-7699, M5-receipt.json |

Findings: none in this evidence-only scope.

Build: 9ae9a20b1579bf2e47268e3e8e33f2cae20bde59, run qa-2026-10-20-2. Fetched origin; clean detached HEAD, dev and origin/dev matched before and after checks. Demo freshness current=true. The revised brief has five manual checks and no cases. No new suite, product probe or demo lease was started; QA evidence reads ran locally with isolated HOME/XDG/Git config and an empty inherited environment.

C1: all 39 children closed. 38 have first-parent Item: landing trailers and all their criteria verified (none stale/failed). T-564 has the recorded “Closed as covered by T-618” explanation naming C1/C2 and A-7269. T-962 was landed then reverted by T-970; its re-land T-971 belongs to R-377. Per-child JSON and full landing SHAs are retained.

C2: both fresh, non-cache stage runs cover the exact requested head and verification tree 5c3c28f21562a9eeacdd7a49b9e2a9fd7b88dfe4. Hub completion receipts in receipts.json establish all exit 0, executor and occasion; logs independently establish head/tree, completed commands and zero failures. The local log does not print occasion; its hub completion receipt explicitly says Executor local · occasion stage.

Linux run 396c2c6c-efc4-45f3-bad1-343ada82bb18 (A-7695): full stage, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, two workers per shard. 3319 tests, 3311 pass, 8 skips, 0 fail/cancelled. Shard-1 A-7696 on cland-v0-5bae87f0 (c-8 lon1): 1041.97 s admission through remote finish, lifetime 1030 s, $0.0715; collection 36.01 s. Shard-2 A-7697 on cland-v0-7832f936 (c-8 lon1): 912.97 s admission through remote finish, lifetime 902 s, $0.0627; collection 22.92 s. Total actual wall 1078.28 s admission through collection; total reported cost $0.1342. Both shard logs finish exit 0.

macOS run 4a19c723-9b72-4afe-8976-896ef5402f17 (A-7699): full local stage, Darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5, two workers. 3319 tests, 3319 pass, 0 fail/cancelled/skipped. T1/T2/T3/T4 command durations in the receipt: 27/175/998/49 s; these are phase durations, not total wall. Local droplet cost not applicable.

Both runs execute check plus T1–T4; T4 runs its ten files once in the base phase, with repeated load rounds skipped as explicitly reported. Duration budgets, T3 ratchet and diagnostic test-lint output are report-only; this verdict makes no performance-budget or repeated-load claim. Projected wall values are not actual timings.

Criterion marks requested: C1,C2 verified in this run. The earlier stopped run remains history only in A-7694.

Evidence artifact A-7701: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7701-e-952-qa-clear-evidence-at-9ae9a20b-five-checks-c1-c2/report.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T15:20:01.203Z

Closed on QA clear qa-2026-10-20-2 (qa-676, A-7701) at 9ae9a20b, with C1 and C2 verified. All 39 children are closed. The green stage covers on tree 5c3c28f2 are Linux 396c2c6c (A-7695: 3311 pass, 8 skip, 0 fail) and macOS 4a19c723 (A-7699: 3319 pass, 0 fail). The periodic dev T3 caught T3 regressions from the sweep's own fixes, and they were fixed in-epic: T-964 and T-965 for T-961 and T-807, T-972 and T-974 for T-807, and T-970 reverting T-962, whose re-land is T-971 under R-377. Ships as v0.1.5 (D78, D79).
