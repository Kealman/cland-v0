---
id: T-1859
kind: task
title: A droplet run stops on a region's 'size not available' instead of trying the next region
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1549
branch: t/T-1859-a-droplet-run-stops-on-a-region-s-size
created: 2026-11-14T18:24:03.472Z
updated: 2026-11-16T14:02:42.477Z
closed: 2026-11-16T14:02:42.477Z
---

## Summary

A droplet run whose create call returns DigitalOcean `422 unprocessable_entity: Size is not available in this region` ends the whole run instead of trying the next configured region. T-1831's mode-free verify 3c705d47 (2026-11-14 ~18:22Z, log A-19419) stopped this way in ams3 with c-8, after a passing T0. Earlier today, regions whose size is missing from the catalog (fra1 for c-8) were skipped correctly, but a capacity refusal at create time is not handled.

## What to build

The droplet executor treats a create-time "size not available in this region" (422) as region-local. It records the refusal in the run log and tries the next region in `[verification.droplet] regions`. Only when every region refuses does the run end, with one reason naming each region and its refusal. No machine is left behind, and spend reservation and release stay exact.

## Acceptance criteria

- [x] C1. With the fake DigitalOcean API returning that 422 for the first region and success for the second, a run is created in the second region and its log names the first refusal (test).
  - done: impl-1859 · 2026-11-16T11:39:51.584Z
  - verified: rev-35 [reviewer] · run rev-35-1859-final-1 · 2026-11-16T12:09:01.600Z · commit 7f7f67698e8b33159e16946af430ddf06e430fe9
- [x] C2. When every configured region refuses, the run ends with one reason listing each region's refusal, leaves no machine, and releases its spend reservation (test).
  - done: impl-1859 · 2026-11-16T11:39:51.786Z
  - verified: rev-35 [reviewer] · run rev-35-1859-final-1 · 2026-11-16T12:09:01.600Z · commit 7f7f67698e8b33159e16946af430ddf06e430fe9

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

### rev-35 · 2026-11-16T11:39:44.027Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1859-source-2
commit: 7f7f67698e8b33159e16946af430ddf06e430fe9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review A-20002: Standards0/Spec0. Shared fixtureWork owns pre-acquisition setup/body and attempt-all disposal; late acquisitions captured, steps fenced, incomplete cleanup retains root. Held-work test has outer release/join finally and preserves final write/fence/removal assertions. Malformed success escapes as non-capacity/ambiguous without another create; exact positive refusal count alone establishes exhaustion. Guide/header now T1. A-19998 exact-head nine-case local T1/typecheck/lint receipts retained with report-only/platform/capture limits; A-19990 consumer limits carry. C1/C2 source findings resolved but no criterion verified before same-head configured result. Tracker still has prior failed marks despite request saying done; Implementer should restore its own done marks. Hold released, mode-free verify permitted at this exact head; no dev merge absent rule11 authorization.

### impl-1859 · 2026-11-16T12:07:43.275Z

Mode-free verify e8a1b0e3-459d-4f82-8e20-1a3bbe78a18d at exact reviewed head7f7f67698e8b33159e16946af430ddf06e430fe9 completed exit0:6405/6405 pass, no fail/cancel/skip. T0/T1/T2/Web completed; T3 deferred to merge batch, T4 unexecuted. Executor Linux x64 droplet c-8 sfo2, kernel6.8.0-147-generic, Node24.21, Neovim0.12.5, lifetime1252s estimated$0.0869. Log A-20024 contains explicit pass finish/timing receipts for held-work, fallback, exhaustion, neighbouring400/422/500 and malformed-success generated identities (executor-admission T1), apart from aggregate exit. Web preparation records Chrome Headless Shell156.0.8078.4 playwright v1248. Timing budgets/lint notices report-only, not enforced pass claims. Source clean/unchanged. Awaiting Reviewer final evidence settlement; qaPolicy none/after-stage.

### rev-35 · 2026-11-16T12:09:01.600Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1859-final-1
commit: 7f7f67698e8b33159e16946af430ddf06e430fe9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-20026; independent named/consumer reconciliation A-20025. C1 fallback and C2 exhaustion ordinary passes at A-20024:1521/1526, all nine file cases positive; seven new identities each also have five positive load case/file finishes. Held ownership, malformed non-capacity/reservation fence and neighbouring 400/422/500 controls retained. Parsed6405 ordinary tests/702 files plus separate245 load tests/files positive, no negatives;221T1/426T2/55Web executed,268T3/17T4 deferred. All78 original inventory heading entries/74 unique paths retained in1019-row conservative union, not complete runtime/transitive coverage. Clean exact head/provenance and actual browser confirmed. Report-only/capture/synthetic-provider limits remain; no Reviewer runtime. Hold released; Coordinator retains landing and integrated-stage gates.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T14:02:42.477Z

Merged a7880ac415409400e3cb53a6c0230b4be27b8f52 onto dev.
