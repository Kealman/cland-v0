---
id: E-678
kind: epic
title: "Merge queue: task verify runs T0–T2, the hub lands batches on T3"
state: closed
rank: 4229
criterion_seq: 8
labels:
  - epic
  - verification
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
follows:
  - E-676
topic: topic-665
branch: null
created: 2026-10-16T19:58:43.217Z
updated: 2026-10-20T04:02:44.339Z
closed: 2026-10-20T04:02:44.339Z
---

## Summary

Week 4 of D53, with parts earlier. `cland merge` enqueues into a hub-owned merge queue. The queue runs T3 once per batch of up to three reviewed heads, lands a green batch and bisects a red one leave-one-out with `merge-bisected`. A task verify runs T0–T2 only, occasions run T1–T4, a nightly T4 soak runs within the daily cap, and the budgets enforce. Per-tier `[verification]` commands make the tier model cland's product rule for any project. Source: A-4143 (memo §5.2, §5.5 step 4 and §5.6).

## Goal

A merged ticket costs about 1.5 runs instead of 2.5, the task gate takes 8 minutes or less, and the Coordinator's manual covers retire.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. The median task-run body (check through collection) over the first 20 droplet task runs after T-713 went live is measured against the 8-minute target on c-8 at workers 2, with the run ids (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C2. Executed suite runs per merged ticket over the merges since T-713 went live are measured against the 1.6 target, counting task runs, batch runs divided by batch size and bisection jobs (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C3. Task runs since T-713 went live are measured for red rate (target ≤ 10 %) and red-on-a-flake rate (target ≤ 5 %, a quarantined or later-green test with no code change) (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C4. From T-713 going live (restart #17, 2026-10-19 04:23Z) to the release build, every commit on dev landed from a green batch tree or as a tracker/docs-only or human-override direct landing, and no manual cover ran (accumulated-to-release scope, D63).
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C5. Over merges since T-713 went live, the median batch wall (target ≤ 15 minutes) and the median droplet cost per merge (target ≤ $0.08) are measured (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C6. Budgets enforce: a planted over-budget T2 test without an allowance fails its run, and T3 growth without an allowance is refused with `merge-budget`.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C7. Every nightly soak due between T-715's merge and the release build is listed with its cost against the daily cap and the $0.25 target and with whether it recorded a coverage map (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C8. A non-Node fixture project with per-tier commands runs unit and component tests in its task verify and integration tests in its merge batch.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:02:03.126Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c

## Plan

```yaml
stages:
  - name: queue entries, occasions and budgets
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-710
      - - T-714
      - - T-716
  - name: batches and the soak
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-711
        - T-712
      - - T-715
  - name: the protocol switch
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-713
        - T-718
      - - T-803
      - - T-850
      - - T-823
      - - T-831
  - name: the product rule
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-717
      - - T-824
      - - T-827
      - - T-812
```

## Comments

### coord · 2026-10-19T22:37:32.796Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z). C4 passes with these exceptions, all the Coordinator's, from restart #17 (04:23Z) to the release build. Direct non-batch, non-tracker/docs commits on dev: 9e79d7e4 (D64 [merge] batch = 4), 1d81bd6e (D68 daily cap $20), 595c7f01 (durations baseline refresh from green run cd21226d / A-6297), e56825e8 (D69 batch_wait 2m), plus the D68 revert at 00:00Z 2026-10-20 if it lands before the release build. Manual integrated full dev runs (diagnosis or baseline, not occasion runs): e06cee33, d0660b6b, cd21226d, e1986b51 (326b4251 and 87ff7258 never ran tests). Stage, epic, release, soak and hub dev-t3 occasion runs are not manual covers. C6 counts the enforce mechanism, proven by its tests. Switching the manifest from report to enforce is a separate v0.1.4 task before the release (D63), and C6's verdict names it. C1, C2, C3, C5 and C7 already carry D66.

### coord · 2026-10-20T02:57:23.313Z

D73 (stand-in under D24, ask 8fe184d2, 2026-10-20 02:56Z): duration budgets enforced from T-915's landing (2026-10-20 ~00:41Z) until T-930 returns them to report mode for the v0.1.4 release. In that window stage covers #3 and #4 went red only on budget lines (zero test failures) from load variance. C6 still counts the mechanism (D71): it was live and refused real over-budget tests (T-670's T3 growth at 00:42Z). Re-enabling enforcement with variance-based headroom is T-931 under E-880.

### hub · 2026-10-20T03:56:19.028Z

demo 54b73c7d-5c08-45f9-844c-c6de89e72941 created: droplet cland-v0-54b73c7d, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T05:10:19.880Z.

### hub · 2026-10-20T03:58:04.029Z

demo 54b73c7d-5c08-45f9-844c-c6de89e72941 destroyed: lifetime 150500 ms; cost $0.0105.

### qa-676 · 2026-10-20T04:02:03.126Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-1
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"low","text":"G3/R5: measurements were retained in A-6104/A-6105/A-6112 and child closures but absent from the epic at START; this verdict supplies them. Placement is nonblocking under the brief."},{"severity":"low","text":"R4 script filters suite-result at S commit time and misses the October20 soak queued before S but completed afterward. A-7019 supplementation explicitly authorized by requester f7a145cf preserves the raw output and accounts for both due nights. Follow-ups XS: filter due/queued slots, then attach later results.","file":"qa/briefs/E-678.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Check | Surface / executor | Result and evidence |
| --- | --- | --- |
| G0 | local metadata | PASS: clean detached requested SHA, ancestor of dev, committed brief, Node24.21.0, QA identity |
| G1 | local records | PASS: open epic R-577, C1–C8 match, 16 closed children and 16 ancestor merges |
| G2 | hub API | PASS: QA hold acquired |
| G3 | records | PASS: D71/D73 comments; E-880 under Ideas C-327, needs-triage; T-824/T-812/T-713/T-715 closed; restart boundary verified |
| D0/D1 | Linux droplet | PASS: one active lease at S, clean tree, Node24.21.0, Linux x86_64 |
| D2a–c | Linux droplet | PASS: runner-budget 3, suite-duration-budget 9, merge-budget 4 tests; enforce/allowance proofs |
| D3a–b | Linux droplet | PASS: durations 17, merge-queue 12; T3 ratchet and dropped-entry proofs |
| D4a–d | Linux droplet | PASS: batches35, queue-unit6, dev-t3-search4, component3 |
| D5a–b | Linux droplet | PASS: soak5, soak-component9 |
| D6a–d | Linux droplet | PASS: commands14, named Python fixture1, named other-stack occasion1, suite-command1 |
| D14 | hub API | PASS: freshness.current true; final recheck also true |
| D15 | hub API | PASS: lease released; hub destruction comment confirmed |
| L1 | local macOS reads | PASS under D71/D73: report mode at S, 329 allowances; latest task log2/report-only lines, integrated log16; T-915 and T-930 closed |
| R1 | records | PASS: 20 log hashes match; 20 journal heads match; median775.045s, 18 green/2 red |
| R2 | records | PASS: frozen counts reproduced; full S-window metrics retained separately |
| R3 | records | PASS under D71 and requester clarification: 187 commits classified, six decision-bound exceptions; covers classified |
| R4 | records | PASS under D66: both due nights accounted, costs/results/maps recorded; second result-time cutoff supplemented |
| R5 | records | PASS: A-6104/A-6105/A-6112 retained; T-812/T-824 closed with D65 measurement criteria checked |

Findings: none high or medium; two low.

1. **Low — G3/R5, E-678 record.** `task view E-678 --json` at START contains D71/D73 dispositions but no measurement table. Measurements remain in A-6104/A-6105/A-6112 and the child closure records. This report now supplies them; no criterion fails for placement under the brief.
2. **Low — R4, qa/briefs/E-678.md.** `R4-soak.cjs` filters suite-result timestamps at S's commit time and reports October20 as missing, although its 03:00 soak was queued before S and completed afterward. Original output is retained, supplemented by A-7019 and the journal receipt under Coordinator decision f7a145cf-73c2-42d4-81e9-f48957b0e1d4 (03:59Z). Follow-ups XS: select due/queued slots before attaching their later results.

Run **qa-2026-10-20-1**, build **824105c5a2a56b3495e9215cc88d60c4c129df6c**, brief v2 from5a9c868b. Result **clear**. Verify **C1,C2,C3,C4,C5,C6,C7,C8**; none failed/deferred. There are29 recorded checks and124 passed tests across15 sequential invocations, no skips/retries. No local test file, verify submission, scratch hub, product edit or second lease. Initial G1 wrapper lacked exported shell helpers; its read calls did not execute, then sourcing the same block supplied the helpers. Initial metadata gates preceded the Agents notification; all subsequent local work was announced before/after. See setup-note.txt.

Measurements and decisions:

| Criterion | Original target | Frozen record reproduced | At S / disposition |
| --- | --- | --- | --- |
| C1 | task-body median ≤480s | 775.045s (12.92min), first20 runs,18exit0/2exit1 | Same fixed cohort; all SHA256s and journal heads match. D66 accepts measurement; improvement E-880 |
| C2 | ≤1.6 runs/merge | (47 task +26 batch +9 rerun)/40 =2.05 | (198+87+13)/129 =2.31; D66 |
| C3 | red≤10%, flake≤5% | last50:5red=10%; lenient3flakes=6%, strict same-head-later-green1=2% | last50:9red=18%; strict same-head-later-green2=4%. All198 task runs:30red=15.15%. No new lenient flake attribution asserted; frozen A-6112 classifications retained. D66 |
| C5 | batch median≤15min; merge cost≤$0.08 | 1158.8s/19.3min over25; supplied membership replay$0.042 (A-6112 rounded attribution$0.043) | 40.1s/0.7min over85 measured batch runs; median$0.009/merge over129. D67 changed batches to T1-only; D66 accepts measured values |
| C7 | soak≤$0.25, daily cap and map recorded | Oct19 timeout,$0.3182436111,no map | Oct20 exit1,$0.1189509028,no map; both due nights ran. D66 |

Frozen R2 window: 2026-10-19 04:23Z–14:45Z:91 suite-results,40 merges,56 task runs(5red),26 batches(5red),9 reruns,0other. Frozen flake table from A-6112: T-843 same-head green, T-665 twice known T-848 flake, T-837 real defect, T-666 treated real. These classes were cited, not re-diagnosed.

S-window ends at **2026-10-20T03:11:04.000Z**:316 results,129 merges,198 task runs(30red),87 batches(12red),13 reruns,18other. Recorded cost totals task$8.69,batch$3.60,rerun$0.09. Full run lists and original outputs are in R1-median.txt, R1-head-check.json, R2-frozen.txt, R2-at-S.txt and R2-original-A6112.md. The last50 strict reading is2/50 from b572f618 and a5360642; other late reds are not silently reclassified as flakes.

C4 landing audit:187 first-parent commits =43 tracker-only +14 docs-only +118 green-batch +6 rerun-resolved +6 decision-bound direct exceptions. Exceptions:9e79d7e4 D64(batch4),1d81bd6e D68(cap$20),595c7f01 baseline refresh,e56825e8 D69(batchwait2m),e6aedd67 D70(crew pool3 plus spec),65248766 D68revert(cap$14). The first four and revert are authorized by D71; e6aedd67 explicitly classified by requester decision f7a145cf. It is not described as docs-only.

Later direct tracker/docs/spec commits after the brief snapshot b62bf16c: b2e9ecb3,15f9c308,5a9c868b,e80e101e,11f9d8da,0645fd39,89d92c38,2d2eb91f,32ae5bdc,04b9a50a,49bfbc04,824105c5. Full SHAs, subjects and changed paths (plus e6aedd67/65248766 exceptions) are in R3-later-direct-commits.txt.

Cover classification is requester evidence, not inferred intent. R3 lists20 cover results, including results completed after S for earlier/same candidate trees. Stage#1 ad5da9f3/781169bb;#2 d07e4c8a/fb05a8ef;#3 3d721aab/fb3edd9f;#4 cb859d86/76e50eb2 plus cancelled46775cbd;#5 51b982ae/40c55103. Hub rows165afbf2,6cdaddb7,e8f0c390,66e60918,2abbfebf are non-manual periodic/soak runs. D71 permits manual diagnostics e06cee33,d0660b6b,cd21226d,e1986b51; the audit includes the first three, while e1986b51 is named by the disposition. D71 says326b4251 and87ff7258 never ran tests;326b4251 appears as a red cover receipt. No unclassified cover remains under the recorded ruling. See R3-audit.txt and R3-R4-ruling.txt.

C6 is **mechanism proven, report mode at S**. D2/D3 exercise real enforce-mode budget failures and allowance behavior in tests. D71 accepts that mechanism. D73 records enforcement live from T-915 until T-930, including a real T-670 T3-growth refusal at00:42Z; that historical refusal is requester/epic-comment evidence, not independently reproduced in this run. Both tasks are closed; restoring enforcement with headroom is T-931/E-880. Latest task logA-7013 has2 report-only lines; A-7022 has16. No live enforcement is claimed at S.

C7 due-night ledger:

| Due / queued UTC | Run / head | Machine / lifetime | Cost | Outcome / coverage |
| --- | --- | --- | --- | --- |
| Oct19 03:00 /03:00:02.899 | 866cf201-a3a7-47fd-bf3e-89376fba41fe /414da0d3 | cland-v0-8ebbd674,c-8 lon1 /4582708ms | $0.3182436111111111 (above$0.25) | timeout124 at75min; map absent |
| Oct20 03:00 /03:00:01.991 | 66e60918-f3e8-4c86-ae51-17e3987cc1e9 /04b9a50a | cland-v0-04e7e009,c-8 lon1 /1712893ms | $0.11895090277777778 (below$0.25) | exit1, budget lines,0test failures; map absent |

Second result arrived03:29:05.994Z, after S's03:11:04 commit; A-7019 supplements raw R4 output with explicit requester authorization. No due night was skipped. The first soak's retained log body4498.55s and second log are evidence, not green receipts. Daily suite-result cost lower bounds from raw window: Oct18$0.82 vs$30 D58; Oct19$13.99 vs$20 D68; Oct20$0.53 vs$14 at S (excludes the second soak's later result). Those sums exclude demo/stage or in-flight lease costs and do not independently prove the complete daily ledger. D66 accepts the measured outcomes and missing maps.

C8 uses the brief's **stubbed non-Node Python fixture**, not a live second project: configured task/unit and batch/integration plans passed, plus the named integrated occasion. C4's mechanism is D4; C4 intent rests on the Coordinator classifications. Criteria mapping: C1 R1/R5/G3; C2,C3,C5 R2/G3; C4 R3/D4/G3; C6 D2/D3/L1; C7 R4/R5/D5/G3; C8 D6.

Resource and supporting evidence:

One Linux x86_64 demo lease **54b73c7d-5c08-45f9-844c-c6de89e72941**, machine **cland-v0-54b73c7d**. Created03:55:21.523Z, deadline05:10:19.880Z. Hub confirmed destruction: **150500ms, $0.010451388888888889** total demo cost. Tests ran sequentially; no sharded demo. Local read-only checks incur no droplet cost. D15 comments and final-freshness.json confirm released/current.

Coordinator stage receipts at S, read without submitting another run: A-7022 Linux run51b982ae,3159pass/0fail/8skips across two shards (cland-v0-1d139ca1:1222.07s,$0.0843; cland-v0-23418384:1592.07s,$0.1100; combined$0.1944,wall1615.43s); A-7026 macOS run40c55103,3167pass/0fail/0skip. They include T1–T4 and are classified stage occasions. Extracts retained as INT_LOG_LINUX.txt and INT_LOG_MAC.txt. Report-only budget warnings are not test failures under D73.

Build tree remains clean, freshness current. QA worktree removal follows accepted verdict; Coordinator owns epic closure.

Evidence finalized 2026-10-20T04:01:32.889260+00:00.

Final report A-7035: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7035-e-678-qa-clear-c1-c8-with-d66-d71-d73-dispositions.md
Complete evidence A-7034: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7034-e-678-qa-complete-evidence-at-824105c5-qa-2026-10-20-1

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-20T04:02:44.339Z

Closed on qa-676's clear at the release candidate 824105c5 (run qa-2026-10-20-1, A-7035 / A-7034): C1–C8 verified under D66, D71, D73 and the R3 classifications.
