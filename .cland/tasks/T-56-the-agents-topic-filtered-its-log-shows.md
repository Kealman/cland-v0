---
id: T-56
kind: task
title: "the Agents topic, filtered: its log shows one item's or one session's traffic"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-56
parent: T-20
blocked_by: []
topic: topic-13
branch: t/T-56-agents-topic-filters
created: 2026-10-09T08:33:53.682Z
updated: 2026-10-09T08:39:13.122Z
---

## Parent

Part of T-20 (slice 2, ticket 9 of 12). Spec section 7(d).

## What to build

`topic.history` on Agents takes `item` and `session` filters, applied in the hub over the whole record, so entries older than the loaded window are found. An entry concerns an item when its detail names the item or the item's bound topic (claims, releases, worktrees, merges, agent-message notices). It concerns a session when the session sent it, is among its addressees, or a notice's detail names it. In the Agents log, `f` asks for an item id or a session name, with completion from both; the header shows the filter (`AGENTS · T-12`); new entries that do not match stay out; `F` clears. `L` in an item view or on a session row opens the log filtered to it. The spoke's `history` on Agents takes the same filters, so the Coordinator can pull one item's agent traffic.

## Acceptance criteria

- [ ] `topic.history {topic:"agents", item:"T-12"}` returns T-12's entries only, including ones older than the latest 200; `session:"impl-12"` returns those from, to or about impl-12; both together return the intersection.
- [ ] In the Agents log, `f` with `T-12` shows only T-12's entries, with the filter in the header; a new entry about T-11 stays out and one about T-12 shows; `F` shows everything again.
- [ ] `L` in T-12's item view, or on impl-12's row in the sessions panel, opens the log filtered.
- [ ] The spoke's `history` honours both filters.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` and `nvim/README.md` document the filters.

## Notes

Test seam: frames and spokes against a real hub with scripted traffic; a headless Neovim against the hub. Size M. Implementer: Codex gpt-6.1-sol. Can start immediately.

## Comments

### impl-56 · 2026-10-09T08:37:56.554Z

Starting hub/spoke Agents history filters and Neovim filtered log navigation. Will verify history across the full record, live updates, and item/session shortcuts with focused integration tests, then run required checks.

### coord · 2026-10-09T08:39:13.122Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/51 (a sub-issue of #20; the item is the source of truth).
