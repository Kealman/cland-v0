---
id: E-1888
kind: epic
title: Verification and flow improvements from the v0.4.0 retro (0.4.1)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1533
branch: null
created: 2026-11-16T07:28:34.087Z
updated: 2026-11-24T02:41:27.653Z
closed: 2026-11-24T02:41:27.653Z
---

## Goal

The verification and flow improvements the human approved on 2026-11-16 (ask 8e3dd5ab) from the v0.4.0 retrospective (A-19803, overview AzfEFdvyR3T1ifQWAqgu5d): load-aware waits, flaky-identity receipts, epic-level macOS covers, a lighter landing, fewer periodic runs, faster full runs, delivery fail-fast, release preflight, an enqueue preflight, Coordinator wake-ups, a review-class analysis and QA kit checks. The human approved the changes to decisions H-3 to H-8 explicitly.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1876, T-1877, T-1878, T-1859, T-1528, T-1868, plus the new tickets H-1 to H-15 filed under this epic. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261124-1888-1 · 2026-11-24T02:41:18.181Z · commit e90a97fa2f89e7269594fad1c049189ff2d9b6c0
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261124-1888-1 · 2026-11-24T02:41:18.181Z · commit e90a97fa2f89e7269594fad1c049189ff2d9b6c0

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1889
      - - T-1876
        - T-1899
      - - T-1877
      - - T-1878
      - - T-1859
      - - T-1528
      - - T-1900
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1890
      - - T-1891
      - - T-1894
        - T-1895
      - - T-1898
      - - T-1903
      - - T-1868
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1893
        - T-1896
      - - T-1901
      - - T-1892
      - - T-1897
        - T-2048
      - - T-2035
      - - T-2054
  - name: stage 4
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2056
      - - T-2053
        - T-2051
      - - T-2050
        - T-2055
      - - T-2049
      - - T-2052
        - T-2059
      - - T-2061
      - - T-2064
      - - T-2063
      - - T-2066
```

## Comments

### qa-1880 · 2026-11-24T02:41:18.181Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261124-1888-1
commit: e90a97fa2f89e7269594fad1c049189ff2d9b6c0
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-1888 evidence-only QA

Run qa-20261124-1888-1. Build e90a97fa2f89e7269594fad1c049189ff2d9b6c0. Brief qa/briefs/E-1888.md source commit40f68c7d9fbae475a1d05b1a5a6e129118db7f92. Kit pinned to build (last kit change a28f8ecf978b654c98e28bb7eb738394da7b6022); Node24.21.0 satisfies >=24.13.0 <25. Clean detached HEAD matches build; build is ancestor of dev and dev still equals build. Demo freshness.current=true, no lease. Approval not required. Four stages closed (8+7+8+12=35 staged members), plus3 children outside stages: T-1902,T-2036,T-2042.

Brief correction: actual child count38, replacing stale35; request's35+4 also miscounted because T-2061 already belonged to original count. Coordinator decision8c229755-fe75-4b8c-b498-f75f830cd1a8 explicitly authorizes38 and defers brief commit to preserve pinned dev. Initial QA progress repeated39 before reading actual38 result; corrected immediately, no cases recorded at39. This is a brief/report correction, no product finding.

|Case|Result|Observation|
|---|---|---|
|M1|PASS|Live tracker CLI: no open children|
|M2|PASS|38 closed task ids;74 verified criteria across76 total;34 own landing ancestors and4 documented non-merge closures|
|M3|PASS|A-22728 Linux droplet stage cover: exact head/tree, structured producer code0, fail0|
|M4|PASS|A-22732 macOS local epic cover: exact head/tree, structured producer code0, fail0|

Commands: node hub/bin/cland.ts task list --under E-1888 --state open/closed; task.view each child; git log -1 --first-parent --format=%H --grep='^Item: T-N$' at requested build; read named cover logs and .cland/run/suites/<run>/result.json (aggregate,both Linux shards,macOS). All four result receipts code0/empty cause. Hub owner result messages suite:28f66e86-f2ee-46cb-bf66-e8053bdb202b and suite:df2f5ff1-110a-420f-a930-69b58ba39909 in Agents confirm all exit0.

## Cover scope

Linux run28f66e86-f2ee-46cb-bf66-e8053bdb202b/A-22728: stage,2 droplet shards,c-8 sfo2,workers2,Linux x64 6.8.0-149-generic. Owner totals9679 tests,9665 pass,14 skip,0 fail/cancel/todo. Lifetimes3182s/$0.2209 and2271s/$0.1577; producer total$0.3787 (rounded shard figures), executor accounting not case wall time.

macOS run df2f5ff1-110a-420f-a930-69b58ba39909/A-22732: epic,local Darwin arm64 27.0.0,workers2;9675 tests,9674 pass,1 skip,0 fail/cancel/todo. Both provenance receipts: exact requested head, tree6d1bcf785054d6bb89b9dbec9524b7fd23722409,cached null,Node24.21.0,Nvim0.12.5. Actual browser Chrome Headless Shell1248, Google Chrome for Testing156.0.8078.4; exact Linux and macOS binary paths retained in source log provenance. No browser launched by QA.

T0–T4 and Web completed;18 T4 files base phase only,extra repetitions skipped. Structured finish records independently inspected: Linux9968 test pass/14 skip/1335 file pass;macOS9977 test pass/1 skip/1335 file pass. These include load repetition records and are not substituted for the hub's aggregate totals. Budget,lint,fixed-wait,ratchet and skip-reason diagnostics report-only. Skips remain unexecuted coverage. No new suite/demo/product tests, no timing comparison, no promotion of earlier failed runs.

## Child closure receipts

- T-1528: 2/2 criteria verified. Merged fd186828762a948451a1fc264770ba083ef3a788 onto dev.
- T-1859: 2/2 criteria verified. Merged a7880ac415409400e3cb53a6c0230b4be27b8f52 onto dev.
- T-1868: 2/2 criteria verified. Merged 5307ed43c664df534e546ebc64215807d1c162b7 onto dev.
- T-1876: 2/2 criteria verified. Merged 6e6b709de524afdd2ec833f7da1e22f346bec99f onto dev.
- T-1877: 2/2 criteria verified. Merged 4a905ab8ea2698e6f9c13bb3ba592aa811f7aa3e onto dev.
- T-1878: 2/2 criteria verified. Merged d5ea35a55b8ab20dcdfc502c0f007bce710afa2b onto dev.
- T-1889: 2/2 criteria verified. Merged b2579dcbf6b00288dbf43009471233357ef518e7 onto dev.
- T-1890: 2/2 criteria verified. Merged b469b98caff90f4b62dabed60567a1b724062c00 onto dev.
- T-1891: 3/3 criteria verified. Merged 0763a463f67b97aa97c09f09b6d3ca1a0296d059 onto dev.
- T-1892: 3/3 criteria verified. Merged 7dfafa84fbdd6d69e7b742cc8582d796268db8e4 onto dev.
- T-1893: 3/3 criteria verified. Merged e2d8f806333e9a19cb9db7e4583d49b83fb213b7 onto dev.
- T-1894: 2/2 criteria verified. Merged 6031921da5d7be6ba32f8d5757ebaa43fa7874e0 onto dev.
- T-1895: 3/3 criteria verified. Merged fb513e13f5991e1e05210e2005e7b04b09b2ee45 onto dev.
- T-1896: 2/2 criteria verified. Merged ecdc13a99587648982cea357ebe19b776740317d onto dev.
- T-1897: 1/1 criteria verified. Merged d788c486ee3c87ed90ea52d788137f14550dad1e onto dev.
- T-1898: 3/3 criteria verified. Merged 16f801a05b735c33e9bcf19d0571696c2dd76659 onto dev.
- T-1899: 2/2 criteria verified. Merged f780708702cdb19c4c2a4cbb398435411a0627df onto dev.
- T-1900: 1/1 criteria verified. Merged 21f46b3f28b5d3dd93678b936ca9db981920292c onto dev.
- T-1901: 2/2 criteria verified. Merged d9fa6d95d63eff6a23f4ec1df65da9049702c273 onto dev.
- T-1902: 2/2 criteria verified. Analysis only, no code: A-19989 (census of R-1530's 354 not-clear verdicts into six cause classes) and supplement A-19991 (reading depth 13 full / 341 excerpt / 0 keyword-only, 29 borderline ids). C2's prevention proposals P1–P6 went to the Coordinator as rule proposals for the human's next rule batch. Review clear: rev-37-1902-full-1 (A-19994), as a descriptive leading-finding analysis, not a calibrated accuracy census.
- T-1903: 2/2 criteria verified. Merged 06182c40626e0e9ceb9b793f86bce1b32dd4276c onto dev.
- T-2035: 2/2 criteria verified. Merged d20f53b65e80e5a5a27f3f3f3e05bc0c4ac64193 onto dev.
- T-2036: 1/1 criteria verified. Closed without a merge: the task branch carries no code change, so this is an evidence-only measurement. C1 is verified (rev-35, A-22517). The comparison is in A-22515 (comparison.md, wording-corrected in A-22517). At the same head 895ad0152, unsharded with 2 workers, c-8 run 66f497e2 (A-22307) completed T0–T3 and Web green. The c-4 run f98eed3f (A-22514) ended exit 124 on the 75-minute run limit after T0–T2, with T3 partial and Web unexecuted, and 0 observed failures. The completed tiers were slower on c-4: T1 197 s against 177 s, and T2 1,217 s against 963 s. Implication: keep c-8 at the current run deadline. A full unsharded suite does not fit c-4 within 75 minutes. Confirmed machine cost for the pair was $0.443.
- T-2042: 0/1 criteria verified. Closed by the human's decision on ask 3262f2d9 (2026-11-23, relayed by cland-impl and recorded in the hub): «Принять ~30 минут: закрыть T-2042 с записанной причиной (цель 20 минут не достигнута)». The measurement A-22537 (partial day, 2026-11-21) shows a median of 29.94 min over 12 green two-shard runs: batches 27.34 min, covers 44.36 min, about 30.10 min with the held timeout included. C1's 20-minute target is not met, and the human accepted about 30 minutes for 0.4.1.
- T-2048: 2/2 criteria verified. Merged 3321d5e2b8652638ff81b628d4063e5b62478903 onto dev.
- T-2049: 2/2 criteria verified. Merged 3d384a7fa45cc8b34414ef46f20e2a27aabee946 onto dev.
- T-2050: 2/2 criteria verified. Merged 503d5858f72ef8ae6eb71a6b18bfb306c2bfb396 onto dev.
- T-2051: 2/2 criteria verified. Merged 5302cceb1b60fe1e253c3e2f9c2db32a3e598016 onto dev.
- T-2052: 1/1 criteria verified. Merged 0e0f6c8771cb8fb0e5600243ffc460be1fc7de41 onto dev.
- T-2053: 2/2 criteria verified. Merged 75390a00eb445174f5ba39f2828fe6735decacb8 onto dev.
- T-2054: 3/3 criteria verified. Merged 4cafa60404a8c2e68a68431a3f25d129954d48d6 onto dev.
- T-2055: 2/2 criteria verified. Merged 0cb5b23bdbef62fd5d3e3b5ea093bfe6fef81eb9 onto dev.
- T-2056: 3/3 criteria verified. Merged 4750d3f576fcb20a7162cdc5180c2a38af33ecb2 onto dev.
- T-2059: 0/1 criteria verified. Done in T-2052's merge 0e0f6c871 (batch e745cfb9, run 09681165 green). All five identities were renewed under C-216, added 2026-11-23, expiring 2026-11-30, at 1.5 times their worst fresh Linux sample: fake-claude dropped 6.939 s, orphan 7.381 s, host-allow-list 9.566 s, prune 8.367 s, stage-cover 46.784 s. None was removed, because 1.5 times each worst sample exceeds the 5 s fallback budget, and prune has no baseline. Evidence: docs/evidence/T-2052-duration-renewal.md and A-22632. Samples come from d6245a18, fe8db4e4, 6a4791fb, ae9e60c1 and 8ae71246.
- T-2061: 2/2 criteria verified. Merged 6b54424ad4d9cd409048673f263ad5da1bd5572d onto dev.
- T-2063: 1/1 criteria verified. Merged b9403c7b8f2030d0c9174772ec943cf7ce3c1421 onto dev.
- T-2064: 2/2 criteria verified. Merged de6e4664fcd3b0cc708ecb9512b2698bbd61d254 onto dev.
- T-2066: 2/2 criteria verified. Merged 19d381e8a6edac66d2d19f91d876d58a11af7210 onto dev.

The four without own landing are T-1902 (analysis),T-2036 (measurement),T-2042 (human accepts unmet target,ask3262f2d9),T-2059 (folded into T-2052). T-2052 landing0e0f6c8771cb8fb0e5600243ffc460be1fc7de41 is ancestral. T-2042 and T-2059 unverified criteria are not labelled verified; recorded reasons satisfy C1's alternative. Findings:none. Verify epic C1,C2 only.

Evidence A-22734 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22734-e-1888-evidence-only-qa-at-e90a97f.md. Shared publisher secret scans and positive controls passed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T02:41:27.653Z

QA clear (qa-20261124-1888-1, A-22734) at e90a97fa2: C1 and C2 verified. 38 children: 34 landed, plus 4 recorded closures without a landing (T-1902, T-2036, T-2042, T-2059). Covers at that commit: Linux stage 28f66e86 (A-22728) and macOS epic df2f5ff1 (A-22732), both all exit 0 with 0 fail. All four stages closed.
