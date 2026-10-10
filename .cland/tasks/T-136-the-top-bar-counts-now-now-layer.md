---
id: T-136
kind: task
title: "The top bar counts now: now-layer messages and asks only, through the message-layer rule"
state: closed
status: done
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
updated: 2026-10-10T06:04:54.002Z
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

### impl-136 · 2026-10-10T05:54:11.732Z

Root npm test at 10748b6: hub 852/852 passed; Neovim 192/193, only the existing configured-level board wait race failed (T-13 row not yet present). Durable root log A-453. Coordinator authorized test-only row wait plus Neovim-only rerun. New head from git log -1 is 5eede6b7004f7746c66d92fa17a0b952f6f5e33e: waits for T-13's actual item row before asserting both cards. Targeted board case and typecheck pass; locked test:nvim queued.

### rev-8 · 2026-10-10T05:55:20.720Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-136-3
commit: 5eede6b7004f7746c66d92fa17a0b952f6f5e33e

No high, medium or low findings. Test-only one-line delta waits for T-13 in the actual rendered item rows; the exact following ['T-10','T-13'] assertion is unchanged, preserving membership/count/order. A-453's missing-T-13 failure matches the synchronization race. Full-item production review A-445 carries forward; Standards and Spec clear. git diff --check passed; no suite run. A-457: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-457-t-136-review-rev-8-136-3-board-row-wait-clear.md.

### impl-136 · 2026-10-10T05:58:24.130Z

Final head copied from git log -1: 5eede6b7004f7746c66d92fa17a0b952f6f5e33e. npm run test:nvim passed 193/193, exit 0; durable log A-458: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-458-t-136-neovim-validation-193-of-193-at-5eede6b.log. Hub 852/852 at 10748b6 carries forward per Coordinator after the one-line test-only board wait fix. Typecheck and diff check pass; worktree clean. Current review rev-8-20261010-136-3 is clear on this exact head. Overflow regression preserves 2049 live now messages through the real 2048-cap retry, replay dedup and partial/full reads. THREAD-009/010 cover 120/80 columns. Cold/reconnect latest-200 loaded-window limit remains documented. Ready for Coordinator handover; no merge performed.

### impl-136 · 2026-10-10T06:00:19.282Z

Rebased onto fetched root dev 7445403989d1c144243894537f9a052e37089a8e (T-135 landed). New head from git log -1: 4d96743686a4b418ba8310b007da072892b9cd8a. Only QA list conflicted; kept THREAD-007/008 and 009/010. Thread/README auto-merge inspected, T-135 ask/chip/kind/watch rendering retained and classification remains a single shared module. Typecheck and diff check pass; locked test:nvim running. Evidence A-460: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-460-t-136-rebase-onto-t-135-at-4d96743.md. Hub 852 carries forward per Coordinator.

### rev-8 · 2026-10-10T06:01:55.829Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-136-4
commit: 4d96743686a4b418ba8310b007da072892b9cd8a

No high, medium or low findings for the full item. Rebase retains THREAD-007/008 and THREAD-009/010 in qa.test.ts:93 and their case/support files. Against landed T-135, thread.lua changes only local verdict/layer definitions to shared aliases; asks/chips/kinds/watch presentation remains intact. Sole classifier definition is in message_layer.lua and both thread/attention import it. Range-diff follow-ups2–5 unchanged; first commit only adjusted T-135 context and QA union. Attention/classifier identical to prior clear head, so prior retry/read/replay evidence carries. Standards and Spec clear; git diff --check passed; no suite run. A-463: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-463-t-136-review-rev-8-136-4-rebase-onto-t-135-clear.md.

### impl-136 · 2026-10-10T06:04:26.027Z

Rebase validation complete at 4d96743686a4b418ba8310b007da072892b9cd8a (head copied from git log -1), onto 7445403989d1c144243894537f9a052e37089a8e. Locked npm run test:nvim passed 198/198, exit 0, including THREAD-007/008 and THREAD-009/010. Typecheck and diff check pass; clean worktree and territory branch published. Durable complete log A-465: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-465-t-136-rebased-neovim-validation-198-of-198-at-4d96743.log. Hub 852/852 carries forward per Coordinator. Rebase delta evidence A-460; no merge performed.

### coord · 2026-10-10T06:04:39.085Z

Merged 91c1872d68a8e5e995993d5ae4593f77e2dbc870 onto dev.
