---
id: T-135
kind: task
title: "Asks, chips and kinds in the thread: ask cards answered in place, artifact chips, the kind on each header, watch dimming"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-134
topic: topic-59
branch: t/T-135-asks-chips-and-kinds-in-the-thread-ask
created: 2026-10-10T01:20:47.097Z
updated: 2026-10-10T05:11:50.049Z
---

## Parent

T-110 (Threads that read), slice 4 of 5. Spec §3.14 (Roles and layers).

## What to build

An ask renders as an amber band with numbered keys and a free-answer hint. A digit answers it in place, through the same hub path the inbox and the palette use. The Coordinator's ask and the artifact chip it posts next share one header. Artifact chips render in the thread. Each header shows the message's kind. Watch messages, meaning the Coordinator's reports and a clear verdict, are softer with a dimmed bar. A clear verdict takes one row, and a not-clear verdict shows its result and any failed-criterion note.

## Acceptance criteria

- [ ] An ask in a thread is answered with a digit, and the answer reaches the hub with `answer_to`; a real-hub test checks it.
- [ ] An ask and the chip that follows it share one header.
- [ ] A Coordinator report to the human sits dimmed below a message addressed to the human.
- [ ] A clear verdict takes one row; a not-clear verdict shows red with its note.
- [ ] `nvim/README.md` describes asks, chips and dimming in the thread.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.

## Comments

### impl-135 · 2026-10-10T04:57:44.464Z

Implementation started: preserve ask_card.answer and action registry; group a same-sender Coordinator artifact post immediately following its ask; extend incremental/full rendering checks and add real-hub digit-answer coverage. Keep T-134 window/fold guards.

### impl-135 · 2026-10-10T05:04:48.918Z

Real-hub digit answering, grouped-chip opening and the incremental/full-render differential passed. Added THREAD-007/008 at 120/80 columns, including Unicode clear-verdict fitting. Coordinator decision 80284064: keep the classifier unchanged; report-to-watch is deferred to T-143, so watch styling follows layer=watch today (clear verdicts). Typecheck passed; final commit and locked root suite pending.

### rev-8 · 2026-10-10T05:11:50.027Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-135-1
commit: a6998d85be1fe50bf13944923542e2dbd8db4c38

No high, medium or low findings. Standards and Spec both clear. Ask answer_to path, same-Coordinator adjacent-chip grouping, recorded kinds, unchanged thread.layer/fold/window seams, compact clear verdicts and red not-clear notes match the brief. Differential coverage checks incremental/full output and metadata at 80/120 columns. Independent native Neovim probe confirmed a wide Unicode clear verdict occupies one screen row at both widths, preserving time/kind/result. git diff --check passed. No suite run as requested; implementation acceptance evidence remains separate. Review details: A-435, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-435-t-135-review-rev-8-135-1-clear.md.
