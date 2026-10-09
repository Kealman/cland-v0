---
id: T-62
kind: task
title: "QA briefs and the qa skill: a QA session runs an item's brief and records its verdict and runs"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: null
parent: T-20
blocked_by:
  - T-54
  - T-57
topic: null
branch: t/T-62-qa-briefs-and-the-qa-skill-a-qa-session
created: 2026-10-09T08:34:54.777Z
updated: 2026-10-09T15:14:29.302Z
---

## Parent

Part of T-20 (slice 2, ticket 11 of 12). Spec sections 4.10 and 7(c); the qa-astra research.

## What to build

The brief, `qa/briefs/T-<n>.md`, is committed and self-contained, because a rescue run cannot ask. It names the item; the build (branch and commit); the cases (ids of `qa/cases/<ID>.lua`, run with `cland --headless --qa`, T-57); manual checks (commands and expected outcomes); the surface per case (`headless-grid` by default, or `tmux`, `web-terminal`, `hub-api`); what is out of scope; and the grants needed, none by default. Each case file opens with its catalogue header: id, title, preconditions, expected result, since, regression. Runs go one JSON line per case and run into `.cland/qa/runs.jsonl`, with evidence in `.cland/qa/T-<n>/<run>/` (decision D14); the QA role's default `writable_roots` gains `.cland/qa`, and the managed `.gitignore` ignores `qa/` under `.cland`. The `qa` skill (`.agents/skills/qa/`) has two parts. For the QA role: run each case of the brief from the item's worktree, append the lines, write the verdict (`task.comment --verdict qa --result … --run … --commit …`, T-54; clear only when every case in scope passed, with the case table in its text), and report to the Coordinator. For the Coordinator: write the brief, send `qa request T-<n>` naming it, or run it through `/codex:rescue --background --fresh --model gpt-6-astra "Run the QA brief in qa/briefs/T-<n>.md exactly"` and record the returned verdict itself (which the merge gate does not count, decision D5); file each finding as an item labelled `qa-found` and `needs-triage`. The QA clause and `docs/review-and-qa.md` follow.

## Acceptance criteria

- [ ] A brief with two cases, sent as a `qa request` to a real Codex QA session (gpt-6-astra), ends with a QA verdict on the item, written through the hub by that session with the commit and the case table, and two lines in `.cland/qa/runs.jsonl` holding `ts`, `item`, `run`, `case`, `build`, `surface`, `method`, `result`, `exit_code`, `evidence` and `session`. The run is recorded in a comment on this item.
- [ ] A FAIL, BLOCKED or INCONCLUSIVE case makes the verdict `not clear` and names the case.
- [ ] The same brief through `/codex:rescue` returns the case lines and the verdict in its output; recorded by the Coordinator, it shows in the item view as the Coordinator's.
- [ ] The `qa` skill is in the QA and Coordinator skill lists of the default `roles.toml`, and `docs/review-and-qa.md` describes the brief and the runs line.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Test seam: a real Codex QA session through the hub on a fixture item, and one rescue run, both recorded on the item; the skill's command sequences run against a real hub, as the skills-tracker test does for the tracker template. Size M. Implementer: Claude Code (the criteria need a real Codex QA session and a `/codex:rescue` run).

## Comments

### coord · 2026-10-09T08:39:13.470Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/57 (a sub-issue of #20; the item is the source of truth).
