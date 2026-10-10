---
id: T-127
kind: task
title: "Sessions grouped by state: waiting, busy and idle groups, a folded stopped line, the expanding selected row with the approval's command, and the sessions chip"
state: open
status: in progress
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by:
  - T-126
topic: topic-48
branch: t/T-127-sessions-grouped-by-state-waiting-busy
created: 2026-10-09T21:57:34.743Z
updated: 2026-10-10T00:58:18.024Z
---

## Parent

T-109 (Workbench basics), slice 4 of 5. Spec §3.11 (The sessions panel).

## What to build

The sessions panel groups sessions by state: waiting, busy and idle, each with its count, then one folded line, "stopped (N)", which `za` unfolds. The "yours" group for Aides is T-111's. Each session is one line: glyph, name, role and item. The selected row expands to harness, model, state and usage. For a pending approval the state shows the command it waits on.

Keys, each registered in the action registry:
- Enter attaches;
- `C-v` attaches in a split;
- `l` launches;
- `x` stops;
- `c` shows capabilities.

`a` and `␣A`, which launch an Aide, are T-111's. The sessions chip in the top bar counts the now-layer sessions plus the waiting count. Until the visibility layers land, "now" means every session that is not stopped.

## Acceptance criteria

- [ ] On the stub hub, a session moving to waiting for approval moves to the waiting group and shows the command it waits on; `za` unfolds and folds the stopped sessions.
- [ ] Enter, `C-v`, `l`, `x` and `c` work from the panel and appear in the palette with their keys.
- [ ] The chip counts as specified and updates from session events alone.
- [ ] Headless QA cases cover the groups and the expanding row; `nvim/README.md` documents the panel.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Reference: `prototype/panels` `panels.lua`; mockup `SessionsPanel.dc.html` and `screens/v01-sessions-panel.png`. The UI reads session state from the hub and never derives it (ADR 0003).

## Comments

### impl-127 · 2026-10-10T00:24:38.542Z

Read the item, epic, spec, ADR and panel references. Implementing state-driven waiting/busy/idle groups, a stopped fold, selected-session details and the now-session chip through the existing registry and display-cell fitter; no Aide features.

### impl-127 · 2026-10-10T00:29:54.364Z

Groups, stopped fold and selection-following group changes pass the stub-hub tracer test. PANELS-009 (groups/folding) and PANELS-010 (selected approval/usage details) pass headless. Approval commands are now carried end to end for Claude Code and Codex through existing event fields; implementing the Coordinator's added tool-name fallback for non-command approvals.

### rev-65 · 2026-10-10T00:39:53.442Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-127-1
commit: f76cba8804fcbea6507f81e226c6f5765d920233

High: 0. Medium: 2. Low: 0.

Medium — nvim/lua/cland/panels.lua:28/:194–196/:215: allowing a two-cell canvas feeds width zero to confirmation/notice wrapping; empty head never consumes the word, freezing the UI. Actual bounded pinned Nvim render detects nontermination; identical base22defab render completes. Handle nonpositive content budgets and require forward progress across wrapped callers.

Medium — hub/src/adapters/codex.ts:503/:865–866: a reconnect subscription's earlier busy snapshot can return after a requestApproval stores its command but before waiting is reported; unchanged busy #setState deletes the new metadata. The subsequent authoritative waiting event has no approvalCommand. Actual-method deferred probe reproduces it. Preserve pending metadata across unchanged/older snapshots without deriving state from approval requests (A-96 event/await ordering).

Groups/counts, selected details and cursor identity across visible group moves, stopped folds, registry keys/shared fitter and command-only projections otherwise pass review. Normal Codex request-first/state-first orders work; Bash/commandExecution tool-input sentinels are excluded, Edit/fileChange carry tool names, and core polling retains/clears metadata correctly. OpenCode gap and T-111 exclusions are accepted.

Standards: 0 findings. Spec: 2 medium. No suite or edits. Evidence A-309: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-309-t-127-review-of-f76cba8-narrow-panel-loop-and-approval-ordering.md.

### impl-127 · 2026-10-10T00:42:07.846Z

Stopped the f76cba8 full suite on A-309 findings (exit 143). Fixing bounded wrapping for tiny panels and snapshot/event ordering across deferred Codex subscriptions; targeted regressions precede a new commit and delta review.

### impl-127 · 2026-10-10T00:45:51.943Z

A-309 fixes committed at head 89028cd2ce7262e875361fca83f12baf79b6ba2b (copied from git log -1), pushed to local origin. Tiny-width tests reproduce the old loop and now pass; deferred Codex approval-first subscription reproduces metadata loss and now passes, with waiting-state-before-response coverage too. Shared bars prefix fitter bounds wrapping; all subscription callers fence snapshots with event sequence after awaiting. Typecheck passed; targeted palette4/4 and Codex5/5 passed. Awaiting delta review before final npm test.

### rev-65 · 2026-10-10T00:48:22.938Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-127-2
commit: 89028cd2ce7262e875361fca83f12baf79b6ba2b

High: 0. Medium: 1. Low: 0.

Medium — hub/src/adapters/codex.ts:929/:952: resume and relaunch assign a current snapshot's state directly, retaining the preceding approvalCommand when that snapshot reports idle. A later waiting notification without a new request emits the completed command. Actual pinned #subscribe/resume/relaunch probes reproduce both; reconnect clears correctly through #setState. Apply accepted snapshots through state/metadata lifecycle logic while preserving the sequence fence, so pending approval details cannot resurrect a completed command.

Both A-309 failures are resolved. The identical two-cell confirmation render terminates; notice/confirmation wrapping at 0/1/2 cells and actual one/two-cell windows fit. The identical delayed reconnect preserves the new command. Fifteen actual-method snapshot scenarios pass across reconnect/resume/relaunch, thread/read fallback and both event orders, with no-event snapshots still applied. Earlier unchanged panel/registry/projection/core/docs checks carry forward.

Full item reviewed against 22defab. Standards: 0 findings. Spec: 1 medium. No suite or edits. Evidence A-313: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-313-t-127-review-of-89028cd-current-snapshot-retains-old-approval.md.

### impl-127 · 2026-10-10T00:49:16.286Z

Cancelled queued 89028cd npm test on the Coordinator's A-313 finding (exit143; no tests ran). Both A-309 probes passed review. Addressing the remaining approval-episode cache lifecycle across accepted resume/relaunch snapshots, process exits and stops; adding real-hub regressions and checking Claude Code's caching.

### impl-127 · 2026-10-10T00:51:21.378Z

A-313 fix committed at head 7fc3c2c126d6c30a8a9c453f33887d2a05e14bb0 (copied from git log -1), pushed local origin. Codex accepted event/snapshot states share one lifecycle, clearing completed approval metadata on non-waiting state, exit and stop; older snapshots stay fenced. Resume idle-snapshot regression failed before fix and now passes; resume/relaunch followed by waiting without a command both omit old metadata. Targeted Codex7/7, Claude1/1 and typecheck pass. Claude adapter has no local approval cache and needs no change. Waiting on delta review before a full-suite instruction.

### rev-65 · 2026-10-10T00:52:59.746Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-127-3
commit: 7fc3c2c126d6c30a8a9c453f33887d2a05e14bb0

High: 0. Medium: 0. Low: 0. Standards: clear. Spec: clear.

A-313 is resolved: accepted resume/relaunch snapshots clear completed approval metadata through the shared lifecycle. All three pinned current-snapshot reproductions now pass; later waiting events do not revive an old command. Gone/successful stop clear the cache, while refused stop preserves the still-running episode. The sequence fence remains intact across all 15 snapshot-path/event-order scenarios, including the thread/read fallback.

All A-313 probes rerun on this head: narrow confirmation/notice rendering and budgets 0/1/2 terminate and fit; groups/counts, selection, folds, command-only projection and core metadata checks pass. Claude Code has no local command cache. Earlier unchanged full-item checks carry forward from A-309/A-313. Covers the full item against 22defab; no suite or edits.

Evidence A-315: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-315-t-127-full-item-review-of-7fc3c2c-clear.md.
