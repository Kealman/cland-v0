---
id: T-54
kind: task
title: verdicts name the commit they cover, and the hub knows which verdicts it wrote
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-54
parent: T-20
blocked_by: []
topic: topic-11
branch: t/T-54-verdict-commit-and-provenance
created: 2026-10-09T08:33:53.658Z
updated: 2026-10-09T08:39:13.006Z
---

## Parent

Part of T-20 (slice 2, ticket 2 of 12). Spec section 4.7 (the merge gate); ADR 0004 (identity enforced by the hub).

## What to build

A verdict's header gains `commit:`. `task.comment` with a verdict takes `commit` (`cland task comment … --commit <sha>`); without it, on an item whose `branch` resolves, the hub records that branch's tip at write time and says so in the result. The hub keeps each verdict it writes in its database, in a table the index never rebuilds from the files: item, kind, result, run, commit, the writer's session id and role at write time, and the comment's time. `task.view` and `task.list` mark each verdict `hub` (written through the hub) or `file` (found only in the file: a hand edit, an import). `task.view` also says whether each latest verdict is current: its commit is the branch tip, or its diff from the merge base has the same `git patch-id --stable` as the tip's, which a rebase that changed nothing keeps (decision D4). The item view shows the short commit and the marks. Verdicts without `commit` keep parsing. This is the ground for the gate (ticket 4): only the latest verdict of each kind, written through the hub by a session that held the matching role at the time and does not claim the item, counts (decision D5).

## Acceptance criteria

- [ ] `cland task comment T-1 "ok" --verdict review --result clear --run r-1 --commit <sha>` writes the full sha as `commit:` in the header, and `cland task view T-1 --json` returns it.
- [ ] Without `--commit`, on an item whose `branch` exists, the verdict records the branch's tip; on an item without one, it has no commit and the result notes it.
- [ ] A verdict typed into the file by hand, `by` line and all, shows as `file`; one written through the hub shows as `hub`, also after a hub restart and after a hand edit elsewhere in the file.
- [ ] After a new commit on the branch, `cland task view` marks the review verdict stale; after a rebase that keeps the diff, current.
- [ ] The item view in Neovim shows the short commit, a red `stale` and `from the file` where they apply.
- [ ] Item files whose verdicts have no `commit` parse, index and show as before.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents `commit:` and the provenance marks.

## Notes

Test seam: the CLI and spokes against a real hub in a temp project with a real git repository; the item file; a headless Neovim item view against the hub, as the items tests do. Size M. Implementer: Codex gpt-6.1-sol. Can start immediately.

## Comments

### impl-54 · 2026-10-09T08:37:56.552Z

Starting implementation: verdict commit headers, durable hub provenance, current/stale calculation and Neovim item marks. Will validate with real-hub/git integration coverage and the full repository checks.

### coord · 2026-10-09T08:39:13.006Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/49 (a sub-issue of #20; the item is the source of truth).
