---
id: T-478
kind: task
title: found_by on regressions and answered_as on ask answers
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by: []
topic: topic-327
branch: t/T-478-found-by-on-regressions-and-answered-as
created: 2026-10-15T09:13:19.908Z
updated: 2026-10-15T21:10:09.138Z
---

## Summary

Retrospective A-2783, START 2: escapes could not be attributed to where they were caught, and the human's answers could not be told apart from the stand-in's.

## What to build

- **`found_by`.** An item with `regression_of` takes `found_by`, one of review, cover, droplet, qa or human, through `task create`/`task edit` and the tools.
- **`answered_as`.** An ask's answer records `answered_as`: human, or stand-in with its session name. It is set from the answering client's identity, and the stand-in's relay is marked.
- **Where they appear.** Both are shown in `task view` and the journal.

## Acceptance criteria

- [ ] C1. `task create --regression-of T-n --found-by cover` stores and shows found_by, and a value outside the set is refused.
- [ ] C2. An ask answered from the human's shell records `answered_as: human`, and one answered by a named stand-in records `stand-in` with its name.
- [ ] C3. hub/README.md describes both fields.

## Comments

### impl-478 · 2026-10-15T20:59:11.731Z

Implemented found_by across frontmatter, tracker index and task-written journal, task create/edit CLI and MCP schemas; missing regression or out-of-vocabulary values refuse, clearing regression drops attribution. Targeted new task-attribution.test.ts passes 2/2 (Mac quiet, load 2.05; longest test 0.783s). Ask identity decision pending with lead.

### impl-478 · 2026-10-15T21:10:09.138Z

Implementation committed as ea0f03f8. Followed Coordinator answer c5e97e15: human-shell --as <name> is a self-declared stand-in label; all known session shells, including Aides, remain refused. Origin persists on ask cards/messages and relays, in task view item.answers, journal and answer delivery metadata. Final ask-attribution.test.ts 3/3 passes (longest 1.683s); typecheck and shard lint pass. task-attribution and existing asks full-file reruns waiting for current Mac load limit (<10), then first source review.
