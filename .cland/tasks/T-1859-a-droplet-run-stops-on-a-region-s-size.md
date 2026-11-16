---
id: T-1859
kind: task
title: A droplet run stops on a region's 'size not available' instead of trying the next region
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1549
branch: t/T-1859-a-droplet-run-stops-on-a-region-s-size
created: 2026-11-14T18:24:03.472Z
updated: 2026-11-16T11:32:18.562Z
---

## Summary

A droplet run whose create call returns DigitalOcean `422 unprocessable_entity: Size is not available in this region` ends the whole run instead of trying the next configured region. T-1831's mode-free verify 3c705d47 (2026-11-14 ~18:22Z, log A-19419) stopped this way in ams3 with c-8, after a passing T0. Earlier today, regions whose size is missing from the catalog (fra1 for c-8) were skipped correctly, but a capacity refusal at create time is not handled.

## What to build

The droplet executor treats a create-time "size not available in this region" (422) as region-local. It records the refusal in the run log and tries the next region in `[verification.droplet] regions`. Only when every region refuses does the run end, with one reason naming each region and its refusal. No machine is left behind, and spend reservation and release stay exact.

## Acceptance criteria

- [ ] C1. With the fake DigitalOcean API returning that 422 for the first region and success for the second, a run is created in the second region and its log names the first refusal (test).
  - failed: rev-35 [reviewer] · 2026-11-16T11:32:18.561Z · note New criterion fixture lacks failure-path ownership/join before API/root disposal.
- [ ] C2. When every configured region refuses, the run ends with one reason listing each region's refusal, leaves no machine, and releases its spend reservation (test).
  - failed: rev-35 [reviewer] · 2026-11-16T11:32:18.561Z · note Capacity exhaustion can be classified without complete positive refusals; new fixture also lacks safe failure-path ownership.

## Comments

### impl-1859 · 2026-11-16T11:24:12.702Z

Seam fixed by brief C1/C2: DropletExecutor.acquire through scripted DigitalOceanApi, scripted host/machine and scratch filesystem, observing returned lease, run log, durable released lease and spend ledger. Consumer sweep: acquire callers suites.ts (normal/shards), droplet.ts (prepare/host prepare), executor interface and direct executor tests; ProviderCapacityUnavailable consumers suites.ts (submission/dry run/provider-capacity outcome) plus suite-cover/close/soak tests. Search covered hub/src,test, nvim,web,qa,.agents,docs by acquire, ProviderCapacityUnavailable and refusal text. Existing run log readers treat lines as opaque text (CLI suite log/heartbeat, Neovim/web and QA); append regional refusal lines without altering existing lines or wire fields. Existing catalog capacity text unchanged; aggregated exhaustion remains ProviderCapacityUnavailable. No client migration required.

### rev-35 · 2026-11-16T11:32:18.562Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1859-source-1
commit: 41ed21c967a7da9f60decde765388992d6349e65
scope: full
findings: [{"severity":"medium","text":"New regional fixture closes executor/API and removes root without owning/joining the whole setup/acquire/release continuation; registration follows root/fake acquisition. executor.close does not join this direct body. Rule12: own before acquisition, fence new steps and join admitted work before disposal; retain root on incomplete join and add a held-work failure regression. Claimant confirms no earlier owner.","file":"hub/test/executor-admission.test.ts","line":24},{"severity":"medium","text":"!droplet conflates exhausted exact refusals with a successful malformed reply whose response.droplet is absent; api.create has no runtime validation. Only positively refused candidates establish ProviderCapacityUnavailable. Preserve malformed success as non-capacity/ambiguous, do not create again, and add a scripted control. Claimant confirms no earlier validation owner.","file":"hub/src/executor/droplet/droplet.ts","line":258},{"severity":"low","text":"Touched guide/test header say T2 while pinned tiers.json declares T1. Scripted FakeClock/in-process execution needs no tier widening; correct source guidance and evidence classification to normalized T1.","file":"docs/agents/tests/hub-test-executor-admission.test.ts.md","line":3}]
finding_counts: {"high":0,"medium":2,"low":1}

Completed full read-only Standards/Spec audit A-19993: Standards one medium/one low, Spec one medium. Ordinary exact-refusal fallback/accounting paths otherwise match source scope. A-19990 retains original producer excerpts, normalized tier/consumer inventory and capture limits; local seven-case green is precommit T1 evidence, not full verify. No tests/compiler/native work by Reviewer. Hold released for consolidated correction; fresh source review required before configured verification. Keep rule11 head discipline.

Criteria: C1 failed (New criterion fixture lacks failure-path ownership/join before API/root disposal.), C2 failed (Capacity exhaustion can be classified without complete positive refusals; new fixture also lacks safe failure-path ownership.).
