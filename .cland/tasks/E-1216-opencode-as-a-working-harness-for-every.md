---
id: E-1216
kind: epic
title: OpenCode as a working harness for every role
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T09:04:26.967Z
updated: 2026-10-24T09:04:26.967Z
---

## Goal

Code gets written through OpenCode on cheap models, in this project and in others: the human calls this cland's main killer feature (General, 2026-10-24 08:56Z). Every role (Implementer, Reviewer, QA) runs real tasks on OpenCode end to end, as reliably as on Codex, without the Coordinator stepping in. Qualification model: DeepSeek V4.1 Flash, the free variant (human, answer to ask adc5c04a, 09:03Z); exact OpenCode model id pending. Free model, so the spend cap is $0 for the qualification; a paid variant needs the human's approval first.

Today: the OpenCode adapter exists (hub/src/adapters/opencode.ts; E-424 closed), OpenCode 2.0.24 is installed, and no role has run real tasks on it.

## Approach

1. Qualification: 4–6 real XS/S backlog tasks run end to end by an OpenCode Implementer, with review kept on Codex; then Reviewer and QA trials on OpenCode. Measured per run: reaches ready without help, process discipline (TDD, hub `send`, `cland verify`, stays in its worktree, literal rm), review rounds, wall time, token use and cost. Every failure becomes a ticket under this epic.
2. Fixes from the qualification, including T-619 (role clause across compaction via OpenCode instructions).
3. Re-qualification on fresh tasks.

## Definition of done

- [ ] C1. An OpenCode Implementer takes three consecutive XS/S tasks from claim to merge with no Coordinator intervention beyond ordinary briefs and answers, recorded per run in a qualification artifact.
- [ ] C2. An OpenCode Reviewer and an OpenCode QA session each complete a real request with a verdict the hub accepts, recorded in the same artifact.
- [ ] C3. Each run's token use and cost are visible in cland's usage view for the OpenCode session.
