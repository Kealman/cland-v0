---
id: T-125
kind: task
title: "The layout persists: .cland/ui.json keeps the preset, panels, sizes,
  filters and scope; a manual resize beats the layout formulas"
state: closed
status: done
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: E-109
blocked_by:
  - T-124
topic: topic-43
branch: t/T-125-the-layout-persists-cland-ui-json-keeps
created: 2026-10-09T21:57:18.371Z
updated: 2026-10-10T00:58:18.003Z
---

## Parent

T-109 (Workbench basics), slice 2 of 5. Map T-81, "Settled while charting" (UI state); spec §3.1 (Tree and scope, the pick kept in `.cland/ui.json`).

## What to build

`.cland/ui.json` keeps the workbench state across restarts: the preset, which panels are open, their sizes, the items panel's filters, and a slot for the human's pick of the current release. The pick itself is set by `e` and `E` in slice 5. The file is per machine, ignored by git, and listed in the managed `.cland/.gitignore` that `cland init` and `cland update` write. A manual resize wins over the layout formulas and survives later layout changes, view switches and preset switches. Switching to a preset applies the preset's panel set without discarding the stored manual sizes of the panels it keeps. Writes are debounced and atomic, by temp file and rename. A missing or corrupt file falls back to defaults with one notice and never blocks startup.

## Acceptance criteria

- [ ] Resize the items panel, switch views and presets, restart headless Neovim against the stub hub: the sizes, open panels, preset and filters come back.
- [ ] A manual size survives a preset switch and a view switch.
- [ ] A corrupt `ui.json` gives defaults and a notice; startup is not blocked.
- [ ] `.cland/ui.json` is in the managed `.cland/.gitignore` after `cland init` and `cland update`, and this project's file gets the line; list it in your report.
- [ ] `nvim/README.md` documents `ui.json`; headless QA cases cover persistence, succeeding `PANELS-00x` on `prototype/panels`.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Risk from the sizing: manual sizes winning over the formulas without breaking presets. Reference: `prototype/panels` `panels.lua`. Lands after slice 1, because both edit the Neovim layout and `init`.

## Comments

### impl-125 · 2026-10-09T22:30:19.027Z

Read the item, epic, map's UI-state decision, spec §3.1 and prototype panels/layout reference. Implementing a per-project UI-state store and preserving manual panel sizes across layout changes; tests will exercise the stub-hub restart sequence, corrupt input and an interrupted atomic write.

### impl-125 · 2026-10-09T22:34:58.917Z

Added ui.lua, persistent settings and manual-size precedence, cold-process restart and atomic-interruption tests, and shipped PANELS-005/006 QA cases. Both shipped cases pass. Root .cland/.gitignore now has the ui.json line after hub.json (Coordinator to commit that instance file). Targeted testing caught a delayed WinClosed notification replacing the manual-resize baseline; stale closes now leave the baseline untouched.

### rev-65 · 2026-10-09T22:39:07.306Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-1
commit: 52adb19e9410bfe04bea0a99896b2925cff9b0eb

Medium — nvim/lua/cland/layout.lua:519: a delayed recognized centre/composer/session-split close resets every surviving panel's measured baseline without storing a pending manual resize, so the next fix discards it; preserve surviving measurements and cover this sibling interleaving.
Low — nvim/lua/cland/ui.lua:21: possible Duplicated Code (heuristic): the saved-preset validator duplicates layout.PRESETS, so a newly supported preset could invalidate its own persisted state; use the existing table.

Read-only actual pinned Lua probe: formula width 35 → manual 48 → queued recognized split-close → resized stores no override → fix restores 35. Centre/composer closes reproduce the same loss; stale unrecognized close correctly retains 48. Standards: 0 high/medium, 1 low. Spec: 1 medium. No suite or files changed. Evidence A-241: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-241-t-125-review-of-52adb19-recognized-close-loses-resize.md.

### impl-125 · 2026-10-09T22:39:45.983Z

Fix round rev-65-125-1 (A-241): cancelled the still-queued full-suite waiter for 52adb19. Correcting delayed recognised centre/composer/session-split close handling to capture a pending manual resize first, adding regression coverage for each split type, and deriving valid saved presets from layout.PRESETS.

### impl-125 · 2026-10-09T22:41:56.709Z

Resolved rev-65-125-1 on new head d4ac23e35b956a349ac5f6462a0c3f7002d3a779: capture pending sizes before immediate and scheduled close processing, suppress captures during programmatic layout operations, and retain capture ordering when rebuilding. Added actual-Neovim delayed-close regression cases for centre, composer, session split, left/right/dock panels and stale callbacks. Preset validation now uses layout.PRESETS. All 4 targeted UI tests, shipped PANELS-005/006 and npm run typecheck pass. The queued old-head suite was cancelled before it started; starting the full suite on the new committed head.

### rev-65 · 2026-10-09T22:44:59.673Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-2
commit: d4ac23e35b956a349ac5f6462a0c3f7002d3a779

Medium — nvim/lua/cland/layout.lua:115 (via delayed on_win_closed capture at :506): closing the sole board centre automatically expands a surviving panel, which capture_sizes records as a manual override; preserve preferred sizes across closure-induced redistribution while still capturing genuine post-close resizes.

Actual pinned headless-Neovim probe: saved/actual widths 48/46 → close board centre without composer → actual 48/111 → delayed close stores 48/111 → reopening centre retains right111 and constrains left to27. No human resize occurred. The new test's Watch centre retains its composer column and checks only the left survivor, so misses this case.

Both prior findings are resolved: A-241 virtual-window probe now preserves pending48 across split/centre/composer and stale closes; preset validation uses PRESETS. Standards: 0 findings. Spec: 1 medium. No suite, hub writes or file changes by Reviewer. Evidence A-243: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-243-t-125-resolution-review-of-d4ac23e-automatic-close-resize-persists.md.

### impl-125 · 2026-10-09T22:51:01.284Z

Second fix round rev-65-125-2 (A-243): removed close/layout/exit-time preference capture. Only WinResized records manual sizes; external close redistribution is marked automatic until deferred repair restores the stored dimensions. Regression now uses real C-w resizes, checks all saved sizes after every tracked close and an untracked split, and verifies a later genuine resize still persists. Ran it against pristine d4ac23e layout/init: it fails in 1.9 seconds because the board centre close stores left=113 instead of 48 without user resizing. The new event-based implementation passes that scenario; final targeted verification is in progress.

### impl-125 · 2026-10-09T22:52:06.800Z

Second fix committed at 94ad3194b279c8f5eca32fdfcec035d59bc6af0a and pushed to origin. Final close regression covers board centres with/without the dock, centre/composer/session/left/right/dock closes, untracked splits and stale callbacks, asserting all stored sizes and subsequent human resizes. The pristine d4ac23e source fails the board regression; 94ad319 passes. Full targeted UI tests, PANELS-005/006 and typecheck pass. The full package suite was launched after commit and is queued behind pid 82638.

### rev-65 · 2026-10-09T22:54:42.647Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-3
commit: 94ad3194b279c8f5eca32fdfcec035d59bc6af0a

Medium — nvim/lua/cland/layout.lua:112: a genuine resize made while close repair is pending is discarded by suppression/repair; real close-and-resize commands set left50, then deferred repair restores saved48. Preserve human intent during the suppression window.
Medium — nvim/lua/cland/layout.lua:565: even with no close pending, a view operation before WinResized restores the old size and replaces the baseline at :568; real vertical resize50 followed immediately by show(board) ends at saved/actual48. Preserve pending manual intent before layout operations.

A-243 automatic-centre redistribution probe now passes: stored/actual48/46 are restored after close and reopening. The two new failures were confirmed with actual pinned layout in standalone headless Neovim, scratch buffers and in-memory state ports. Existing tests resize after repair or wait for initial capture, so miss both interleavings. Standards: 0 findings. Spec: 2 medium. No suite, hub writes or file changes by Reviewer.
Evidence A-246: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-246-t-125-review-of-94ad319-human-resize-lost-before-capture.md.

### impl-125 · 2026-10-09T22:57:34.519Z

Third fix committed at 1e2fc96aa5bade152e288e27aaace03431fd8cd9. Pending human differences flush synchronously before every layout operation (including show/view/preset/repair) and exit, while close-origin redistribution remains suppressed through the full repair. No-wait vertical resize 50 followed by show(board) failed on 94ad319 (stored/actual48) and passes here; preset/fix/build same-turn cases pass too. Documented the Coordinator-accepted typeahead close/select/resize limitation in nvim/README.md and added a real command-batch test with A-246 provenance. All 6 targeted UI tests, PANELS-005/006 and typecheck pass. Old queued suite cancelled before starting; full suite now launched after the new commit.

### rev-65 · 2026-10-09T23:00:11.258Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-4
commit: 1e2fc96aa5bade152e288e27aaace03431fd8cd9

Medium — nvim/lua/cland/layout.lua:133: a pending human resize BEFORE a native close is not flushed before suppression; actual `vertical resize 50 | close` on items leaves storedleft48, and reopening returns48. Capture the prior resize while the first native closing window still exists, before marking redistribution, keeping existing programmatic/previous-close guards.

Strict requested checks pass: no-wait resize→view and resize→charting/watch presets retain50. A-243 automatic-centre redistribution remains fixed. The documented accepted close→resize typeahead interval is excluded from findings; this new trigger is resize→close.

Standards: 0 findings. Spec: 1 medium. Actual pinned standalone headless-Neovim probes; no suite, hub writes or files changed. Evidence A-248: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-248-t-125-review-of-1e2fc96-pending-resize-before-native-close.md.

### impl-125 · 2026-10-09T23:02:46.903Z

Fourth fix committed at eaa771977de89b84f9097a456b1b8ccfb79355aa: flush pending human dimensions before M.closing sets its first marker, retaining the programmatic and previous-close guards; checked the other marker sites for flush-before-marker ordering. Added real native resize|close tests for items, inbox, sessions, topics and the dock, asserting saved sizes while hidden and dimensions on reopen. New regression fails on 1e2fc96 and passes here. All 7 targeted UI tests, PANELS-005/006 and typecheck pass. Cancelled the old running suite early in hub verification; final full suite launched after this commit.

### rev-65 · 2026-10-09T23:05:16.155Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-125-5
commit: eaa771977de89b84f9097a456b1b8ccfb79355aa

High: none. Medium: none. Low: none. Pending manual dimensions flush before the first native-close marker; programmatic-change and existing-close guards remain intact. No new lost-write path identified.

Actual pinned standalone-Neovim comparisons: native resize→close→hidden/reopen fails on 1e2fc96 and passes on eaa7719 for items, inbox, sessions, topics and dock, with unrelated saved dimensions unchanged. No-wait view/charting/watch switches and automatic centre-close repair also pass. The documented Coordinator-accepted close-before-resize interval remains out of scope and retains its tested behavior.

Standards: 0 findings. Spec: 0 findings. No suite, hub writes or files changed by Reviewer. Evidence A-250: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-250-t-125-resolution-review-of-eaa7719-clear.md.

### impl-125 · 2026-10-09T23:17:36.031Z

eaa7719 full suite: hub 665/665; Neovim 120/121; exit 1. A-253 retains the final log. Coordinator steer: absent ui.json is silent defaults; an existing unreadable/corrupt file notices without displacing inbox answer keys. Kept the failing shell test unchanged, reproduced it red, and fixed it green. Expanded startup regression to absence, unreadable directory, corrupt JSON/schema/version, checking the actual focused inbox statusline. Sole production reader is ui.load; QA readbacks do not post notices. Delta now awaiting targeted UI tests; PANELS-005/006 and typecheck pass.

### rev-65 · 2026-10-09T23:21:00.863Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-6
commit: c9efcffcaf8da720026f5fa9443e1841320c9cb2

Medium — nvim/lua/cland/bars.lua:206 (also :221): keep_hint shortens the notice and drops duplicate session counts but leaves the centre context unbounded; a valid longer topic title at 160 columns hides both ui.json notice and inbox answer keys. Budget/truncate context too, reserving the notice and answer-hint prefix.

Actual pinned standalone-Neovim rendering with in-memory stat/readfile ports: absent file is silent; directory/EACCES/corrupt JSON/schema/version each produces defaults and one notice with ui.json and the full inbox hint visible for General/coord-1. With the longer T-119 container topic title, state has one notice but the rendered row shows neither notice nor answer hint. ui.load is the only production reader. Failing shell.test.ts is unchanged (identical blob 70c47694b042d5272a920cbf0da15e1349f54ae6); full-suite execution remains Implementer validation.

Full item covered by carrying forward rev-65-125-5/A-250; layout and manual-size fixes remain unchanged, and the accepted typeahead limitation remains excluded. Standards: 0 findings. Spec: 1 medium. No suite or file edits. Evidence A-258: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-258-t-125-review-of-c9efcff-long-context-hides-notice-and-hint.md.

### impl-125 · 2026-10-09T23:28:27.772Z

Resolved A-258's long-context finding at committed 571c7d6ea3658cd88a678155eb9b2c0fee82ae87: one measured statusline display-cell budget allocates focused hint, notice, ellipsized context, then counts. Long centre titles and context/preset text cannot push hints or notices off the bar; removed keep_hint-specific trimming. Actual long-title regression goes red on c9efcff and green at both 160 and 80 columns, with wide characters and budget assertions. All 8 UI tests, PANELS-005/006 and typecheck pass. Broader shell run passed 67/68: its only failure expected context during a higher-priority long preset notice. That preset test now checks the notice, expiry, then context, and passes its targeted rerun; the original inbox regression stays unchanged and passed the broader run. Cancelled c9efcff npm test via its runner (exit143), freeing T-120's lock; new full suite launched after commit.

### rev-65 · 2026-10-09T23:31:11.121Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-125-7
commit: 571c7d6ea3658cd88a678155eb9b2c0fee82ae87

High: none. Medium: none. Low: none. A-258 is resolved by the shared display-cell fitter and hint→notice→context→counts budget; keep_hint is gone.

Actual pinned standalone-Neovim comparison: the long title with wide characters loses notice/hint on c9efcff at 160/80 columns, and preserves both on 571c7d6 within 160/80 cells. Leading-wide titles also pass at 159/80 cells. Ordinary absent/valid inputs remain silent; five unreadable/invalid cases each produce defaults and one visible notice. Mode/hub/preset/context and full hints survive at normal width; lowest-priority counts return when space permits and remain in the top bar/session panel.

The sole shell.test.ts hunk is the preset test's notice/expiry/context checks and Board wait. Original inbox regression is byte-identical (1313 bytes, SHA-256 f074b84baf382a9651b306ce14e3d29ea67b8c6b036ffded65a2d7dcae6c1608). Full-item coverage carries forward rev-65-125-5/A-250; layout/manual-size fixes are unchanged and the accepted typeahead limitation remains excluded. ui.load remains the sole production reader.

Standards: 0 findings. Spec: 0 findings. No suite or file edits. Evidence A-261: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-261-t-125-resolution-review-of-571c7d6-clear.md.

### impl-125 · 2026-10-09T23:43:29.925Z

Final verification on clean committed 571c7d6ea3658cd88a678155eb9b2c0fee82ae87: npm test exited 0; hub 665/665 and Neovim 122/122, total 787 pass, 0 failures/cancelled/skips. Full-suite duration 662.35s, lock wait 207.38s. Typecheck and targeted UI/QA/preset checks also pass. Review clear rev-65-125-7 (A-261). Complete suite log A-268: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-268-t-125-571c7d6-full-suite-log-787-pass-exit-0.log. Final implementation/limitations handoff A-269: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-269-t-125-final-handoff-persistent-layout-and-passing-verification.md. Exact project .cland/.gitignore line is ui.json after hub.json, already committed by Coordinator. Branch pushed to origin; no merge; source tree clean.

### coord · 2026-10-09T23:43:56.079Z

Merged fc90fa84e135c729519b1e8a58aff87c7c932b5b onto dev.

### coord · 2026-10-09T23:44:10.412Z

Merged by the Coordinator through `cland merge T-125`, after `cland push`: squash fc90fa8 on dev. Gate: review rev-65-125-7 clear on 571c7d6, after five fix rounds:
- the manual-size flush;
- the native close order;
- a missing ui.json is silent, and an unreadable one gives a notice (A-253);
- the statusline uses one cell budget: hint, then notice, then context, then counts (A-258).
Full suite on 571c7d6: 665 hub and 122 Neovim tests passed, exit 0 (A-268); handoff A-269.
Accepted limitation, documented in the README: a resize typed ahead in the same batch after a close is reverted.
Project instance: the `.cland/.gitignore` line `ui.json` was already committed (359dd4c), and the template now carries it.
