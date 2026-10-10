---
id: T-151
kind: task
title: "The Aide speaks for the human: the crew's clauses say so; the thread's speaks-for-you mark and dashed blue bar; Aide messages never fold"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-148
  - T-135
topic: topic-82
branch: t/T-151-the-aide-speaks-for-the-human-the-crew-s
created: 2026-10-10T05:33:00.860Z
updated: 2026-10-10T11:54:17.210Z
---

## Parent

T-111 (The human's own session), slice 4 of 5. Spec §3.3 (Its voice is the human's), §3.14.

## What to build

The crew's role clauses say that an Aide speaks for the human, decisions included. An Aide's messages show as `aide-1 [Aide]` with the thread's "speaks for you" mark and the human's blue as a dashed bar (§3.14); messages to or from an Aide never fold.

## Acceptance criteria

- [ ] The default Coordinator, Implementer, Reviewer and QA clauses state that an Aide speaks for the human; list the exact `.cland/roles.toml` lines.
- [ ] In the thread, an Aide's message carries the "speaks for you" mark and the dashed blue bar, and never folds.
- [ ] Demo: an Aide tells the Coordinator to rank one task above another, and the Coordinator treats it as the human's decision.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.

## Comments

### impl-151 · 2026-10-10T11:39:12.386Z

Implementation: retain T-134's now-layer Aide boundary rule; add the speaks-for-you header and blue dashed gutters (including cursor/wrapped rows), plus an authority instruction in all four default crew clauses. Tests cover clauses delivered by a real hub and rendered history/live thread boundaries. Existing project roles.toml changes will be supplied exactly in the handover for the Coordinator to commit.

### impl-151 · 2026-10-10T11:45:15.251Z

Handover: 21f35054c20a54d13423d3fb3f80d53f89b0ecbd pushed to local origin; clean worktree, review status. A-589 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-589-t-151-implementation-handover-at-21f3505.md records changes, exact four role-clause insertions and later demo. Typecheck and roles/thread targeted tests passed (6/6 and 23/23); locked npm test is queued, result to follow.

### rev-9 · 2026-10-10T11:46:38.110Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-151-1
commit: 21f35054c20a54d13423d3fb3f80d53f89b0ecbd

Clear: no high, medium or low findings within the requested slice. Standards and Spec both clear. The four crew authority lines retain 'within your role'; Reviewer and QA still accept requests only from the Coordinator, and permissions are unchanged. nvim/lua/cland/thread.lua:279 adds the speaks-for-you mark; thread.lua:1021 and hl.lua:62 apply human-blue dashed gutters including wrapped rows and cursor emphasis. T-134's message_layer classifier is untouched; reviewer memory Lua probe confirms Aide non-background boundaries and ordinary progress/verdict layers unchanged. Exact instance lines and deferred live-demo clarification are in A-589. Evidence A-590: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-590-t-151-authority-and-thread-review.md. Reported typecheck/6 role/23 thread tests pass; full suite separately queued. No reviewer edits or full-suite run.

### impl-151 · 2026-10-10T11:54:17.210Z

Review clear at 21f3505: rev-9, run rev-2026-10-10-151-1, A-590. Coordinator changed validation to the approved batch rule in topic-82 (b5439625-054e-47dd-8052-b4519aa3e178): withdrew the queued full npm test before it started, and queued locked npm run test:nvim instead. Full npm test runs once on integrated dev after merge.
