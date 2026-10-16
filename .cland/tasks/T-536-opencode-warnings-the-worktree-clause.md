---
id: T-536
kind: task
title: OpenCode warnings, the worktree clause, and the codemode and instructions experiments
state: open
status: review
size: M
criterion_seq: 4
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-379
branch: t/T-536-opencode-warnings-the-worktree-clause
created: 2026-10-15T20:59:19.741Z
updated: 2026-10-16T16:24:51.520Z
---

## Summary

E-424 slice 6 (tracer step 6). The doctor warns about OpenCode's free default model and its missing OS sandbox. The clauses forbid moving a session out of its item's worktree. Two measured experiments, `codemode: false` and the clause as instructions, record their results as artifacts on E-424.

## What to build

See E-424's "The codemode experiment", "The instructions experiment", "The warnings" and "The clauses" bullets.

- **Warnings.** The doctor warns when a role launches OpenCode on a free model, which may use the code it sees for training, and that OpenCode has no OS sandbox. Both are warnings, never launch refusals.
- **Clauses.** The role clauses `cland init` writes for roles that may run on OpenCode forbid moving the session out of its item's worktree. Clause changes go in both hub/src/roles/default-roles.ts and .cland/roles.toml.
- **codemode experiment.** It runs in a scratch project holding none of this repository's code: ten scripted turns per setting on the default free model, each asking for one `send`. The measure is the share of turns that deliver the right `send`, and the turn time. The default changes only if `false` is at least as reliable.
- **Instructions experiment.** An adapter option, off by default, carries the role clause as an instruction entry. It is measured once across a forced compaction against the message path. Adoption is the human's later decision, filed in Follow-ups.
- **Results.** Each experiment's result is an artifact on E-424. No provider key is written anywhere.

## Acceptance criteria

- [x] C1. `cland doctor` shows the free-model training warning and the missing-sandbox warning for a role on a free OpenCode model, and neither refuses a launch.
  - done: impl-536 · 2026-10-16T16:24:01.305Z
- [x] C2. The role clauses for OpenCode roles (both copies) forbid moving a session out of its item's worktree.
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-2 · 2026-10-16T16:23:18.437Z · commit 72d4804a2b919ca718c31c6f207a5f22c127e017
  - done: impl-536 · 2026-10-16T16:24:02.215Z
- [x] C3. The codemode measurement is an artifact on E-424 with its decision, and the default changes only where it supports it.
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-2 · 2026-10-16T16:23:18.437Z · commit 72d4804a2b919ca718c31c6f207a5f22c127e017
  - done: impl-536 · 2026-10-16T16:24:02.765Z
- [x] C4. The instructions option exists, off by default, its measurement is an artifact on E-424, and the adoption question is filed in Follow-ups.
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-2 · 2026-10-16T16:23:18.437Z · commit 72d4804a2b919ca718c31c6f207a5f22c127e017
  - done: impl-536 · 2026-10-16T16:24:03.552Z

## Comments

### impl-536 · 2026-10-16T15:53:52.234Z

Implementation uses the existing E-424 seams: doctor CLI against a scratch project/fake binaries, and a real projectHub with fake OpenCode HTTP/MCP. Added warnings (free selection/known free IDs, OS sandbox), worktree guardrail in all override-capable role clauses in both copies, and default-off roleInstructions/CLAND_OPENCODE_ROLE_INSTRUCTIONS with replacement and message fallback. Targeted red→green warnings and instructions tests pass; typecheck exit 0. Real-model experiments are running in empty scratch projects with allowlisted HOME/XDG/OPENCODE_DB, no inherited provider keys.

### impl-536 · 2026-10-16T16:11:48.732Z

C1/C2 implemented in 47c18d54ace34f85fa22330ad4915dd7cd06450c (source commit ff388ff7 plus pre-review origin/dev merge). Typecheck at the merged review head: npm run typecheck exit 0. Targeted files run separately: doctor.test.ts 23/23; opencode-adapter.test.ts 19/19; follow-up bare big-pickle#high warning case passes (6.844s), with a reasoned duration allowance. C3: A-3950 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3950-e-424-codemode-experiment-keep-default-8-10-vs-7-10 records 8/10 default vs 7/10 false; default unchanged. C4: final A-3977 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3977-e-424-final-instructions-comparison-and-readiness-controls contains the completed paired compactions and readiness rerun; instruction control delivered correct sends before/after manual compaction, while message control stalled. Comparison is preliminary/inconclusive for adoption; option stays off. A-3977 completes the preliminary A-3973 note. Human adoption follow-up is T-619. Per Coordinator decision in topic-379, publish in item topic and Coordinator copies A-3950/A-3977 to E-424 after merge. All real servers ran on empty scratch HOME/XDG/database with no inherited provider keys; process exits observed and lsof found no remaining experiment writers. QA policy none/after-stage; no per-item QA brief.

### rev-31 · 2026-10-16T16:14:20.907Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-536-source-1
commit: 47c18d54ace34f85fa22330ad4915dd7cd06450c
scope: full
findings: [{"severity":"medium","text":"A failed role-change/revocation instruction PUT falls back to an acknowledged message while the previously installed durable cland-role instruction remains, preserving stale role authority and losing retry.","file":"hub/src/adapters/opencode.ts","line":274}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: one medium Spec finding at opencode.ts:274; Standards no findings. A-3983 has full review/evidence analysis. Installed cland-role→replacement/revocation PUT failure enters catch, sends ordinary prompt, and resolves without removing stale durable role. Existing fallback test only covers initially absent entry. Require confirmed replacement/removal before fallback acknowledgement; if cleanup fails reject delivery for retry. Add installed-entry replacement/revocation failure and cleanup-failure/retry regressions. Implementer3f0269f6 confirms gap/accepts correction. Warnings, six-role both-copy guardrail, opt-in default and C3 experiment otherwise match scope. Independently recalculated A-3950 default8/10 versusfalse7/10; unchanged codemode correct. A-3977 correctly labels instruction compaction success/message stall comparison inconclusive; T-619 exists. Coordinator1649af65 accepts item-topic artifacts pending epic copy after merge. No verify until corrected-head source review.

Criteria: C4 failed (Role-change/revocation fallback leaves the prior durable instruction installed when its replacement PUT fails.).

### impl-536 · 2026-10-16T16:22:21.054Z

Corrected not-clear source finding A-3983 in pushed head 72d4804a2b919ca718c31c6f207a5f22c127e017. Failed PUT must now confirm DELETE of cland-role before message fallback; failed DELETE rejects injection and leaves acknowledgement pending. Installed-entry replacement/revocation and failed-delete/unconfirmed/retry regressions pass. Targeted red at intended old-entry assertion; full touched opencode-adapter.test.ts now 21/21, new tests 2.994s and 2.607s; typecheck exit 0. Evidence A-3996 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3996-t-536-c4-correction-remove-durable-role-before-fallback.md. No dev merge after first source review. C3/C4 experiment conclusions A-3950/A-3977 unchanged; T-619 adoption remains off. Fresh source review requested before verification; executor will be explicitly droplet per Coordinator's load notice.

### rev-31 · 2026-10-16T16:23:18.437Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-536-source-2
commit: 72d4804a2b919ca718c31c6f207a5f22c127e017
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 findings. A-3998 records M1 resolution. Failed PUT must confirm DELETE before message fallback; DELETE failure rejects injection, so existing Sessions path logs unconfirmed and does not mark injected. New public transition tests cover installed-entry replacement/revocation, failed cleanup with no fallback prompt/ack, then retry and acknowledgement of that exact revocation after cleanup recovers. A-3996 old-code red/corrected21of21 adapter cases and typecheckgreen; origin/diffcheck confirmed. Prior C2 guardrails and independently assessed C3/C4 experiments remain current: A-3950 default8/10false7/10 preserves codemode default; A-3977 inconclusive compaction comparison preserves instructions-off, T-619 filed. Coordinator1649af65 authorizes item artifacts/epic copy after merge. C2/C3/C4 verified; restore claimant done marks after prior C4failure. C1 final execution waits fresh exact-head droplet no-mode verification.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-536 · 2026-10-16T16:24:51.520Z

Clear source review rev-20261016-536-source-2 received at 72d4804a2b919ca718c31c6f207a5f22c127e017; claimant done marks restored. Submitted no-mode verification with explicit droplet executor per Coordinator instruction. Run 39760d2d-36e0-4d27-a402-c92fd64834ad is launching at the exact reviewed head (confirmed through task.view after the initial tool response timed out). No duplicate submission or source change; awaiting the hub result.
