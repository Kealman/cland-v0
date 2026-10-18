---
id: T-747
kind: task
title: Importing hub/test/harness.ts registers ps and socket work at module load
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by:
  - T-744
topic: topic-478
branch: t/T-747-importing-hub-test-harness-ts-registers
created: 2026-10-17T17:24:17.537Z
updated: 2026-10-18T05:57:12.272Z
---

## Summary

T-744's import-graph lint (2026-10-17) found that a test importing only a pure helper from `hub/test/harness.ts` still runs resource work at module load. harness.ts side-effect-imports `account-fixture-env.ts`, which calls `ownDirectory(undefined, root)` and registers a teardown that can spawn `ps`. `cover-quiet.ts` calls `assertTestAdmission`, which depends on the socket admission environment. Every importer is therefore charged with process or socket use, and pure tests can't qualify for T1.

## What to build

Make harness.ts import side-effect free: account-fixture setup, the ownDirectory teardown and the cover-quiet admission check run only when a fixture that needs them is created, not at import. Every existing protection (fixture isolation, cover-quiet refusal) keeps working for the fixtures that use it.

## Acceptance criteria

- [x] C1. Importing only a pure helper from harness.ts runs no ps, socket or child-process work, proved by a T1 census, and T-744's lint no longer charges those importers. The review request lists the files whose qualification changes.
  - done: impl-747 · 2026-10-18T05:56:16.074Z
  - verified: rev-30 [reviewer] · run rev-20261018-747-final · 2026-10-18T05:57:11.446Z · commit fccf4991ead89c042c3b0388e2605d06137af093
- [x] C2. The cover-quiet and fixture-isolation tests pass unchanged, 5/5 on the Mac and in the task's droplet verify.
  - done: impl-747 · 2026-10-18T05:56:16.478Z
  - verified: rev-30 [reviewer] · run rev-20261018-747-final · 2026-10-18T05:57:11.446Z · commit fccf4991ead89c042c3b0388e2605d06137af093

## Comments

### impl-747 · 2026-10-18T04:47:52.613Z

Implemented explicit cached account-fixture admission/setup instead of global harness-import hooks. C2 Coordinator decision a205716f: child target now requests tempProject before its body, while every refusal/no-directory assertion is unchanged; account-fixture-isolation.test.ts unchanged. T1 census proves pure helper import preserves account settings and starts no fixtures; enforced resource tripwire records zero native resources. Before/after lint for the same new census: reachable T3 (6 resources) → T1 (0). Existing manifest files retain their conservative reachable qualification, since they also select resource-using helpers. Local repetitions so far: cover-quiet, account-fixture-isolation, project-hub and test-admission each 5/5, load below 6; final census 5/5 enforcement receipt being captured. Source review precedes task droplet verify; restart hold is lifted.

### impl-747 · 2026-10-18T04:49:52.092Z

Caught and fixed a Node hook-scope issue before review: an after() registered lazily inside the first fixture caller is test-scoped, so cached account directories disappeared before later tests. Added a T2 successive-subtest regression (red before fix, green after). The worker now registers only a no-op cleanup callback at module load; directory ownership/admission and actual teardown remain conditional on explicit fixture creation. The T1 census and import-graph lint still show zero import-time resources. Repeating all focused files on the final source.

### rev-30 · 2026-10-18T04:54:47.368Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-747-source
commit: a28ccc307a8a19ab98d83ee3746916444bb1b25f
scope: full
findings: [{"severity":"medium","text":"M1: Neovim refusal control now admits via generic tempProject, masking that actual startClient skips isolateVerification when CLAND_COMMAND is set. Existing ui/vboard raw-mkdtemp stub callers can allocate/spawn without lazy admission after import hooks are removed; guard the real entry before resources and exercise it directly.","file":"hub/test/cover-quiet.test.ts","line":38}]
finding_counts: {"high":0,"medium":1,"low":0}

A-4963: not clear, one medium Spec finding, no separate Standards finding. Caching and worker-scoped conditional cleanup preserve lazy generic fixture setup, but nvim/test/harness.ts:113 skips the only lazy-admission path for CLAND_COMMAND/stub clients; ui.test.ts:20/26 and vboard.test.ts:32/34 create raw roots and then spawn without tempProject. The changed Neovim control pre-calls generic tempProject, so its unchanged assertions mask that gap. Guard actual Neovim fixture entry for both normal and explicit-command paths before allocating/spawning, add a direct refusal control and request fresh review before verification. Audited all 30 local runs/115 passes and unchanged isolation/cover assertions; their current green result does not cover this path.

Criteria: C2 failed (Cover admission is lost for actual explicit-command/stub Neovim fixture startup; the adapted driver tests an unrelated preliminary tempProject instead.).

### impl-747 · 2026-10-18T04:56:24.125Z

Addressing review M1 on the reviewed base (no dev merge). nvim startClient now awaits lazy account admission before resource allocation for both ordinary and CLAND_COMMAND paths. The cover-quiet controls call actual startClient directly, with no preliminary generic fixture, for normal and exact stub-command paths. New stub control failed against the reviewed source before the fix and both controls pass after. Refreshing typecheck/tiers/lint and five serial whole-file runs of cover-quiet, T1 census, and representative raw-root stub clients ui/vboard before a new source review request.

### rev-30 · 2026-10-18T05:00:51.553Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-747-source-correction
commit: 19c168fa2bf276152dc569adbad61049692dbf25
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4966: corrected source clear; M1 resolved, no remaining Standards/Spec findings. startClient admits lazily before allocating/spawning on both default and CLAND_COMMAND paths. Actual-entry refusal controls use no preliminary generic fixture; original refusal/no-directory assertion lines and account-fixture-isolation source remain unchanged. Pure import/cached worker setup, typed AdmissionTimeout and conditional cleanup remain intact. Audited A-4965: 20 refreshed whole-file runs/230 passes, zero failure/cancellation/skip; five T1 census rows each resourceCount=0, cover controls 5/5 and ui/vboard consumers 5/5 each. Unchanged isolation 5/5 remains A-4962. No lint/allowance changes or dev merge after first review. C1/C2 verification remains pending the same-head task receipt.

### coord · 2026-10-18T05:03:02.569Z

Related observation from impl-708 (2026-10-18 05:02Z): targeted T1 runs under the pre-import enforce tripwire flag the shared cover-quiet.ts admission hook's net.createConnection before any test body runs. T-747's lazy admission at fixture entry is meant to remove exactly this. The T1 import census should show it gone; if it doesn't, say so here.

### impl-747 · 2026-10-18T05:28:25.637Z

Droplet 802a6072 at reviewed 19c168fa (A-4984) exited 1: 2127/2133 pass, one T-754 non-stub Neovim runner assertion failed, five skips; Linux x64, lifetime 1354s, $0.0940. Coordinator identified task-caused interaction and requested local fix/delta review. Exact Mac repro matched only-socket receipt. Probe showed all inner launches reject correctly (pass 4); cached Promise context makes later trips retain first caller's node:test identity and deduplicate. Parent admitted fixture alone still fails (one parent-attributed trip). Async ensureAccountFixture wraps shared initialization in a fresh caller-owned Promise and restores all three unchanged socket/command/default spawn receipts. Committed/pushed fccf4991; no dev merge. Typecheck/tiers/lint pass; T1 census5/5 zero resources and lifetime5/5 pass; complete guard file5/5 pass. Remaining cover/isolation5/5 refresh underway before delta review. No debug instrumentation remains.

### rev-30 · 2026-10-18T05:30:19.123Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-747-context-delta
commit: fccf4991ead89c042c3b0388e2605d06137af093
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4989: Standards/Spec delta clear, no findings. Async ensureAccountFixture wraps cached initialization in a fresh caller-owned Promise while preserving lazy admission, shared setup and conditional worker cleanup. The planted non-stub test admits its shared fixture before subtests; exact socket/command/default spawn-trip and inner pass-4 assertions are unchanged. Coordinator ffc4b0d5 authorizes this task-caused correction after failed A-4984, which remains disclosed. Parsed A-4988's 25 whole-file logs: 170 passes, zero failures/cancellations/skips; complete runner 5/5 and five enforced census rows each resourceCount=0. Prior cover/isolation/native-entry audit remains applicable. C1/C2 remain unverified pending new exact-head task evidence; normal verification may proceed.

### rev-30 · 2026-10-18T05:57:11.446Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-747-final
commit: fccf4991ead89c042c3b0388e2605d06137af093
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5005: final same-head evidence clear; C1/C2 verified. A-5004/a98d8631 exits zero with complete hub+Neovim phases: 2,519 pass/0 fail/8 unrelated prerequisite skips. Audited positive census, lifetime/isolation, all 12 cover controls, all 17 runner tests including the unchanged three-spawn guard, and UI/vboard receipts; focused files have no tier trips/skips. Three new identities each pass 5/5 load repetitions. Census is qualifying/reachable T1/0; existing qualification population unchanged. Mac A-4988's 25 whole-file logs/170 passes and prior unchanged-entry proof remain applicable. Failed parent A-4984 remains disclosed; unrelated report-only Claude ps probe is the known T-759 class. Linux c-8 lon1, 1,479s lifetime, $0.1027. No per-item QA.

Criteria: C1 verified, C2 verified.
