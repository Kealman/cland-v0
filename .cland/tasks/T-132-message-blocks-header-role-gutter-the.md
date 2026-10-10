---
id: T-132
kind: task
title: "Message blocks: header, role gutter, the human's band, day rules, delivery stage; appends touch only their own lines"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-127
topic: topic-50
branch: t/T-132-message-blocks-header-role-gutter-the
created: 2026-10-10T01:20:46.278Z
updated: 2026-10-10T01:50:03.951Z
---

## Parent

T-110 (Threads that read), slice 1 of 5. Spec §3.14 (Messages, Cost).

## What to build

A topic thread renders each message as one block. The header reads `sender [Role] → addressees  HH:MM` (`→ you` for the human), with the delivery stage or the waiting state at the right. A gutter bar in the role's colour runs down every screen row of the message, wrapped rows included, drawn through `'statuscolumn'` and heavier on the message under the cursor. A band sits behind the human's messages. A rule marks each local day. Continuation rows align with the text (`breakindent`), and lines break only at spaces, so ids like T-58 stay whole. The thread keeps the latest 200 messages. A new message is appended, and a stage change rewrites only that message's lines; neither redraws the thread.

## Acceptance criteria

- [ ] General's real history renders with headers, role gutters (the Coordinator teal, Implementers violet, Reviewers pink, QA sky, the human blue), the human's band and a rule per local day.
- [ ] A new message is appended without a full rewrite (under 1 ms at 200 messages), and a delivery-stage change rewrites only its message; a test counts the touched lines.
- [ ] A full rewrite of 200 messages stays within the T-86 budget (tens of milliseconds); a test measures it.
- [ ] Wrapped rows keep the gutter, continuation rows align, and `T-58` never breaks across rows.
- [ ] Headless QA cases cover the thread at 120 and 80 columns, as the successor of `THREAD-PROTO`.
- [ ] `nvim/README.md` describes the thread's blocks.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.

## Comments

### impl-132 · 2026-10-10T01:26:30.433Z

Claim is live; T-127 is merged. Reading the thread/spec/prototype and headless harness before implementing incremental message blocks, role gutters, local day rules and delivery updates.

### impl-132 · 2026-10-10T01:30:15.398Z

Ported block builder/body seam, per-role statuscolumn gutters, cursor emphasis, human band, local day rules and eol_right_align delivery marks. Stub-hub tests pass for visible presentation and touched lines: append inserts exactly four new lines, delivery touches zero text, retention deletes only the expired four-line block. Prototype deviations so far: strict 200-message retention instead of 250/slack; no Markdown/folds/layers (later slices); current asks/chips stay supported.

### impl-132 · 2026-10-10T01:39:02.189Z

Committed and pushed local origin: c4fb6fb0c2c5bc8295549ebf5393bf88eb2c02c9 (copied from git log -1). Typecheck passes; thread5/5 with append0.559ms including eviction, rewrite+redraw6.989ms; THREAD-001/002 pass; General's68 real messages replay at both widths. Artifacts A-335 implementation/deviations, A-336 real General120 head and A-337 General80 tail. Started final root npm test with pinned Node v24.21.0/shared machine lock. No merge.

### impl-132 · 2026-10-10T01:40:37.698Z

Cross-day retained-answer regression passes; it verifies one rule per retained local day when the old ask expires. No production delta. Committed final head12b5eb966dadc86ff7580334c5fab5f43e4afae6 (copied git log -1), pushed local origin. Cancelled queued c4fb6fb suite (exit143, no tests ran); final pinned-Node root npm test is queued on12b5eb9. Earlier production checks and A-335/A-336/A-337 carry forward.

### rev-6 · 2026-10-10T01:45:21.745Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-132-1
commit: 12b5eb966dadc86ff7580334c5fab5f43e4afae6

Medium — nvim/lua/cland/thread.lua:562: promoting a retained answer adds its day rule but leaves the following block's previous rule intact, duplicating that local day's rule after ask eviction and violating the one-rule-per-day criterion.

A-339 confirms this on the pinned final head in scratch Neovim: live eviction retains 200 messages and the answer once, but shows Oct 9 twice; the exact final fixture's direct merge shows three rules for two retained days. A full rewrite repairs both, so the incremental insertion must recompute the following boundary without rewriting its text. A-339 corrects A-338's explanation of the stub history limit; the stub ignores it.

Standards: clear. Spec: the medium boundary finding above remains; no other high or medium findings. Full delta e980bf1..12b5eb9 and the documented T-133–135 deferrals reviewed. Diff check passed; no suite run.

Evidence: A-339, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-339-t-132-final-review-day-rule-boundary-evidence-at-12b5eb9.md.

### impl-132 · 2026-10-10T01:46:53.990Z

Cancelled queued12b5eb9 suite on A-338 (exit143; no tests ran). Exact live200-message ask/answer+append reproduces2 day rules vs1. The old initial-trim assertion was masked by the test helper's charting-preset view change, which called render before assertion. New generated tests skip that view rewrite and compare lines, extmark virtual rules/stages/highlights/bands and gutter/card/chip row metadata against a separate fresh oracle buffer. Red differential reproduces divergence on seed1 live append1. Fixing predecessor-dependent day rules at every insertion/removal boundary.

### impl-132 · 2026-10-10T01:50:03.951Z

Fixed the duplicate day-rule class by recomputing only separator extmarks at removal/insertion boundaries, and fixed stable ordering of equal-time promoted answers. The old test's charting-preset switch performed a full render before the count assertion, masking initial trim defects. New independent full-render differential snapshots compare all extmark details, lines and gutter/action metadata across 4 generated histories and 96 live appends with asks, answers and boundary stage changes. Red exact eviction and red initial equal-time ordering confirmed before the fixes; all 6 thread tests, both 120/80-column QA cases and typecheck now pass. Append+eviction median 0.310 ms; rewrite+redraw 5.395 ms. Preparing committed head before the root suite.
