---
id: T-1025
kind: task
title: "The hub plans the Web phase: tier lint, web-only selection and the Web command, before any web test"
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by: []
topic: topic-769
branch: t/T-1025-the-hub-plans-the-web-phase-tier-lint
created: 2026-10-20T19:21:51.689Z
updated: 2026-10-20T19:49:50.551Z
closed: 2026-10-20T19:49:50.551Z
---

## Summary

The hub learns the Web phase before any web test exists: tier lint accepts the `Web` classification, the planner can plan a Web command and a `web-only` selection, and nothing is yet classified Web. This is the expand step that lets T-991's web tests be verified by a hub that already understands them (the running hub cannot verify a branch that introduces the phase it would need to run it).

## What to build

Split from T-991: the tier-lint acceptance of `Web` (outside T0-T3, per the human's decision on E-415), the suite-selection rule (`web/**` selects `web-only`; protocol and edge files force `full`), the Web command in the planner (empty while no file is classified Web), and their unit tests. No browser, no playwright-core, no web test file.

## Acceptance criteria

- [x] C1. The tier lint accepts a tiers.json entry classified `Web` and still rejects an unknown class (T1 test).
  - done: impl-1025 · 2026-10-20T19:31:13.608Z
  - verified: rev-23 [reviewer] · run rev-20261020-1025-final · 2026-10-20T19:45:36.757Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e
- [x] C2. A diff inside `web/**` selects `web-only`, and a protocol or edge file forces `full` (suite-selection unit tests).
  - done: impl-1025 · 2026-10-20T19:31:13.625Z
  - verified: rev-23 [reviewer] · run rev-20261020-1025-final · 2026-10-20T19:45:36.757Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e
- [x] C3. The planner emits a Web command after the hub phase when a Web file is classified, and no Web command when none is (T1 test).
  - done: impl-1025 · 2026-10-20T19:31:13.641Z
  - verified: rev-23 [reviewer] · run rev-20261020-1025-final · 2026-10-20T19:45:36.757Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e
- [x] C4. With no Web file classified, an ordinary task verify and a merge batch plan exactly as before (test).
  - done: impl-1025 · 2026-10-20T19:37:01.370Z
  - verified: rev-23 [reviewer] · run rev-20261020-1025-final · 2026-10-20T19:45:36.757Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e
- [x] C5. docs/agents/tests.md describes the Web phase's place and its selection.
  - done: impl-1025 · 2026-10-20T19:31:13.676Z
  - verified: rev-23 [reviewer] · run rev-20261020-1025-source · 2026-10-20T19:32:31.317Z · commit 842877d7e22e604d3a5fe98bc031c5e539d18462
  - verified: rev-23 [reviewer] · run rev-20261020-1025-source-2 · 2026-10-20T19:37:17.834Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e
  - verified: rev-23 [reviewer] · run rev-20261020-1025-final · 2026-10-20T19:45:36.757Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e
- [x] C6. On a machine that cannot launch Chrome Headless Shell (missing executable or system libraries), a selected Web phase reports "Web unavailable on this machine" with the reason in the result and in the run receipt; it neither passes silently nor fails the run, and the phase is listed as not run (test with a stubbed missing-library probe).
  - done: impl-1025 · 2026-10-20T19:31:13.703Z
  - verified: rev-23 [reviewer] · run rev-20261020-1025-final · 2026-10-20T19:45:36.757Z · commit a641bbe2f314adffc81b5c5f148b11266db9976e

## Comments

### impl-1025 · 2026-10-20T19:25:20.110Z

Applied A-7991 on current dev with no conflicts. Corrected capability-only command insertion to require at least one Web-classified file (C4); added T1 cases for accepted/rejected classification and unchanged no-Web task/batch/periodic/stage plans, and updated clause assertions. Root typecheck and static/test lint passed locally on macOS arm64 (duration/test lint report mode, 0 refusals). No local test execution during Coordinator cover-quiet. Source review will precede exact-head remote mode-free verification. Per-item QA is not required; inherited after-stage QA remains.

### rev-23 · 2026-10-20T19:32:31.317Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1025-source
commit: 842877d7e22e604d3a5fe98bc031c5e539d18462
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1025 source review at 842877d7e22e604d3a5fe98bc031c5e539d18462

Fixed base: 7c1aeae9f13dd6938184a8c3e3432a2f65185802. Reviewed tree: e21cf45eb18d577c0fcdea8bf7ee3e6b881e7ec1. Read-only comparison: git diff 7c1aeae9...842877d7; one implementation commit, 33 files.

## Standards
No findings. Reviewed the tier/resource rules, fixture isolation, receipt boundaries, duration policy and matching documentation under AGENTS.md, docs/agents/tests.md and the current Reviewer rules. New T1 cases use scratch source/config files or the existing in-process Suites fixture; no browser or runtime process test is introduced. The Web phase retains machine scheduling, separate worker policy, duration reporting and no repetition lanes. Implementer skill provenance, help, README, test docs and both implementer clauses describe the expansion. No Web test is classified yet.

## Spec
No findings. C1–C4 have explicit source regressions: accepted Web/unknown classification; web-only vs protocol/edge/mixed selection; candidate capability plus classified-file command insertion; unchanged no-Web task/batch/periodic/stage command and phase plans. Web is omitted from batches and assigned once with the Neovim close shard.
C6 distinguishes explicit machine unavailability from probe errors. It suppresses browser workers/build, emits a semantic not-run receipt with the reason, retains it through log reduction, job/result JSON and restart, and excludes that receipt from green cache reuse. Tests cover the missing-library probe, summaries, durable result and restart/cache behavior. The prerequisite implementation and browser dependencies belong to T-991/T-993, not this expansion.
C5 is established by source: docs/agents/tests.md Web phase describes cadence, selection, budgets, prerequisite contract and unavailable evidence.

## Evidence and verdict
Source clear; verify C5 only. C1–C4 and C6 runtime checks remain unverified until the normal same-head mode-free gate. A-7994 reports local macOS arm64 static typecheck/lint success with test lint in report mode and zero refusals; it explicitly supplies no runtime test receipt during cover-quiet. Reviewer ran no tests, compilers, browsers or product processes.
Findings: Standards 0; Spec 0. Source clear is not final verification.

Criteria: C5 verified.

### impl-1025 · 2026-10-20T19:36:34.708Z

A-7999/run 150f6ec2 at 842877d7 failed in T1: actual name 'T1 whole', expected 'hub free' at C4 fixture line 110; all 5 load repetitions repeated the same assertion. This is the new fixture's incorrect task label; pre-expansion source confirms task emits T1 whole, T1-only batch emits hub free. One-line correction committed/pushed as a641bbe2f314adffc81b5c5f148b11266db9976e. Hub typecheck and diff check pass on local macOS; runtime not rerun under cover-quiet. Fresh source review requested before new verify. First run executed T0/T1 on Linux x64 droplet (report-mode budgets), T2 not run, no Web files.

### rev-23 · 2026-10-20T19:36:55.802Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-1025-final-red
commit: 842877d7e22e604d3a5fe98bc031c5e539d18462
scope: evidence
findings: [{"severity":"medium","text":"No-Web task compatibility fixture expects hub free, but the existing T1,T2 task planner produces T1 whole; ordinary execution and all five load repetitions fail.","file":"hub/test/web-phase.test.ts","line":110}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1025 failed gate evidence at 842877d7

A-7999 / run 150f6ec2-d0b8-4c36-8d55-025b49b7c261 exited 1 at source-reviewed 842877d7e22e604d3a5fe98bc031c5e539d18462.

## Standards
No additional standards findings. Actual Linux x64 c-8 lon1 droplet execution completed T1 only: 666 ordinary tests, 665 pass / 1 fail; 113 file finishes, 112 pass / 1 fail. Load-gate finishes separately contain 40 passing and five failing tests. The repeated failure is the same new compatibility identity, not six distinct defects. T2 was not executed; its projection is not evidence. No Web file/browser phase or T3/T4 execution is claimed. Host check reference 2ad4a1e85409178e4279164c0fa6a9631884fc2f was not repeated remotely. Lint, duration diagnostics, baselines and ratchet are report-only. Lifetime 132 seconds; estimated cost $0.0091.

## Spec
Medium M1 — hub/test/web-phase.test.ts:110: the no-Web task compatibility fixture expects the wrong existing phase name and fails ordinary execution and all five repetitions. Actual output:
```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+     name: 'T1 whole',
-     name: 'hub free',
at .../hub/test/web-phase.test.ts:110:10
```
The pre-expansion package planner already inserts 'T1 whole' for task tiers T1,T2; the batch phase remains 'hub free'. This is a task-owned fixture expectation error, not a production compatibility regression or a shared flake.

## Verdict
Not clear; C4 fails because its required compatibility test is red. Other criteria are not finally settled from this partial gate. The forthcoming corrected head requires fresh source review before another gate. Reviewer ran no tests.
Findings: Standards 0; Spec 1 medium.

Criteria: C4 failed (Required no-Web task compatibility test fails: actual T1 whole, fixture expects hub free; ordinary and five load repetitions red.).

### rev-23 · 2026-10-20T19:37:17.835Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1025-source-2
commit: a641bbe2f314adffc81b5c5f148b11266db9976e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1025 corrected source review

Head a641bbe2f314adffc81b5c5f148b11266db9976e; tree 7f512c575ec2a6a0322c3509017008c4dd4197c5. Reviewed the single-line correction since source-reviewed 842877d7; no dev merge or production change.

## Standards
No findings. Correction retains the full task phase/target/resource/worker comparison and the independent batch assertion; no assertions, test identities or repetition policy are weakened.

## Spec
No findings. The task-specific expected phase is now 'T1 whole', matching the pre-expansion planner's existing T1,T2 task rewrite. The batch still expects 'hub free'. This resolves M1's source cause from A-8001. All other source conclusions from A-7996 remain applicable; matching Web documentation remains unchanged (C5).

## Evidence and verdict
Source clear; verify C5 by source. C1–C4/C6 runtime checks await a fresh normal mode-free configured-executor gate at this exact head. A-7999 is the old failed T1 gate and is not current passing evidence; T2 did not execute there. Lead reports only local typecheck/diff-check for the correction, no local runtime tests under cover-quiet. Reviewer executed no tests.
Standards 0 findings; Spec 0 findings.

Criteria: C5 verified.

### impl-1025 · 2026-10-20T19:45:18.111Z

Same-head verification green: run 4c26ed55-40a6-4512-b85c-979e6f243f24, head a641bbe2f314adffc81b5c5f148b11266db9976e, A-8013. T0 host gate plus all T1/all T2 fallback across hub and Neovim, Linux x64 c-8 lon1 droplet, 2144 pass / 0 fail / 0 skipped; duration/test lint report mode. Droplet lifetime 407 s, cost $0.0283. T3 deferred to periodic/integrated occasions; no Web command/browser phase because no file is classified Web. New planner/receipt/cache tests ran, including 5/5 load repetitions. Tree remains unchanged and clean. Reviewer receives result directly and settles final criteria/verdict; QA remains after-stage.

### rev-23 · 2026-10-20T19:45:36.757Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1025-final
commit: a641bbe2f314adffc81b5c5f148b11266db9976e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1025 final evidence review

Commit a641bbe2f314adffc81b5c5f148b11266db9976e; tree 7f512c575ec2a6a0322c3509017008c4dd4197c5. Corrected source verdict A-8002 remains current.

## Standards
No findings. A-8013 / run 4c26ed55-40a6-4512-b85c-979e6f243f24 exited 0 at this exact head. Parsed finish records show 2,144 ordinary passing tests and 335 passing files, plus 45 separately counted passing load-gate tests. All eight web-phase T1 identities and the in-process unavailable-Web restart/cache identity passed ordinary execution and five repetitions each.
Actual execution: Linux x64 6.8.0-142-generic c-8 lon1 droplet, Node v24.21.0, Neovim v0.12.5, two ordinary machine workers; all T1 and fallback all T2 completed, including Neovim 75.78 seconds. No browser/Web tests exist in the manifest yet, so these are planner/probe/receipt tests, not executed browser evidence. No T3/T4 or after-stage QA completion is claimed.
Host check reference 49ccbfde85bd4c5ce1665968a212e86ba96d4413 was not repeated remotely. Test lint 131 findings/59 files, duration diagnostics, eight missing baselines and incomplete-base T3 ratchet remain report-only. Droplet lifetime 407 seconds; estimated cost $0.0283.

## Spec
No findings. C1 classification acceptance/rejection passed; C2 Web-only/full boundary selection passed; C3 capability-plus-manifest command pinning and phase ordering passed; C4 corrected no-Web task/batch/periodic/stage compatibility passed, resolving the old A-7999 failure. C5 matching docs were checked at source and remain unchanged. C6 explicit missing-library probe, not-run reason/semantic receipt, result durability, restart and cache exclusion all passed through the intended in-process seams. Available probes supply no fabricated pass evidence, and broken probes remain errors.
This expansion introduces no actual browser dependency/test or Web manifest entry; T-991/T-993 supply the later fixture/prerequisite/install slices.

## Verdict
Final clear; verify C1–C6 at a641bbe2. Prior failed gate A-7999 stays historical. Inherited affected after-stage QA remains separate. Reviewer ran no tests or product processes.
Standards 0 findings; Spec 0 findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-20T19:49:50.551Z

Merged 0877bba4435bceebfc9fd1d78f604db836741e8b onto dev.
