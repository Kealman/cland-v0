---
id: T-319
kind: task
title: "T-275 gaps before QA: the human's npm test ahead of ranked items, the human holder shown as human, the queue line and prune in the clauses and READMEs"
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-275
blocked_by: []
topic: null
branch: t/T-319-t-275-gaps-before-qa-the-human-s-npm
created: 2026-10-13T04:57:02.253Z
updated: 2026-10-13T04:57:20.276Z
---

## Summary

Close the gaps between T-275's Definition of done and what T-303 to T-308 merged, so QA's demo can verify every checkbox. These gaps were found while writing the QA brief on 2026-10-13. The human's `npm test` waiter queues ahead of ranked item runs, as the epic decided. An admitted human run shows as `human`. The role clauses and the READMEs describe the queue line and prune.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: docs/spec/v0.1.2.md §3.5 and §3.6. Decision (4) in T-275's ticket comment says: "The human's npm test waiter queues behind integrated dev runs and ahead of ranked items."

## What to build

**Queue order (hub).** T-308 merged ranked item requests ahead of the human's waiter. The test `human slots share enqueue order while ranked item requests retain priority` pins that order. Change the order to decision (4): integrated dev runs first, then the human's `npm test` waiters in their enqueue order, then ranked item runs, then the rest. Update that test to the decided order without weakening it, and add a frame-level test on a real hub on a temporary project with an isolated lock path: one dev run, one human waiter and one ranked item request queue in that order. `hub/README.md` states the order.

**The human holder's label.** T-307 said the holder reads `human` once T-308 landed. The merged panel's verify line, the queue view and `cland verify queue` text show an admitted human run as `hand run`. Show `human` when the hand-run holder carries `session: "human"`, and keep `hand run` for other hand runs. Use a Neovim headless test on the stub hub and a CLI test.

**Role clauses.**
- The default clauses in `hub/src/roles/default-roles.ts`: the Coordinator's clause names the verify line and `cland verify queue` as the place to read the suite queue. Every role that runs suites is told that the human's own `npm test` waits in the same queue.
- This repo's `.cland/roles.toml` carries the T-275 clause lines that the defaults gained in T-304 to T-306 and in this ticket: resume `--relaunch` and `--fresh`, `cland session archive`, `cland session prune` and the queue line. It also carries the Coordinator's tools `session.archive` and `session.prune` if that file lists tools.
- The roles snapshot tests pin the new text.

**READMEs.** `nvim/README.md`'s sessions section mentions `cland session prune` beside the archive. `hub/README.md`'s `cland verify queue` paragraph names the human waiter's place in the order.

## Constraints

- Tests go through the frame protocol first, on a real hub on a temporary project with `verification.lock_path` pointed at an isolated directory. No test touches the machine's real `/tmp/cland-suite.lock` or the live hub's queue.
- No new seams. Helpers stay out of `hub/test/harness.ts`.
- Suites run through `cland verify`. A protected Linux slot announced in Agents goes first.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. English everywhere.
- The Coordinator clause changes, so the Coordinator relaunches after the merge.

## Acceptance criteria

- [ ] C1. A frame test on a real hub with an isolated lock path queues one integrated dev run, one human `npm test` waiter and one ranked item request, and shows the admission order dev, human, ranked. The existing ordering test is updated to the decided order with its strength kept.
- [ ] C2. An admitted human run shows as `human` on the panel's verify line, in the queue view and in `cland verify queue`, and another hand run still shows as `hand run`. The Neovim headless test on the stub hub and a CLI test cover it.
- [ ] C3. The default clauses and `.cland/roles.toml` name the verify line and `cland verify queue`, and the human's `npm test` waiting in the same queue. `.cland/roles.toml` carries T-275's resume, archive and prune lines. The roles snapshot tests pass with the new text.
- [ ] C4. `nvim/README.md` mentions `cland session prune`, and `hub/README.md` states the queue order with the human waiter's place.
- [ ] C5. `cland verify` is green.
