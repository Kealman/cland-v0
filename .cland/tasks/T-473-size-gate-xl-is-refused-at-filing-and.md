---
id: T-473
kind: task
title: "Size gate: XL is refused at filing, and plan-epic splits L tasks into 2–3 M tasks unless the Coordinator records a reason"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: topic-314
branch: t/T-473-size-gate-xl-is-refused-at-filing-and
created: 2026-10-15T09:13:17.633Z
updated: 2026-10-15T18:38:40.996Z
---

## Summary

Retrospective A-2783, START 1: L tasks had a first-pass yield of 2 of 10 and carried 8 of 17 escapes. XL is never filed, and an L task enters a plan only with a recorded reason, or as 2–3 M tasks.

## What to build

- `task create` and `task edit` refuse `--size XL` with a message to split the task.
- `task plan set` warns, through a refusal unless `--allow-large <id>=<reason>` is given, for each L task in the plan.
- The reason is recorded in the plan history.
- The to-tickets and plan-epic skills say to split L tasks into 2–3 M slices.

## Acceptance criteria

- [x] C1. `task create --size XL` and `task edit --size XL` are refused with the split message.
  - done: impl-473 · 2026-10-15T18:31:06.972Z
- [x] C2. `task plan set` with an L task is refused without `--allow-large`, and with it the reason is in the plan history.
  - done: impl-473 · 2026-10-15T18:31:10.715Z
- [x] C3. The to-tickets and plan-epic skills describe the split rule.
  - done: impl-473 · 2026-10-15T18:31:14.973Z
  - verified: rev-30 [reviewer] · run rev-20261015-473-source · 2026-10-15T18:38:40.996Z · commit a969170bcc43009ac72a11ecc65f279a1a91fa7b

## Comments

### impl-473 · 2026-10-15T18:23:17.019Z

Implementation: XL assignments refused in tracker create/edit while legacy files remain readable. Plan set accepts repeatable CLI --allow-large id=reason and MCP allow_large mapping; it requires a non-empty reason for each L lane task and appends canonical item/reason decisions to existing journal-backed plan history. Coverage uses the existing CLI, frame and MCP seams, including refusal atomicity and history restoration.

### rev-30 · 2026-10-15T18:38:40.996Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-473-source
commit: a969170bcc43009ac72a11ecc65f279a1a91fa7b
scope: full

Source review T-473 clear at a969170bcc43009ac72a11ecc65f279a1a91fa7b, fixed point fa00e57a43857bc2a70be077cbd858cf7cc495bb. No high, medium or low findings. Standards and Spec reviewed directly under no-delegation role.
Standards: shared tracker create/edit paths reject newly assigned XL after existing size/kind validation; old item parsing remains compatible. CLI/MCP reach those same checks. Keeping legacy size vocabulary/schema recognition permits the requested split-specific refusal instead of breaking old reads. No unrelated workflow/status behavior changes.
Spec C1: create and edit return the split message without mutating an existing size; legacy XL stays readable. Paired default/project filing clauses and CLI help advertise XS/S/M/L.
Spec C2: repeatable CLI --allow-large and typed-frame/MCP allow_large map are validated before mutation. Every L task actually in plan lanes requires a nonempty, length-checked reason; identifiers canonicalize through the tracker. Unknown/non-L/out-of-plan keys, duplicate aliases and malformed/empty values refuse. The Map avoids object-key ambiguity. Reasons enter existing journal-backed history as canonical task IDs after successful publication.
Unchanged-plan explicit reasons now create a history entry with identical previous/current plan, while plan indexing/scheduling and descendant readiness invalidation remain conditional on actual structural change. Plans with neither change nor reason remain no-ops; invalid proposed plans still refuse before accepted history. Existing approval policy is unchanged.
C3 verified: to-tickets and plan-epic explicitly require 2–3 M slices for L, record each retained L exception, and split XL before filing. Tracker docs/README/help describe flags, history and unchanged-plan decisions.
Test review covers CLI/MCP XL refusal, preserved existing size, malformed/missing/alias-duplicate L exceptions with unchanged bytes, multiple canonical reasons, unchanged-plan history append and restart restoration. A-3258 reports whole task-plan10/10, task-size3/3, roles-snapshot9/9 and roles8/8, plus typecheck green; these are targeted pre-source evidence, not the final gate. Whitespace check passes.
C1/C2 remain unverified until accepted exact-head post-source suite evidence. Source clear permits the requested verification at this exact head under current Coordinator scheduling. No per-item QA criteria. No Reviewer tests, edits, merges or provider calls.

Criteria: C3 verified.
