---
id: E-578
kind: epic
title: "Test speed: structural, part 2"
state: closed
criterion_seq: 6
labels:
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
topic: topic-662
branch: null
created: 2026-10-16T06:35:58.703Z
updated: 2026-10-20T04:33:00.628Z
closed: 2026-10-20T04:33:00.628Z
---

## Summary
Carried over from E-387 in v0.1.3 by the human's decision on 2026-10-16 (ask 396ec11a). E-387 closed on a measured 743 daemon starts per full run (census A-3775). This epic takes the remaining structural test-speed targets: under 600 daemon starts (T-575), the two-shard stage-run wall time (T-520), and, by the human's decision of 2026-10-16 (ask 6a7185b6), E-387's unmet hub-test-time, verify-time, worker-default and T-393 C5 targets.

## Definition of done
- [ ] C1. (D1) A full-run spawn census shows daemon starts under 600 (T-575).
  - verified: qa-3 [qa] · run qa-20261020-3f · 2026-10-20T04:32:21.793Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C2. (D2) A two-shard stage run's wall time meets T-520's target.
  - verified: qa-3 [qa] · run qa-20261020-3f · 2026-10-20T04:32:21.793Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C3. (D3) Hub test-time on one slot falls by at least 15% against the quick-wins epic's after run (A-2714) on common tests, measured on a quiet Mac (from E-387).
  - verified: qa-3 [qa] · run qa-20261020-3f · 2026-10-20T04:32:21.793Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C4. (D4) A typical hub task's `cland verify` selects by coverage and finishes in under 5 minutes, and the replay of the last 40 merges meets the human's bar, with T-394 C5–C7's results posted (from E-387).
  - verified: qa-3 [qa] · run qa-20261020-3f · 2026-10-20T04:32:21.793Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C5. (D5) The worker defaults are set from a recorded measurement, locally and on c-16, with T-396's table filled in (from E-387).
  - verified: qa-3 [qa] · run qa-20261020-3f · 2026-10-20T04:32:21.793Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C6. (D6) T-393's 20 migrated files run at least 20% faster than before the migration, judged after merge (T-393 C5, from E-387).
  - verified: qa-3 [qa] · run qa-20261020-3f · 2026-10-20T04:32:21.793Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c

## Plan

```yaml
stages:
  - name: the measured targets
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-575
      - - T-520
```

## Comments

### coord · 2026-10-19T22:37:32.652Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z), applying D66: C2–C6 are speed or measurement targets. The measured values count as meeting them for v0.1.4, and how to reach the original targets goes to E-880 (Ideas). QA records each measured value with its source (run id or artifact) in its verdict and marks C2–C6 verified under D71. Where no measurement exists at all, the verdict says so, and the criterion is verified under D71 only if a value is recorded somewhere. C1 (spawn starts < 600) is judged as written.

### hub · 2026-10-20T04:14:16.301Z

demo 88225030-da50-4db7-93aa-00edab61077c created: droplet cland-v0-88225030, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T05:28:15.012Z.

### hub · 2026-10-20T04:30:38.146Z

demo 88225030-da50-4db7-93aa-00edab61077c destroyed: lifetime 1028806 ms; cost $0.0714.

### qa-3 · 2026-10-20T04:32:21.793Z

verdict: qa
result: clear
by: qa-3 [qa]
run: qa-20261020-3f
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"low","text":"D2 exact helper selector is stale: start was renamed startProjectHub in 3147e92f. Old query misleadingly yields zero; same daemon spawn site gives 176 canonical starts (177 with copied fixture). Original aggregate and rename diff preserved; no rerun.","file":"qa/briefs/E-578.md"},{"severity":"low","text":"D4 no-skip expectation omits the macOS-only sandbox-exec case. Linux 1 pass + 1 platform skip, plus same-S A-7026 macOS pass, accepted by Coordinator bbb9d13b. Original erroneous no-skip recording retained and explicitly corrected by D4-platform.","file":"qa/briefs/E-578.md"},{"severity":"low","text":"R6 Bugs aside XS: README says four workers while config at S is two, matching D53/T-655/T-656 recorded c-8 experiments. Reported to lead for filing; no QA source fix.","file":"hub/README.md","line":2801},{"severity":"low","text":"R2/R3 metric wording: historical 4% spread is not this run's 370 s shard spread; A-6104 measures remote runner suite-duration, not host-check-through-collection. Actual stage and task-body boundaries are preserved in the report.","file":"qa/briefs/E-578.md"}]
finding_counts: {"high":0,"medium":0,"low":4}

| Case | Where | Result | Evidence |
|---|---|---|---|
| G0 | local macOS | PASS | Clean detached S, committed brief, on dev, Node 24 |
| G1 | records | PASS | Open epic/C1–C6; children closed; T-575/T-520 merges ancestors; T-662 superseded; D71 |
| G2 | hub API | PASS | QA hold |
| D0 | droplet | PASS | One lease at S |
| D1 | droplet | PASS | Clean S, Linux x86_64, c-8, Node 24.21.0 |
| D2 | droplet | PASS | Fresh full census: 176 canonical starts; green single run |
| D3 | droplet | PASS | close-shards 3/3, no skips; combined plan and conservation |
| D4 | droplet + Mac receipt | PASS with correction | Linux 1 pass/1 platform skip plus A-7026 sandbox pass |
| D4-platform | records | PASS | Corrects initial no-skip method; original retained |
| D5 | hub API | PASS | Freshness current; no dev delta |
| D6 | hub API | PASS | Released; created/destroyed comments; final lifetime/cost |
| L1 | local macOS | PASS | 40/40 replay, 7 selected, zero misses |
| R1 | records | PASS | A-4088 historical combined 529; cross-check only |
| R2 | Linux records | PASS D66/D71 | A-7022 stage wall 1615.43 s against 600 s |
| R3 | Linux records | PASS D71 | Ten selected logs median 2.0 min, 8/10 under 5 |
| R4 | Mac records | PASS | Common hub test-time −33.9% against −15% |
| R5 | Mac records | PASS D66/D71 | Common top-file time −2.1% against −20% |
| R6 | records | PASS D71/27bf8784 | c-8 experiments support workers 2; six local/c-16 rows remain unmeasured |
| R7 | records | PASS D71/27bf8784 | A-7049 publishes current values; no post-merge T-394 results existed before this run |
| R8 | docs at S | PASS | Coverage selection and replay documented |

All 20 recorded checks pass under the stated brief corrections and dispositions. Criteria marks: C1,C2,C3,C4,C5,C6 verified in qa-20261020-3f. D66 is explicitly extended to E-578 C2–C6 by D71; C1 passes its literal count bar. The unmet original targets and missing measurements remain visible and are carried to E-880.

Findings (low only): D2's obsolete helper selector, D4's missing macOS-only skip exception, R6's stale README worker count (XS Bugs aside), and R2/R3's historical example/metric-boundary wording. Commands, source diff, original mistaken D4 record, correction note and evidence are in A-7052/A-7053. No high or medium finding. No product fix.

| Criterion | Target | Actual value / provenance |
|---|---|---|
| C1 | <600 daemon starts | 176 canonical, 177 including copied coverage fixture, fresh single green census at S. Current exact helper is hub/src/cli/hub.ts startProjectHub; rename confirmed by T-844 commit 3147e92f. Historical A-4088 529 at a8ddbb8c is only a cross-check; no fallback or combined fresh count. |
| C2 | Stage wall ≤600 s | A-7022 run 51b982ae-ecdc-4e59-a786-b2294bd999ea at S: overall 1615.43 s (gap 1015.43 s); shard 1222.07/1592.07 s, spread 370 s. D66/D71 plus T-520 disposition 1aab3506 accept measured balancing limits. A-3935 equal estimates are test work, not wall. |
| C3 | −15% common hub time | Mac A-2714 run b90756d8-c00a-4376-a1ba-3c4ecc4ce27b at fda3a637aae12e5c113308962bd9399c258f3a99 → A-7026 run 40c55103-93ef-41fc-ac26-b818dd91c44a at S: 1102 common tests, 1585.26→1047.11 summed seconds, −33.9%; peak loads 13.32/14.68. |
| C4 | Selection, <5 min, replay, posted results | L1: 40/40 landings, 7 hub-selected, zero own/historical misses. A-7049 lists ten full run ids/heads: lower-middle median 117.03 s; conventional median 121.295 s; both 2.0 min; 8/10 <300 s. These are runner bodies, not end-to-end verify. No post-merge results were on T-394 before this run; Coordinator 27bf8784 accepts the published measurement and will post its citation. Coverage overhead was not newly measured or asserted ≤15%. |
| C5 | Filled local/c-16 table | Fixed 4555eafe0f84c91649c962dbf432bd9f911eb320 c-8 experiments: A-4106 worker 1 timeout 2996.70 s; A-4156 worker 2 three green, mean 2411.96 s, peaks 7.91–9.27; A-4163 worker 4 two green/one red, mean attempt 1757.00 s, 2635.51 s per green. A-4165/T-655/T-656 support D53 config 2. Coordinator 27bf8784 accepts these under D71. All six local 4/5/6 and c-16 4/6/8 rows stay unmeasured, E-880. |
| C6 | −20% across 20 named files | Same Mac receipts, brief basename filter: 182 common tests, 560.64→548.68 s, −2.1%, 17.9 percentage points short. Full per-file table retained; added/removed/renamed/duplicate tests excluded. The exact brief filter includes nvim/test/session-resume.test.ts. |

Fresh census used the brief's npm test -- --all wrapper on the single lease. 3125 tests: 3117 pass, zero fail, eight platform skips. Hub free 562/562; machine 2175 pass/5 skips; Neovim 380 pass/3 skips. Suite 826.66 s, invocation 828.79 s, peak 12.22; free 1 worker, machine/Neovim 4 workers. This structural-count timing is not compared to the 2-worker stage. Missing origin in the delivered checkout caused explicit full fallback; both full hub and Neovim completed. No occasion/T4 request. Recorder counted 53053 child_process calls, zero truncated lines; report retains known preload/sandbox/non-Node coverage limits. Original aggregate, full log and append-only records archive retained.

Accounting: Linux c-8 machine cland-v0-88225030, lease 88225030-da50-4db7-93aa-00edab61077c; created 04:13:16.615Z, deadline 05:28:15.012Z; confirmed released, lifetime 1028806 ms, cost $0.0714448611. Integrated stage receipt A-7022 is prior read-only evidence: shard machines cland-v0-1d139ca1/cland-v0-23418384, lifetimes 1215/1584 s, costs $0.0843/$0.1100; total $0.1944 and overall wall 1615.43 s. No local suite/census, plants, second lease, source fixes or commits.

Evidence note A-7053: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7053-e-578-qa-clear-176-daemon-starts-measured-speed-gaps-retained.md
Full bundle A-7052: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7052-e-578-qa-evidence-qa-20261020-3f-at-824105c5
Published T-394 measurements A-7049: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7049-e-578-current-replay-and-selected-run-measurement-for-t-394.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-20T04:33:00.628Z

Closed on qa-3's clear at the release candidate 824105c5 (run qa-20261020-3f, A-7053 / A-7052): C1–C6 verified. C1 = a fresh full-run census at S with 176 canonical daemon starts (< 600); C2–C6 under D71 with measured values. README worker wording is T-934.
