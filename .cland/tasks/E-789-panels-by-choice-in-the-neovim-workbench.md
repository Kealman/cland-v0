---
id: E-789
kind: epic
title: Panels by choice in the Neovim workbench
state: open
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: topic-774
branch: null
created: 2026-10-18T09:12:36.923Z
updated: 2026-10-20T20:52:43.799Z
---

## Summary

The human asked on 2026-10-18 (General, ask 03c2a877, answered 09:12Z) to let the human choose what each side panel of the Neovim workbench shows. Today the left panel is always Items and the right one switches among the other panels. Any panel should open on either side. Neovim only; the web keeps its own rail and split design.

## What to build

- Any workbench panel (Items, Sessions, Topics, Inbox, Events, Artifacts, Accounts, Verification and the rest that the right side hosts today) can be opened on the left or on the right, from the palette and by key.
- The chosen layout is remembered per human in the workbench's UI state and restored on the next start; the current layout stays the default.
- Panel keys, focus motions, widths and the dock keep working whichever side a panel is on; the same panel is never shown on both sides at once.

## Definition of done

- [ ] D1. Opening Sessions on the left and Items on the right from the palette works, and both keep their keys and live updates.
- [ ] D2. The layout survives a workbench restart, and a reset command restores the default.
- [ ] D3. Existing layout, width and focus tests stay green, and new headless-grid cases cover both sides.

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
