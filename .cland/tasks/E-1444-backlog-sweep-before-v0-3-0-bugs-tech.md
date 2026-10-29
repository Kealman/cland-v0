---
id: E-1444
kind: epic
title: "Backlog sweep before v0.3.0: bugs, tech debt and follow-ups"
state: closed
criterion_seq: 2
labels:
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: null
branch: null
created: 2026-10-29T15:58:42.986Z
updated: 2026-10-29T22:04:30.831Z
closed: 2026-10-29T22:04:30.831Z
---

## Summary

The human's decision (2026-10-29 15:58Z, ask 686eac9b): before the v0.3.0 live run and release, the crew fixes the open backlog in the recommended set of 28 items. That is all 16 Bugs; Tech debt T-1319, T-1248, T-1316, T-1082 and T-1087; Follow-ups T-1421, T-1436, T-1437, T-1336, T-1379, T-1162 and T-410. T-1433, T-373, T-1264 and T-1268 stay in their categories.

## Goal

v0.3.0 ships on a `dev` without the known bugs and test flakes found during the 0.3 build, and with the tracker, merge and test-time debt that slows the crew paid down.

## Definition of done

- [ ] C1. Every child is closed: merged with its own criteria verified, or closed with a recorded reason (fixed elsewhere, duplicate, or the human's decision).
  - verified: qa-677 [qa] · run qa-2026-10-29-677-1444 · 2026-10-29T22:03:45.765Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd
- [ ] C2. A stage cover on Linux and macOS is green at the dev tip after the last child lands.
  - verified: qa-677 [qa] · run qa-2026-10-29-677-1444 · 2026-10-29T22:03:45.765Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-341
        - T-1350
      - - T-1422
        - T-1336
      - - T-1380
        - T-1319
      - - T-1420
        - T-1316
      - - T-1320
      - - T-1351
      - - T-1426
      - - T-1430
      - - T-1373
      - - T-1416
      - - T-1428
      - - T-1429
      - - T-1431
      - - T-1435
      - - T-1337
      - - T-1248
      - - T-1421
      - - T-1436
      - - T-1437
      - - T-1379
      - - T-1162
      - - T-410
      - - T-1082
      - - T-1087
      - - T-1445
      - - T-1446
      - - T-1447
      - - T-1448
      - - T-1449
      - - T-1450
      - - T-1452
```

## Comments

### qa-677 · 2026-10-29T22:03:45.765Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-2026-10-29-677-1444
commit: 3e15caf47526a10c79dff01e4c637e9913f641bd
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface | Result | Evidence / observation |
| --- | --- | --- | --- |
| M1 | hub-api, local macOS | PASS | No open children. |
| M2 | hub-api, local macOS | PASS | 35 closed/done ids; 33 Item-trailer dev landings, all 59 child criteria verified; T-341/T-1320 explicit no-change reasons, branchless with no landing. |
| M3 | hub-api, local macOS | PASS | the sweep closed; 35 eligible; both covers match verification tree e7f94ed72dfbda3ffe5fdf2c8794844a5fe5fbc4. |
| M4 | log audit, local macOS | PASS | c6e2b28b / A-14131: Linux droplet, occasion stage, all exit 0; 5785 pass, 9 reasoned skips, fail 0. |
| M5 | log audit, local macOS | PASS | d3c6e739 / A-14135: darwin local, occasion stage, all exit 0; 5793 pass, 1 reasoned skip, fail 0. |

Clear; no scoped high/medium/low findings. C1 and C2 verified by this run. Artifact A-14140: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14140-e-1444-dod-evidence-audit-at-3e15caf4-clear-c1-c2/report.md — case receipts, full child matrix, logs, hub result messages, exact skip names/counterpart outcomes, scan manifest.

Tested source/dev 3e15caf47526a10c79dff01e4c637e9913f641bd; final clean detached HEAD and dev equal the request; freshness current:true at 22:01:43Z. No product tests, browser or demo lease launched by this evidence audit; local Node v24.21.0. Existing covers independently read, not newly run and not cache hits (reused:false). Both completed T0–T4 and Web; T4 extra load repetitions excluded, base tests ran; budgets/ratchet/test-lint diagnostics report-only. Every skipped generated case passes on the other platform. Latest clear review and passed verify heads match for all 33 landed children; squash SHAs distinguished from task heads.

Linux x64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5; Headless Shell156.0.8078.4/v1248. Two c-8 lon1 machines: cland-v0-c321f683 lifetime1438s/$0.0999 and cland-v0-45daafe6 lifetime1447s/$0.1005; reported total$0.2003, wall1496.75s admission through collection. Web cases on shard-1, empty shard-2 Web selection is not extra coverage. macOS darwin arm64 27.0.0, same Node/Neovim; isolated Headless Shell (exact binary version unstamped); local cost not applicable. Its hub-generated suite result supplies occasion stage, absent from standalone local log.

Audit corrections retained: initial M1 missing yaml before tracker access, corrected by existing dependency symlink and successful repeat; original M2 prose count60 superseded by appended M2-count-correction (actual59). Neither is a product finding. T-1320 C1 remains unverified under its explicit no-change disposition; no OOM fix claimed. Child product behavior and E-1314 live/release DoD outside this brief.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T22:04:30.831Z

QA clear qa-2026-10-29-677-1444 at 3e15caf4 (A-14140). 35 children are closed: 33 landed with their criteria verified, and T-341 and T-1320 closed without a change. Stage covers are green on Linux (c6e2b28b, A-14131) and macOS (d3c6e739, A-14135).
