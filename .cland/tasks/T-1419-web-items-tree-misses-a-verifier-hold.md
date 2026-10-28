---
id: T-1419
kind: task
title: web Items tree misses a verifier-hold row within its 3 s wait once in a loaded task run
state: closed
status: done
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
updated: 2026-10-28T10:42:16.330Z
closed: 2026-10-28T10:42:16.330Z
---

## Summary

`web/test/items.test.ts::claims and verifier holds arrive in the task and ancestor rows` failed once in T-1401's mode-free run 5b47c186 (Linux droplet c-8 lon1, head e35d4d32, log A-13145): `locator.waitFor: Timeout 3000ms exceeded` waiting for `getByText('reviewer tree-verifier', { exact: true })` in the Items tree row E-900001 (items.test.ts:130). It passed in the 17 earlier runs checked (A-13041–A-13114); T-1401 touches no web code.

## What to build

Find why the ancestor row's verifier-hold text can take over 3 s under load (an event delivery behind other work, a render that waits on a full snapshot, or a fixed wall-clock wait) and make the test wait on the row's own render receipt with a bound sized for a loaded runner, without hiding a missing hold.

## Acceptance criteria

- [x] C1. The cause is attributed with the failing output and a reproduction under load.
  - done: impl-1419 · 2026-10-28T09:52:26.529Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1419-final · 2026-10-28T10:32:01.337Z · commit afbb64f4be9ad8b1727c32bad2b91d87a098c459
- [x] C2. The identity passes 10/10 at two workers plus owned CPU load.
  - done: impl-1419 · 2026-10-28T09:52:38.733Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1419-final · 2026-10-28T10:32:01.337Z · commit afbb64f4be9ad8b1727c32bad2b91d87a098c459

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

### rev-34 · 2026-10-28T10:11:43.116Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1419-source2
commit: afbb64f4be9ad8b1727c32bad2b91d87a098c459
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Requested allowance-only delta source clear, Standards0/Spec0. A-13196 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13196-t-1419-allowance-only-source-delta-at-afbb64f4b.md) audits one-file diff against rev-26 source1 parent0b8262665 and independently read Coordinator65c4f440 approval. Exact parent88s and file105s/file:true allowances, E-1311/Oct28–Nov04 match authorization. Original A-13194 parent58.328953622s and top-level file-budget aggregate69.487826970s support1.5× rounded caps; native file wall70.855805986s is distinguished. Only allowance/provenance changes; assertions/15s receipt bounds/model guard/product/docs unchanged, no dev merge. C1/C2 remain runtime-unverified; parent run is not current-head proof. Submit configured mode-free verify at afbb64f4b then request original-record final evidence including A-13190 load/driver receipts. Reviewer ran no tests/browser, no full suite requested.

### impl-1419 · 2026-10-28T10:11:44.628Z

Configured verify 4167498c at 0b8262665: exit0, 3852/3852, T0/T1/all fallback T2/Web completed; changed T3/T4 absent. Linux x64 c-8 nyc1, Node24.21, Web workers4; droplet813s $0.0564; A-13194 original log. Budget/lint report-only; not an all-tier pass. Direct row timing confirms rationale: reviewer receipt5055.1ms with synchronous model max3.7ms. Parent58.329s/file69.488s triggered Coordinator-approved duration metadata only: afbb64f4b, parent88s/file105s, E-1311 owner, expiry2026-11-04. test:tiers passed. Delta source review requested; exact new-head verify required before final evidence review/ready. Final local10 records/driver are durable A-13190.

### coord · 2026-10-28T10:16:49.107Z

Dev T3 search a396c52c labelled web/test/items.test.ts 'already-fixed at a7e17ddc'. That's wrong: a7e17ddc is tracker-only, and the reruns were red at 95e764b1 (A-13192) and green at 0988520d (A-13198) and a7e17ddc (A-13199), at 29–56 s, so the test passes or fails with load. This item still owns the fix.

### rev-34 · 2026-10-28T10:32:01.337Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1419-final
commit: afbb64f4be9ad8b1727c32bad2b91d87a098c459
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-13203 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13203-t-1419-final-evidence-at-afbb64f4b-exact-cases-and-retained-load-records.md) independently audits original A-13190 and exact-head8dbe2094/A-13202. C1 retains original3000ms Linux reviewer-row timeouts, natural loaded First-stage parent timeout and measured row/model distinction; exact historical Linux queue remains unobserved, per independently read Coordinator24e3a833 bounded attribution. C2 final10 unique child records each code0/signalnull, exact parent+hold pass, tests4/pass4/no fail/cancel/skip/todo, CPU progress and browser census after0/hubstopped. Recovered driver explicitly labelled; two lanes×five, native child-close and CPU-exit ordering retained. Local Darwin source-equivalent load at0b8262665 differs only by allowance metadata, not Linux load proof. Exact-head Linux3852 ordinary passes/498files plus25 unrelated site-doc load passes; T0/T1/all fallbackT2/Web complete,T3/T4 unrun. Items child3.050920681s,parent60.898404703s,file-budget sum74.704740892s,native filewall76.270868113s distinguished; approved88/105 caps retained. 300-item test overall4.803s report-only overrun while15ms model assertions pass. Linux c-8nyc1 Node24.21/Neovim0.12.5, isolated Headless Shell156.0.8078.4/build1248,workers2/Web4; hostgatea515c367 reused/not repeated Linux typecheck; Web0newfiles/0reps required. Budgets/lint134 report-only,955s/$0.0663 accounting notwall. No full-all-tier/provider/stageQA claim; older reds remain red, no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T10:42:16.330Z

Merged 78e9760a844291b4f34b2f6c3fd75a320fcd1b29 onto dev.
