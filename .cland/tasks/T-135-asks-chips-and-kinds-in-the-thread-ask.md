---
id: T-135
kind: task
title: "Asks, chips and kinds in the thread: ask cards answered in place, artifact chips, the kind on each header, watch dimming"
state: closed
status: done
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
updated: 2026-10-10T06:05:00.831Z
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

### impl-135 · 2026-10-10T05:40:55.521Z

Committed e7d6bf64f0a39eff4b6f721c580637681df813fc after a6998d8. Root run: hub 852/852, Neovim 187/188; sole failure was the client's old exact header expectation excluding kinds. Updated only that test, retaining anchored sender/role/addressee/time/stage checks and adding literal kinds. Client file 7/7 and typecheck pass. Coordinator decision 7aac1bb0 carries hub forward and requests locked test:nvim on this committed head; that run is started. Full root evidence: A-447.

### rev-8 · 2026-10-10T05:43:33.054Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-135-2
commit: e7d6bf64f0a39eff4b6f721c580637681df813fc

No high, medium or low findings for the full item. Standards and Spec clear; prior production review carries forward. Four exact-kind regex additions preserve the anchored sender/role/addressee/time/stage checks. Human UI uses topic.send→sendFromHuman, which creates/stores no kind; thread.kind labels that human text message as a display fallback. T-138's absent-kind=report applies to agent send→sendFromSession and is stored there. Recorded kinds still take precedence. Native kind probe confirmed the display fallback leaves human.kind absent; git diff --check passed. No suite run as requested. A-448: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-448-t-135-review-rev-8-135-2-client-header-expectations-and-kind-semantics.md.

### impl-135 · 2026-10-10T05:55:00.409Z

Final head e7d6bf64f0a39eff4b6f721c580637681df813fc is clean and pushed to local origin. Typecheck passes. Locked test:nvim passes 188/188 (zero failures/skips); hub 852/852 carried forward per Coordinator decision 7aac1bb0. Final suite covers real-hub digit answer_to, grouped artifact opening, incremental/full equality and THREAD-007/008 at 80/120 columns. Warm rewrite 21.137 ms; append with eviction 1.058 ms. Evidence A-455; final handover note posted in topic-59. Coordinator report dimming remains deferred to T-143 by decision 80284064.

### coord · 2026-10-10T05:55:20.275Z

Merged f50a4cf5d82879b854e6169a90aa08e731948d51 onto dev.
