---
id: T-1937
kind: task
title: suite-timeouts "verify kills a silent test tree and spoke" races its 1.5 s startup watchdog against the silence watchdog under load
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1607
branch: t/T-1937-suite-timeouts-verify-kills-a-silent
created: 2026-11-17T07:35:36.084Z
updated: 2026-11-18T03:09:24.100Z
closed: 2026-11-18T02:48:15.771Z
---

## Summary

Periodic dev T3 249ae076 at 04d1f6a0f (A-20741, Linux droplet c-8 ams3, peak 1-minute load 6.32) failed only `hub/test/suite-timeouts.test.ts::verify kills a silent test tree and spoke, names the last started test and frees admission`. The test expects the silence watchdog's message (`/stalled: no output for 0\.05 min/`). The startup watchdog fired first instead: "stalled: silent.test.mjs no test started within 1.5 s; command exit pending". The fixture's first test started too late under load, so the run's outcome depends on which watchdog wins. The same log shows "preserved pid 232419: ambiguous ownership" for the spoke.

## Evidence

- A-20741 lines 34830 onward hold the literal AssertionError and the full received summary.
- Coordinator, macOS arm64, Node 24.21.0, the whole file alone five times at 04d1f6a0f: 19/19 each run, starting loads 3.43–4.40.
- impl-1848 ran the file 19/19 locally at its merged head earlier today.

## What to build

Make the case deterministic. Either have the fixture's test start be observed before the silence window begins, or give the startup budget a fixture value well above the silence budget, so only the silence watchdog can fire. Then assert the silence outcome. Keep the existing kill, name and admission-release assertions.

## Acceptance criteria

- [x] C1. The case cannot be decided by the startup watchdog: a test with a delayed first test start (fake or held) still reports the silence stall (test).
  - done: impl-1937 · 2026-11-18T00:21:47.391Z
  - verified: rev-35 [reviewer] · run rev-35-1937-final-1 · 2026-11-18T01:33:00.557Z · commit 8d038c387b5120761d4ac855868191579350a59a
- [x] C2. 20/20 runs of the file under the T3 runner at a 1-minute load of at least 8 pass, with the load recorded per run (native slot).
  - done: impl-1937 · 2026-11-18T00:10:05.488Z
  - verified: rev-35 [reviewer] · run rev-35-1937-final-1 · 2026-11-18T01:33:00.557Z · commit 8d038c387b5120761d4ac855868191579350a59a

## Comments

### coord · 2026-11-17T19:17:41.939Z

Third instance, 2026-11-17 19:17Z: Linux stage cover f821e4cd at ca5f70ca4 (A-20917, shard-2, c-8 droplet) failed only this case, with the same mode: "The input did not match the regular expression /stalled: no output for 0\.05 min/" (7.1 s). It now costs a stage cover rerun, so it is a candidate for early stage 2.

### impl-1937 · 2026-11-17T23:20:27.718Z

Confirmed seam: existing suite-timeouts T3 public verifier fixture (authorized by item). Regression adds a 2-second held import with 100ms output heartbeats, beyond the old 1.5s startup cap while excluding no-output expiry during that hold. Planned fix sets only generated package runner's fixture startup policy to 120s (30s startup cap); outer verifier remains at 3s. Existing kill, name and admission assertions remain. No shared production contract changes; native slot requested before running.

### impl-1937 · 2026-11-18T00:10:06.231Z

Implementation caf110649896124240110ee465ce492b71105852 changes only existing T3 fixture and its per-file guide. Current origin/dev merged once before first review. No shared production contract or test identity/tier changed; T1 consumers reachable from this fixture-only diff: none (search includes suite-timeouts.test path, silent test name and fixture output; references are tier/duration/lint manifests and guide). A-20956 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20956-t-1937-delayed-start-red-green-and-20-loaded-t3-receipts-at-caf110649) retains C1 red/green and C2 20/20 full-file T3 proof: 380/380 exact named pass receipts, native exit0/no signal, local darwin arm64 Node24.21.0, start loads10.06–15.26, no browser. Report-only duration advisories retained. Initial auto-helper duplicate phase deliberately interrupted exit143 is retained and excluded. Generator close observed and native slot released. No production timer policy changed; outer3s retained, generated inner fixture limits120s gives startup30s.

### rev-35 · 2026-11-18T00:18:14.043Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1937-source-1
commit: caf110649896124240110ee465ce492b71105852
scope: full
findings: [{"severity":"medium","text":"Standards / C1: the generated fixture adds a literal 2000ms setTimeout wait without the explicit reasoned wall-clock exception required by tests.md's placement/review and allowance guidance. Record the narrow authorized native-startup fault-injection reason at this delay; retain receipt-based readiness and all product assertions.","file":"hub/test/suite-timeouts.test.ts","line":187},{"severity":"low","text":"Standards: guide and suite-timeouts.test.ts:175 call startup a fixed 30s cap. With stallTimeoutMs120000 the shared function is min(60000, load-adjusted30000), so 30s is only unit factor and 60s is the ceiling. Correct both descriptions, as already acknowledged in A-20958.","file":"docs/agents/tests/hub-test-suite-timeouts.test.ts.md","line":7}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source at caf110649 / Git tree 7c586ba8e2204eed71811b2b973cc453716e45e6 against fixed 98c597e0c1efc867c5e6e99ad789f6098223a4c3. Standards 1 medium/1 low, Spec 0: functional watchdog separation and original kill/name/silence/admission assertions retained. A-20959 records full review and static independent audit of A-20956/A-20958: 20 logs each have the same 19 test pass frames and a pass file envelope, 380 total, matching native code0/signalnull receipts and start loads10.0576–15.2612. Earlier duplicate-phase exit143/178569ms remains excluded. C2 not failed; no extra stress loop requested. Per-launch tree hashes absent: evidence is chronological working-tree association, not immutable source fencing. No Linux/browser/configured verify claim. Correct only the explicit delay reason and cap wording, then fresh clean-head source request; preserve existing runtime receipts/limits. No Reviewer execution or edits.

Criteria: C1 failed (Delayed-start regression adds an unexcepted wall-clock wait; record its explicit narrow native fault-injection reason.).

### rev-35 · 2026-11-18T00:29:09.609Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1937-source-2
commit: 8d038c387b5120761d4ac855868191579350a59a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 8d038c387b5120761d4ac855868191579350a59a / Git tree 065d46898a06f5bc171717a0baebfd63790de3a8. Original base 98c597e0c1efc867c5e6e99ad789f6098223a4c3; one comment/guide-only corrective commit since caf110649, no dev merge. A-20959 M1/L1 both resolved: explicit narrow native fault-injection wall-clock reason and accurate min(60s, load-adjusted30s) wording. Expressions, assertions, tiers and timing behavior unchanged. Standards 0, Spec 0. A-20964 records settlement. C1/C2 runtime verification remains pending same-head configured evidence. Prior A-20956 twenty-run/380 named-pass chronological evidence remains valid in its A-20958 provenance scope, not a new-head run or immutable per-launch fence; earlier exit143 excluded and report-only advisories preserved. No additional stress loop requested. Lead may obtain Coordinator window for mode-free verify at this unchanged clean head. No Reviewer execution or edits; QA none.

### rev-35 · 2026-11-18T01:33:00.557Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1937-final-1
commit: 8d038c387b5120761d4ac855868191579350a59a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear from configured ca9433c1-f9d0-465c-aab9-e196e82c0e82 / A-20996; independent audit A-20997. Provenance38436 pins reviewed head8d038c387 and delivered treeeb199ff438b34cdc9a075c3a3e9165c9a5cfc1f6, uncached Linuxx64 droplet Node24.21/Nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4. C1 exact silent-tree finish35740/timing35741 pass13.232243047s; changed file19/19 and file envelope35808pass. All711 selected file envelopes pass (224T1,431T2,1T3,55Web),6705 ordinary test pass/no nonpass, plus210 load test passes/42 five-of-five proofs. T0/T1/T2/changedT3/Web exit0. Remaining268T3/17T4 unexecuted; taskT3 once/no repetitions,85.776s selected phases excludes machine wait. C2 retains prior A-20956 twenty native loaded closes/380 names at caf110649 with A-20958 chronological/no-per-launch-hash limits; corrective delta was comments/guide only, current exact-head Linux pass corroborates without relabelling twenty runs as new-head. Old startup red and interrupted143 attempt preserved/excluded.108 advisory tripwire identities match A-20973, none task-specific;44 shared refusal-control stacks not absence-only proof. Lint130/63,budgets/Web wall/ratchet advisories remain report-only. Billing1561s/$0.1084 not suite wall. Standards0/Spec0,QA none, no Reviewer execution/edits or rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T02:48:15.771Z

Merged 0c2540bc52d2a6958fd80e88f87858e41c114e00 onto dev.

### coord · 2026-11-18T03:09:24.100Z

Post-landing note, 2026-11-18 03:09Z: periodic dev T3 a2a16ab9 at fd2f1d484 (A-21041) failed only this case in T3. That commit predates T-1937's landing (0c2540bc5, 02:48Z), so the run tested the pre-fix code; it isn't a regression of the fix. The next dev T3 at or after 0c2540bc5 is the first post-fix integrated evidence.
