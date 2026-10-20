---
id: T-1007
kind: task
title: The Neovim explorer loads item summaries, open items first
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-755
branch: t/T-1007-the-neovim-explorer-loads-item-summaries
created: 2026-10-20T17:01:23.939Z
updated: 2026-10-20T17:42:58.526Z
---

## Summary

The Neovim explorer loads item summaries without bodies: open items first, closed items when the human asks for them. Today a single `task.list` sends all 1,005 items with their full bodies (1.8 MB), and the hub and Neovim both choke on it.

## What to build

- `task.list` gets a summary projection: id, kind, title, state, status, size, labels, parent, blockers, claim, the latest verdict of each kind, and criteria counts. No body, no comments, no verdict history.
- The projection takes a state filter. The explorer asks for open items first, and fetches closed items only when the human expands a closed group or searches for them.
- Opening an item's card reads its body through `task.view`.
- A `task.list` without the projection answers as it does today, so the CLI and `--json` users keep working.
- Measure the projection's bytes on a copy of the live tracker and post the figure in the item topic.

## Acceptance criteria

- [x] C1. The summary projection returns no body, comments, verdict history, plans or verification, and on a 1,000-item fixture tracker with 100 open items the open-only first payload stays under 60 KB, with the all-items projection bytes recorded in the test output (test).
  - done: impl-1007 · 2026-10-20T17:42:15.626Z
- [x] C2. On start the explorer requests open items only, and closed items are requested when the human expands the closed group or searches (test on recorded frames).
  - done: impl-1007 · 2026-10-20T17:24:35.687Z
- [x] C3. Opening an item's card reads its body with `task.view` and renders it (test).
  - done: impl-1007 · 2026-10-20T17:24:36.312Z
- [x] C4. `task.list` without the projection answers as today, and the CLI's `task list --json` output is unchanged (test).
  - done: impl-1007 · 2026-10-20T17:18:27.625Z
- [x] C5. The projection's bytes and compose time on a copy of the live tracker are posted in the item topic (local evidence).
  - done: impl-1007 · 2026-10-20T17:18:28.165Z
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-3 · 2026-10-20T17:29:57.397Z · commit bb35e1b0a0dae4e1618b6daf51b789bbd6c2e50a
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-4 · 2026-10-20T17:42:58.526Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
- [x] C6. `hub/README.md` documents the projection, and `nvim/README.md` documents lazy loading of closed items.
  - done: impl-1007 · 2026-10-20T17:18:28.791Z
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-3 · 2026-10-20T17:29:57.398Z · commit bb35e1b0a0dae4e1618b6daf51b789bbd6c2e50a
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-4 · 2026-10-20T17:42:58.526Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b

## Comments

### impl-1007 · 2026-10-20T17:10:38.540Z

Implementation progress: summary/open snapshot, demand-loaded closed summaries and task.view-backed card details are implemented; default request path is unchanged. T1 request/list test and new T2 recorded-frame scenarios are in place. Copied-live-tracker probe (1,011 items, macOS arm64/local): initial 112 open summaries 40,618 bytes, 16.418 ms median compose+serialize; all summaries 538,202 bytes/105.776 ms; default 1,459,822 bytes/118.859 ms. Probe excludes socket/visibility and is not a startup/suite pass. Full evidence artifact posted in item topic.

### rev-26 · 2026-10-20T17:21:55.010Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-1007-source-1
commit: 2a3af4c83556bf1848e8e8dafc46d8c5d9ead1c3
scope: full
findings: [{"severity":"medium","text":"Closed snapshot merge appends a stale closed row after a globally applied reopening event retained its open row; journal replay updates only the first duplicate and explorer by-id can still select the stale closed row. Merge by canonical identity and test held closed snapshot plus reopening event.","file":"nvim/lua/cland/init.lua","line":217},{"severity":"medium","text":"Criterion round_of uses latest-only summary verdicts overlaid on task.view detail, so marks from an earlier review run display r— although full history is available. Resolve historical rounds from detail and test compact latest summary plus earlier marked run.","file":"nvim/lua/cland/explorer_card.lua","line":185}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear. A-7782 records separate Standards/Spec audit against fixed 30fde40c base. Two medium Spec findings: closed-list snapshot installation duplicates an item reopened during the request under Client:snapshot's actual global-plus-journal contract, and detailed card criteria use compact summary verdicts to resolve historical runs. Preserve default CLI shape, payload bound and blocker events while correcting both boundaries with recorded component regressions. No independent Standards finding. Existing C1 projection test, C4 CLI JSON equality, C5 qualified copied-tracker measurements and C6 matching docs were inspected, but no verification marks settled on this failed source pass. A-7774 is a local targeted summary; retained original outputs requested without transcription reruns. T-1008's separate refresh loop remains outside scope. No Reviewer tests, edits or reproduction claims.

Criteria: C2 failed (Closed snapshot replay can leave duplicate open/closed rows for an item reopened while the snapshot is pending.), C3 failed (Task-view-backed cards lose historical criterion verdict rounds because latest-only summary verdicts overwrite detailed history.).

### rev-26 · 2026-10-20T17:27:10.391Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-1007-source-2
commit: f9f0e4669c1e72d978dc46d242dbc57ff4ccff6d
scope: delta
findings: [{"severity":"medium","text":"The new thousand-item summary T1 case takes 753.0175 ms in retained A-7790, above the documented 0.5 s T1 limit, with no exact allowance in durations.json. Reduce setup cost while preserving fixture/assertions or add a valid measured reasoned dated allowance.","file":"hub/test/tracker-summary.test.ts","line":45}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrective source review not clear at f9f0e466; A-7805 records the delta. Prior M1 snapshot duplication and M2 historical-round bugs are resolved by canonical identity merge before replay and detail-history lookup; their new regressions retain assertions. One new Standards finding comes from newly retained raw A-7790: the thousand-item T1 case is 753.0175 ms with no matching allowance. The test/production implementation is unchanged at this head; docs require applying the 0.5 s tier rule despite report-only diagnostics. Reduce cost without shrinking 1000/100 fixture or 60 KB/field exclusions, or use a valid reasoned dated allowance. No remaining Spec logic finding. A-7798 has complete 19/19 and15/15 output but also 'Recorded 5439 Neovim protocol frames'; original command/tree attribution requested before claiming ordinary replay. A-7790 copied-tracker bytes/timing remain qualified original-head evidence, not startup proof. C1 failed for test budget; C2/C3 done restored and source fixes accepted. No task verification started, Reviewer tests or edits.

Criteria: C1 failed (Required new T1 projection fixture test exceeds the 0.5 s tier budget (753.0175 ms) without an exact allowance.).

### rev-26 · 2026-10-20T17:29:57.398Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1007-source-3
commit: bb35e1b0a0dae4e1618b6daf51b789bbd6c2e50a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at bb35e1b0. A-7812 records the allowance-only delta and resolved prior findings. Exact new T1 identity receives a 1.2 s reasoned allowance citing observed0.7530175s/required1000-file SQLite fixture, open authoritative E-880 owner, added2026-10-20/expires2026-10-27, no legacy/baseline/global changes; A-7808 lint and read-only diff check pass. M1 canonical snapshot coalescing and M2 detailed historical-round lookup remain resolved. A-7806 correctly distinguishes A-7798 recording generation from separate actual f9f0e466 ordinary replay A-7801/A-7802 (19/19,15/15,local macOS). Runtime source/tests unchanged by this head; no independent bb35 gate claim. C5 actual original-head copied-tracker output A-7790 remains valid production-equivalent evidence:112/1011open,43136bytes/20.724ms median compose+JSON, excludes transport/rendering/startup. C6 matching docs inspected; verify C5/C6. C1–C4 and final execution settlement await mode-free exact-head verification. All claimant done marks restored; no remaining Standards or Spec findings, no Reviewer execution/edits.

Criteria: C5 verified, C6 verified.

### rev-26 · 2026-10-20T17:41:10.603Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-1007-final-1
commit: bb35e1b0a0dae4e1618b6daf51b789bbd6c2e50a
scope: evidence
findings: [{"severity":"medium","text":"New T1 1,000-item fixture takes 3.021263533 s on Linux; all five repetitions take 2.740891301–2.948392162 s, exceeding the reviewed 1.2 s allowance. Report-only exit 0 does not satisfy the documented reviewer budget rule.","file":"hub/test/tracker-summary.test.ts","line":45}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium — hub/test/tracker-summary.test.ts:45: A-7831 records `3.021 s > 0.5 s (T1)` and `1.2 s → 3.021 s`; 5/5 repetitions also exceed 1.2 s. Reduce fixture cost while preserving C1, or provide a policy-compliant measured allowance/rationale for fresh source review. No unchanged rerun requested.

A-7831 at this exact head is functionally green: Linux x64 droplet c-8 lon1, two workers, T1 and fallback all T2 in both packages, 2,067 ordinary passes plus 25 passing load repetitions, exit 0. Open payload 42,303 bytes; all-summary diagnostic 423,905 bytes. Lazy closed/reopen/detail and historical-round tests each pass 5/5. Budgets/lint/ratchet report-only; T3/T4 not executed. Host check reference is not a repeated same-head droplet T0 receipt. Existing source C5/C6 evidence is retained. Full audit: A-7834, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7834-t-1007-final-not-clear-at-bb35e1b0-linux-fixture-exceeds-reviewed-allowance.md.

Criteria: C1 failed (Functional payload assertion passes, but its new T1 fixture exceeds the exact 1.2 s duration allowance in the same-head Linux receipt and all five repetitions.).

### rev-26 · 2026-10-20T17:42:58.526Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1007-source-4
commit: 9370939d0e9dcbbd243ee8cb86359c518bf5218b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-7838 records separate Standards/Spec audit of the complete allowance-only delta from bb35e1b0. Exact new T1 fixture allowance is now 4 s, with actual A-7831 Linux peak 3.021263533 s and five passing repetitions 2.741–2.948 s, bounded headroom and required 1000/100 fixture rationale. E-880 owner and 2026-10-20/2026-10-27 dates unchanged; no baseline/tier/global-budget, runtime, fixture or assertion changes. A-7837 manifest lint and independent read-only diff check are clean. Prior allowance finding resolved; old-head overage remains accurately recorded.

C5 qualified copied-tracker measurements and C6 matching docs carry forward unchanged; verified at this head. C1–C4 and final verdict await mode-free exact-head verification. A-7831 remains bb35e1b0 evidence, not a 9370939d pass: Linux x64 droplet T1/all-T2, 2067 ordinary passes plus five 5/5 groups, report-only diagnostics; T3/T4 not executed. No remaining Standards/Spec findings or Reviewer test execution.

Criteria: C5 verified, C6 verified.
