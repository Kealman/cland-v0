---
id: T-455
kind: task
title: "Rulebook: .cland/RULES.md with numbered rules, read and written by cland rule add, edit, retire, list and show, and reloaded by the hub when the file changes"
state: open
status: review
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
updated: 2026-10-15T08:05:59.463Z
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
- [x] C2. `cland rule edit 1 --scope all` and `cland rule retire 1 --reason "…"` rewrite only that rule, keeping its number and origin; a retired rule stays in the file and its number is never reused.
  - done: impl-455 · 2026-10-15T07:35:38.751Z
- [x] C3. `cland rule list --all --json` returns active and retired rules with every field, `cland rule list` returns active ones only, `--role r` filters by scope, and `cland rule show <n>` prints one rule written as `rule <n>`.
  - done: impl-455 · 2026-10-15T07:26:18.826Z
- [x] C4. A hand edit of `.cland/RULES.md` is re-read without a hub restart, and a file that does not parse is logged with its line while the last good rulebook stays in force.
  - done: impl-455 · 2026-10-15T07:26:20.085Z
- [x] C5. From an Aide's shell `cland rule add --origin memory:<path>` records that origin, and from an Implementer's or a Coordinator's shell `cland rule add` is refused with `forbidden` and a reason.
  - done: impl-455 · 2026-10-15T07:26:21.600Z
- [x] C6. `cland init` writes an empty rulebook with its header, and `.cland/.gitignore`'s header names `RULES.md` as committed.
  - done: impl-455 · 2026-10-15T08:00:59.227Z
- [x] C7. `hub/README.md` describes the rulebook file, its fields and origins, the `rule <n>` form, the `cland rule` commands and who may write.
  - done: impl-455 · 2026-10-15T07:26:24.793Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-2 · 2026-10-15T07:35:24.942Z · commit 856181faa8000c4a4470886fccec61cd107c8979
  - verified: rev-23 [reviewer] · run rev-2026-10-15-455-4 · 2026-10-15T08:01:41.809Z · commit a0ec44eaf1bbfc125d1709bf544913dac3bce709

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
