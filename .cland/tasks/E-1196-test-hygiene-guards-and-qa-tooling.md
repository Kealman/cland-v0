---
id: E-1196
kind: epic
title: Test hygiene, guards and QA tooling
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-1013
branch: null
created: 2026-10-24T06:45:44.006Z
updated: 2026-10-25T01:00:19.316Z
closed: 2026-10-25T01:00:19.316Z
---

## Summary

Parallel lanes stop colliding in docs/agents/tests.md, Web and Neovim tests are sealed and race-free under load, and QA briefs are checked against the build before a run.

## Goal

Parallel lanes stop colliding in docs/agents/tests.md, Web and Neovim tests are sealed and race-free under load, and QA briefs are checked against the build before a run.

## Why

123 of 166 v0.2 landings touched docs/agents/tests.md; three Web load races (T-1157, T-1182, T-1183). Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-676 [qa] · run qa-dod-2026-10-25-1 · 2026-10-25T01:00:05.158Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-676 [qa] · run qa-dod-2026-10-25-1 · 2026-10-25T01:00:05.158Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb

## Plan

```yaml
stages:
  - name: split the tests doc
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1199
        - T-1070
      - - T-1210
  - name: sealed and race-free fixtures
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1083
        - T-1200
      - - T-1012
        - T-1030
        - T-1149
      - - T-1108
        - T-360
        - T-1204
      - - T-1214
      - - T-1239
      - - T-1246
  - name: QA tooling and docs drift
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1201
        - T-1205
      - - T-1206
      - - T-436
```

## Comments

### qa-676 · 2026-10-25T01:00:05.158Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-25-1
commit: 4decf43e2a44fff25b25b1c60e8de277240929eb
findings: [{"severity":"low","text":"T-1200 C2 qualification, T-1268 (Tech debt, XS): the synthetic ten-child/two-worker CPU mechanism passes both covers; no production new-Web-file browser repetition receipt exists yet. Coordinator 419e6e7b explicitly scopes that outstanding receipt as a follow-up, not a DoD failure.","file":"hub/test/suite-runner.test.ts"}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Result | Evidence |
|---|---|---|
| CHILDREN / C1 | PASS | 18 landed children; latest clear review SHA equals green same-head verify; raw artifact Head/Finished exit 0 checked. |
| NAMED / C2 | PASS | 42 criterion/test mappings, 84 ordinary native passing finish records across A-11557 and A-11561. Exact generated names/files/lines in A-11565. |
| T0 / C2 | PASS | Executed lint-web-workspace, lint-copied-tracker and lint-closed-item-wording assertion scripts retain planted controls and both cover outputs. Decision 420da41b accepts these as T0 assertion receipts, not node:test names. Closed wording explicitly reports fixture diagnostics passed and 244 documents/1265 items/0 findings. |
| HISTORICAL / C2 | PASS | Original local 20/20 loops for T-1108, T-1149 and T-1239; T-1030 TMPDIR-specific 25/25 receipts; T-1246 standalone and launch/attach inventory retained with actual original heads/platforms. No current-head rerun claimed. |
| COVERS / C2 | PASS | Linux 8b0010a2 A-11557 and macOS 27e68fd5 A-11561 at eedc81011923a5c71829f89229ba64150f04e518, both exit 0. All 41 Neovim T2 files/349 named passes on each platform. |
| SOURCE/FRESHNESS | PASS | Requested 4decf43e2a44fff25b25b1c60e8de277240929eb differs by tracker and durations refresh/reownership only. demo status immediately before verdict: current true. |

Low qualification: T-1200 C2 / T-1268 (Tech debt, XS). `Web repetition children publish ten completed summaries under CPU load and are reaped` passes in both covers; its diagnostic `web/test/new.test.ts 10/10 passed; workers 2; CPU load; attempted 10/10` is synthetic process evidence (A-11557:24326, A-11561:20228), not production browser proof. Coordinator decision 419e6e7b confirms the production new-file receipt is outstanding and explicitly scopes it as a follow-up. No missing receipt is counted as a pass.

Runtime provenance: Linux droplet x64 4454 pass/9 skipped; local macOS arm64 4463 pass. T0/check, T1–T4 and Web completed; T4 11 base files only, repetitions skipped. Browser: pinned Chrome Headless Shell 156.0.8078.4/revision1248. Budget/lint/ratchet report-only where labelled; no enforce-mode performance claim. No local tests, new suite, demo lease or real-browser run in this light pass. Historical cover SHA is not relabelled as requested later SHA.

Linux shard logs A-11558/A-11559: cland-v0-1c502893 admission–finish1192.55s/lifetime1170s/$0.0812, collection22.00s; cland-v0-de88756a1140.55s/lifetime1121s/$0.0778, collection26.27s. Merged actual wall1215.06s, reported total$0.1591 (rounding retained). Local billing not applicable. Earlier stage pairs remain A-10848/A-10857 at95662413 and A-11401/A-11393 atfdcea0b9.

Evidence A-11565: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11565-e-1196-light-dod-at-4decf43e-18-child-receipts-named-tests-and-t0-assertions/report.md. Export scan: four positive controls detected, zero matches. This run's worktree and scratch removed; no test processes launched. Verified C1,C2.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T01:00:19.316Z

Closed on qa-676's clear light DoD qa-dod-2026-10-25-1 at 4decf43e (A-11565): 18 children with matching same-head review/verify receipts; stage covers 8b0010a2/27e68fd5 green. Follow-ups: T-1264 (parser, trigger-gated), T-1266 (T-1205 T2 budget), T-1268 (T-1200 production receipt).
