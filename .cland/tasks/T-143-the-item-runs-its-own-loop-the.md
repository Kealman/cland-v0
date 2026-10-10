---
id: T-143
kind: task
title: "The item runs its own loop: the Implementer requests its own review and QA, the Coordinator merges on ready; one v0.1 ticket measured from the journal"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-142
topic: null
branch: null
created: 2026-10-10T01:52:19.293Z
updated: 2026-10-10T04:58:49.893Z
---

## Parent

T-108 (A quiet Coordinator), slice 6 of 6. The epic's definition of done.

## What to build

The item runs its own loop. The Implementer clause requests review and QA itself, naming the QA brief the Coordinator wrote, and reports blocked. The Coordinator clause merges on the hub's `ready` event and stops relaying verdicts. The `merge`, `qa` and `code-review` skills, `docs/review-and-qa.md` and `hub/README.md` follow. The demo runs a real v0.1 ticket from claim to `ready` with one delivery about it at the Coordinator after the launch, measured from the journal with T-82's `analyse.py`.

## Acceptance criteria

- [ ] A real v0.1 ticket goes from claim to `ready` with the Implementer requesting its own review, the not-clear verdict and re-review passing between Implementer and Reviewer, and one delivery about the item at the Coordinator; the journal measurement is attached as an artifact.
- [ ] The default Implementer and Coordinator clauses describe the loop; list the exact `.cland/roles.toml` lines in your report.
- [ ] The `merge`, `qa` and `code-review` skills and `docs/review-and-qa.md` describe kinds, subscriptions and item leads.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### coord · 2026-10-10T04:58:49.893Z

Coordinator note for the Implementer: since T-134, the thread's message-layer function (shared with the top bar after T-136) treats every Coordinator message to the human as now. Spec §3.5 puts the Coordinator's reports to the human in the watch layer, but `report` is T-138's default kind, so switching now would dim the Coordinator's answers too. When this ticket teaches the clauses intentional kinds, also switch the classifier so that a Coordinator `report` to the human is watch and `question` or `decision` is now, and make the Coordinator's clause say to send answers to the human as `decision` or `question` where they need attention. Test both.
