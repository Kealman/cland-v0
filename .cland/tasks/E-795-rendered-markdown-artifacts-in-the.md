---
id: E-795
kind: epic
title: Rendered Markdown artifacts in the Neovim workbench
state: closed
criterion_seq: 3
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: topic-782
branch: null
created: 2026-10-18T10:14:36.459Z
updated: 2026-10-24T00:57:29.552Z
closed: 2026-10-21T10:05:11.523Z
---

## Summary

The human, 2026-10-18 10:14Z in General: an opened artifact shows raw Markdown and is hard to read, so artifacts should render properly in v0.2. Today `nvim/lua/cland/artifacts.lua` only sets `filetype = markdown`, so syntax colours apply but every `#`, `**`, backtick and bracket stays visible. Thread messages already render through `thread_md.lua` (T-133): concealed heading markers, code chips and bands, bullets as `•`, link styling and quotes. The web workbench (E-418, spec v0.2 §3) renders artifacts on its own.

## Goal

An opened Markdown artifact in the Neovim workbench reads rendered, as thread messages do, with its raw source one key away.

## Definition of done

- [ ] C1. A Markdown artifact opened in the workbench renders like a thread message (headings, emphasis, inline and fenced code, lists, links, quotes, tables readable), with a key that toggles the raw source.
  - verified: qa-676 [qa] · run qa-2026-10-21-2 · 2026-10-21T10:04:52.949Z · commit 13ee21c235886618b4ea5f082414377264618ad8
- [ ] C2. Long artifacts open and scroll without a visible delay. Rendering is cached per artifact version and never blocks the UI.
  - verified: qa-676 [qa] · run qa-2026-10-21-2 · 2026-10-21T10:04:52.949Z · commit 13ee21c235886618b4ea5f082414377264618ad8
- [ ] C3. Headless-grid cases cover a rendered artifact and the raw toggle.
  - verified: qa-676 [qa] · run qa-2026-10-21-2 · 2026-10-21T10:04:52.949Z · commit 13ee21c235886618b4ea5f082414377264618ad8

## Plan

```yaml
stages:
  - name: rendered artifacts
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-796
        - T-1003
        - T-1004
        - T-1005
```

## Comments

### coord · 2026-10-20T16:54:38.548Z

Decided by the human, 2026-10-20 16:54Z (ask 310190bf option 1, A-7719): a Markdown artifact opens as a read-only rendered view built from the thread's projection (tables laid out, link tails compacted), with a toggle to the raw editable buffer. T-796 is amended to match before it is claimed.

### qa-676 · 2026-10-21T09:42:19.436Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-1
commit: 479178b25c78ccbb54f908ef7cc7c05c18426cd0
stage: rendered artifacts
stage_hash: a10784604912747aa783e2175e7822bff0627a79883515c081831382945952e5
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Surface | Result | Evidence / observation |
| --- | --- | --- | --- |
| S0 | local CLI | PASS | Clean detached HEAD/dev 479178b25c78ccbb54f908ef7cc7c05c18426cd0; all four stage merges and both grid cases present; pinned Neovim matches. |
| ARTIFACT-001 | headless-grid | PASS | Rendered read-only heading/emphasis/code/list/quote/link/table view; exact editable raw source and toggle back. Screens and state retained. |
| ARTIFACT-002 | headless-grid | PASS | Folder child and palette split render; independent centre/split toggle. Screens and state retained. |
| M1 | targeted Neovim tests | PASS | 3/3: rendered/raw, 120/80-column tables, source-position preservation. |
| M2 | targeted Neovim tests | PASS | 3/3: 2,000-line bounded first paint, version-key cache, modified-buffer preservation. |
| M3 | targeted Neovim tests | PASS | 2/2: 20,000-line yields to keys and obeys work caps; whole-document context and superseded-slice discard. |
| M4 | targeted Neovim tests | PASS | 3/3: event/raw-save refresh, restart rendered default, moved-path rebinding. |
| M5 | targeted Neovim tests | PASS | 2/2: independent palette split, folder entry/children opening and exact raw toggles. |
| M6 | targeted Neovim tests | PASS | 1/1: prompt drafts stay raw and send exact bytes/attachment flag. |
| M7 | targeted Neovim file | PASS | 12/12 at this build (brief allows updated file count); Mermaid/HTML and existing artifact behaviors retained. |
| M8 | targeted Neovim file | PASS | Thread rendering oracle 23/23. |
| M9 | shipped-case runner | PASS | 31/31 shipped cases, including both ARTIFACT cases, through the headless QA runner. |
| M10 | docs read | PASS | nvim/README.md:507 documents rendered default, raw editable :w, focused-window toggle, folder/split behavior and exceptions. |
| M11 | CLI typecheck | PASS | Root typecheck exit 0; no warnings/errors. |

Findings: none.

Run qa-2026-10-21-1, stage “rendered artifacts”, full tested SHA 479178b25c78ccbb54f908ef7cc7c05c18426cd0. All 14 scoped checks passed: two direct grid cases and 80 targeted test executions, zero failures/cancellations/skips/todo. Actual executor local macOS arm64, Node v24.21.0, Neovim v0.12.5. All files serial, local queue empty before each; scratch HOME/XDG/Git and shared credential filter applied, system TMPDIR preserved. No GUI, real browser or harness launch.

M2 deterministic first-paint evidence: 46/2000 rows parsed initially. M3 deterministic limits: max work 256, rows 128, marks 256; 2950 slices; cached reopen and key yield passed. Diagnostic timing (first grid 11.79 ms for 2,000 lines; first 14.824 ms and maximum slice 13.607 ms for 20,000 lines) is observational, not this verdict's criterion or a hardware-median claim. No full suite was run by QA, and no timing projection was treated as an actual wall measurement.

All four merges verified: T-796 8ef8ff4d, T-1003 ea8b43af, T-1004 e58f0c45, T-1005 d8a7781c. Stage cover in task.view is complete at tree d026d0a84f0b25de15257e303002111bc247cbf1: Coordinator Linux 6773233c/A-8207 and macOS baaf13ec/A-8211; these covers and report-only budgets are outside the brief.

Final HEAD/dev unchanged and worktree clean. Own scratch/worktree process scan 0, scratch and detached worktree removed. Fourteen recorder rows, exact commands/output and grid/state captures retained. No epic criterion marks: C1–C3 mapping is evidence for a separate epic DoD run, not verification by this stage verdict.

Durable artifact A-8222: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8222-e-795-rendered-artifacts-stage-14-checks-pass-at-479178b2/report.md

### qa-676 · 2026-10-21T10:04:52.949Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-2
commit: 13ee21c235886618b4ea5f082414377264618ad8
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
| --- | --- | --- |
| C1 | PASS | A-8222 ARTIFACT-001/002, M1/M4/M5/M6/M7/M8/M10: rendered Markdown including tables and exact raw toggle, all openers, focused split and version refresh. |
| C2 | PASS | A-8222 M2/M3/M4: 2,000-line G scroll and 20,000-line gg / 10001Gzt / G start-middle-end rendered grids; input handled while render pending; bounded slices, version cache and zero new parsers on unchanged reopen. |
| C3 | PASS | A-8222 ARTIFACT-001/002 and M9: direct headless grids and all 31 shipped cases passed. |
| Epic receipt | PASS with stated scope limits | Fresh suite 9b18c0ab at full target SHA: exit 0, 3503 tests / 3495 pass / 0 fail / 8 skipped. Required artifact-render, artifacts, thread and qa-shipped files passed with no scoped skips. |
| Freshness | PASS | demo status E-795 --commit 13ee21c235886618b4ea5f082414377264618ad8 --json returned current:true. Relevant source diff from stage is empty. |

Findings in E-795 scope: none.

Criterion marks: C1,C2,C3 verified in qa-2026-10-21-2. Coordinator request 565e0526 and decision 7d74e9f1 explicitly authorize reuse of A-8222 where exact. Its 14 checks, two direct grid cases and 80 targeted tests actually ran at 479178b25c78ccbb54f908ef7cc7c05c18426cd0 on local macOS arm64, Node24.21.0 / Neovim0.12.5, with zero skips and completed cleanup. These checks were reused, not rerun at the target. C2's explicit scrolling is proven by the recorded stage tests and retained source audit. No new demo lease was required.

Fresh epic suite: 13ee21c235886618b4ea5f082414377264618ad8, tree aa2e2d067dc348cb44bfc5cb4094555d00a393c4, occasion epic, mode full, two Linux x64 droplets, kernel6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers2. Merged A-8240; shard1 A-8241 on cland-v0-6e945401 c-8 lon1: 1026.99s admission-to-remote-finish, 21.38s collection, lifetime1013s, $0.0704. Shard2 A-8242 on cland-v0-4928d1c9 c-8 lon1: 983.99s, 25.83s collection, lifetime974s, $0.0677. Actual total wall1048.63s and hub-rounded total cost$0.1380. Coverage A-8243.

Limits: Web did NOT RUN (missing Linux HeadlessShell libraries), outside this Neovim epic; not a pass or zero-time result. T4's 10 files ran in the base phase only; load repetitions were skipped. Eight skips are outside E-795: one macOS idle-sleep, two unavailable OpenCode, five sandbox-exec cases. Test lint (131 findings/59 files), four test budget exceedances, T3 projected-wall excess and final T3 ratchet are REPORT only. No enforced-gate pass or actual wall is inferred from projections.

Final evidence A-8244: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8244-e-795-epic-dod-clear-at-13ee21c2-c1-c3-and-completed-epic-receipts/report.md. Includes exact reuse mapping, scrolling excerpts, receipt excerpts and scoped file results.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T10:05:11.523Z

Closed on QA clear qa-2026-10-21-2 at 13ee21c2 (C1–C3 verified, A-8244), with epic suite 9b18c0ab green (A-8240: 3,495 passed, 0 failed) and stage verdict qa-2026-10-21-1 at 479178b2 (A-8222).
