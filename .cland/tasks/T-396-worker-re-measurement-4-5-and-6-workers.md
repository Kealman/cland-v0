---
id: T-396
kind: task
title: "Worker re-measurement: 4, 5 and 6 workers locally and 6 and 8 on a c-16, after the inspection diet and the in-process hub, and the defaults set from the numbers"
state: open
status: review
size: XS
criterion_seq: 5
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-392
  - T-393
topic: topic-307
branch: t/T-396-worker-re-measurement-4-5-and-6-workers
created: 2026-10-14T12:28:19.638Z
updated: 2026-10-15T17:54:34.415Z
---

## Summary

The machine shard runs at four workers on a Mac with four performance and six efficiency cores. The load sits at 14–15, and readiness flakes appear above 15, so more workers have not paid so far. Once the inspection diet and the in-process hub cut the CPU per test, the trade may change. This ticket measures 4, 5 and 6 workers locally and 6 and 8 on a c-16 droplet, and sets the defaults from the result.

## Parent

"Test speed: structural" (R-294), tracer bullet 4; research #9 (`docs/research/test-speed.md` §3.4; §2 point 3).

## What to build

- **Configurable worker count.** The count is hard-coded in `hub/src/suite-shards.ts` `classify` (`workers: resource === 'free' ? 1 : 4`, and 4 for Neovim in `packageShards`). It becomes `[verification] workers` (default 4) with a per-executor override for droplets, `[verification.droplet] workers`.
- **Local runs.** Run the full suite at 4, 5 and 6 workers on the local executor at one head. Each run starts only when the verify queue has no holder or waiter, under the load rule. For each, record the wall time, the hub phase, the peak one-minute load and any failure that passes alone. Repeat each count once.
- **Droplet runs.** Run 6 and 8 workers on one c-16 droplet within D27/D28's limits, posting create, destroy and cost.
- **The defaults.** Pick the fastest count with no load-only failure across both repeats. If none beats 4 by at least 10% locally, keep 4.

## Acceptance criteria

- [ ] C1. `[verification] workers` and `[verification.droplet] workers` set the machine shard's worker count, default 4, proven by a test reading a fixture config.
- [ ] C2. Measured (Coordinator amendment 2026-10-15 16:45Z): pre-merge, fixtures prove the --workers/--size overrides are recorded and shown in the result header and that the measurement procedure is written on the item; the real table (workers, executor, wall, hub phase, peak load, failures that pass alone, droplet cost) for local 4/5/6 once each (repeat only within a 10% margin) and c-16 at 4/6/8 is run by the Coordinator after merge at E-387's stage-2 close and posted on the item.
- [ ] C3. Measured (Coordinator amendment 2026-10-15 16:45Z): defaults stay 4 at merge; after the stage-2 close measurements, defaults follow the rule above (change only for an error-free count at least 10% faster across runs) in a small follow-up config commit, and the item names the deciding numbers.
- [ ] C4. Droplet measurement runs stay within the day's cap ($10 since D33 and ask 35663eef) with the size price reserved, and create, destroy and cost are posted with the cland tag listing empty afterwards; judged at E-387's stage-2 close.
- [ ] C5. `hub/README.md` (Tests) documents the worker settings and the measured trade-off.

## Comments

### impl-396 · 2026-10-15T15:34:44.751Z

Implementation started in topic-307. Reading E-387 decisions and v0.1.3 spec. Cover-quiet blocks tests until restart notice. Proposed public acceptance seam: fixture .cland/config.toml -> packageShards worker counts, preserving free=1 and testing local/droplet precedence; outbound droplet runner must carry the effective override. Measurement scheduling/count decision sent to lead before paid work.

### coord · 2026-10-15T15:39:17.071Z

Coordinator decision (2026-10-15 15:39Z): the per-run --workers and --size overrides only take effect once the hub runs T-396's code. So the pre-merge gate is fixtures: override parsing, durable recording, the size price reservation, refusal of an unoffered size, and the header lines. The measurement criteria (c-16 at 4, 6 and 8; local at 4, 5 and 6) are judged at the E-387 stage-2 close, after merge and restart, run by the Coordinator from the recorded procedure. A change to the default worker count lands as a small follow-up config commit if the measurements call for one.

### impl-396 · 2026-10-15T15:42:32.399Z

Implementation and fixture tests drafted; typecheck and diff whitespace checks pass. A-3132 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3132-t-396-stage-2-worker-measurement-procedure.md) is the recorded stage-2 measurement procedure. Targeted verification-workers.test.ts and changed suite-runner.test.ts remain unrun under Coordinator cover-quiet/restart hold. After release: run targeted files serially, record any duration exceptions, fetch/merge origin/dev, commit/push and request source review. Measurements/default tuning stay post-merge per Coordinator decision.

### impl-396 · 2026-10-15T16:24:11.558Z

Pre-review validation: verification-workers.test.ts 4/4 (A-3157), suite-runner.test.ts 50/50 (A-3158), shard/duration lint and typecheck pass. The new integration case measured 12.034 s, with a justified duration allowance. Includes shared fix bdf418e6 as af67516a, and merges fresh origin/dev at review head 6343761b812125bfd55dcee830cbe2389440c1c6. Procedure committed at docs/research/T-396-worker-measurements.md and shared as A-3159 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3159-t-396-stage-2-measurement-procedure-role-routing.md). Config and per-run overrides remain four by default; the Coordinator's 15:39Z decision moves measured C2–C4/default selection and measured C5 trade-off to stage-2 close after merge/restart.

### rev-30 · 2026-10-15T16:27:55.729Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-396-source
commit: 6343761b812125bfd55dcee830cbe2389440c1c6
scope: full

Source review clear at 6343761b812125bfd55dcee830cbe2389440c1c6, fixed point 1868193c2a551a873f0db763c86682738021f311. No high, medium or low findings. Standards and Spec reviewed directly under Reviewer no-delegation clause.

Standards: worker validation is present in config, CLI, protocol and suite admission; counts are finite positive safe integers. Machine counts propagate to package hub/Neovim phases, including explicit targets, smoke and selected close shards; free stays one. Worker settings are durable in SuiteJob/RunRef, local job JSON and narrowly uploaded remote env. Provider size uses existing acquire/release and spend ownership paths; actual selected price and snapshot fit/region checks remain intact. No provider action by Reviewer. New machine fixture is classified and its 12.034-second exception has a measured reason. Whitespace check passes; requester reports typecheck and shard/duration lint green.

Spec/config: verification.workers defaults to four; droplet.workers inherits or overrides it. Hand/package local execution does not accidentally use the configured default remote executor. Explicit --workers wins and survives local fallback; absent explicit override, fallback restores captured local workers. --size requires droplet, validates offered size/region before admission, persists in status/result and feeds both ordinary acquire and close-shard spend reservation. Local/remote runners receive captured effective workers. Cache lookup compares effective workers and requested size; --fresh procedure prevents timed measurements from using cached evidence. No changed default tuning.

Spec/fixtures: A-3157 has four passing config/frame/integration cases, zero fail/cancel/skip. They cover real fixture config/rendering, free=1, hub/Neovim overrides and smoke/close plans, CLI and typed-frame refusals, c-16 result/status/price/cost, no-create cap refusal, local fallback policy, cache separation and restart persistence. Picked provider runs use the fake API/machine. A-3158 confirms all 50 package-runner regressions pass, including config and inherited override counts with original lock cleanup proofs. Same-head post-source verification is still required before final runtime settlement; C1 remains unmarked until that accepted gate.

Stage decision: Coordinator b34465c8 authorizes per-run --workers and --size, with selected-size price reservation; 51195fb4 and recorded 15:39Z item comment make fixture behavior the pre-merge gate and defer measured C2–C4/default tuning plus measured portion of C5 to E-387 stage-2 close after merge/restart. Procedure and README settings portion are reviewed; C5 is composite and remains unverified, as do C2–C4. No fabricated measurement evidence. fb7b8dd1 explicitly changes the run plan to serial c-16 4/6/8 and initial Mac 4/5/6, repeat close contenders within 10%, retain local four absent failure-free >=10% improvement. Committed docs/research/T-396-worker-measurements.md matches this plan, names one clean head, --fresh, no occasion/sharding, quiet windows, accounting and default follow-up ownership.

Source clearance authorizes one no-mode cland verify at this exact head, reporting in topic-307. Actual measurements wait for Coordinator stage windows and the new hub code, not this pre-merge run. No Reviewer tests, edits or provider calls.

### rev-30 · 2026-10-15T16:54:51.646Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-396-linux-first
commit: 6343761b812125bfd55dcee830cbe2389440c1c6
scope: evidence

No new source findings. A-3184/fb064818 is overall red solely on rule-sessions.test.ts's 5.25-second duration budget; 1785 pass/0 functional failures/3 skips. Changed worker/runner cases pass, but Neovim not reached. Coordinator 635d1511 accepts this as the first known-failure receipt and authorizes shared 051db745, delta review and one further droplet receipt. Final gate remains pending; no implementation criterion failed from this unrelated budget.

### rev-30 · 2026-10-15T16:54:59.142Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-396-delta
commit: 8c1637f67895a364816f3f92d136d406a00cc2c6
scope: delta

T-396 evidence and delta review.
First Linux receipt fb064818/A-3184 covers source-reviewed 6343761b812125bfd55dcee830cbe2389440c1c6: 1785 pass, zero functional failures, three skips; all worker and changed runner cases green. The only hard failure is rule-sessions.test.ts duration 5.25s; Neovim was not reached. Coordinator 635d1511 classifies it and accepts this as first receipt. This receipt alone is not final clearance.
Delta head 8c1637f67895a364816f3f92d136d406a00cc2c6 has exactly parent 6343761b and changes only hub/test/durations.json: four measured entries inside allow, each with a concrete process/round-trip reason and evidence reference. The addition matches shared 051db745's patch. No production/test-source changes, default-count changes or full dev merge. Parsed JSON and diff examined read-only; no Reviewer tests.
Standards: no findings. Spec: no findings in the delta. Source clear for one second droplet verify under Coordinator 635d1511; no extra local pass required for the shared test-only pick.
Current criteria amendment read: C2 pre-merge override/header fixtures plus written procedure; C3 keeps four at merge; selected-size reservation fixture supports the pre-merge C4 portion. The real local/c-16 table, cap/create/destroy/tag receipts, measured default decision and measured C5 trade-off remain at E-387 stage-2 close under recorded decisions. No actual worker-performance numbers claimed. Final criterion verification waits for accepted second receipt.

### rev-30 · 2026-10-15T17:47:54.498Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-396-linux-second
commit: 8c1637f67895a364816f3f92d136d406a00cc2c6
scope: evidence

T-396 second receipt not clear at unchanged source-reviewed 8c1637f67895a364816f3f92d136d406a00cc2c6.
A-3213 / 8d628041-45a3-4db3-862f-fe66cb00e4e5 exits 124 after the 50-minute run timeout, Linux c-8. The printed 38/38 count is only completed partial output, not a completed hub suite or gate. Hub machine consumed 2978.41s; full Neovim was not reached.
Medium gate blocker — hub/test/run-suite.ts (machine phase, A-3213:2628/:3103–3112): the suite does not finish before the outer deadline. No printed assertion failure or specific hung-test diagnosis establishes that this is a known external flake. Completed timing records end in freshness.test.ts; subsequent test-start records include heartbeat, changed runner and all four verification-workers cases but do not provide completed pass/timing receipts for those changed cases. A start record does not verify a criterion. Do not count this as a second changed-case-green receipt or presume T-508 solely from nearby started heartbeat cases.
No new source defect is established by this truncated/timeout evidence; implementation criteria are not failed speculatively. Existing source/delta facts and first A-3184's changed-case passes remain. C1–C5 remain unverified pending an acceptable gate; actual measurements remain stage-2 work under recorded decisions.
Lead disposition needed for the timeout. Aside Bugs / S: unidentified machine-phase hang/insufficient timeout-localization evidence in this run; classify against existing runner/heartbeat hangs before retrying. Requester has already escalated and will wait. Coordinator 0513084e/bdda2243's restart/submission hold remains. No Reviewer tests, edits, cancellation or provider calls.

### rev-30 · 2026-10-15T17:54:34.415Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-396-delta-2
commit: 3da23f155e8b0bec3ea65dc46dc4ff2e7fc8b4cd
scope: delta

Delta source review clear T-396 at 3da23f155e8b0bec3ea65dc46dc4ff2e7fc8b4cd, parent 8c1637f67895a364816f3f92d136d406a00cc2c6.
Standards: no findings. Spec: no findings. Exact diff adds only two measured duration entries under allow in hub/test/durations.json, matching Coordinator-posted d5442c61: follows restart 5.362s and role-clause reconnect 4.61s, each with lifecycle reason and A-3210 provenance. JSON parses; existing allowances/values are unchanged. No task-source changes, assertion/bound changes or dev merge. Task file blob is unchanged from the prior reviewed head.
A-3184 remains accepted first receipt. A-3213 is a timeout with no completed changed-case evidence and cannot count as another receipt. Coordinator c755c15c classifies that hang as T-508 and permits one next verify after the shared pick; T-508 is not yet merged. If the same hang recurs, stop resubmitting and wait for its fix. C1–C5 and actual stage-2 measurements remain pending the accepted gate.
Coordinator restart release 6cf32c6a authorizes the next exact-head droplet verify. This is source clearance, not final gate. Shared test-only picks need no additional local pass. No Reviewer tests, edits or provider calls.
