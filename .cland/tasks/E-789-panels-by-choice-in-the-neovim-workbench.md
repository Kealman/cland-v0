---
id: E-789
kind: epic
title: Panels by choice in the Neovim workbench
state: closed
criterion_seq: 3
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: topic-774
branch: null
created: 2026-10-18T09:12:36.923Z
updated: 2026-10-24T00:57:37.437Z
closed: 2026-10-20T21:23:09.093Z
---

## Summary

The human asked on 2026-10-18 (General, ask 03c2a877, answered 09:12Z) to let the human choose what each side panel of the Neovim workbench shows. Today the left panel is always Items and the right one switches among the other panels. Any panel should open on either side. Neovim only; the web keeps its own rail and split design.

## Goal

The human chooses what each side panel of the Neovim workbench shows: any panel opens on either side.

## What to build

- Any workbench panel (Items, Sessions, Topics, Inbox, Events, Artifacts, Accounts, Verification and the rest that the right side hosts today) can be opened on the left or on the right, from the palette and by key.
- The chosen layout is remembered per human in the workbench's UI state and restored on the next start; the current layout stays the default.
- Panel keys, focus motions, widths and the dock keep working whichever side a panel is on; the same panel is never shown on both sides at once.

## Definition of done

- [ ] C1. Opening Sessions on the left and Items on the right from the palette works, and both keep their keys and live updates.
  - verified: qa-676 [qa] · run qa-2026-10-20-3 · 2026-10-20T21:22:53.797Z · commit 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9
- [ ] C2. The layout survives a workbench restart, and a reset command restores the default.
  - verified: qa-676 [qa] · run qa-2026-10-20-3 · 2026-10-20T21:22:53.797Z · commit 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9
- [ ] C3. Existing layout, width and focus tests stay green, and new headless-grid cases cover both sides.
  - verified: qa-676 [qa] · run qa-2026-10-20-3 · 2026-10-20T21:22:53.797Z · commit 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9

## Plan

```yaml
stages:
  - name: panels on either side
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-999
        - T-1000
        - T-1001
        - T-1002
```

## Comments

### coord · 2026-10-20T16:54:38.443Z

Decided by the human, 2026-10-20 16:54Z (ask 310190bf option 1, A-7719): only the four existing panels (Items, Inbox, Sessions, Topics) become placeable; Events, Artifacts, Accounts and Verification panels go to Ideas. Model: each panel has a home side the human chooses, each side shows one of the panels assigned to it, and the panel keys stay toggles on the panel's side. Coordinator default: ui.json gains optional fields in version 2, landing before E-413 bullet 3.

### qa-676 · 2026-10-20T20:52:43.799Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-2
commit: 44097bad32444c7db96492ef15d182c819166f99
stage: panels on either side
stage_hash: 161eac59b90c4feea9f55636a2ad6cb5ede88cdcf8425c8fb29422b4ee6c16fc
findings: [{"severity":"low","text":"M4 initially failed twice with unrecorded session.attach frames under /tmp scratch TMPDIR. Coordinator confirmed /private/tmp alias canonicalization gap and filed the harness defect; authorized system-TMPDIR recheck passed 25/25. Both failures retained; no E-789 regression asserted.","file":"nvim/test/frame-fixtures.ts","line":25}]
finding_counts: {"high":0,"medium":0,"low":1}

| Check | Surface | Result | Evidence run / observation |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | qa-2026-10-20-1: clean detached build, four item merges, isolated HOME/XDG/Git, pinned Neovim |
| PANELS-005 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-006 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-007 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-008 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-009 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-010 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-011 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-012 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-013 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-014 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-015 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-016 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-017 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-018 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-019 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| PANELS-020 | headless-grid | PASS | qa-2026-10-20-1: recorder screen/state captures |
| M1 | hub-api | PASS | run 1, panel-placement-component.test.ts: 22/22 |
| M2 | hub-api | PASS | run 1, explorer-component.test.ts: 20/20 |
| M3 | hub-api | PASS | run 1, ui.test.ts: 10/10 including cold swapped-layout restart |
| M4 | hub-api | PASS | qa-2026-10-20-2, shell.test.ts: 25/25 with system TMPDIR; earlier two failures retained |
| M5 | hub-api | PASS | run 1, qa-shipped.test.ts: 30/30 |
| M6 | hub-api | PASS | run 1, shell-component.test.ts: 60/60 |
| M7 | static read | PASS | run 1, actions.audit() assertion at panel-placement-component.test.ts:204; exercised by M1 |
| M8 | static read | PASS | run 1, README keys/commands/preferences match placement, reset, side widths, dock and excluded CTRL-W moves |
| M9 | hub-api | PASS | run 1, npm run typecheck: exit 0, no errors/warnings |

Low finding — M4 / nvim/test/frame-fixtures.ts:25: fixture canonicalization recognizes /private/var aliases but not /private/tmp. Initial command `node --test nvim/test/shell.test.ts` under scratch TMPDIR /tmp/qa-e789-d532awk4/tmp failed (15 pass/10 fail), as did the authorized rerun restoring PATH/SHELL/TERM. The first exact failure was “Error: the screen never showed the attached terminal within 10000 ms”; the captured grid said “cannot attach coord-1: stub hub request session.attach: Error: unrecorded protocol frame: operation=frame request=sess…”. Both outputs remain under run 1 (M4-empty-env.txt and M4-recheck.txt). Coordinator confirmed the path-alias cause with a same-commit system-TMPDIR 25/25 run, classified it as a test-harness defect already filed under Bugs, and authorized one corrected M4 recheck (decision e43c9f20-3f3b-48f4-add6-b93da5d567e2). Our corrected recheck passed 25/25. No product/fixture code changed. The earlier failures are not counted as passing executions.

Stage: panels on either side. Tested full SHA: 44097bad32444c7db96492ef15d182c819166f99.
Final verdict run: qa-2026-10-20-2 (targeted M4 recheck); other 25 checks/cases reuse the retained same-SHA qa-2026-10-20-1 evidence, as authorized by the Coordinator's rerun-only direction. Every scoped check is now supported by a PASS. The original FAIL recorder line remains unchanged; run 2 contains the new M4 PASS.

Platform/executor: local Darwin arm64, Node v24.21.0, headless Neovim v0.12.5. Coverage: 16 recorder cases, 167 passing test executions across the prescribed T2/T3/T4 files, static reads and typechecking. Zero skips/cancellations in the final supporting test executions. This is targeted stage QA, not a full-suite or live-Mac performance claim. No GUI/browser or real harness process. Test subprocesses retain scratch HOME/XDG/Git and filtered credentials; the final M4 recheck restores actual PATH/SHELL/TERM and system TMPDIR. All files/cases ran serially after checking local:none; the Coordinator authorized local QA alongside the remote Linux cover. No stage/release suite was submitted by QA.

Supports D1 with PANELS-017/018 and M1 (both sides, keys and live updates); D2 with PANELS-019, M1/M3/M4 (persistence, cold restart, real :restart and reset); D3 with PANELS-005–016/020 and M2–M6 (existing layout/focus/width behavior and new swapped widths). Stage verdict only; no epic criterion marks.

Clean HEAD and dev matched before and after both execution passes. Scratch processes: zero; both scratch roots removed non-force. Full command/evidence mapping is in run 1 case-table.md and each run's case-records.jsonl. The initial cover discrepancy is separately filed as T-1029; covers remain outside this brief and no missing cover is claimed as passed.

Evidence A-8052: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8052-e-789-stage-qa-panels-on-either-side-corrected-m4-passes-at-44097bad/report.md

### hub · 2026-10-20T21:06:56.697Z

demo 31c16a22-42fb-418c-98f3-a41b7e4a9eba created: droplet cland-v0-31c16a22, commit 61a5f0392dca5760295535a6f4a8e60dec5d8aef, deadline 2026-10-20T22:20:37.515Z.

### hub · 2026-10-20T21:07:10.975Z

demo 31c16a22-42fb-418c-98f3-a41b7e4a9eba destroyed: lifetime 78317 ms; cost $0.0054.

### hub · 2026-10-20T21:08:37.706Z

demo 22a6a823-8b21-4a7a-93e5-34b7749ba52d created: droplet cland-v0-22a6a823, commit 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9, deadline 2026-10-20T22:22:16.567Z.

### hub · 2026-10-20T21:12:45.626Z

demo 22a6a823-8b21-4a7a-93e5-34b7749ba52d destroyed: lifetime 314666 ms; cost $0.0219.

### qa-676 · 2026-10-20T21:22:53.797Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-3
commit: 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Executor | Result | Evidence |
| --- | --- | --- | --- |
| S0 | local macOS arm64 | PASS | setup, source read or typecheck capture; S0.txt |
| PANELS-005 | Linux droplet | PASS | screen/state captures; persistent-panels.screen.txt, persistent-panels.state.json, PANELS-005.screen.txt, PANELS-005.state.json |
| PANELS-006 | Linux droplet | PASS | screen/state captures; panel-failures.screen.txt, panel-failures.state.json, PANELS-006.screen.txt, PANELS-006.state.json |
| PANELS-007 | Linux droplet | PASS | screen/state captures; palette-prefixes.screen.txt, palette-prefixes.state.json, PANELS-007.screen.txt, PANELS-007.state.json |
| PANELS-008 | Linux droplet | PASS | screen/state captures; palette-answer.screen.txt, palette-answer.state.json, PANELS-008.screen.txt, PANELS-008.state.json |
| PANELS-009 | Linux droplet | PASS | screen/state captures; session-groups.screen.txt, session-groups.state.json, PANELS-009.screen.txt, PANELS-009.state.json |
| PANELS-010 | Linux droplet | PASS | screen/state captures; approval-details.screen.txt, approval-details.state.json, idle-details.screen.txt, idle-details.state.json, PANELS-010.screen.txt, PANELS-010.state.json |
| PANELS-011 | Linux droplet | PASS | screen/state captures; status-board.screen.txt, status-board.state.json, PANELS-011.screen.txt, PANELS-011.state.json |
| PANELS-012 | Linux droplet | PASS | screen/state captures; in-work.screen.txt, in-work.state.json, current-done-and-needs-you.screen.txt, current-done-and-needs-you.state.json, PANELS-012.screen.txt, PANELS-012.state.json |
| PANELS-013 | Linux droplet | PASS | screen/state captures; vertical-board.screen.txt, vertical-board.state.json, shared-centre-board.screen.txt, shared-centre-board.state.json, PANELS-013.screen.txt, PANELS-013.state.json |
| PANELS-014 | Linux droplet | PASS | screen/state captures; container-scope.screen.txt, container-scope.state.json, PANELS-014.screen.txt, PANELS-014.state.json |
| PANELS-015 | Linux droplet | PASS | screen/state captures; aide-launch.screen.txt, aide-launch.state.json, PANELS-015.screen.txt, PANELS-015.state.json |
| PANELS-016 | Linux droplet | PASS | screen/state captures; aide-groups.screen.txt, aide-groups.state.json, PANELS-016.screen.txt, PANELS-016.state.json |
| PANELS-017 | Linux droplet | PASS | screen/state captures; panels-on-chosen-sides.screen.txt, panels-on-chosen-sides.state.json, PANELS-017.screen.txt, PANELS-017.state.json |
| PANELS-018 | Linux droplet | PASS | screen/state captures; moved-panels.screen.txt, moved-panels.state.json, PANELS-018.screen.txt, PANELS-018.state.json |
| PANELS-019 | Linux droplet | PASS | screen/state captures; remembered-panel-sides.screen.txt, remembered-panel-sides.state.json, PANELS-019.screen.txt, PANELS-019.state.json |
| PANELS-020 | Linux droplet | PASS | screen/state captures; swapped-panel-sizes.screen.txt, swapped-panel-sizes.state.json, PANELS-020.screen.txt, PANELS-020.state.json |
| M1 | Linux droplet | PASS | 22/22 tests; no skips; M1.txt |
| M2 | Linux droplet | PASS | 20/20 tests; no skips; M2.txt |
| M3 | Linux droplet | PASS | 10/10 tests; no skips; M3.txt |
| M4 | Linux droplet | PASS | 25/25 tests; no skips; M4.txt |
| M5 | Linux droplet | PASS | 30/30 tests; no skips; M5.txt |
| M6 | Linux droplet | PASS | 60/60 tests; no skips; M6.txt |
| M7 | local macOS arm64 | PASS | setup, source read or typecheck capture; M7.txt |
| M8 | local macOS arm64 | PASS | setup, source read or typecheck capture; M8.txt |
| M9 | local macOS arm64 | PASS | setup, source read or typecheck capture; M9.txt |

Findings: none in this fresh pass.

Epic DoD run: qa-2026-10-20-3. Tested SHA: 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9. Brief: qa/briefs/E-789-stage-1.md, explicitly reused for the epic DoD by request 57d988ec-2f71-4ca9-b57e-59ce18a5230c. No stage field belongs in this verdict. D1–D3 were normalized to stable C1–C3 with identical text (decision 8b96b77d-2708-4f25-9b75-56c60953c522).

All 26 brief checks passed: 16 direct recorder grid cases, 167 targeted test executions across T2/T3/T4, static source/docs reads, and typechecking. Every named targeted file ran; no skipped or cancelled tests. This evidence is actual fresh execution, not reuse of the earlier stage artifact or a timing projection. Assertions enforced their expected behavior; no duration-budget claim is made from targeted runtimes. Typecheck reported zero warnings/errors.

Criteria mapping:
- C1: PANELS-017/018 and M1 establish placement on either side, keys and live row changes.
- C2: PANELS-019 and M1/M3/M4 establish saved homes, cold restart, real :restart terminal reattachment and reset behavior.
- C3: PANELS-005–016/020 and M2–M6 establish existing layout/width/focus behavior plus both-side coverage.

The detached local checkout and delivered Linux tree were clean at the tested SHA. Both use Node 24.21.0 and pinned Neovim 0.12.5. Behavior ran on dedicated Linux x86_64 demo lease 22a6a823-8b21-4a7a-93e5-34b7749ba52d, deadline 2026-10-20T22:22:16.567Z; confirmed released, lifetime 314666 ms, cost $0.02185181. Local setup/static/typecheck used scratch HOME/XDG/Git and fixtureEnvironment's post-overlay credential filter, preserving system TMPDIR/PATH/SHELL/TERM. Remote manual checks used the same filter with scratch HOME/XDG/Git; the grid runner creates its own isolated fixture environment. No real browser or harness ran. Manual files and grid cases ran serially.

The obsolete 61a5f039 lease 31c16a22-42fb-418c-98f3-a41b7e4a9eba was released before any cases ran: 78317 ms, $0.00543868. Total demo lease cost including that retargeting overhead: $0.02729049. This is separate from occasion suite cost.

Freshness current=true after all cases. No Neovim process remained on the demo machine; lease destruction confirmed released. Local scratch process count zero; scratch root removed non-force. Source code and fixtures were not edited. All record lines and captures were checked for existence. Prior-stage /private/tmp failures remain historical in A-8052 and are not reused or counted here.

Integrated epic suite f65b0531-6a44-44ae-bd10-653777b3fbac completed at the same full SHA; canonical verification tree 206e30b31faebe9de3a88b1df81fb24918d41d68. Hub result suite:f65b0531-6a44-44ae-bd10-653777b3fbac arrived 2026-10-20 21:21:21Z: mode full, occasion epic, exit 0; 3420 tests, 3412 pass, 0 fail, 0 cancelled, 8 skipped. Completed T1–T4; T4 repetitions skipped by policy, 10 T4 files ran in the base phase. This is an actual two-shard Linux x64 6.8.0-142-generic run, Node 24.21.0 / Neovim 0.12.5, two workers per shard. No cache reuse is claimed.

| Receipt | Machine | Duration (admission through remote finish) | Collection | Lifetime | Cost |
| --- | --- | --- | --- | --- | --- |
| A-8080, shard-1 | cland-v0-c1158f46, c-8 lon1 | 894.58 s | 21.70 s | 885 s | $0.0614 |
| A-8081, shard-2 | cland-v0-8c0d0783, c-8 lon1 | 817.58 s | 20.96 s | 806 s | $0.0560 |

Merged log A-8079: actual overall wall from admission through final collection 916.50 s; total suite cost $0.1174 (hub-rounded amounts). Coverage map A-8082. Total suite plus both demo leases approximately $0.14469049, using the rounded suite cost. Parallel runtimes are not summed into wall time.

The eight suite skips are retained in suite-skips.json; none is a scoped E-789 brief check. They cover the macOS sleep inhibitor (generic skip reason), five macOS sandbox-exec checks, and two unavailable real-OpenCode checks. They are not counted as passes. All 167 targeted E-789 test executions ran without a skip.

Report-only observations, not enforcing failures or performance passes: test lint 131 findings in 59 files; T3 projected wall 1066.968 s against 900 s (a projection, not measured wall); suite-selection's remote-fixture T4 self-test 17.345 s against 10 s; T3 ratchet 2133.149 s against base 2133.149 s. Existing legacy budget allowances remain owned by E-880. These general-suite diagnostics are outside E-789's panel-placement criteria. Actual suite wall is the separately measured 916.50 s above.

No new E-789 defect found. C1, C2 and C3 are established by the fresh scoped cases and the completed integrated receipt. Final released-lease freshness check again returned current=true. Detached worktree removed after clean status; scratch cleanup receipt retained. QA clear, run qa-2026-10-20-3; criterion marks C1,C2,C3 verified. This is the epic DoD verdict, not a stage verdict.

Execution captures were first published as A-8074 while the suite was pending. This final report supersedes only that report's pending status; no case was rerun or rewritten.

Suite artifact paths:
- /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8079-suite-f65b0531-6a44-44ae-bd10-653777b3fbac-all-at-2b8b3f3.log
- /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8080-suite-f65b0531-6a44-44ae-bd10-653777b3fbac-shard-1-at-2b8b3f3.log
- /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8081-suite-f65b0531-6a44-44ae-bd10-653777b3fbac-shard-2-at-2b8b3f3.log
- /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8082-coverage-map-f65b0531-6a44-44ae-bd10-653777b3fbac-at-2b8b3f3196ad42b9bcc9b702b6d.json

Final evidence A-8083: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8083-e-789-epic-dod-at-2b8b3f31-all-scoped-checks-pass-and-epic-suite-green/report.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T21:23:09.093Z

Closed on QA clear qa-2026-10-20-3 at 2b8b3f31 (C1-C3 verified, A-8083) and epic suite f65b0531 green (3412 pass, A-8079); stage 'panels on either side' closed on covers 918b2a95/53af0d11 and QA qa-2026-10-20-2. Delivered: T-999 (any of the four panels on either side), T-1000 (gm move key, openers follow the panel's side), T-1001 (layout survives restarts; reset restores sides and widths), T-1002 (widths, Topics dock, explorer card on either side). Decisions: the human's four panels with a home side each; Coordinator defaults for keys, reset and dock (comments on E-789).
