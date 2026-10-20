---
id: E-482
kind: epic
title: "Flake sweep: the load-sensitive tests found in v0.1.2"
state: closed
criterion_seq: 2
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: topic-661
branch: null
created: 2026-10-15T09:14:14.206Z
updated: 2026-10-20T07:02:02.444Z
closed: 2026-10-20T07:02:02.444Z
---

## Goal

The load-sensitive tests found during the v0.1.2 run and the start of v0.1.3 are fixed in one place, so that task gates and integrated covers stop going red on known flakes. Each one is made to wait on the state it asserts, never on wall time, and keeps its meaning. This is the retrospective's STOP 4 (A-2783), applied to the backlog the run produced.

## Contents

T-442 (sessions midnight reset), T-445 (suite cleanup observer), T-446 (artifact-browser socket), T-449 (session-stop-races probe.json), T-453 (executor-run lock.break scan), T-463 (session-usage restart publications), T-465 (codex-adapter rateLimitsAt), T-467 (codex-adapter steer recovery) and T-481 (executor-prepare release record).

## Definition of done

Each ticket's Implementer produces its own evidence before merge. It runs the fixed file 5 times serially beside any non-coord local full run, labelled loaded or quiet, and its post-review `cland verify` is the droplet run. At the epic's close, QA re-checks every fixed file once beside a full run and once on a droplet, and its verdict closes the epic. (Coordinator clarification, 2026-10-15 09:57Z.)

- [ ] C1. Every child's file passes 5/5 beside a local full run and once on a Linux droplet.
  - verified: qa-2 [qa] · run qa-2026-10-20-qa2-4 · 2026-10-20T07:01:12.000Z · commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b
- [ ] C2. No child weakens an assertion or widens a time bound without a recorded reason.
  - verified: qa-2 [qa] · run qa-2026-10-20-qa2-4 · 2026-10-20T07:01:12.000Z · commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-481
        - T-453
        - T-465
        - T-467
        - T-485
      - - T-445
        - T-449
        - T-463
      - - T-446
        - T-442
      - - T-484
  - name: the sweep, part 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-494
      - - T-501
      - - T-509
      - - T-524
      - - T-526
      - - T-763
      - - T-758
      - - T-762
      - - T-765
      - - T-739
      - - T-769
      - - T-759
      - - T-767
      - - T-770
      - - T-771
      - - T-761
      - - T-777
      - - T-528
      - - T-555
      - - T-558
      - - T-560
      - - T-581
      - - T-657
      - - T-658
      - - T-569
      - - T-585
      - - T-674
      - - T-675
      - - T-723
      - - T-724
      - - T-818
      - - T-848
      - - T-849
      - - T-870
      - - T-871
  - name: demo fixes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-935
```

## Comments

### coord · 2026-10-15T11:05:29.087Z

Gate rule while E-482 is open, a human decision on 2026-10-15 at 11:04Z (ask 9183a54c, answer fb9f8d2a). It replaces the local fallback.

When a droplet verify is red only on known flakes and the task's own files are green, the next step is one more droplet verify at the same head. A head that moved only by shared-fix picks counts as the same. If that run is red only on known flakes, on a different failing test, the two Linux receipts plus the Reviewer's final clear are the merge gate. The same test red twice gets reported. The local slot is reserved for the Coordinator's integrated runs.

### coord · 2026-10-15T12:32:49.963Z

Evidence rule from 2026-10-15 at 12:32Z. Each ticket needs five serial whole-file passes on the Mac, quiet or loaded and labelled, plus the task's droplet verify, which runs the file under 4-worker Linux load. The beside-a-local-full-run requirement is dropped, because after the 12:04Z load spike only one test file runs on the Mac at a time.

### coord · 2026-10-15T13:09:26.232Z

Watch item: subscriptions.test.ts:453/:472 got an extra 'impl idle' event beside 'impl launched' (T-395, A-3003, on a branch without T-486). It's classified as T-486's Codex launch-order race. If it recurs on a head that carries 4db6ed9c, file it as a new ticket, because T-486's fix may then legitimately emit the idle that the test doesn't expect.

### coord · 2026-10-15T15:03:54.833Z

Gate clarification (2026-10-15 15:04Z): the 'own files green' condition of the two-receipt rule applies to the test cases a task's diff changes. A red on another case in the same file counts as known if a ticket covers that case and the diff doesn't touch it (T-467: codex-adapter:561 is T-485's).

### coord · 2026-10-15T15:24:42.537Z

Same-head clarification (2026-10-15 15:24Z): a head that moved by a full origin/dev merge counts like shared picks for the two-receipt rule, provided the Reviewer confirms the task diff against dev is unchanged. This covers merges made before the 15:23Z "pick only" notice (T-497, T-498, T-507). From now on, pick only, and merge dev on conflict or on request.

### coord · 2026-10-20T03:43:11.097Z

Plan revision (Coordinator, 2026-10-20 03:47Z): removed T-654, T-655 and T-656 from stage 'the sweep, part 2'. They were flake-experiment tickets closed without a code change (A-4106, A-4156, A-4163; D51), so their missing landing kept the stage from closing although stage cover #5 at 824105c5 (Linux 51b982ae, macOS 40c55103) completed it. Their results stay recorded on the items. The stage is now closed.

### hub · 2026-10-20T03:54:34.366Z

demo a606ddb6-3708-4466-8d58-4dc64e5bcee8 created: droplet cland-v0-a606ddb6, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T05:08:33.053Z.

### qa-2 · 2026-10-20T05:10:53.327Z

verdict: qa
result: not clear
by: qa-2 [qa]
run: qa-2026-10-20-qa2-3
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"medium","text":"D4 round4: ENOTEMPTY removing fake-Claude directory after 5008.057615ms, followed by a process hang until the600s wrapper exited124. D5 passed five serial and one loaded rerun, insufficient for the required five loaded reruns. Child T-801; fix tracked in T-935. A-7054/A-7057 retain full failure log and open-handle evidence.","file":"hub/test/handover-process.test.ts","line":45}]
finding_counts: {"high":0,"medium":1,"low":0}

| Check | Surface / venue | Result | Evidence |
| --- | --- | --- | --- |
| G0 | hub-api / local | PASS | G0.txt |
| G1 | hub-api / local | PASS | G1.txt, G1-epic.json, G1-children.json |
| G2 | hub-api / local | PASS | G2-hold.json |
| F1 | hub-api / local | PASS | F1-summary.txt, F1-files.txt, F1-files.txt.map |
| D0 | hub-api / droplet | PASS | D0-start.json |
| D1 | hub-api / droplet | PASS | D1-build.txt |
| D2 | hub-api / droplet | PASS | D2-setup.txt, D2-process-clean.txt |
| R1 | hub-api / local | PASS | R1-evidence.txt, R1-judgement.md, R1-coordinator-rules.txt |
| R2 | hub-api / local | PASS | R2-scan.txt, R2-judgements.md |
| R3 | hub-api / local | PASS | R3-Linux-summary.txt, R3-macOS-summary.txt, R3-ran.txt |
| D3 | hub-api / droplet | PASS | D3-serial.txt, D14-after-D3.json |
| D4 | hub-api / droplet | INCONCLUSIVE | D4-load.txt, D4-time-limit.txt, D4-round4-handover-final.log, D4-handover-handles.txt, D14-after-load-4.json |
| D5 | hub-api / droplet | INCONCLUSIVE | D5-serial.txt, D5-load.txt, D5-serial-logs.tgz, D5-load-logs.tgz, D5-after-processes.txt |
| D14 | hub-api / droplet | PASS | D14-status.json, D14-dev.txt |
| D15 | hub-api / local | INCONCLUSIVE | D15-stop.json, D15-after.json, D15-item.json |

Medium — D4 / hub/test/handover-process.test.ts:45 (child T-801; follow-up T-935). During the fourth four-file Linux load round, `timeout 600 node --test hub/test/handover-process.test.ts` failed the revocation-mid-turn case after 5008.057615 ms with `ENOTEMPTY` removing `/tmp/fake-claude-KlavRs`. The process remained alive until 600 s and exited 124. Final reporter: 0 pass, 1 fail, 1 cancelled; interruption also reports a pending Promise after the event loop resolved. This is a cleanup failure and process-lifetime defect; the duration alone does not establish a failed 5 s revocation wait. Fixture events show successful handover, forbidden send and revocation injection before the coord harness exited. Original complete log and OS process/fd evidence are retained in A-7054 and this folder.

No high or low product findings. Measurement corrections are documented separately, not counted as findings.

Not clear: C1 INCONCLUSIVE, main load rounds 4/5; D5 serial 5/5 passes but only 1 loaded subject receipt(s), 1 complete companion round(s) of 5. C2 source audit PASS (103 landing commits, 11 candidates, all explained). C1 uses the explicitly authorized 12:32 substitution. No second lease; build `824105c5a2a56b3495e9215cc88d60c4c129df6c`; lease `a606ddb6-3708-4466-8d58-4dc64e5bcee8` cleanup releasing, estimated 4,506,436 ms/$0.31294694; stop receipt 05:06:37Z, pending under T-932 by Coordinator decision c38d861b. Same-S integrated Linux A-7022 and macOS A-7026 both green. Full case notes, C2 judgments, brief corrections, raw logs and process handles are in the final evidence artifacts.

Criteria marks: C1 failed for incomplete load/rerun proof and the observed T-801 cleanup/hang failure; C2 passed but unmarked on this not-clear verdict.

Evidence: A-7057 (complete folder), A-7058 (case table, C2 judgments and verdict), A-7054 (focused failure/handles). Cleanup confirmation pending under T-932 per Coordinator c38d861b; confirmed lifetime/cost will follow in topic-661.

Criteria: C1 failed (INCONCLUSIVE: only four of five main load rounds and one of five loaded reruns completed; T-801 handover-process failed ENOTEMPTY cleanup and hung until exit124.).

### hub · 2026-10-20T05:10:57.407Z

demo a606ddb6-3708-4466-8d58-4dc64e5bcee8 destroyed: lifetime 4368199 ms; cost $0.3033.

### hub · 2026-10-20T05:53:14.801Z

demo ef55ad44-fb42-491d-aae9-2c16cc9dc2f9 created: droplet cland-v0-ef55ad44, commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b, deadline 2026-10-20T07:07:13.395Z.

### hub · 2026-10-20T07:00:24.103Z

demo ef55ad44-fb42-491d-aae9-2c16cc9dc2f9 destroyed: lifetime 4077523 ms; cost $0.2832.

### qa-2 · 2026-10-20T07:01:12.000Z

verdict: qa
result: clear
by: qa-2 [qa]
run: qa-2026-10-20-qa2-4
commit: 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Venue / surface | Result | Evidence |
| --- | --- | --- | --- |
| G0 | local / hub-api | PASS | G0.txt |
| G1 | local / hub-api | PASS | G1.txt, G1-epic.json, G1-children.json |
| G2 | local / hub-api | PASS | G2-hold.json |
| F1 | local / hub-api | PASS | F1-summary.txt, F1-files.txt, F1-files.txt.map, T-935-files.txt, request-amendment.txt |
| D0 | droplet / hub-api | PASS | D0-start.json, D0-status.json |
| D1 | droplet / hub-api | PASS | D1-build.txt |
| D2 | droplet / hub-api | PASS | D2-setup.txt, D2-process-clean.txt |
| D3 | droplet / hub-api | PASS | D3-serial.txt, runtime-summary.json, D14-status.json |
| D4 | droplet / hub-api | PASS | D4-complete-observed.txt, lease1-archive-audit.json, archive-totals.json |
| D5 | droplet / hub-api | PASS | D5-no-reruns.txt, D5-after-processes.txt |
| R1 | local / hub-api | PASS | R1-evidence.txt, T-935.json, G1-children.json |
| R2 | local / hub-api | PASS | R2-scan.txt, R2-comparison.txt, R2-judgements.md, R2-T935.diff, T-935.json |
| R3 | local / hub-api | PASS | R3-Linux-summary.txt, R3-macOS-summary.txt, R3-coverage.txt, R3-ran.txt |
| D14 | droplet / hub-api | PASS | D14-final.json, D14-dev.txt, D14-worktree-status.txt |
| D15 | local / hub-api | PASS | D15-stop-time.txt, D15-stop.json, D15-after.json, D15-confirmation.txt |

No high, medium, or low findings in this pass.

Clear at `9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b`, run `qa-2026-10-20-qa2-4`. C1 and C2 verified in this run.

C1: 94 fixed files from 110 closed children, including T-935. Quiet serial 94/94; all five four-file loaded rounds 94/94. Peaks: serial 2.21; loaded 7.21, 7.07, 8.44, 7.78, 8.61. All 564 file runs exit 0; all 564 complete raw logs retained and audited. Each sweep has 795 passed tests, zero failures/cancellations, and five prerequisite skips. All five skipped Linux cases explicitly pass in the same-S2 Mac cover. Handover-process passes once serially and 5/5 under load, with normal exit; the prior cleanup/hang signature did not recur. D5 has no eligible file and required no rerun.

C2: fresh scan of 104 landing commits, 11 explained candidates. Immutable candidate patches match the previously read diffs; fresh live records were captured and the new T-935 test/shared-harness changes were read. No assertion or wait was weakened or widened without a recorded reason. Detailed judgments are in R2-judgements.md.

C1 uses the recorded 2026-10-15T12:32:49.963Z rule replacing the Mac beside-full-run requirement with four-file Linux load, alongside child Mac receipts and supplied same-S2 integrated covers. R1 retains the exact eight historical no-code exceptions, with all other 102 children verified and no ancestor/stale/failed gaps.

One Linux x86_64 c-8 / 8-CPU demo lease, Node 24.21.0 and pinned Neovim 0.12.5: `ef55ad44-fb42-491d-aae9-2c16cc9dc2f9`. Created 2026-10-20T05:52:14.938Z; deadline 2026-10-20T07:07:13.395Z. Confirmed destroyed at the hub comment 2026-10-20T07:00:24.103Z: lifetime 4,077,523 ms (67.959 min), cost $0.28316132. Total demo lease lifetime/cost are the same, because no second lease was needed. Final test-process probe is zero; build remains fresh and worktree clean.

Same-S2 stage covers reused, no duplicate suite submitted: Linux A-7105 (14b674ab), both shards T1–T4 exit 0, all 94 fixed files present; macOS A-7109 (bfb912c4), exit 0 with all five prerequisite-skipped Linux cases explicitly passing. Linux shard 1 cland-v0-57497c77: duration 1007.62 s, lifetime 998 s, $0.0693; shard 2 cland-v0-d762d069: duration 910.62 s, lifetime 910 s, $0.0632. Merged Linux cover wall 1027.56 s, total $0.1325. These are reused cover costs, separate from this demo; Mac cost not applicable. Report-only budget notices do not change the green outcomes.

Run-specific authorizations: Coordinator 578615b3 waived F1/R2's empty-slot gate for read-only scans; dfa76567 allowed a second sequential lease only if the D4 deadline guard required it (unused). Measurement corrections: exact exit-row parsing excludes the peak marker, and D2's inline process probe matched setup text; its standalone repeat was zero before any test started. No local tests, stress, suite submissions, provider controls, product edits, or additional worktrees.

Criteria marks: C1 verified; C2 verified.

Evidence: A-7175 (complete folder, all 564 raw logs and audits); A-7176 (final case table and C2 judgments).

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T07:02:02.444Z

Closed on qa-2's clear at release candidate 2, 9b2cb194 (fresh run qa-2026-10-20-qa2-4, A-7176 / A-7175): C1 and C2 verified. 94/94 serial and five loaded rounds 94/94 each (564 file runs); handover-process passed 6/6 after T-935.
