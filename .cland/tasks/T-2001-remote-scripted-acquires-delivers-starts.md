---
id: T-2001
kind: task
title: remote-scripted 'acquires, delivers, starts, collects' intermittently times out waiting 15 s for a frame in loaded T2 batches
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1721
branch: t/T-2001-remote-scripted-acquires-delivers-starts
created: 2026-11-19T09:55:31.440Z
updated: 2026-11-24T09:51:46.016Z
---

## Summary

`remote-scripted` case "scripted remote verification acquires, delivers, starts, collects and releases on the hub clock" failed once in a local multi-file T2 batch (impl-1729, T-1729, 2026-11-19, macOS, Node 24.21, load about 6.2) with `Error: no frame matched within 15000ms`. The last observed run state was `launching`, the remote queue holder pid was null, and the fake timestamp was 2026-10-16T12:00Z. Run alone, it passed 5/5 at dev 8431152db and 5/5 with T-1729's change, so it's an intermittent wait race in the test, not attributable to T-1729.

## What to build

Find the event the case waits for and replace the 15 s frame poll with a wait on the producer's receipt (rule 9), so a slow batch run can't miss or outlast the frame. Keep the assertion's meaning.

## Acceptance criteria

- [ ] C1. The case waits on a positive receipt for the frame it needs instead of a time-bound poll, and passes 20/20 in a loaded multi-file T2 batch (test, evidence).
- [x] C2. The literal failure above is reproduced or explained with evidence before the change (evidence).
  - done: impl-2001 · 2026-11-24T09:17:09.539Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-2001-source · 2026-11-24T09:18:43.467Z · commit 5899d2acb0a8d722b10b380a944ff0e4f59c2d2d

## Comments

### impl-2001 · 2026-11-24T09:07:57.460Z

Cause verified at dev 5c9533cc9: matching suite message wait explicitly passed 15000, bypassing UiClient shared per-operation waitTimeoutMs(testWaitMs(5000)). Red fixture control failed actual 15000 vs expected undefined before change; after removing override, all 10 remote-scripted T2 cases pass locally (macOS, Node 24.21.0, load 3.11). Historical loaded timeout is explained, not reproduced. Full lint in progress; native slot granted but stress batch is held until ambient load falls below 12 per Coordinator.

### impl-2001 · 2026-11-24T09:17:24.763Z

Source review requested at 5899d2acb0a8d722b10b380a944ff0e4f59c2d2d per Coordinator decision 665398db. Evidence A-22781. Correction to earlier comment: actual prepared baseline was 8d39689202c91579a8413559bd8ff048a2226c17; 5c9533cc9 was prior launch triage only. C2 done; C1 loaded proof pending renewed native slot after restart onto T-2069. Batch stopped by Coordinator after 8 completed rounds, none count as criterion evidence; native slot released, parent and descendants gone, scratch root removed. Focused T2 10/10, supporting T1 until 17/17, full test:lint and full typecheck exit 0 (macOS local Node24.21.0; no browser). No configured verify submitted.

### rev-40 · 2026-11-24T09:18:43.467Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2001-source
commit: 5899d2acb0a8d722b10b380a944ff0e4f59c2d2d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Exact suite:<submitted-id> message wait remains buffered/event-driven and bounded; removing explicit15000 uses shared per-operation waitTimeoutMs(testWaitMs(5000)). Scope-owned control rejects override and retains real waiter. Durable start receipt before fake-clock advance and final report/log/order/lease/resource assertions unchanged; existing scripted/native guard ownership preserved. C2 verified as explained fixed-budget bypass from old source/helper/control, per Coordinator acceptance; historical loaded timeout not reproduced or deeper latency cause inferred. A-22781 focused local10T2/17supportingT1/static passes are reported dirty-baseline narrative evidence, not exact-head configured proof. C1 remains pending20/20 loaded multi-file campaign. Coordinator-stopped8rounds expressly excluded from criterion proof; no run/load permission granted here. No reviewer runs or edits.

Criteria: C2 verified.

### rev-40 · 2026-11-24T09:51:46.016Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2001-configured
commit: 5899d2acb0a8d722b10b380a944ff0e4f59c2d2d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured receipt step clear, not finalC1. Run5415fe04/A-22801 exact reviewed head/canonicaltreececf10f1 finished/passed. All10remote-scripted base identities pass; exact orchestration29249 outcome pass0.310435826s. T0/T1/fallbackT2/selectedT3/Web exit0;7selectedT3/T4files100passing identities once/no repetitions, restT3batch/T4unexecuted. Noncached Linuxx64/c-8nyc1/Node24.21.0/Nvim0.12.5/workers2, HeadlessShell1248/CfT156.0.8078.4; advisory reports and Mac-only skip retained. C1 still unchecked/unverified: requires separate authorized20/20loadedmulti-fileT2 campaign. C2 source verification retained; Coordinator-stopped8rounds excluded. No final readiness claim and no new reviewer run/edit.
