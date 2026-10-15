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
updated: 2026-10-15T19:05:16.848Z
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

### rev-30 · 2026-10-15T19:01:50.251Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-473-linux-first
commit: a969170bcc43009ac72a11ecc65f279a1a91fa7b
scope: evidence

Evidence review T-473 not clear at source-reviewed a969170bcc43009ac72a11ecc65f279a1a91fa7b. Actual Linux c-8 receipt A-3275/2df3d3fe exits 1: 1790 pass/2 fail/3 platform skips. Host/remote typecheck and hub phases complete; full Neovim is not reached after hub red.

Medium — hub/test/skills-tracker.test.ts:38: the existing skill contract test still demands /XS, S, M, L or XL/ from both changed skills. T-473 intentionally changes their filing vocabulary to XS/S/M/L and requires XL splitting. A-3275:4064–4066 deterministically fails against the updated to-tickets text. Update this test to require the new allowed filing sizes, XL-before-filing split rule, L-to-2–3-M guidance and retained Coordinator reason/--allow-large exception, preserving its existing Summary/regression-link assertions. Do not restore XL filing language just to satisfy the old regex. This is own-task test migration, not a known external flake; the receipt is excluded from final gate pairing and requires correction/source review before another full run.

Known outside failure / Bugs S — hub/test/account-limited.test.ts:265: recent failed-poll backoff case reads one account-polled row while expecting two (A-3275:4047–4061). This matches the T-493 poll-state/journal publication family already classified by the Coordinator in earlier gates. No account-poll source change is requested for T-473. Its presence does not waive the independent task-caused skill test failure.

Standards: the source behavior remains consistent with the reviewed size gate; the associated existing skill assertion was missed in the initial targeted mapping. Spec: the skill text itself correctly states the requested split rule, and all ten task-plan, three task-size, nine role-snapshot and eight role cases complete green (A-3275:5154–5171, :5609–5618, :5627–5629). This is own functional execution evidence, not a final integrated gate. No criterion is failed speculatively and no final C1/C2 marks are added. C3's documentation fact remains established at the reviewed source, subject to normal head freshness.

Return a new source/delta request after the test correction and any Coordinator-posted shared picks. Keep the new head fixed for its post-source verification under current admission rules. A-3275 cannot serve as a first known-only receipt because of the demonstrated own failure. No Reviewer edits, tests or provider calls.
