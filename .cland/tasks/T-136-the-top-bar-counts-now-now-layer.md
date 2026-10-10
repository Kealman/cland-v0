---
id: T-136
kind: task
title: "The top bar counts now: now-layer messages and asks only, through the message-layer rule"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-134
topic: topic-60
branch: t/T-136-the-top-bar-counts-now-now-layer
created: 2026-10-10T01:20:47.341Z
updated: 2026-10-10T05:31:59.809Z
---

## Parent

T-110 (Threads that read), slice 5 of 5. Spec §3.5 (How surfaces show them).

## What to build

The top bar's count takes only now-layer messages and asks, through the message-layer function from slice 3. Agent-to-agent traffic in any topic no longer raises it.

## Acceptance criteria

- [ ] A burst of agent-to-agent messages in an item topic leaves the top bar's count unchanged; a message addressed to the human raises it; an ask raises it.
- [ ] The count uses the slice-3 classifier; no second rule exists.
- [ ] Headless QA cases cover the count.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.

## Comments

### impl-136 · 2026-10-10T04:58:51.232Z

Read epic/spec and predecessor artifacts A-426, A-331 and A-269. Agreed test seams are the existing stub-hub message protocol and shipped headless QA at 120/80 columns. Extracting the sole classifier to a shared message_layer module; coordinating the report-kind watch rule with impl-135. The top-bar/inbox count distinction is awaiting Coordinator scope guidance.

### impl-136 · 2026-10-10T05:04:36.226Z

The single needs-you chip retains asks/approvals/waiting topics and adds unread messages through the unchanged shared classifier. Live-message count, replay deduplication, reading, ask-message/inbox union, answered asks, and cold/reconnect held-history replay pass targeted stub-hub checks. Added THREAD-009/010 at 120/80 columns with message-frame-only updates and the existing display-cell fitter. Coordinator report-kind behavior stays unchanged per Coordinator decision; T-143 owns the later rule change.

### impl-136 · 2026-10-10T05:16:46.670Z

Final implementation head 96621f685f70502a72fc036e48e0e9020176a632 (copied from git log -1). Self-review fixed held-snapshot read-id replay, preservation of live messages beyond the cold-history window, positive partial reads, and partial reads during the initial load. Seven focused count regressions and THREAD-009/010 pass; typecheck and diff check pass. Standards self-review clear; final Spec delta reviewing. Starting the one machine-locked root npm test on this committed head with Node v24.21.0 first on PATH.

### rev-8 · 2026-10-10T05:22:30.141Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-136-1
commit: 96621f685f70502a72fc036e48e0e9020176a632

Medium — nvim/lua/cland/attention.lua:129: a topic.history snapshot retry replaces current unread state using the original pre-attempt capture (lines84–86) and only the successful attempt's journal; live messages in a discarded journal outside the retry's latest200 disappear without a read. Native production Client probe with default2048-event cap: count2049 before overflow retry →200 after latest200 reply; replay of a dropped id remains200 because seen is retained. Preserve live unread identities across snapshot attempts while respecting reads. Standards and Spec report this same defect; otherwise requested classifier/chip/fitter/no-polling behavior matches. No suite run as requested. A-442: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-442-t-136-review-rev-8-136-1-snapshot-retry-loses-live-counts.md.

### impl-136 · 2026-10-10T05:29:02.409Z

Fixed rev-8-136-1 overflow finding in 10748b625dc5bfc52fc4022c5e8179b501e2d30b: retry reconciles against current live unread ids, preserves chronological suffixes and replay identity. Actual 2048-cap regression red reproduced 2049→200 and now passes, including partial read and replay after read. Eight focused attention cases and typecheck pass. Root suite was stopped (143), lock released; awaiting delta review before rerun. Evidence A-443 (artifact id/path to be confirmed from creation result).

### rev-8 · 2026-10-10T05:31:59.708Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-136-2
commit: 10748b625dc5bfc52fc4022c5e8179b501e2d30b

No high, medium or low findings for the full item. A-442 is resolved: native actual Client/default2048-cap probe now preserves2049→2049 through the latest200 retry reply, replay stays deduplicated, partial read leaves1 and replay remains1, full read clears0; no errors. Current live-set reconciliation preserves ids absent from bounded replies and suffix order. History-proven reads are allowed per Coordinator clarification d6729b73; the shared classifier/single chip/no-polling/fitter behavior remains intact. Standards and Spec clear. git diff --check passed; no suite run as requested. A-445: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-445-t-136-review-rev-8-136-2-retry-fix-clear.md.
