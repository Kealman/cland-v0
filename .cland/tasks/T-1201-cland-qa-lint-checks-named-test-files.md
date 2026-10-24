---
id: T-1201
kind: task
title: cland qa lint checks named test files, tests and selectors at the build and flags literal counts
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-998
branch: t/T-1201-cland-qa-lint-checks-named-test-files
created: 2026-10-24T06:46:04.795Z
updated: 2026-10-24T20:51:40.103Z
---

## Summary

QA briefs written before an item's code existed carried guessed test names and literal counts that drifted with landings (E-419 stage briefs, inbox.test.ts 22→23). Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. qa lint fails a brief that names a test file or test title absent at the build SHA, or a selector absent from web/src (test).
- [ ] C2. qa lint flags literal test, member and item counts and points to task plan show or the generated cases instead (test).

## Comments

### impl-1201 · 2026-10-24T20:51:40.103Z

Consumer inventory before changing lint policy: production hub/bin/cland.ts offline qa dispatch -> hub/src/cli/qa-lint.ts -> lintQaBrief; existing T1 hub/test/qa-lint.test.ts and T2 hub/test/qa-lint-cli.test.ts; help snapshot hub/test/fixtures/cli-usage/commands.json and CLI usage tests; docs/agents/qa-brief-lint.md, hub/README.md QA brief lint, .agents/skills/qa/{SKILL,BRIEF,STAGE-BRIEF}.md. Repository-wide qa-lint/lintQaBrief/qa lint search found no wire clients, persisted readers, startup probes or T3/T4 callers. Existing briefs are lint inputs, not parser consumers; old text-only lintQaBrief calls remain supported. New reference checks use an additive build-source input; output finding shape and exits stay unchanged. Test seams: existing public pure lint function (T1), offline CLI with sealed scratch fixture (T2).
