---
id: T-455
kind: task
title: "Rulebook: .cland/RULES.md with numbered rules, read and written by cland rule add, edit, retire, list and show, and reloaded by the hub when the file changes"
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: topic-276
branch: t/T-455-rulebook-cland-rules-md-with-numbered
created: 2026-10-15T07:15:15.459Z
updated: 2026-10-15T13:19:31.897Z
closed: 2026-10-15T13:19:31.896Z
---

## Summary

The project's rules live in the Coordinator's harness memory today, where another harness cannot read them and nobody can see them whole (Q-378). This ticket adds the rulebook as a committed project file, `.cland/RULES.md`, and the `cland rule` commands that read and write it through the hub. The hub re-reads the file when it changes, as it does `roles.toml`. Getting rules into clauses, briefs and deliveries is ticket T-456.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 3 of 7; spec `docs/spec/v0.1.3.md` §3.2; the epic's choices "The file's shape", "Rule ids beside item ids", "The commands and tools" and "Who records a rule", and the 2026-10-14 amendment (plain numbers, no letter prefix); ADR 0002.

## What to build

**The file.** `.cland/RULES.md` starts with a one-line header. Each rule is written:

```markdown
## 3 One suite at a time
Scope: all
Date: 2026-10-14
Status: active
Origin: memory:~/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/one-suite-at-a-time.md
Reason: two full suites at once cascade into flaky failures.

Run at most one full suite at a time machine-wide; targeted single-file runs are free.
```

- `Scope:` is `all` or a comma-separated list of role names from `roles.toml`.
- `Status:` is `active` or `retired <date>`.
- `Origin:` takes one of these forms:
  - `message:<topic>/<msg_id>`, a human message in a thread;
  - `session:<name>`, an Aide;
  - `shell`;
  - `workbench`;
  - `memory:<path>`, the seed.
- The rule's text is the paragraph after the fields.
- Numbers count up in the file and are never reused. A retired rule stays in the file.

**Parser and writer.** Add a hub module, for example `hub/src/rules/rulebook.ts`, with a pure parse and render pair.

- The writer is the hub. It writes atomically, preserves every other rule byte for byte, and assigns the next number as one more than the highest ever written.
- The hub watches the file as it watches `roles.toml`, so a hand edit or a merge that changes it is re-read.
- A file that does not parse is logged with the line and the reason. The last good version stays in force.
- `cland init` writes an empty rulebook with its header. The header comment in `.cland/.gitignore` names `RULES.md` among the committed files.

**Frames and CLI.** Add frames `rule.add`, `rule.edit`, `rule.retire`, `rule.list` and `rule.show` to `hub/src/protocol.ts`, and `hub/src/cli/rule.ts` wired into the CLI and `usage.ts`:

- `cland rule add <text> --scope <roles>|all --reason <text> [--title <t>] [--origin memory:<path>]`
- `cland rule edit <n> [--text t] [--scope s] [--reason r]`
- `cland rule retire <n> --reason <text>`
- `cland rule list [--all] [--role r]`. Active rules only by default; `--role` filters to the rules in that role's scope.
- `cland rule show <n>`
- Each command takes `--json`. A rule is addressed by its plain number. Printed output writes it `rule <n>`, never `R-<n>`, because `R-` is the release prefix.

**Who may write.** The CLI acts as its caller (`hub/src/cli/actor.ts`).

- The human's shell records origin `shell`, or the `--origin memory:<path>` it names.
- An Aide's shell records `session:<aide-name>`, or `memory:<path>` when it names one. The seed task (04) relies on that.
- Any other session's shell is refused with `forbidden` and the reason: Coordinators record through the `rule.add` tool from a human message (ticket T-456), and other roles propose a rule to the Coordinator.
- An edit or retirement keeps the rule's number and origin and updates `Date:`. A retirement appends its reason to `Reason:`.

**Tests** use the CLI against a temporary project through `hub/test/harness.ts`, and the parser has unit tests.

## Acceptance criteria

- [x] C1. `cland rule add "…" --scope implementer --reason "…"` from the human's shell writes `## 1 <title>` with `Scope`, `Date`, `Status: active`, `Origin: shell` and `Reason` lines and the text to `.cland/RULES.md`, and the next add gets `2`.
  - done: impl-455 · 2026-10-15T07:26:14.401Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02
- [x] C2. `cland rule edit 1 --scope all` and `cland rule retire 1 --reason "…"` rewrite only that rule, keeping its number and origin; a retired rule stays in the file and its number is never reused.
  - done: impl-455 · 2026-10-15T07:35:38.751Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02
- [x] C3. `cland rule list --all --json` returns active and retired rules with every field, `cland rule list` returns active ones only, `--role r` filters by scope, and `cland rule show <n>` prints one rule written as `rule <n>`.
  - done: impl-455 · 2026-10-15T07:26:18.826Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02
- [x] C4. A hand edit of `.cland/RULES.md` is re-read without a hub restart, and a file that does not parse is logged with its line while the last good rulebook stays in force.
  - done: impl-455 · 2026-10-15T07:26:20.085Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02
- [x] C5. From an Aide's shell `cland rule add --origin memory:<path>` records that origin, and from an Implementer's or a Coordinator's shell `cland rule add` is refused with `forbidden` and a reason.
  - done: impl-455 · 2026-10-15T07:26:21.600Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02
- [x] C6. `cland init` writes an empty rulebook with its header, and `.cland/.gitignore`'s header names `RULES.md` as committed.
  - done: impl-455 · 2026-10-15T08:00:59.227Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02
- [x] C7. `hub/README.md` describes the rulebook file, its fields and origins, the `rule <n>` form, the `cland rule` commands and who may write.
  - done: impl-455 · 2026-10-15T07:26:24.793Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-2 · 2026-10-15T07:35:24.942Z · commit 856181faa8000c4a4470886fccec61cd107c8979
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-4 · 2026-10-15T08:01:41.809Z · commit a0ec44eaf1bbfc125d1709bf544913dac3bce709
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-6 · 2026-10-15T08:38:15.180Z · commit f5ef70453f08b9f2a55289302e37de98b984bb5d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-8 · 2026-10-15T12:11:45.111Z · commit 91635a792948255a2608cd4690d6a0c4c43b3516
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-10 · 2026-10-15T12:43:54.062Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-12 · 2026-10-15T13:13:33.428Z · commit 17d643130d3d7fc3b06b20908188f209e69ae5bc
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-13 · 2026-10-15T13:19:21.953Z · commit fdc7da1a03e09a61f30b72425a232c201b375f02

## Comments

### impl-455 · 2026-10-15T07:23:36.508Z

Implementation in progress: pure rulebook codec preserves untouched entry spans; hub serializes atomic writes and refreshes every 500 ms, retains last good on line-numbered parse errors, and refuses overwriting broken source. Rule CLI lifecycle, held-role permissions/origins, live reload and concurrent-write tests pass (4 cases, each under 5 s). Init and documentation integration underway.

### rev-23 · 2026-10-15T07:29:42.678Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-1
commit: 91abcce8b1b56db43c11a91802c2109e12007df0
scope: full

Medium — hub/src/rules/file.ts:76-77: writer awaits its temporary-file write then renames without re-reading RULES.md, silently overwriting an intervening hand edit/merge to an unrelated rule. This violates preservation of other entries; add CrewFile-style stale-source refusal and deterministic native-window public-CLI regression while retaining authorization/atomicity checks. Implementer confirmed the gap. Standards: no high/medium independent finding; remaining Spec review found no other confirmed high/medium defect. Parser, origins/held-role refusal, CLI, last-good reload, init and docs reviewed. Lead clarification pending on never-reused IDs when valid hand edits remove/renumber the highest entry; current-file max behavior recorded without inferring that scope. A-2723 details complete review. No verification at this head; request corrected-source review before no-mode cland verify with no executor flag.

Criteria: C2 failed (A stale full-file rename can overwrite an intervening hand edit/merge to another rule during the temporary-write await; re-read/refuse stale source before publication.).

### impl-455 · 2026-10-15T07:33:57.801Z

Corrected head 856181fa fixes the stale-source overwrite confirmed by review and implements the Coordinator’s file-held high-water decision. Both new regression cases reproduced red before the fix; rule CLI 6/6, parser 2/2, init 16/16, hub typecheck and shard lint pass. See corrected-head evidence artifact in this topic.

### rev-23 · 2026-10-15T07:35:24.942Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-2
commit: 856181faa8000c4a4470886fccec61cd107c8979
scope: full

Corrected source clear. Standards and Spec: no high or medium findings remain. C2 stale overwrite fixed by source re-read/equality refusal plus authorization before rename; deterministic public CLI native-write-window regression proves exact intervening sibling preservation, temp cleanup and successful retry. Coordinator 095198b5 numbering decision implemented with file-held high-water state, max(mark, highest present)+1, explicit missing-marker fallback, low-mark warning and higher-mark merge guidance. Tests cover highest retired-entry deletion, missing/low markers; untouched raw spans remain preserved. Init/header/docs agree. Original held-actor origins/refusals, CLI, serialized writes and last-good behavior reviewed in A-2723 remain unchanged. A-2725 reports CLI 6/6, parser 2/2, init 16/16 and typecheck/shards/diff green. A-2726 details full corrected review. C7 verified; C1-C6 remain run-dependent pending exact-head no-mode cland verify, no executor flag under current hub policy. Restore claimant C2 done mark after correction; no per-item QA required.

Criteria: C7 verified.

### rev-23 · 2026-10-15T07:59:31.477Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-3
commit: 856181faa8000c4a4470886fccec61cd107c8979
scope: evidence

Medium — hub/test/daemon.test.ts:181: the committed .cland inventory omits intended RULES.md, making an existing test fail after this change. Update that exact list, preserving all runtime exclusions; this companion assertion was missed in source review.
A-2746 / 8052e04c is red at the exact source-reviewed head: 1722 passed, 3 failures, 3 platform skips, Neovim not reached. Other failures are hub/test/claude-code-adapter.test.ts:389 (signed-out watch 3 CLI calls vs 2) and hub/test/claude-code-sessions.test.ts:251 (clause injection timeout); these need shared-defect disposition. A-2748 records evidence. No new criterion verification; corrected source requires re-review before another run.

### rev-23 · 2026-10-15T08:01:41.809Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-4
commit: a0ec44eaf1bbfc125d1709bf544913dac3bce709
scope: delta

Corrected source clear; no high/medium finding. hub/test/daemon.test.ts:181 adds intended committed RULES.md to the exact sorted inventory, preserving all volatile probes and assertions. Incoming dev is tracker-only; rulebook source and docs remain A-2726's reviewed implementation. Claimant reports daemon file 15/15. A-2750 records this delta.
C7 refreshed; C1-C6 await successful exact-head verification. Prior red 8052e04c/A-2746 remains retained. Read Coordinator 8c3f65e0 directly: five serial isolated whole claude-code-adapter file passes are required before its permitted one resubmit; a failure becomes shared-fix work. T-447 owns clause-injection line 251 and can arrive later. No verification permission beyond that disposition; release merge hold remains.

Criteria: C7 verified.

### impl-455 · 2026-10-15T08:05:59.463Z

Corrected exact committed-file inventory in a0ec44ea, source delta clear rev-2026-10-15-455-4. Whole daemon file 15/15 green. Coordinator-requested adapter whole-file serial repros are 5/5 green (45/45 tests), evidence A-2754; per 8c3f65e0 this permits one verification resubmit and the Coordinator files the signed-out-watch flake. Independent clause timeout belongs to shared fix T-447.

### rev-23 · 2026-10-15T08:31:22.359Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-5
commit: a0ec44eaf1bbfc125d1709bf544913dac3bce709
scope: evidence

Exact-head resubmit 1ea1e21d/A-2777 remains red: 1724 pass, one assertion fail, three platform skips; Neovim not reached. Untouched hub/test/session-usage.test.ts:176 sees two pre-restart usage records versus one. This is a second different unrelated failure after the permitted resubmit; no further automatic retry.
Own new-test budget failure: hub/test/rule-cli.test.ts:44 held-identity/origin test 5.358s >5s. Preserve assertions and improve setup or add an individually justified allowance before re-review. Existing unmanifested daemon orphan-startup (5.021s) and suite cancellation-cache (5.039s) also fail budget checks and require lead disposition. The corrected inventory and both prior Claude assertions pass.
A-2780 records this result and retains prior red 8052e04c/A-2746 and specific retry provenance A-2754/8c3f65e0. No new criterion verification; final gate remains not clear.

### impl-455 · 2026-10-15T08:37:12.309Z

A-2777's new shared restart-usage failure passed the Coordinator-required five serial whole-file runs at 9c90591b (40/40 test executions); evidence A-2785. Last case change c28bf3c4 (T-389). Added an individually reasoned 5.358 s allowance for own rule CLI actor matrix; merged release-cover duration baseline 3d300562 and latest dev 045d24fa. Final head f5ef7045 requires corrected-head review before the Coordinator-permitted one verification resubmit.

### rev-23 · 2026-10-15T08:38:15.180Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-6
commit: f5ef70453f08b9f2a55289302e37de98b984bb5d
scope: delta

Source delta clear; no high/medium finding. Incoming Coordinator 3d300562 refreshes manifest from release cover A-2714 and includes both existing-case gaps; branch adds only the measured, individually reasoned 5.358s real CLI authorization-matrix allowance. No runtime/test assertion changes. Incoming dev config raises remote_budget 2→4 under its recorded human decision, daily cap unchanged; remaining incoming material is tracker. Rulebook source and corrected inventory remain A-2726/A-2750.
Audited A-2785 five whole-file usage logs: 8/8 each, zero failure/skip/cancel at 9c90591b; later merge is config/tracker only. Directly read Coordinator 3fa25240/ca169d70: T-463 tracks usage flake, and one verify at reviewed f5ef7045 is authorized after these passes. A-2786 records the delta/provenance.
C7 refreshed; C1-C6/final evidence remain pending. Submit no-mode cland verify at this head without executor override. Retain/name earlier reds 8052e04c/A-2746 and 1ea1e21d/A-2777, plus T-461/T-447/T-463 disposition in final evidence.

Criteria: C7 verified.

### rev-23 · 2026-10-15T09:05:26.628Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-7
commit: f5ef70453f08b9f2a55289302e37de98b984bb5d
scope: evidence

9008902b/A-2808 is red at the exact source-reviewed head: 1727/1728 hub tests pass, zero skips; Neovim not reached. Sole failure is untouched claude-code-adapter.test.ts:232/:252, 'the clause injected on the retry: not within 15000 ms', owned by shared T-447. Earlier inventory/budget blockers pass; duration notices are informational, with no budget failure.
A-2809 records evidence. Specific retry disposition has been consumed; stop unchanged retries and obtain lead disposition for shared-fix adoption. Any changed head needs delta review. Retain 8052e04c/A-2746, 1ea1e21d/A-2777 and 9008902b/A-2808 with T-461/T-463/T-447 dispositions. No new criterion verification; final gate remains not clear.

### impl-455 · 2026-10-15T09:05:28.540Z

Run 9008902b/A-2808 at f5ef7045 passed 1727 tests and failed only the known T-447 unconfirmed-inject retry fixture; no duration failures. Coordinator decision d1a0c87e requires holding for T-447's landing commit, then cherry-picking that commit alone, delta review, and one verify. No unchanged retries or other source changes while awaiting the shared fix.

### impl-455 · 2026-10-15T12:10:52.680Z

Adopted designated shared patches T-461 5366e92f, T-447 9322850b and T-487 1419bc34 as clean cherry-picks e61bd3dc/634b0766/91635a79. At final 91635a79, full typecheck + shard lint + diff check pass; adapter 9/9, sessions 12/12 pass as loaded evidence, and layers 14/14 pass after load-rule admission (14.22, no other target). No rulebook behavior/assertion changes. Requesting delta review before next no-mode droplet-default gate.

### rev-23 · 2026-10-15T12:11:45.111Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-8
commit: 91635a792948255a2608cd4690d6a0c4c43b3516
scope: delta

Delta source clear at 91635a792948255a2608cd4690d6a0c4c43b3516; no high/medium finding remains.

Compared with source-clear f5ef7045: only seven test/harness/fixture files change. Each picked commit's stable patch ID matches its landed source: T-461 5366e92f/e61bd3dc (13d6111e...), T-447 9322850b/634b0766 (0c645cad...), T-487 1419bc34/91635a79 (f3bd75a6...). No rulebook product source, rulebook/init assertion, duration manifest or README delta. The additional T-487 pick is separate from the landed T-447 patch; it is not a duplicate change.

Reviewed shared behavior remains: observed pre-latch child completion plus no-new-PID checks; opt-in hook/mod receipt draining and specific confirmation-timeout staging; fixed stub timestamp/age reference with archive relationships preserved. Original assertions and deadlines remain. Source reviews/final evidence of those landed fixes apply; A-2964 reports current-head full adapter 9/9, sessions 12/12, layers 14/14, root typecheck, shard lint and diff check green. No Reviewer tests run.

C7 unchanged documentation verified at this head. C1–C6 await accepted exact-head verification. Original rulebook source review A-2726/A-2786 remains applicable, including stale-write refusal/high-water identity preservation. Retain prior 8052e04c/A-2746, 1ea1e21d/A-2777 and 9008902b/A-2808 reds with T-461/T-463/T-447 dispositions; none is reclassified green by adoption.

Submit no-mode verify using configured droplet default at this reviewed head after the lifted restart hold. Check actual executor/package coverage; human e6264b46 and mixed-diff additions govern any exception, not an assumed local fallback. No edits or further integration are required by this review.
Review evidence: A-2965.

Criteria: C7 verified.

### rev-23 · 2026-10-15T12:37:24.409Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-9
commit: 91635a792948255a2608cd4690d6a0c4c43b3516
scope: evidence

Medium — hub/test/executor-prepare.test.ts:165: missing executor-lease-released record is dereferenced for lifetimeMs, matching known T-481 (A-2984:3879–3884).
Medium — hub/test/session-stop-races.test.ts:136: post-merge forced-stop case cannot observe Implementer idle within 15s (A-2984:3886–3892). This is not T-449's filed probe.json readiness assertion; it may belong to the Codex initial-idle/launch family, but exact ownership requires lead classification. Bugs/S find aside, no inferred product cause.

Configured Linux 6ffb9985/A-2984 at unchanged source-clear 91635a792948255a2608cd4690d6a0c4c43b3516 selected full, but hub exits 1 before Neovim: 1728 tests, 1723 pass, two fail, three platform skips. Own rulebook/CLI/init/shared Claude hub tests pass; their positive evidence is separate from the overall red gate. Suite 1371.27s, c-8 lon1 lifetime 1462s, cost $0.1015. Branch still matches review.

C1–C6 remain unverified; C7 current source mark retained. Prior 8052e04c/A-2746, 1ea1e21d/A-2777 and 9008902b/A-2808/shared-fix dispositions remain recorded. Human e6264b46 needs known-ticket-only classification and own-file coverage before a qualifying second receipt; no final or retry inference from same-file similarity. Mixed-diff Neovim phase also remains missing. Await lead adoption/classification direction; changed head requires delta review. No Reviewer tests or edits.
Review evidence: A-2985.

### impl-455 · 2026-10-15T12:43:17.051Z

Coordinator 15241749 classifies A-2984's initial idle timeout as known T-486 and accepts 6ffb9985/A-2984 as first qualifying Linux receipt. Adopted T-481 8d4d104b alone as 17d64313; stable patch-id a4580737f1bfaca10a2b414ac94663db85322857 matches upstream. Per 7dcd124f/2f468079, cite green cover 6a13b9a5 at e1b6a16a (2109/0) instead of duplicate local target. Requesting delta review, then one further droplet gate per the two-receipt rule.

### rev-23 · 2026-10-15T12:43:54.062Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-10
commit: 17d643130d3d7fc3b06b20908188f209e69ae5bc
scope: delta

Delta source clear at 17d643130d3d7fc3b06b20908188f209e69ae5bc; no high/medium finding remains.

Only hub/test/executor-prepare.test.ts changes: the existing flush/read now retries until the executor-lease-released record is actually published after lease removal. Lifetime/cost/snapshot/empty-provider assertions remain unchanged, with the existing eventually deadline. Stable patch ID a4580737f1bfaca10a2b414ac94663db85322857 exactly matches landed T-481 8d4d104b; no rulebook source/assertion or production changes.

Direct Coordinator 7dcd124f and standing 2f468079 accept green cover 6a13b9a5 at dev e1b6a16a (2109/0, includes T-481) plus unchanged patch ID instead of another local targeted run. Direct 15241749 classifies session-stop-races:136 as T-486 initial-idle root-cause family and explicitly accepts 6ffb9985/A-2984 as first Linux receipt: only T-481/T-486 reds with own files green.

C7 unchanged docs refreshed. C1–C6 await the authorized next configured-default droplet verification. Shared-only pick counts as same head under e6264b46/15241749. Green follows the normal path; a different-known-only second red with passing own files can form the gate under the specific rule, with package coverage handled by the recorded mixed-diff supplement if needed. Repeated/unknown/own failure returns to Coordinator. Check actual executor and do not assume default means Linux after a hub fallback.

Retain A-2984 as red plus older A-2746/A-2777/A-2808/shared-fix history; current source A-2965 otherwise applies. No Reviewer tests or edits.
Review evidence: A-2991.

Criteria: C7 verified.

### rev-23 · 2026-10-15T13:09:28.910Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-11
commit: 17d643130d3d7fc3b06b20908188f209e69ae5bc
scope: evidence

Medium — mixed-diff Neovim coverage: neither proposed Linux receipt reached the Neovim phase. The standing 90193e8c/d05c60c7 supplement is still needed for final gate settlement unless the Coordinator explicitly substitutes existing shared-cover evidence; the shared pick's source-clear/target exemption does not itself state that this package gate is waived.

Second Linux a480e386/A-3004 at unchanged 17d643130d3d7fc3b06b20908188f209e69ae5bc fails only codex-adapter.test.ts:997 initial-idle setup in late-reject steer case, matching the exact known T-467 signature and its T-486 root-cause linkage. It differs from first Linux 6ffb9985/A-2984's T-481 release-record and T-486 session-stop-races:136 failures. Own rulebook/CLI/init/shared hub files pass in both; adopted release-publication case passes in the second.

First: 1723 pass/two fail/three platform skips; second: 1724 pass/one fail/three platform skips. Both exit 1 before Neovim and remain red. The only head delta is exact T-481 shared pick, reviewed in A-2991. Direct Coordinator 15241749 accepts A-2984 as first receipt and permits different-known-only second failures under e6264b46; the hub pair meets that ruling. Second suite 1368.75s, c-8 lon1 lifetime 1452s, $0.1009.

C1–C6 final marks remain pending the missing package coverage; C7 source mark current. Use the existing prescribed one local npm run test:nvim -- nvim/test/*.test.ts at this exact head under normal lease/admission rather than another full verify, with Linux Neovim deferred to E-423 close under the standing mixed-diff rule. Claimant notes T-487 alone is the Neovim source delta and has a green shared cover; retain that evidence, without calling an unrun phase executed. No new source fix or third Linux run requested. Earlier red/fix history remains unchanged. No Reviewer tests or edits.
Review evidence: A-3007.

### impl-455 · 2026-10-15T13:11:44.718Z

Final coverage supplement at unchanged reviewed 17d64313: explicit `npm run test:nvim -- nvim/test/*.test.ts` exited 0, 387/387 passed, 0 fail/skip/cancel, 80.61 s, normal lease lock wait 0.02 s. Admitted local slot none, load 2.02, no other target. Full log preserved in this topic. This completes 90193e8c/d05c60c7 coverage alongside accepted Linux pair 6ffb9985/A-2984 and a480e386/A-3004 under 15241749/e6264b46. No source/head change or extra verify.

### rev-23 · 2026-10-15T13:13:33.428Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-12
commit: 17d643130d3d7fc3b06b20908188f209e69ae5bc
scope: evidence

Final evidence clear at unchanged 17d643130d3d7fc3b06b20908188f209e69ae5bc under the recorded two-receipt/mixed-diff gate rules; no high/medium T-455 finding remains.

Accepted Linux hub pair: 6ffb9985/A-2984 at 91635a79 fails only T-481 release-publication and T-486 initial-idle cases (1723 pass/two fail/three platform skips); a480e386/A-3004 at 17d64313 fails only the different known T-467 :997 initial-idle steer case, linked to T-486 (1724 pass/one fail/three platform skips). Own rulebook/CLI/init/shared hub files pass in both; adopted T-481 release case passes in the second. Direct Coordinator 15241749 accepts the first receipt and shared-pick-only head equivalence under human e6264b46; source review A-2991 confirms the exact T-481 patch. Both Linux receipts stay overall red and stopped before Neovim.

Mixed-diff supplement under 90193e8c/d05c60c7: audited A-3011 explicit npm run test:nvim -- nvim/test/*.test.ts at the reviewed head, normal lease, local 387/387, zero failures/skips/cancellations, exit 0; 80.61s, lease wait 0.02s. This completes the accepted pre-merge package coverage. Linux Neovim remains epic-close coverage under that ruling; no complete green Linux run is claimed.

C1–C3: human CLI numbering/fields, edit/retire preservation, active/all/role/show outputs pass the real hub/CLI tests. C2 additionally passes concurrent writers, intervening hand edit during native temp write refusing stale publication, and high-water identity preservation after hand deletion. C4 atomic hand reload/invalid-line notice/last-good retention passes. C5 held-shell identity and Aide origin restrictions refuse Implementer/Coordinator writes as specified. C6 init header/committed-file inventory passes. C7 README source mark remains current. Source chain A-2726/A-2786/A-2965/A-2991 establishes unchanged rulebook behavior; all C1–C7 verified at this final head.

Retain earlier red 8052e04c/A-2746, 1ea1e21d/A-2777 and 9008902b/A-2808 with their own inventory correction and T-461/T-463/T-447 dispositions; adoption does not relabel those gates green. Final reviewed head adds only exact designated shared patches beyond the rulebook source; no extra test allowance was introduced here. No Reviewer tests or edits.
Review evidence: A-3014.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### impl-455 · 2026-10-15T13:18:05.585Z

Resolved Coordinator-reported merge conflicts and pushed fdc7da1a (origin/dev 1e75347d merged). core.ts equals current dev plus only the four rulebook wiring additions, retaining all heartbeat/follows behavior. durations.json verified as exact recursive union with every existing/shared value unchanged. Full root typecheck and shard lint pass; serial targets parser 2/2, CLI 6/6, heartbeat 9/9, follows 10/10 (27/27). Requesting delta review; per 2cef6e7d no new full verify, covered by E-423 stage-1 droplet close cover immediately after merge.

### rev-23 · 2026-10-15T13:19:21.953Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-455-13
commit: fdc7da1a03e09a61f30b72425a232c201b375f02
scope: delta

No high or medium finding remains. Core conflict resolution is dev plus exactly the four original rulebook wiring additions; heartbeat and lane-flow hooks survive. Independently checked durations.json as exact recursive parent union with every overlapping value unchanged. Rulebook implementation and own tests unchanged from final-clear 17d64313; CLI/daemon/dispatch/protocol/init integration retained. A-3018 logs: parser 2/2, CLI 6/6, heartbeat 9/9, follows 10/10, zero failures/skips/cancellations; typecheck/shards reported green, diff check independently clean. Full Standards/Spec delta audit A-3019.

Direct Coordinator 2cef6e7d explicitly substitutes this targeted integration validation and delta review for another full verify; E-423 stage-1 droplet close cover follows immediately after merge. All C1-C7 refreshed under that specific amendment and prior final A-3014. No new current-head full-run claim: A-2984/A-3004 remain historical red accepted Linux receipts with known dispositions; A-3011 remains parent-head local Neovim 387/387. Integrated complete/Linux-Neovim coverage is still owed at stage close. Ready for Coordinator merge; no additional verify requested. No Reviewer edits or tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-15T13:19:31.896Z

Merged 9f5158384e704be76289b4510fd3a02ef5e4eebc onto dev.
