---
id: T-536
kind: task
title: OpenCode warnings, the worktree clause, and the codemode and instructions experiments
state: open
status: ready
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
updated: 2026-10-16T18:35:19.238Z
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
  - verified: rev-31 [reviewer] · run rev-20261016-536-final · 2026-10-16T18:35:18.840Z · commit 4f51454ed441f9c152fd2efe3f718544e1553ae7
- [x] C2. The role clauses for OpenCode roles (both copies) forbid moving a session out of its item's worktree.
  - done: impl-536 · 2026-10-16T16:54:47.373Z
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-3 · 2026-10-16T16:55:25.681Z · commit 4f51454ed441f9c152fd2efe3f718544e1553ae7
- [x] C3. The codemode measurement is an artifact on E-424 with its decision, and the default changes only where it supports it.
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-2 · 2026-10-16T16:23:18.437Z · commit 72d4804a2b919ca718c31c6f207a5f22c127e017
  - done: impl-536 · 2026-10-16T16:24:02.765Z
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-3 · 2026-10-16T16:55:25.681Z · commit 4f51454ed441f9c152fd2efe3f718544e1553ae7
- [x] C4. The instructions option exists, off by default, its measurement is an artifact on E-424, and the adoption question is filed in Follow-ups.
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-2 · 2026-10-16T16:23:18.437Z · commit 72d4804a2b919ca718c31c6f207a5f22c127e017
  - done: impl-536 · 2026-10-16T16:24:03.552Z
  - verified: rev-31 [reviewer] · run rev-20261016-536-source-3 · 2026-10-16T16:55:25.681Z · commit 4f51454ed441f9c152fd2efe3f718544e1553ae7

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

### rev-31 · 2026-10-16T16:48:40.991Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-536-evidence-1
commit: 72d4804a2b919ca718c31c6f207a5f22c127e017
scope: evidence
findings: [{"severity":"medium","text":"New156byte guardrail makes Coordinator clause reply7823bytes, exceeding established7680byte cap-with512headroom; both shipped/project snapshot tests fail.","file":"hub/src/roles/default-roles.ts","line":57}]
finding_counts: {"high":0,"medium":1,"low":0}

Gate not clear; A-4032. Exact-head Linux39760d2d/A-4031 exit1:1946pass/2fail/5skip, no Neovim. Both own clause snapshot cases fail roles.ts88 on7823byte Coordinator reply versus8192-512=7680. Independently measured new guardrail156bytes, previousreply7667fits: direct task regression, not flake. Compact both clause copies retaining guardrail/required role content and unchanged512headroom assertion; rerun whole roles file and request new source review before verification. C2 failed; C1 final mark pending. C3/C4 source evidence current and stale-instruction finding remains resolved; allfive added doctor/instruction identities5of5. No Reviewer edits/tests.

Criteria: C2 failed (Added guardrail pushes both Coordinator clause copies above the established reserved reply budget (7823>7680 bytes).).

### impl-536 · 2026-10-16T16:54:47.212Z

Gate 39760d2d / A-4031 failed only task-owned Coordinator clause byte assertions (7823 > 7680 with unchanged 512-byte headroom). Corrected in pushed head 4f51454ed441f9c152fd2efe3f718544e1553ae7: compact explicit OpenCode worktree ban for all roles in both copies, remove Coordinator's illustrative cost cache/shorten daily-cap pointer, compact QA request cleanup prose after whole-file validation exposed QA's previously full budget. Same policy and metadata preserved. roles.test.ts now explicitly asserts the guardrail in every role's emitted clause. Targeted red reproduced both original failures; whole roles.test.ts 8/8 and surface.test.ts 3/3 passed, run separately under load threshold; typecheck exit 0. A-4035 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4035-t-536-c2-correction-preserve-worktree-guardrail-and-clause-reply-headroom.md records the correction. No head merge after first review. Fresh source review requested before another no-mode droplet gate.

### rev-31 · 2026-10-16T16:55:25.681Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-536-source-3
commit: 4f51454ed441f9c152fd2efe3f718544e1553ae7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 findings. A-4036 records review. Compact categorical OpenCode worktree ban remains in allsix roles/bothcopies. Coordinator removes illustrative cost only, retains sharding/shortage fallback/cap pointer; QA shortens request prose preserving required fields, any-role permission, cleanup and report routing. Existing512byte headroom assertion unchanged; emitted-clause test additionally verifies ban for every role/bothsources. A-4035 reports old7823>7680 reproduced then whole roles8of8/surface3of3/typecheckgreen. Diff/ref confirmed; no dev merge. C2 finding resolved, C2/C3/C4 current; prior instruction correction/experiments unchanged. C1 final execution awaits fresh exact-head no-mode droplet gate; A-4031 remains historical exit1.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-536 · 2026-10-16T16:56:01.949Z

Source review clear rev-20261016-536-source-3 at 4f51454ed441f9c152fd2efe3f718544e1553ae7 received; working tree clean and HEAD confirmed unchanged. Submitted fresh no-mode verification with explicit droplet executor as 007fa789-775e-4df7-9838-105fe5ed17c2, queued in topic-379 with reports to reviewer and impl-536. Waiting for same-head result; no further source changes.

### impl-536 · 2026-10-16T17:27:03.839Z

No-mode droplet gate 007fa789 / A-4068 at exact source-reviewed 4f51454ed441f9c152fd2efe3f718544e1553ae7 failed only 3 tests outside the diff. Both clause-budget cases passed. Failure 1: known T-585 Claude discovery/watch case, this time 'the next launch does not bypass the schedule' (PID vs null, claude-code-adapter.test.ts:349). Failures 2/3: T-569 demo run-timeout and machine-lifetime watchdog cases, 'demo deadline reached during delivery' / 'machine command failed or exceeded its time bound' (demo.test.ts:71). T-569 already records the shared-defect/quarantine candidate. Reported with run id to lead T-536; holding diagnosis and awaiting posted shared fix or unchanged-head retry direction. No source changes or local test runs. Linux c-8 lon1, lifetime 1784s, $0.1239, peak 1m load 14.30; 1953 tests, 1945 pass, 3 fail, 5 skip. Durable log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4068-suite-007fa789-775e-4df7-9838-105fe5ed17c2-auto-at-4f51454.log.

### rev-31 · 2026-10-16T17:27:12.214Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-536-evidence-2
commit: 4f51454ed441f9c152fd2efe3f718544e1553ae7
scope: evidence
findings: [{"severity":"medium","text":"External next-launch scheduling assertion returns PID21953 instead ofnull; same T-585 case but a different assertion from its recorded2vs1 count failure, requiring classification.","file":"hub/test/claude-code-adapter.test.ts","line":349},{"severity":"medium","text":"External run-timeout and machine-lifetime demo.start deadline failures keep gate exit1 (T-569 family); no item-specific gate acceptance.","file":"hub/test/demo.test.ts","line":71}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear, A-4070. Same-head Linux007fa789/A-4068:1945pass/3fail/5skip, exit1, no Neovimsmoke. Both clause snapshots now pass (4.084/3.852s); prior C2budget finding resolved. Allfive new warning/instruction identities5of5, C2/C3/C4 source markscurrent; C1 pending final disposition. External failures are Claude schedule349actualPIDvsnull (T-585samecase/differentassertion) and both demo deadlines71(T-569family). Bugs/S aside for lead classification; no task criterion failed, no scope expansion/retry/known-flake exception assumed. Lifetime1784s/cost0.1239perreceipt. No Reviewer edits/tests.

### impl-536 · 2026-10-16T17:28:39.441Z

Coordinator directed one unchanged-head retry now (topic-379 decision 5c41b561-b107-4d93-b378-74d3f283807e), without waiting for T-569/T-585 fixes. Retry 66f233ea-3234-401c-9be2-d60f00afbb4b is queued with no mode, explicit droplet executor and the same report/recipients. HEAD 4f51454ed441f9c152fd2efe3f718544e1553ae7 and clean tree confirmed. If this is red only on the known flakes again, report both 007fa789 and 66f233ea to lead T-536 and hold for Coordinator disposition/quarantine decision before anything else.

### impl-536 · 2026-10-16T18:35:15.194Z

Authorized unchanged-head retry 66f233ea-3234-401c-9be2-d60f00afbb4b passed (auto exit 0) at source-reviewed 4f51454ed441f9c152fd2efe3f718544e1553ae7. A-4110: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4110-suite-66f233ea-3234-401c-9be2-d60f00afbb4b-auto-at-4f51454.log. Hub package plus Neovim smoke: 1965 tests, 1960 passed, 0 failed, 5 skipped; Linux x64 c-8 lon1, lifetime 1374s, $0.0954, peak 1m load 12.48. No source changes or shared-fix cherry-picks; clean tree/HEAD confirmed. Awaiting Reviewer final same-head settlement/C1 mark.

### rev-31 · 2026-10-16T18:35:18.840Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-536-final
commit: 4f51454ed441f9c152fd2efe3f718544e1553ae7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards0/Spec0 findings, A-4111. Independently inspected exact-head Linux retry66f233ea/A-4110 exit0:1960pass/0fail/5skip, including12of12 Neovim smoke. Doctor training/sandbox warnings and allfour new instruction transition/fallback cases pass ordinary execution and5of5 load repetitions each. Both clause-budget snapshots pass; prior external reds do not recur. C1 verified; C2/C3/C4 source-3/A-4036 remain current at unchanged branch head. Experiment defaults remain unchanged/off and T-619 adoption follow-up stands. All claimant done marks present. Hub-only plus Neovim smoke, not full Neovim package. Lifetime1374s/cost$0.0954 perhub. No exception, edits or Reviewer tests.

Criteria: C1 verified.
