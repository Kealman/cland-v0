---
id: E-1197
kind: epic
title: Hub correctness and speed
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-1014
branch: null
created: 2026-10-24T06:45:44.119Z
updated: 2026-10-25T01:12:15.242Z
closed: 2026-10-25T01:12:15.242Z
---

## Summary

Small hub correctness and speed fixes left after v0.2: permission codes, CLI frames, tracker hydration, the managed literal-rm hook, [web] reload refusal and artifact cleanup.

## Goal

Small hub correctness and speed fixes left after v0.2: permission codes, CLI frames, tracker hydration, the managed literal-rm hook, [web] reload refusal and artifact cleanup.

## Why

Backlog items confirmed still real by the triage (A-10327). Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: oc-qa-1 [qa] · run qa-dod-2026-10-25-2 · 2026-10-25T01:11:38.211Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: oc-qa-1 [qa] · run qa-dod-2026-10-25-2 · 2026-10-25T01:11:38.211Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb

## Plan

```yaml
stages:
  - name: permissions, CLI and tracker reads
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-337
        - T-998
      - - T-339
        - T-1188
      - - T-421
        - T-538
        - T-539
      - - T-1220
        - T-1255
      - - T-1257
      - - T-1226
      - - T-1231
      - - T-1247
  - name: init hooks, reload and artifacts
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1181
        - T-1146
      - - T-1187
        - T-515
      - - T-1043
      - - T-1261
```

## Comments

### oc-qa-1 · 2026-10-25T01:11:38.211Z

verdict: qa
result: clear
by: oc-qa-1 [qa]
run: qa-dod-2026-10-25-2
commit: 4decf43e2a44fff25b25b1c60e8de277240929eb
findings: [{"severity":"low","text":"T-1146 has only the merge-batch T1 verify record a51a8b35 at the reviewed head, with no separate per-item log artifact; the Coordinator disposition of 2026-10-24T21:51:40Z accepts the merge batch's T1 run as its landing cover.","file":"hub/README.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

| case | result | basis |
|---|---|---|
| CHILDREN / C1 | PASS | 19 children closed done and merged; every latest clear review head equals its green same-head verify head. |
| NAMED / C2 | PASS | 55 named generated tests across all 42 child criteria pass in both platform covers of each item's stage; stage-1 behaviours also pass in the stage-2 covers at the last landing. |
| COVERS / C2 | PASS | Linux 14d0d24a / A-11401 and macOS 9c0ab09c / A-11393 at fdcea0b9; Linux 8b0010a2 / A-11557 and macOS 27e68fd5 / A-11561 at eedc8101; every tier exit 0, fail 0, cancelled 0. |
| SOURCE / FRESHNESS | PASS | demo status at 4decf43e reports current true; delta from last landing eedc810 is the T-1267 tracker file and hub/test/durations.json only. |

Light DoD check at 4decf43e2a44fff25b25b1c60e8de277240929eb, run qa-dod-2026-10-25-2. No local test, suite, browser or demo lease ran; evidence is the tracker review/verify receipts and the four supplied stage-cover logs. Linux skips are the nine known macOS-only cases; macOS has none. Report A-11566 in topic-1014 carries the child receipt table, per-criterion named tests with Linux/macOS log lines, cover counts and limits.

Finding: low evidence qualification for T-1146 (merge-batch T1 verify only, no per-item log artifact; Coordinator disposition 2026-10-24T21:51:40Z). T-1267 is the known follow-up to T-1261, not a DoD failure. No failed in-scope test or product defect.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T01:12:15.242Z

Closed on oc-qa-1's clear light DoD qa-dod-2026-10-25-2 at 4decf43e (A-11566). This was the first QA verdict written by an OpenCode session (E-1216 DoD C2). Coordinator spot-check: four cited log lines (A-11401:22093, A-11393:5574, A-11401:27113, A-11393:22361) are the named passing finish records. 19 children; stage covers 14d0d24a/9c0ab09c and 8b0010a2/27e68fd5 green. Follow-ups: T-1265 (Codex reattach payload), T-1267 (second hub-stop Timeout).
