---
id: T-59
kind: task
title: "cland merge: the gate takes a task with clear verdicts onto dev as one squash commit"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: null
parent: T-20
blocked_by:
  - T-53
  - T-54
topic: null
branch: null
created: 2026-10-09T08:34:54.729Z
updated: 2026-10-09T08:39:13.313Z
---

## Parent

Part of T-20 (slice 2, ticket 4 of 12). Spec sections 4.7 and 7(a); ADR 0004.

## What to build

The Coordinator's `merge` spoke tool and `cland merge T-12`, with one `merge` frame behind both; the human may run it from their own shell. The hub runs merges one at a time under the territory lock (decision D2) and checks in order, refusing with a typed reason and moving no ref: the item is an open task with a `branch`; its latest review verdict is clear, written through the hub by a session that held Reviewer at the time and does not claim the item, and current for the branch (T-54; decisions D4, D5); with the label `qa-required` (decision D6), the same holds for QA from a session that held QA; the branch merges onto `dev` without conflicts (`git merge-tree --write-tree`), otherwise the conflicting files are named and the Implementer rebases in its worktree, since the merge never rewrites a task branch (decision D9). It then lands one commit on `dev` with `git commit-tree`: the subject is the item's title and id, and the trailers `Item:`, `Reviewed-by:` and `QA-by:` name the sessions and runs. It fast-forwards the root's `dev` checkout, refusing before anything lands when the root has uncommitted changes in the files the commit touches, and pushes `dev` to the territory. Then it comments the commit on the item and closes it (which closes its topic), releases the claim, and removes the worktree and branch, waiting while a running session stands inside (decision D10). Agents and the journal record each merge and refusal. The human's `cland merge T-12 --override "<reason>"` skips the verdict checks, never the conflict check, and records the reason on the item. No check command runs in the gate in v0; the verdicts are the gate (decision D16). The `merge` skill ships for the Coordinator, and the Coordinator's and Implementer's clauses say task work reaches `dev` only through `merge`; the skill forbids delegating a merge to a sub-agent, since a sub-agent in the Coordinator's shell is taken for the Coordinator.

## Acceptance criteria

- [ ] With a clear, current, hub-written review verdict, `cland merge T-12` adds exactly one commit on `dev`, whose tree is `dev` merged with the branch and whose message carries the title and `Item: T-12`; the root's working tree and the territory's `dev` are at that commit.
- [ ] Each of these refuses with its own reason and moves no ref: no branch; no review verdict; review not clear; a review verdict found only in the file, recorded by the Coordinator for a rescue run, written by a QA session or by the claiming session; a stale review verdict; `qa-required` without a clear, current QA verdict; conflicts with `dev`, files named; a root with uncommitted changes in the touched files.
- [ ] An Implementer, Reviewer or QA calling `merge`, through its spoke or from its shell, is refused by the permission table, and the refusal shows in Agents.
- [ ] Two merges asked for at once run one after the other, and the second lands on top of the first.
- [ ] After a merge, T-12 is closed with a comment naming the commit, its claim released, its topic closed, and its worktree and branch gone. With a running session's cwd in the worktree, the removal waits for that session to stop.
- [ ] `--override "<reason>"` from the human's shell lands a merge without verdicts and records the reason; from a session's shell it is refused.
- [ ] The `merge` skill is in `.agents/skills/merge/` and in the Coordinator's skill list in the default `roles.toml`.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents the gate, the commit shape and the override; spec 4.2's amendment (the hub runs the territory's commands) is recorded in the ADRs.

## Notes

Test seam: real git on disk, a temp project with a territory, task branches and worktrees; the CLI and spokes against a real hub; assertions on refs, commits, the item file, Agents and the journal, never on mocks of git. Size L. Implementer: Codex gpt-6.1-sol (deterministic git and hub logic, testable on disk). Serial with ticket 3 (the task-branches ticket): both extend the territory module.

## Comments

### coord · 2026-10-09T08:39:13.313Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/54 (a sub-issue of #20; the item is the source of truth).
