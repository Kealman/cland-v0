---
id: T-318
kind: task
title: "The count line: the items panel at release scope ends with categories 4 · 23 open, Enter switches to the all filter, and every row shows its kind's prefix"
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-269
blocked_by:
  - T-315
topic: topic-199
branch: t/T-318-the-count-line-the-items-panel-at
created: 2026-10-13T02:27:23.403Z
updated: 2026-10-13T10:53:30.969Z
closed: 2026-10-13T10:53:30.351Z
---

## Summary

At release scope the items panel ends with one line counting the categories and their open items, such as `categories 4 · 23 open`. Enter on it switches the panel to the `all` filter, where the categories and their open items are listed, until the explorer can take them. Every row shows its kind's prefix, so the parent column reads `E-` for an epic.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.2 (one count line at the bottom of the release scope) and §3.11 (the categories appear as one count line at the bottom). Decided in T-237 and T-238. Mockup: `docs/design/main-screen/Categories.dc.html`.

## What to build

**The count line.** In `M.render` of `nvim/lua/cland/vboard.lua`, at release scope, the panel's last row before its footer reads `categories <N> · <M> open`.

- N counts the open categories. M counts the open items anywhere under them. A category is an item of a root kind other than the release, read from the ladder that `hub.status` carries (T-315).
- With no open category, the line is left out.
- It shows under every filter except `you`, `done` and `map`, which draw no release scope.
- It is a row of its own in `panels.row_at` (for example `{ categories = true }`), drawn in the section style.
- It is computed in the render pass from `state.S.items`, with no new hub frame. It follows the items as task events arrive.

**Enter on it.** Enter on the count line switches the panel to the `all` filter and puts the cursor on the categories section. The key is registered in the action registry (`nvim/lua/cland/actions.lua`), so `␣?` and the palette list it.

**The categories under `all`.** At release scope under the `all` filter, after the release's own rows, the count line heads a section that lists each open category as a folded row. A category row shows its id, its title and its open count. Unfolded, it shows its open items in rank order with the panel's usual `row`. `za` folds it through the existing fold keys. This stands in for the explorer's categories root until T-276 builds it.

**Prefixes in the rows.** The hub sends canonical ids since T-314, so the scope header, the id column and the parent column show `R-`, `E-`, `C-` and `T-` as the kinds give them. Check them on screen. Update the stub hub's fixtures in `nvim/test/stub-hub.ts` to canonical prefixed ids, with categories and the nested ladder in `hub.status`.

**Demo** (the epic's words). The headless workbench at `R-228` shows the count line at the bottom and `E-` prefixes in the parent column.

**Out of scope.**

- The explorer's categories root, with counts, its top three, "N more" and the idle-work mark (T-276).
- The release scope that leaves other containers and unscheduled items to the `all` filter, and the unscheduled count in the mockup's line (T-270).
- The side panel's epic rows (T-276).
- Any hub change.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- The Neovim UI is tested headless on the stub hub (`nvim/test/stub-hub.ts`), read with `screenstring()`. A Neovim-only delta needs `npm run test:nvim` green.
- No new seams inside the hub. Helpers stay out of `hub/test/harness.ts`.
- The panel's redraw on hub events is coalesced once per tick (T-293).
- Every key goes through the action registry.
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. A Neovim headless test on the stub hub at release scope shows `categories <N> · <M> open` as the panel's last row, with N and M right for the fixture. A task event that adds an open item to a category raises M by one. With no open category the line is absent.
  - done: impl-318 · 2026-10-13T09:16:29.168Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-318-1 · 2026-10-13T10:53:20.343Z · commit 2ec92bfa809249f68850f6df86499297b3e84d41
- [x] C2. Enter on the count line switches the panel to `all` with the cursor on the categories section. The key is in the action registry and listed by `␣?`.
  - done: impl-318 · 2026-10-13T09:16:29.488Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-318-1 · 2026-10-13T10:53:20.343Z · commit 2ec92bfa809249f68850f6df86499297b3e84d41
- [x] C3. Under `all`, each open category shows as a folded row with its open count, and `za` unfolds it to its open items in rank order.
  - done: impl-318 · 2026-10-13T09:16:29.802Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-318-1 · 2026-10-13T10:53:20.343Z · commit 2ec92bfa809249f68850f6df86499297b3e84d41
- [x] C4. The same test reads `R-` in the scope header, `E-` in the parent column of a task row and `C-` on a category row with `screenstring()`. The task's epic has no plan in the fixture, since a planned row shows its stage tag in that column.
  - done: impl-318 · 2026-10-13T09:16:30.112Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-318-1 · 2026-10-13T10:53:20.343Z · commit 2ec92bfa809249f68850f6df86499297b3e84d41
- [x] C5. `nvim/README.md`'s items panel section describes the count line, Enter on it and the categories under `all`.
  - done: impl-318 · 2026-10-13T09:16:31.049Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-318-1 · 2026-10-13T10:53:20.343Z · commit 2ec92bfa809249f68850f6df86499297b3e84d41

## Comments

### impl-318 · 2026-10-13T09:15:41.955Z

Implemented the live categories N · M open heading at release scope, Enter navigation to the all section, numeric category ordering, folded open counts and ranked open descendants. Canonical R-/E-/C- IDs are read on screen through a stub scenario with the nested ladder. Headless vboard tests and action registry audit pass; final integrated suite/review follow. The existing stub already accepts canonical IDs and exposes ladder, so no hub-side changes are needed.

### impl-318 · 2026-10-13T09:41:51.120Z

First all verification a354c2b9 stopped on an inherited T-314 stage-receipt restart readiness assertion before the Neovim phase (A-1880). Whole stage-qa.test.ts passed 3/3 at dev 9e7fa6c and 3/3 at 0fea853 (A-1882). Shared fix 2c0f43d waits on closed stage state after restart, preserving both closure/hash assertions; corrected file 12/12 green. Reviewer rev-23 cleared that shared fix (A-1884). T-318 now includes it at 2ec92bf; fetched and merged origin/dev (already current), pushed to origin. Re-requesting final exact-head review/full verification.

### impl-318 · 2026-10-13T10:52:32.251Z

Complete exact-head all suite 9201f93b is green at 2ec92bfa809249f68850f6df86499297b3e84d41: 1766 tests, 1766 pass, zero failures/skips. Neovim phase green; durable log A-1913. Reviewer notified to finalize C1–C5 at unchanged head. No further suite submitted; respecting protected T-321 slot.

### rev-23 · 2026-10-13T10:53:20.343Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-318-1
commit: 2ec92bfa809249f68850f6df86499297b3e84d41

No high or medium findings. C1–C5 checked: live category/descendant counts, count-row position and omission, registered Enter/help/palette navigation, category folds/rank, canonical screen prefixes and README. Shared restart-readiness fix preserves closure/hash assertions. Exact-head full cland verify 9201f93b / A-1913 passed typecheck and 1766/1766 across all phases, zero failures/skips/cancellations. Evidence A-1915: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1915-t-318-final-review-clear-c1-c5-at-2ec92bf.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-13T10:53:30.969Z

Merged 0b5ca0e40183a76da0e0722cfc9afd7595846607 onto dev.
