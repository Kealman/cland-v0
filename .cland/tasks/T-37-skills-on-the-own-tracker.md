---
id: T-37
kind: task
title: Skills on the own tracker
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-35
topic: null
branch: null
created: 2026-10-08T11:55:19Z
updated: 2026-10-10T00:58:17.406Z
github:
  repo: Kealman/cland-v0
  number: 37
  url: https://github.com/Kealman/cland-v0/issues/37
---

## Parent

Part of #19. Spec sections 4.6 and 4.9; decisions https://github.com/Kealman/cland-v0/issues/8 and https://github.com/Kealman/cland-v0/issues/17. The skills live under `.agents/skills` with `.claude/skills` as a symlink (current repo layout).

## What to build

The Matt Pocock process skills work against the own tracker through their "other" tracker mode: a `docs/agents/issue-tracker.md` template for cland projects describes `cland task` for every operation the skills name (create, read, list, sub-items through `parent`, blocking edges through `blocked_by`, comments, labels, close, the wayfinding operations: map label, claim by assignee, frontier query), and the skills `to-spec`, `to-tickets`, `triage`, `wayfinder` and `implement` are exercised against a temporary project with real items. Where a skill's wording assumes GitHub (`gh` commands, PR surfaces), the vendored copy in `skills/` is patched minimally and the patch is recorded.

## Acceptance criteria

- [ ] `to-tickets` run in a test project creates items with parent and blocked-by edges in `.cland/tasks` through `cland task`
- [ ] `wayfinder` creates a map item and child items, claims through the assignee and finds the frontier through the CLI
- [ ] `triage` applies the configured labels through `cland task edit`
- [ ] Every patch to a vendored skill is listed in a `skills/PATCHES.md` note with the reason
- [ ] The `docs/agents/issue-tracker.md` template is the one `cland init` will provision

## Comments

### Kealman · 2026-10-08T13:07:42Z

<!-- github-comment: 6060559823 -->

Done on main (207b31a, b0c148a): skills/templates/docs/agents/issue-tracker.md (the 'other' tracker template over cland task, with the wayfinding operations), triage-labels and domain templates, two minimal patches to to-tickets and triage recorded in skills/PATCHES.md, hub/test/skills-tracker.test.ts drives the template's command sequences against a real hub (to-tickets, wayfinder frontier/claim/resolve, triage). Caveat: no LLM invoked the skills; the sequences were exercised by test and by hand. CLI gaps noted for later: no --parent/unassigned/unblocked filters in task list (jq needed), no author field, no atomic body append.
