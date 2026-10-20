---
id: T-1007
kind: task
title: The Neovim explorer loads item summaries, open items first
state: open
status: ready
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
updated: 2026-10-20T18:14:16.443Z
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
  - verified: rev-26 [reviewer] · run rev-20261020-1007-final-2 · 2026-10-20T17:51:16.890Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-final-2 · 2026-10-20T18:14:13.290Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
- [x] C2. On start the explorer requests open items only, and closed items are requested when the human expands the closed group or searches (test on recorded frames).
  - done: impl-1007 · 2026-10-20T18:05:48.209Z
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-final-2 · 2026-10-20T18:14:13.290Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
- [x] C3. Opening an item's card reads its body with `task.view` and renders it (test).
  - done: impl-1007 · 2026-10-20T17:24:36.312Z
  - verified: rev-26 [reviewer] · run rev-20261020-1007-final-2 · 2026-10-20T17:51:16.890Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-final-2 · 2026-10-20T18:14:13.290Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
- [x] C4. `task.list` without the projection answers as today, and the CLI's `task list --json` output is unchanged (test).
  - done: impl-1007 · 2026-10-20T17:18:27.625Z
  - verified: rev-26 [reviewer] · run rev-20261020-1007-final-2 · 2026-10-20T17:51:16.890Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-final-2 · 2026-10-20T18:14:13.290Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
- [x] C5. The projection's bytes and compose time on a copy of the live tracker are posted in the item topic (local evidence).
  - done: impl-1007 · 2026-10-20T17:18:28.165Z
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-3 · 2026-10-20T17:29:57.397Z · commit bb35e1b0a0dae4e1618b6daf51b789bbd6c2e50a
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-4 · 2026-10-20T17:42:58.526Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-26 [reviewer] · run rev-20261020-1007-final-2 · 2026-10-20T17:51:16.890Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-source · 2026-10-20T17:55:04.662Z · commit e760ca6b0c3e8848ff37fca6c7603b61dc83c82c
  - verified: rev-31 [reviewer] · run rev-20261020-1007-carrier-source · 2026-10-20T18:06:23.227Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-final-2 · 2026-10-20T18:14:13.290Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
- [x] C6. `hub/README.md` documents the projection, and `nvim/README.md` documents lazy loading of closed items.
  - done: impl-1007 · 2026-10-20T17:18:28.791Z
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-3 · 2026-10-20T17:29:57.398Z · commit bb35e1b0a0dae4e1618b6daf51b789bbd6c2e50a
  - verified: rev-26 [reviewer] · run rev-20261020-1007-source-4 · 2026-10-20T17:42:58.526Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-26 [reviewer] · run rev-20261020-1007-final-2 · 2026-10-20T17:51:16.890Z · commit 9370939d0e9dcbbd243ee8cb86359c518bf5218b
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-source · 2026-10-20T17:55:04.662Z · commit e760ca6b0c3e8848ff37fca6c7603b61dc83c82c
  - verified: rev-31 [reviewer] · run rev-20261020-1007-carrier-source · 2026-10-20T18:06:23.227Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e
  - verified: rev-31 [reviewer] · run rev-20261020-1007-integration-final-2 · 2026-10-20T18:14:13.290Z · commit 94b59069597edd6e967b98a90ad6c4775ab3bf4e

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

### rev-26 · 2026-10-20T17:51:16.890Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1007-final-2
commit: 9370939d0e9dcbbd243ee8cb86359c518bf5218b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. A-7850/run8e5b4b9e audited at exact reviewed unchanged9370939d:2067 ordinary passes, no failure/cancel/skip, plus25 passing load records across five new identities (all5/5). New T1 fixture2.664503094s ordinary/max2.718882284s repetition fits exact4s reviewed allowance. Payload open42303/all423905bytes; open below60KB. Open-first/closed expansion/search/task.view rendering, held-snapshot reopen and historical-round regressions all pass5/5. Default CLI JSON equality case passes0.320548503s. C1–C4 established; qualified copied-tracker C5 and matching-docs C6 source evidence retained. All criteria verified. Audit A-7851.

Linux x64 c-8 lon1 droplet,two workers,Node24.21/Neovim0.12.5; T1exit0(command55s/package51.85s) and fallback allT2 across both packages exit0(command261s/package257.91s). Finished exit0; actual execution, no cache/projection claim. Host check output/refac946b46 not repeated remotely; budgets/lint/ratchet report-only. T3/T4 not executed, deferred periodic/integrated. Lifetime394s/cost$0.0274. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-31 · 2026-10-20T17:55:04.662Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-1007-integration-source
commit: e760ca6b0c3e8848ff37fca6c7603b61dc83c82c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7861: authorized integration delta source clear. Both prior summary test bodies and dev's recovery/watcher cases retained; projection/index/request and Neovim lazy-loading/card source unchanged. T-1008 settling and matching T-1017/T-973 wire changes coexist; matching docs retained. A-7854–A-7856 exact-head local macOS tracker9/9, explorer19/19 and card15/15 ordinary replay receipts audited. A-7853 typecheck stdout lacks its own command/head/exit header; original attribution requested, no rerun. C5 qualified original copied-tracker measurements retained with original attribution; C6 source refreshed. C1–C4 and final settlement await mode-free verification at this head. A-7850 is old9370939d evidence only. No findings or merge enqueue.

Criteria: C5 verified, C6 verified.

### rev-31 · 2026-10-20T18:03:15.347Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-1007-integration-final-1
commit: e760ca6b0c3e8848ff37fca6c7603b61dc83c82c
scope: evidence
findings: [{"severity":"medium","text":"Integrated reconnect carrier presses zR after its task event, which now legitimately requests closed summaries, then asserts task.list remains1; A-7869 observes2. Separate the explicit archive-fetch boundary from the retained event-only no-read assertion and obtain a new reviewed-head green gate.","file":"nvim/test/shell-component.test.ts","line":1576}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7870 audits failed exact-head A-7869/fb65dad6:2086ordinarypass/1fail plus25passing repetitions; host/T1exit0, fallbackT2exit1. Failure actual task.list2 vs expected1 at shell-component1578; source maps zR to fold_all(true)→load_closed_items, so this is a deterministic task-owned integration carrier mismatch, not evidence of an automatic refresh regression or timing noise. Keep startup/reconnect/fake-idle/rendered-row and event-only no-read assertions while separating deliberate human loading. Five new identities pass5/5; fixture2.683s within exact4s allowance. C5/C6 source evidence retained; no final clear or T3/T4 claim. A-7862 closes original typecheck provenance gap. Changed head requires fresh source review.

Criteria: C2 failed (Integrated mode-free gate fails the reconnect/settling carrier: zR deliberately fetches closed summaries but its following assertion still expects no additional task.list.).

### rev-31 · 2026-10-20T18:06:23.227Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-1007-carrier-source
commit: 94b59069597edd6e967b98a90ad6c4775ab3bf4e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7878 corrective source clear. Only reconnect carrier changes: explicit zR closed fetch now has bounded installed-state receipt, exactly one extra list and exact open/closed summary frames before task event; rendered-row/event-no-read assertion and initial startup/ten-fake-minute checks retained, plus ten more fake idle minutes. No runtime/fixture/tier/allowance changes; prior medium finding resolved. A-7876 exact-head local typecheck exit0; A-7877 whole shell60/60 ordinary replay exit0, correctedcase0.372s, no recorder. C5 qualified original measurement and C6unchangeddocs refreshed; C1–C4/final require replacement mode-free gate at this head. A-7869 remains failed oldhead evidence. No findings or Reviewer tests.

Criteria: C5 verified, C6 verified.

### rev-31 · 2026-10-20T18:14:13.290Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-1007-integration-final-2
commit: 94b59069597edd6e967b98a90ad6c4775ab3bf4e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7888 final evidence clear at unchanged 94b59069. A-7886 exact-head replacement ffca1b45 has 2087 ordinary passes plus 25 passing repetitions, host check/T1/full fallback T2 including Neovim exit 0. All five new identities have distinct actual 5/5 receipts. Corrected reconnect carrier passes 0.595936790 s, preserving independent human-demand receipt, event no-read and both fake-idle assertions; prior failure resolved. Summary ordinary 2.548 s/repeat max 2.490 s fits unchanged 4 s exact allowance; open payload 42303 bytes. C1–C6 checked across source and qualified evidence; all claimant done marks present. Report-only duration regressions/missing baseline/lint/ratchet retain their stated limits; original C5 measurements retain original attribution. No T3/T4, integrated or real-ten-minute claim, no remaining findings or merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
