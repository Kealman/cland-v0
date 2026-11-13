---
id: T-1842
kind: task
title: A droplet run's tree.bundle upload has one 120 s scp attempt and no retry; three batches failed delivery in 90 minutes
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1499
branch: t/T-1842-a-droplet-run-s-tree-bundle-upload-has
created: 2026-11-13T01:14:02.538Z
updated: 2026-11-13T21:45:36.716Z
---

## Summary

A droplet run uploads its ~9 MB `tree.bundle` with one `scp` bounded at 120 s and no retry (`hub/src/executor/droplet/machine.ts` `put`, called from `run.ts`). On 2026-11-12/13 between 23:45Z and 01:13Z, three of T-1827's merge-batch runs (9039a267, 2ab88dd9, f46d3f42; logs A-19155, A-19166, A-19168) failed with "delivery upload tree.bundle: machine copy failed or exceeded its time bound" before any test ran, each held as inconclusive, while bundles of the same size uploaded fine at other times that night (75ffeefb, 1cd8d664). A lost periodic run (b33e7940, T-204) fell in the same window. One slow or dropped upload therefore costs a droplet lifetime and a whole batch slot.

## What to build

The upload of a run's delivery files tolerates a transient slow or failed copy: a bounded retry of the failed file (and a time bound that scales with the file's size, or a measured minimum transfer rate), with each attempt's elapsed time and outcome recorded in the run log, and a clear terminal reason when every attempt fails.

## Acceptance criteria

- [x] C1. A fake transport that fails or stalls the first `tree.bundle` copy and succeeds on the next lets the run continue, and the log records both attempts with their elapsed times (test).
  - done: impl-1842 · 2026-11-13T21:05:58.671Z
  - verified: rev-35 [reviewer] · run rev-35-1842-final-1 · 2026-11-13T21:45:36.582Z · commit 0b506cd2e696bdc5e057bb6b7c4b312b08ee9f14
- [x] C2. When every attempt fails, the run ends with one delivery reason naming the file, the attempts and their elapsed times, and the batch holds as inconclusive as today (test).
  - done: impl-1842 · 2026-11-13T21:23:14.646Z
  - verified: rev-35 [reviewer] · run rev-35-1842-final-1 · 2026-11-13T21:45:36.582Z · commit 0b506cd2e696bdc5e057bb6b7c4b312b08ee9f14

## Comments

### coord · 2026-11-13T03:03:48.100Z

More evidence (2026-11-13 03:03Z): the nightly soak 65f717b4 at 4d1adb6a7 failed at "delivery directory readiness: machine command failed or exceeded its time bound (signal SIGTERM)" after 118 s (A-19171). So it's not only the bundle scp: plain ssh commands to fresh lon1 droplets are timing out too. A fourth T-1827 batch failed the same night (ce628134, A-19170). The path from this Mac to DigitalOcean lon1 looks degraded, and the retry or bounded-rate handling in this item should cover delivery ssh steps as well as scp.

### coord · 2026-11-13T11:50:57.605Z

Root cause (2026-11-13): the network path from this Mac itself was degraded. At 09:47Z the coord session's own Anthropic API calls began failing with a Cloudflare 403 ("Attention Required"), and the human restarted the Mac's network; by 11:49Z api.anthropic.com and api.digitalocean.com answered in 50 ms and 17 ms. DigitalOcean had no incident. The 09:47Z attempt after the fra1 region change still ran on "c-8 lon1" (A-19177), so that change hadn't applied to the batch yet, and region wasn't the cause anyway. This item stands: one slow or dropped copy should get a bounded retry with recorded attempts, not cost a whole droplet run.

### coord · 2026-11-13T20:41:34.370Z

Moved into R-1530 by ask 803125ab, answered 2026-11-13 20:41Z (option 1) under the human's standing yes of 2026-10-28. Droplet tree.bundle uploads failed all day (A-19155, A-19166, A-19168, A-19198, A-19203, A-19206): this lands first through a local batch, then the hub restarts, then the E-1537 stage-2 Linux cover runs on a droplet.

### impl-1842 · 2026-11-13T20:43:47.597Z

Consumer inventory before changing delivery policy: DropletRun and DropletExecutor.deliver; hub/suites.ts catches delivery and preserves infrastructure notRun plus remoteLogStart; hub/merge-batches.ts diagnosticResult holds missing test receipts inconclusive; hub/dev-t3-result.ts and suite-isolation.ts retain infrastructure outcomes; demos.ts uses deliver too. machine.put is also used by snapshot prepare and coverage get remains unchanged. Tests: executor-prepare-component (transport error regex and snapshot fallback), executor-prepare T3 (delivery.log exact prepare output), verification-workers, executor-run, remote-scripted, executor-droplet, scenarios/droplet-verify, suite-soak/component, suite-cover, merge-batches. Log/heartbeat consumers show raw strings, not attempt parsers; run.sh reads delivery.log as prepare output. docs/hub/running.md and QA brief templates/shipped stage briefs describe delivery.log; keep its prepare-only contents unchanged and add attempts to run.log. No wire/schema fields change; older client shape remains unchanged. Planned upload bound: two attempts per file; max(120s,30s + size/32KiB per second), capped by one 10-minute delivery budget and lease deadline. Idempotent mkdir retains 30-second retry budget, with each attempt logged. Fetch/prepare never blindly replay shell commands.

### rev-35 · 2026-11-13T21:13:36.554Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1842-source-1
commit: 2c7326675e431272aa00ff71823eaa35c117fd4f
scope: full
findings: [{"severity":"medium","text":"A restored delivered lease skips the new post-delivery offset assignment and retains an older pre-delivery remoteLogStart via ??=. A crash after delivery diagnostics and durable delivered:true but before offset persistence makes #collectLog count local diagnostics as remote bytes and skip the stream prefix. Persist/reconcile that boundary and cover restored old checkpoints without rebasing an already collected stream.","file":"hub/src/hub/suites.ts","line":965}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete first source pass not clear; one medium recovery finding, no other source finding. A-19220 records the fixed diff, exact crash/collection path, Standards/Spec review and development-evidence limits. Lead confirms no correction owner at this head. Existing uninterrupted scripted census control must remain; add the durable recovery control. Complete original producer excerpts and manifest-normalized conservative consumer accounting from retained evidence without provenance-only reruns. Correct, commit/push and request fresh source review before configured verification. Reviewer read-only; C1/final same-head execution remains pending.

Criteria: C2 failed (Delivery recovery can skip remote outcome/test receipts through the stale pre-delivery log offset; restored delivered-state regression required.).

### impl-1842 · 2026-11-13T21:16:05.908Z

Review recovery correction consumer inventory: additive private lease execution.deliveryLogEnd is produced only by DropletRun.deliver and consumed by Suites launch recovery. readLease/readLeases/writeLease preserve optional execution data; existing execution.started/startedAt/unreachableSince mutations preserve it. Older persisted lease and scripted transports omit the field and retain prior job-offset behavior. Searched execution/delivered/remoteLogStart/readLease/writeLease in hub/src, hub/test, shared, web, nvim, docs, QA and skills; no deep-equal execution object consumer found. New suite-remote-budget restored-state test covers stale job offset and already-collected bytes; executor-prepare-component asserts durable lease prefix size. No public frame or CLI field changes; existing fake leases cover the previous persisted shape. A conservative per-path manifest-normalized consumer supplement follows, explicitly distinguishing static reachability from execution.

### rev-35 · 2026-11-13T21:20:15.536Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1842-source-2
commit: d8d47b000782dbac47782f0522fa956239e7959c
scope: full
findings: [{"severity":"medium","text":"After delivery persists deliveryLogEnd but before the job offset is saved, recovery with remoteLogStart absent appends a local Workers/admitted line here. Restoring the earlier deliveryLogEnd then makes the collector count that local line as remote bytes and skip the stream prefix. Both new test variants seed a defined offset; cover the absent-offset crash case while retaining partial-collection and old-shape controls.","file":"hub/src/hub/suites.ts","line":904}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete correction source pass not clear; one remaining medium recovery variant. A-19223 distinguishes the resolved defined-stale case from the missing-offset path and records the lead's confirmation. No other source finding. A-19221's complete973-path conservative inventory independently matches the pinned manifest with zero duplicates/missing paths/tier mismatches; retained original excerpts remain qualified development evidence. Correct, commit/push and request fresh source review before configured verification. Reviewer read-only.

Criteria: C2 failed (Restored delivered state with no saved job offset still skips remote outcome/test bytes after a local admission append.).

### rev-35 · 2026-11-13T21:23:04.591Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1842-source-3
commit: 0b506cd2e696bdc5e057bb6b7c4b312b08ee9f14
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear. A-19225 records early delivered-lease hydration, durable local prefix, post-fence journal routing, absent/stale/partial/legacy controls, and preserved complete remote census. Both prior findings resolved; no remaining source finding. Conservative973-path consumer inventory matches pinned manifest, with original producer/capture limits preserved in A-19221/A-19224. C1/C2 final same-head configured evidence remains pending; task view still has C2 failed from source-2, so lead should restore done for the correction. Run mode-free verification at this exact head and reconcile actual base/load case/file receipts plus the retained consumer union. Broader T3/Linux/integrated evidence remains separate. Reviewer read-only.

### rev-35 · 2026-11-13T21:45:36.583Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1842-final-1
commit: 0b506cd2e696bdc5e057bb6b7c4b312b08ee9f14
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 verified on fresh same-head b6d41756/A-19226. A-19227 records independent positive finish audit:6,254 base tests/691 base files, separately135 load test/file passes, zero negatives/skips. Required bundle retry/exhaustion and four-variant recovery controls each base+5 pass; normal remote census base passes; all three ordinary files positive. All973 conservative consumers retained:219 T1+418 T2+54 Web executed,265 T3+17 T4 explicitly deferred. Local darwin arm64 Node24.21/nvim0.12.5, actual Headless Shell1248/Chrome156.0.8078.4; T0/T1/T2/Web exit0. Report-mode budget/lint and development-capture limits preserved. Coordinator246a9715 accepts targeted zero-delta bar and dispositions configured13,118→13,402 fixture entries as existing T-1806/full-suite residue; untouched, no global-cleanup claim. Linux/full T3/T4/stage remain separate unexecuted evidence. Source clean and unchanged; no remaining findings. Reviewer read-only.

Criteria: C1 verified, C2 verified.
