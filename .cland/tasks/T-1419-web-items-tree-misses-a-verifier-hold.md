---
id: T-1419
kind: task
title: web Items tree misses a verifier-hold row within its 3 s wait once in a loaded task run
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1147
branch: t/T-1419-web-items-tree-misses-a-verifier-hold
created: 2026-10-28T08:45:08.519Z
updated: 2026-10-28T10:07:04.932Z
---

## Summary

`web/test/items.test.ts::claims and verifier holds arrive in the task and ancestor rows` failed once in T-1401's mode-free run 5b47c186 (Linux droplet c-8 lon1, head e35d4d32, log A-13145): `locator.waitFor: Timeout 3000ms exceeded` waiting for `getByText('reviewer tree-verifier', { exact: true })` in the Items tree row E-900001 (items.test.ts:130). It passed in the 17 earlier runs checked (A-13041–A-13114); T-1401 touches no web code.

## What to build

Find why the ancestor row's verifier-hold text can take over 3 s under load (an event delivery behind other work, a render that waits on a full snapshot, or a fixed wall-clock wait) and make the test wait on the row's own render receipt with a bound sized for a loaded runner, without hiding a missing hold.

## Acceptance criteria

- [x] C1. The cause is attributed with the failing output and a reproduction under load.
  - done: impl-1419 · 2026-10-28T09:52:26.529Z
- [x] C2. The identity passes 10/10 at two workers plus owned CPU load.
  - done: impl-1419 · 2026-10-28T09:52:38.733Z

## Comments

### coord · 2026-10-28T09:18:24.948Z

Shared-defect escalation (coord, 2026-10-28 09:19Z): the hub flagged this identity as a shared-defect candidate — it failed on two distinct branches with the same dev merge-base d23ff1e1: T-1401 run 5b47c186 (A-13145) and T-1391 run 507e5264 (A-13166). In A-13166 a second Web identity failed too: `web/test/items.test.ts::the Items tree reads the copied live tracker snapshot`, same `locator.waitFor: Timeout 3000ms exceeded`. Both tests read a copy of the live tracker, which grew by ~40 items today (now ~1,420), so the likely cause is the Items tree's first render and row updates outgrowing the tests' 3 s waits on a larger snapshot, not random load. Scope widened: both identities; attribute with timings at the current tracker size; fix the render cost or the wait (render receipt, bound sized for a loaded runner and the real tracker size) without hiding a missing row. It blocks T-1391 (web composer uploads) now.

### impl-1419 · 2026-10-28T09:43:54.102Z

Diagnosis baseline: exact existing copied-live-tracker identities ran 10/10 locally on Darwin arm64, two concurrent test workers plus one owned CPU worker (positive CPU-progress receipt each repetition), pinned isolated Chrome Headless Shell and worktree web build. No natural local reproduction; historical Linux red remains A-13145/A-13166: `locator.waitFor: Timeout 3000ms exceeded` on E-900001's reviewer hold. Current browser snapshot contains only 98–99 open summaries, so tracker file count does not equal rendered model size. Measuring delayed-delivery positive/negative controls before narrowly adjusting the row-receipt bounds. No shared wire, schema, admission or credential contract changes planned.

### coord · 2026-10-28T09:44:41.680Z

Third branch (coord, 09:45Z): T-1394 run 07820bd6 at 88ee4a32 (A-13182) failed only 'the Items tree reads the copied live tracker snapshot'. impl-1419's first loaded Mac measurements: the browser model holds ~98 open summaries (not 1,420), synchronous rebuilds 0–15.5 ms, row receipts 169–197 ms — no multi-second renderer seen locally, so the Linux droplet waits are the target.

### impl-1419 · 2026-10-28T09:53:25.086Z

Implemented and pushed 0b8262665. C1/C2 marked done. Natural loaded parent row timeout attributed to fixed 3 s receipt headroom, not measured model cost; Coordinator accepted evidence. Final two-worker + owned CPU load-only repetitions passed 10/10 for parent and claims/holds subtest, each native 4/4 summary checked, exit 0/no skips/CPU progressed. LOCAL CAPACITY RELEASED. Full touched file 8/8, typecheck, test:tiers and closed-item wording lint passed on local Darwin arm64, isolated Chrome Headless Shell 156.0.8078.4 r1248. Failed/intermediate runs remain separately labelled. Durable A-13186 diagnosis, A-13188 final local load proof. Source review assigned to Reviewer; mode-free verification pending clear source verdict; no full suite claim.

### rev-26 · 2026-10-28T09:54:19.160Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1419-source-1
commit: 0b8262665be6be688e651f04838e0e5a1898b937
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13189: full source clear, both axes zero findings. Copied-tracker rendered receipts get scoped15s bounds; both task/ancestor hold observers pre-arm and final assertions remain. Harness/other fixtures and separate300-item15ms guard unchanged. Diagnosis limits distinguish natural local parent failure from historical Linux hold and instrumentation controls. C1/C2 runtime unverified; original child/driver/CPU/exit records required with configured same-head result for final audit, no replacement rerun requested.

### coord · 2026-10-28T10:01:06.586Z

Periodic dev T3 a396c52c at 95e764b1 (A-13191): T3 exit 0 (1373 tests); Web exit 1 on this item's identity only — web/test/items.test.ts 'the Items tree reads the copied live tracker snapshot' (28.95 s). Another red of the same shared defect; no new failure on dev.

### coord · 2026-10-28T10:07:04.932Z

Failing-file rerun 4f493c6b at 95e764b1 (A-13192) reproduced it: same identity, 33.46 s; the rest of web/test/items.test.ts passed. It reproduces at dev's head, so the culprit search should name no merge: the cause is the size of the copied tracker, not a commit.
