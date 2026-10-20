---
id: E-677
kind: epic
title: "Tests at the right level, part 2: class migrations and the scenario set"
state: closed
rank: 4239
criterion_seq: 7
labels:
  - epic
  - v0.1.4
  - verification
assignee: null
parent: R-577
blocked_by: []
follows: []
topic: topic-664
branch: null
created: 2026-10-16T19:58:43.121Z
updated: 2026-10-20T04:04:05.689Z
closed: 2026-10-20T04:04:05.689Z
---

## Summary

Weeks 2 and 3 of D53. The heaviest test files move to T1 and T2 by class: adapters onto the in-process fake adapter with one real-binary contract file per harness, executor and suite files onto the clock with an in-process provider, and roles, subscriptions, tracker and inbox files onto projectHub. A curated set of ten T3 scenarios replaces the integration files it covers. Source: A-4143 (memo §2.2 and §5.5 steps 2–3, the four slice reports).

## Goal

Most test time leaves real processes with no behaviour claim dropped. That makes the task gate short and the T3 merge batch affordable.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. A durations refresh from a green integrated run puts at least 60 % of T1–T3 manifest test-seconds in T1 and T2 (decision 8's exit).
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.067Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C2. T3 manifest seconds are 1800 s or less, so the projected T3 wall at 2 workers is 900 s or less.
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.068Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C3. T1–T3 manifest seconds total 3600 s or less, from 5281 s at A-3877.
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.068Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C4. A spawn census of a full run shows 150 hub process starts or fewer (from under 600 after T-575).
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.068Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C5. `tiers.json` names ten scenarios, each 120 s or less, and one contract file per harness, and the lint baseline holds no fake-binary, `startDaemon` or `spawnSpoke` call site outside contract, scenario and T3-header files.
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.068Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C6. No T2 Neovim file reaches a `hub/src` runtime module, and the selection replay over 40 landings has no T2 Neovim selection decided by `nvim test import`.
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.068Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C7. The T1 and T2 phases of a full run together take 8 minutes of wall or less on a quiet c-8 at workers 2.
  - verified: qa-3 [qa] · run qa-20261020-3d · 2026-10-20T04:03:49.068Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c

## Plan

```yaml
stages:
  - name: the head of the distribution
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-691
        - T-725
        - T-692
        - T-693
        - T-695
      - - T-694
      - - T-697
        - T-698
        - T-699
        - T-700
      - - T-696
        - T-728
        - T-726
        - T-727
      - - T-701
      - - T-704
      - - T-705
      - - T-706
        - T-731
      - - T-719
      - - T-733
      - - T-734
  - name: the tail and the scenarios
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-702
      - - T-703
      - - T-707
      - - T-745
      - - T-750
      - - T-751
      - - T-752
      - - T-753
      - - T-754
      - - T-766
  - name: retirement and Neovim
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-708
      - - T-772
      - - T-773
      - - T-709
        - T-774
  - name: stage-3 close
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-775
```

## Comments

### coord · 2026-10-17T01:52:35.818Z

Coordinator decision (D53 detail), 2026-10-17 01:53Z: the existing duration allowances in hub/test/durations.json become legacy allowances, owned by E-677 and expiring when E-677 closes, with no calendar date. Reasons and seconds are kept. New allowances keep the 7-day expiry with an open owner ticket. Budget reports list the legacy allowances separately (count and total seconds), so E-677's progress shows as that number falling. T-716's enforcement exempts legacy allowances until E-677 closes. Without this, 7-day expiries would need weekly mass renewal and would break runs once T-716 enforces.

### coord · 2026-10-17T06:27:06.041Z

Coordinator (D51, D53), 2026-10-17 06:27Z: the 'follows E-676' link is removed. Every ticket in this epic's stage 1 is blocked only by E-676 seams that have merged: T-679 tiers.json, T-685 Clock, T-686 in-process fake adapter, T-687 in-process spoke, plus T-575. E-676's remaining work (T-720, then stage 2's lint, retag and selection) doesn't block the class migrations. The crew was down to one lane, so starting now follows D53's priority. Launching five stage-1 lanes to fit the droplet budget: T-691 (Claude Code contract), T-697 (executor on the clock), T-696 (accounts on the clock), T-701 (leads and routing to T2), T-706 (long waits and perf to T4). Legacy duration allowances are owned by this epic (decision on T-683).

### coord · 2026-10-17T06:34:55.418Z

Coordinator, for every ticket in this epic: seconds criteria are judged from the ticket's evidence artifact (per-file 5/5 medians on the Mac, plus the per-file seconds from the exact-head droplet run), not from hub/test/durations.json. Baselines refresh only from green integrated runs, which the Coordinator does at stage close. A ticket may shrink or remove legacy allowances for the tests it speeds up, but doesn't rewrite baselines.

### coord · 2026-10-17T06:47:14.382Z

Coordinator, allowance ownership rule for this epic: a new duration allowance added by a migration ticket names E-677, not the ticket, as its owner, with the usual 7-day expiry. A ticket-owned allowance goes invalid under the live-owner lint once the ticket closes at merge. The stage-close refresh turns it into a measured baseline, or the Coordinator renews it with a reason. Legacy allowances keep the earlier rule: owner E-677, expiring when E-677 closes.

### coord · 2026-10-19T22:37:32.316Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z), applying D66: C1 (60 % of T1–T3 manifest seconds in T1+T2), C2 (T3 ≤ 1800 s) and C4 (spawn census ≤ 150 hub starts) are measurement targets. The measured values count as meeting them for v0.1.4, and how to reach the original targets goes to E-880 (Ideas). Values at writing: C1 15.6 % (T-775's pinned refresh) or 28.1 % (repo manifest); C2 2356.8 s (T-775's refresh) or 2016.9 s (repo manifest); C4 not measured in v0.1.4 (the local census starved the shared hub, decision 44c61115; T-775 C3). QA records the values at the demo SHA in its verdict and marks these criteria verified under D71. C3, C5, C6 and C7 are judged as written.

### hub · 2026-10-20T03:53:18.527Z

demo 5c6604f5-6a98-4f96-82b4-03d2350e7302 created: droplet cland-v0-5c6604f5, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T05:07:16.500Z.

### hub · 2026-10-20T04:00:22.185Z

demo 5c6604f5-6a98-4f96-82b4-03d2350e7302 destroyed: lifetime 471961 ms; cost $0.0328.

### coord · 2026-10-20T04:02:26.665Z

Disposition D74 (Coordinator, 2026-10-20 04:05Z), applying D66 to C7. D71 judged C7 as written because the recorded projection met it: 339.86 s, and 214.75 s at the demo SHA. The measured walls of the release-candidate stage cover (A-7022, Linux, 824105c5, two shards on c-8 at workers 2) don't meet it:
- shard 1: T1 hub-free 123.00 s + T2 hub-machine 285.88 s + Neovim 76.78 s = 485.66 s;
- shard 2: T1 hub-free 159.53 s + T2 hub-machine 501.89 s = 661.42 s.
Both shards exited 0. Like C1, C2 and C4, C7 is a speed target. Under the human's D66 rule, the measured values count as meeting it for v0.1.4, and reaching the 480 s target goes to E-880. The gap between the projection and the measured wall (fixed per-file and per-phase overhead that per-file seconds don't capture) is E-880 material too. QA records both measured shard walls and the projection at S and marks C7 verified under D74. The D74 line goes into docs/spec/v0.1.4.md with the post-demo tracker commit. The release ask flags it to the human.

### qa-3 · 2026-10-20T04:03:49.068Z

verdict: qa
result: clear
by: qa-3 [qa]
run: qa-20261020-3d
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"low","text":"R1/C7 brief incorrectly treats projected wall as measured attainment. Actual Linux shard walls485.66s/661.42s exceed480s; projection214.749s. Coordinator recorded D74 accepting measurements for v0.1.4 and assigning target/gap to E880; C7 verified under that disposition, not target attainment.","file":"qa/briefs/E-677.md","line":111}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Result | Method and evidence |
|---|---|---|
| G0 | PASS | [local read-only] clean detached build at requested dev SHA, committed brief, Node24 and session identity; G0.txt |
| G1 | PASS | [local read-only] task view/list and 47 merge-base ancestor checks; all children closed, T775 checked C1-C3; G1-epic.json, G1-children.json, G1-ancestors.txt, R4-t775.json |
| G2 | PASS | [hub-api] task hold E-677; task view confirms qa-3 QA hold; G1-epic.json |
| G3 | PASS | [records] D71 Coordinator disposition 2026-10-19T22:37:32.316Z explicitly accepts C1/C2/C4 for v0.1.4; E880 open under Ideas needs-triage; G1-epic.json, G3-E880.json |
| D0 | PASS | [droplet] demo start E677 at S, one lease active; status receipt captures deadline; D0-start.json, D0-status.json |
| D1 | PASS | [droplet] git identity/clean status, Node24.21.0, Linux x86_64, pinned nvim path/version0.12.5; D1-build.txt |
| D2 | PASS | [droplet] test:tiers/test:lint both exit0; 0 refusals; report-only131 findings59 files; 11 scenarios, 3 harness contracts; D2-tiers.txt |
| D3 | PASS | [droplet] node --test each harness adapter contract; Claude23s/Codex25s/OpenCode32s, all exit0; T3 contract headers/checklists; D3a-claude-code.log, D3b-codex.log, D3c-opencode.log, D3-headers.txt |
| D4 | PASS | [droplet] all11 scenario test files sequential; exit0 each; seconds10,14,5,11,1,4,12,5,2,11,4, all<=120; D4-scenarios.txt, D4-crew-launch.log, D4-droplet-verify.log, D4-hook-bridge.log, D4-hub-lifecycle.log, D4-message-tracer.log, D4-release.log, D4-setup.log, D4-stage-close.log, D4-startup-smoke.log, D4-ticket-flow.log, D4-workbench.log |
| D5 | PASS | [droplet] node --test nvim-fixture-boundary and nvim-frame-consumers; both exit0 (0s/1s), runtime import closure and frame drift guards pass; D5a-boundary.log, D5b-frame-consumers.log |
| D6 | PASS | [droplet] node --test test-lint and test-lint-policy; both exit0 (1s/0s), planted helper and frozen baseline rules pass; D6a-test-lint.log, D6b-lint-policy.log |
| D7 | INCONCLUSIVE — optional, not requested | [droplet optional] census not requested; not run. C4 rests on explicit D71 disposition and R4/R5, not on a full-run census; G1-epic.json |
| D14 | PASS | [hub read-only] fetched origin; dev unchanged; demo freshness current=true at S; D14-dev.txt, D14-status.json |
| D15 | PASS | [hub-api] demo stop released; hub destroyed receipt lifetime471961ms/cost$0.032775069444444443; executor droplet; D15-stop.json, D15-after.json, D15-comments.txt |
| L1 | PASS | [local macOS static lint] control exit0/no refusals; spoke plant line64 and fakeClaude plant line102 each exit1, count1 exceeds frozen0; no other file refused; L1-queue.json, L1-summary.txt, L1-control.txt, L1-spoke.txt, L1-fake.txt |
| L2 | PASS | [local macOS replay] 40 landings, 35 T2 files, runtime hub import closure[], nvim test import decides0 selections; exit0; L2-queue.json, L2-replay.txt, L2-exit.txt |
| L3 | PASS | [local cleanup] plant worktree removed, both own plant branches deleted, local and origin qa branch counts0; dev remains S; build worktree clean; L3-cleanup.txt |
| R1 | PASS | [records] manifest C1 share16.2%/C2 T3 2109.78s accepted under D71; C3 total2518.09s<=3600; A7022 measured C7 shard walls485.66/661.42s exceed480; projection214.75s is not attainment. C7 accepted under recorded D74; both same-S integrated logs exit0.; R1-tiers.txt, R1-summary.txt, R1-integrated-receipts.txt, R1-measured-phase-context.txt, R1-D74-epic.json, R1-D74.txt |
| R2 | PASS | [records] helper audit75 files:10 contract/scenario,65 header-exempt,0 offenders; sole T4 orphan-servers-perf under T901; R2-helpers.txt |
| R3 | PASS | [records] 11 scenario entries and11 Hub process starts headers; manifest durations0.867-16.419s each<=120; D4 measured all<=14s; R3-scenarios.txt |
| R4 | PASS | [records] T775 closed C2/C3 checked and verified under D66; census explicitly not measured/carried to E880; A6408/A6454 exist, A6441 not used; R4-t775.json, R4-records.txt |
| R5 | PASS | [records] static scenario headers sum12 hub starts, baseline195 startDaemon+spawnSpoke sites; static lower bound only, not full-run census or <=150 proof; R5-static.txt, R2-helpers.txt |

Findings ranked by severity: no high or medium functional findings. One low brief defect:

- R1/C7 — qa/briefs/E-677.md:111 (also G3 at line 182 and R1): the brief calls a projection “met,” but C7 asks for measured T1+T2 wall. Reading A-7022's `shard duration` rows shows 485.66 s and 661.42 s against 480 s, while R1-man.cjs prints a projection of 214.749 s. The measured target is missed by 5.66 s and 181.42 s; the projection understates the measured values by 270.911 s and 446.671 s. QA raised this before verifying. Coordinator decision 0c8f2a57-21e3-4b71-8ebc-7129ca712a23 identifies the projection convention as a brief defect and directs verification under D74, with no rerun. The actual D74 epic comment is by coord, recorded 2026-10-20T04:02:26.665Z; its complete text is preserved in R1-D74.txt and R1-D74-epic.json. No product or committed brief was edited.

Criterion marks in this run:

| Criterion | Observed result | Basis for verification |
|---|---|---|
| C1 | Manifest T1+T2 share 16.2%, target >=60%; integrated observed share17.5%. Target not attained. | D71 Coordinator epic comment 2026-10-19T22:37:32.316Z, applying D66; target study E-880. G3/R1. |
| C2 | Manifest T3 2109.78s, target<=1800; projected wall1054.89s vs900; integrated T3 observed2544.90s. Target not attained. | Same D71 disposition. G3/R1. |
| C3 | Manifest T1+T2+T3 2518.09s; integrated observed3083.78s, both<=3600. | Measured records meet text. R1. |
| C4 | Full-run spawn census not requested/not measured. Scenario declarations sum12 starts; baseline195 static startDaemon/spawnSpoke sites is not a runtime count. | Explicit D71 and T-775 C3/D66 not-measured disposition; E-880 owns later measurement. G3/R4/R5. Optional D7 excluded from required checks. |
| C5 | Three harness contract files, all pass; eleven scenarios (current set includes setup and Neovim workbench), each actual1–14s<=120; no nonexempt helper offender; both planted helper calls refused at exact line. | D2–D4/D6/L1/R2/R3. Sole nonzero T4 exemption is hub/test/orphan-servers-perf.test.ts under T-901. |
| C6 | Neovim import/frame tests pass;35 T2 files, runtime hub closure[];40-landing replay has0 import-decided T2 selections. | D5/L2. |
| C7 | Measured T1+T2 shard walls485.66/661.42s>480. Projection214.749s is not measured attainment. | D74 Coordinator epic comment recorded2026-10-20T04:02:26.665Z, applying D66; target and projection gap assigned E-880. R1. |

The manifest has two files without duration baselines, so its totals are incomplete; the green integrated log supplies the observed totals as well. Manifest T1 18.35s/102 files; T2 389.97s/209; T3 2109.78s/174; T4 87.56s/10. These differ from the brief's historical “at writing” values. Historical A-6297 was read only for comparison and does not replace current-S evidence. T-775's C2/C3 are closed and verified under their revised dispositions; A-6408/A-6454 exist. Withdrawn partial census A-6441 is not used as a measurement.

Run qa-20261020-3d, QA qa-3; full tested SHA824105c5a2a56b3495e9215cc88d60c4c129df6c. Result clear:21 required checks PASS; optional D7 INCONCLUSIVE because no census was requested, with C4 explicitly verified under D71. Marks: C1,C2,C3,C4,C5,C6,C7. 102/102 targeted Linux tests passed, no failures/skips/reruns. Local macOS ran static lint and replay only, no test file or full suite. All47 child merge commits are ancestors and all children closed; clean detached build and freshness current=true.

Same-commit integrated evidence is Coordinator's A-7022 (Linux) and A-7026 (macOS), both exit0. QA did not submit a full suite. R1-integrated-receipts.txt preserves exact artifact paths, each shard's machine, timing, cost and phase rows. Linux shard1 cland-v0-1d139ca1/c-8 lon1:1222.07s, lifetime1215s,$0.0843. Shard2 cland-v0-23418384/c-8 lon1:1592.07s, lifetime1584s,$0.1100. Integrated overall wall1615.43s,total cost$0.1944. Linux measured C7 arithmetic: shard1 123.00+285.88+76.78=485.66s; shard2 159.53+501.89=661.42s. Projection is T1 19.76s at1 worker plus T2 194.989s at2 workers. Both measured and projected values are reported without substitution. Release budgets remain report-only under D72/D73/T-930; original target work is E-880's.

Execution: one hub-owned Linux x86_64 demo, Node24.21.0, pinned Neovim0.12.5. All D test files ran serially through demo exec. Local L1/L2 started only after an empty verify queue and the Agents announcement; both plant branches and their worktree were removed, no QA branches reached origin, dev unchanged. Local-done sent to coord/qa-676/qa-2. No product changes or provider/model calls were made by QA.

Demo lease 5c6604f5-6a98-4f96-82b4-03d2350e7302; machine cland-v0-5c6604f5; created2026-10-20T03:52:18.153Z; deadline2026-10-20T05:07:16.500Z; state released; final lifetime471961ms; final cost$0.03277507. Hub creation/destruction comments are D15-comments.txt. Total run wall through report672.7s (includes provisioning, records, local checks and disposition wait); total QA remote cost$0.03277507.

Evidence folder A-7036: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7036-e-677-qa-evidence-at-824105c5-qa-20261020-3d (README.md entry). QA note A-7037: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7037-e-677-qa-clear-c1-c7-with-d71-d74-measurement-dispositions.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-20T04:04:05.689Z

Closed on qa-3's clear at the release candidate 824105c5 (run qa-20261020-3d, A-7037 / A-7036): C1–C7 verified; C1/C2/C4 under D71, C7 under D74. Legacy allowances already owned by E-880 (D72).
