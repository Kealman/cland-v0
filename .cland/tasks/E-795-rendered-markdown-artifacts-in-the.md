---
id: E-795
kind: epic
title: Rendered Markdown artifacts in the Neovim workbench
state: open
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
updated: 2026-10-21T09:42:19.436Z
---

## Summary

The human, 2026-10-18 10:14Z in General: an opened artifact shows raw Markdown and is hard to read, so artifacts should render properly in v0.2. Today `nvim/lua/cland/artifacts.lua` only sets `filetype = markdown`, so syntax colours apply but every `#`, `**`, backtick and bracket stays visible. Thread messages already render through `thread_md.lua` (T-133): concealed heading markers, code chips and bands, bullets as `•`, link styling and quotes. The web workbench (E-418, spec v0.2 §3) renders artifacts on its own.

## Definition of done

- [ ] C1. A Markdown artifact opened in the workbench renders like a thread message (headings, emphasis, inline and fenced code, lists, links, quotes, tables readable), with a key that toggles the raw source.
- [ ] C2. Long artifacts open and scroll without a visible delay. Rendering is cached per artifact version and never blocks the UI.
- [ ] C3. Headless-grid cases cover a rendered artifact and the raw toggle.

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
