---
id: T-1581
kind: task
title: init-config test pins this repository's merge batch tiers to T1 after the T1–T3 change
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-1302
branch: t/T-1581-init-config-test-pins-this-repository-s
created: 2026-11-01T09:12:24.790Z
updated: 2026-11-01T14:43:30.493Z
closed: 2026-11-01T14:43:30.493Z
---

## Summary

Coordinator's config commit e818d2dc (human decision 2026-11-01 09:01Z, ask 31d43750) set this repository's `merge.batch_tiers` to `["T1", "T2", "T3"]`, but `hub/test/init-config.test.ts` still pins the repository value to `['T1']` at line 177. Dev has been red on that T1 test since e818d2dc, and it dropped T-1549's batch fc38a65a (A-15268: actual `['T1','T2','T3']`, expected `['T1']`). Fix forward within the rule-6 hour.

## Acceptance criteria

- [x] C1. `hub/test/init-config.test.ts` › "this repository enables the merge batch queue while new projects keep it off" expects the repository's `merge.batchTiers` to be `['T1', 'T2', 'T3']`, and the new-project default assertions stay unchanged (test).
  - done: impl-1581 · 2026-11-01T09:13:11.447Z
  - verified: rev-35 [reviewer] · run rev-35-1581-source-1 · 2026-11-01T09:13:41.835Z · commit 4091d481470caf643241b35c6363a5c34152a40f
  - verified: rev-35 [reviewer] · run rev-35-1581-final-1 · 2026-11-01T09:20:07.514Z · commit 4091d481470caf643241b35c6363a5c34152a40f
- [x] C2. The file passes alone at the head, and a search of hub/test and nvim/test for other assertions on this repository's `batch_tiers` / `batchTiers` finds no other stale pin, or updates it.
  - done: impl-1581 · 2026-11-01T09:13:11.927Z
  - verified: rev-35 [reviewer] · run rev-35-1581-final-1 · 2026-11-01T09:20:07.514Z · commit 4091d481470caf643241b35c6363a5c34152a40f

## Comments

### impl-1581 · 2026-11-01T09:13:12.003Z

Reproduced original red: init-config.test.ts:177 actual ['T1','T2','T3'], expected ['T1']; 16/17 passed. Changed only repository assertion to ['T1','T2','T3']; standalone file now 17/17, npm run typecheck exit 0 (macOS, Node v24.21.0). Searched all hub/test and nvim/test for batch_tiers|batchTiers: other matches are fixture-specific tiers, generic defaults, or usage text, not repository pins. No .cland/config.toml change. Source-only fix, no behaviour/default contract change. origin/dev fetched and merged before source review.

### rev-35 · 2026-11-01T09:13:41.835Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1581-source-1
commit: 4091d481470caf643241b35c6363a5c34152a40f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards/Spec no findings. Sole repository expectation now T1,T2,T3, matching reviewed .cland/config.toml; new-project queue/default tier assertions unchanged, no config/production change. All batch_tiers/batchTiers hub/test+nvim/test consumers inspected; remaining pins are explicit fixtures/defaults/report text, no other stale repository expectation. C1 source verified; C2 awaits same-head queued evidence and targeted17 named outcomes. A-15271 source artifact. No Reviewer execution; QA none.

Criteria: C1 verified.

### rev-35 · 2026-11-01T09:20:07.514Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1581-final-1
commit: 4091d481470caf643241b35c6363a5c34152a40f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. Same-headA-15275/0aa50ff1 exit0,1298pass,zero fail/cancel/skip/todo. All17 init-config actual named outcomes pass, including repository tier pin and unchanged generic defaults; standalone17/17 also recorded by lead. C2 search established in sourceA-15271, no stale other pins. T0/T1/Web smoke complete; selected T2 command had no selected test cases, T3/T4/full integrated unexecuted. Linux x64 droplet Node24.21.0,Neovim0.12.5,isolated Headless Shell1248/Chrome Testing156.0.8078.4; report-only advisories,no cache/skips. C1/C2 verified. No Reviewer execution; QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-01T14:43:30.493Z

Merged 701d849045bae678e1e8cbada7bca567f6734f69 onto dev.
