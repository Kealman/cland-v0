---
id: T-633
kind: task
title: cland config set writes one value of config.toml and refuses what the hub cannot read
state: open
status: ready
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-390
branch: t/T-633-cland-config-set-writes-one-value-of
created: 2026-10-16T16:04:12.209Z
updated: 2026-10-16T20:46:49.821Z
---

## Summary

`cland config set <section.key> <value>` sets one value of `.cland/config.toml` through the hub and refuses a key or value the hub cannot read, so the onboarding records "I approve epic plans" as `plan.approval = "human"` and the stack's verification commands without a hand edit (spec v0.1.4 §3.5, §3.7).

## What to build

- **Keys.** Any key the managed config template writes, by its dotted path: `plan.approval`, `verification.workers`, `verification.droplet.regions` and the rest. The set of keys comes from the template and the config parser, never a second list, so the `[verification]` commands that "Verification for any stack" adds become settable with no change here. An unknown section or key is refused with the section's known keys.
- **Values.** Parsed as TOML, as `cland crew set` does: numbers, booleans and lists in TOML syntax, a bare word as a string. The candidate file is checked by the parser the hub uses at start. A value the parser today ignores without a word (a budget of the wrong type, say) is refused too: the command never writes a value the hub would not apply.
- **The write.** The managed file is rewritten through its template with every other value kept, as `cland update` keeps them, atomically, refusing when the file changed since it was read. A `config.toml` without the managed mark is the project's own: it is left unchanged and the refusal says so.
- **When it applies.** The output prints the value as the hub reads it and says whether it applies at once (the keys `cland hub reload` applies) or at the next hub start.
- **Who.** The human, the Coordinator and an Aide may run it from their shells; other roles are refused with a reason shown in Agents. `--json` prints `{key, value, applies}`. The usage text lists the command.

## Acceptance criteria

- [x] C1. `cland config set plan.approval human` writes `[plan] approval = "human"` and keeps every other value of config.toml, read back by the hub's config parser (new CLI test against a temporary project's hub).
  - done: impl-633 · 2026-10-16T16:11:59.697Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-source · 2026-10-16T16:17:23.555Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-source · 2026-10-16T17:39:14.345Z · commit 536b3717b6abf7501f74f8663aa3cf38921dfaa3
  - verified: rev-31 [reviewer] · run rev-20261016-633-delta-2 · 2026-10-16T19:35:17.395Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45
- [x] C2. `cland config set verification.workers 3` and `cland config set verification.droplet.regions '["lon1"]'` write a number and a list that the parser reads back.
  - done: impl-633 · 2026-10-16T16:12:00.282Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-source · 2026-10-16T16:17:23.555Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-source · 2026-10-16T17:39:14.346Z · commit 536b3717b6abf7501f74f8663aa3cf38921dfaa3
  - verified: rev-31 [reviewer] · run rev-20261016-633-delta-2 · 2026-10-16T19:35:17.395Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45
- [x] C3. An unknown section or key is refused with the section's known keys, and an invalid value (`plan.approval maybe`, `verification.workers 0`) with the parser's reason, config.toml unchanged.
  - done: impl-633 · 2026-10-16T16:12:00.986Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-source · 2026-10-16T16:17:23.555Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-source · 2026-10-16T17:39:14.346Z · commit 536b3717b6abf7501f74f8663aa3cf38921dfaa3
  - verified: rev-31 [reviewer] · run rev-20261016-633-delta-2 · 2026-10-16T19:35:17.395Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45
- [x] C4. A value the parser would ignore silently (`verification.budget two`) is refused, config.toml unchanged.
  - done: impl-633 · 2026-10-16T16:12:02.396Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-source · 2026-10-16T16:17:23.555Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-source · 2026-10-16T17:39:14.346Z · commit 536b3717b6abf7501f74f8663aa3cf38921dfaa3
  - verified: rev-31 [reviewer] · run rev-20261016-633-delta-2 · 2026-10-16T19:35:17.395Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45
- [x] C5. The output says whether the value applies at once or at the next hub start, matching what `cland hub reload` applies.
  - done: impl-633 · 2026-10-16T16:12:03.553Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-final · 2026-10-16T17:37:18.002Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-final · 2026-10-16T20:45:15.494Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45
- [x] C6. The human, the Coordinator and an Aide may run it from their shells, while an Implementer, a Reviewer, QA and a Lead are refused (frame-protocol test).
  - done: impl-633 · 2026-10-16T16:12:05.203Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-source · 2026-10-16T16:17:23.555Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-source · 2026-10-16T17:39:14.346Z · commit 536b3717b6abf7501f74f8663aa3cf38921dfaa3
  - verified: rev-31 [reviewer] · run rev-20261016-633-delta-2 · 2026-10-16T19:35:17.395Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45
- [x] C7. A config.toml without the managed mark is left byte-identical and the refusal says it is the project's own.
  - done: impl-633 · 2026-10-16T16:12:06.813Z
  - verified: rev-31 [reviewer] · run rev-20261016-633-source · 2026-10-16T16:17:23.555Z · commit 7c42367d8f77e16a624f15f6cdaebe060c1aea89
  - verified: rev-31 [reviewer] · run rev-20261016-633-merge-source · 2026-10-16T17:39:14.346Z · commit 536b3717b6abf7501f74f8663aa3cf38921dfaa3
  - verified: rev-31 [reviewer] · run rev-20261016-633-delta-2 · 2026-10-16T19:35:17.395Z · commit 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
  - verified: rev-31 [reviewer] · run rev-20261016-633-conflict-delta · 2026-10-16T20:46:48.242Z · commit ca5ba66d753730b81b1de848d52d0fdc1aee2b45

## Comments

### impl-633 · 2026-10-16T16:08:45.060Z

Implemented the CLI → config.set frame → hub settings write path. Writable keys derive from renderConfig (including optional droplet worker and visibility parser vocabulary); strict parser mode rejects legacy silently ignored values during writes. Startup-only keys report restart; reloadable writes attempt reload and report now only on success, otherwise saved/not-applied with the refusal. Initial CLI test is green; adding remaining acceptance/race/role coverage before review.

### impl-633 · 2026-10-16T16:16:45.255Z

Coordinator clarified no offline writes are needed (34a7456d). Added explicit no-hub refusal and byte-preservation test; pushed new head 7c42367d8f77e16a624f15f6cdaebe060c1aea89 and requested fresh source review. Typecheck exit 0; config-set tests 8/8 green. Evidence A-3989 supplements A-3981. Verification will use explicit droplet per Coordinator load-routing notice.

### rev-31 · 2026-10-16T16:17:23.555Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-633-source
commit: 7c42367d8f77e16a624f15f6cdaebe060c1aea89
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0 findings, Spec0 findings. A-3991 records full review. Template-derived keys, strict candidate parser validation/normalized readback, managed template preservation, symlink/stale-source refusal, serialized atomic write and session role checks satisfy source criteria. Shared startup boundaries and actual reload success/refusal determine applies correctly. Independently read Coordinator34a7456d correcting7a6293b0: running hub required, absent hub writes nothing; final new test proves that explicit refusal/unchanged bytes. A-3981/A-3989 report exact-head typecheck, updated8/8, reload4/4 and matching init3/3; shard/ref/diff checks clear. C1/C2/C3/C4/C6/C7 source-verified. C5 final execution mark waits fresh exact-head post-review no-mode gate. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C6 verified, C7 verified.

### impl-633 · 2026-10-16T17:36:59.876Z

Same-head no-mode verification a93e7cd8-9460-4c5d-8e9a-bc7ca0e486f8 passed at 7c42367d8f77e16a624f15f6cdaebe060c1aea89: auto selected full; Linux droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5; exit 0, tests 2349 / pass 2341 / fail 0 / skipped 8. Durable log A-4077: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4077-suite-a93e7cd8-9460-4c5d-8e9a-bc7ca0e486f8-auto-at-7c42367.log. Reviewer received result directly; final evidence settlement pending. No head changes.

### rev-31 · 2026-10-16T17:37:18.002Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-633-final
commit: 7c42367d8f77e16a624f15f6cdaebe060c1aea89
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards0/Spec0 findings, A-4078. Same-head post-review Linuxa93e7cd8/A-4077 full exit0:2341pass/0fail/8skip including fullNeovim390pass/3skip. All8 config-set cases5of5, including actual reload-now, startup-restart, saved/not-applied refusal preserving live old state and no-hub no-write clarification. C5 verified; C1/C2/C3/C4/C6/C7 source marks current, allcriteria complete. Origin unchanged. No new gate/exception/per-itemQA needed; lifetime/costunknown. No Reviewer edits/tests.

Criteria: C5 verified.

### rev-31 · 2026-10-16T17:39:14.346Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-633-merge-source
commit: 536b3717b6abf7501f74f8663aa3cf38921dfaa3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge source delta clear; Standards0/Spec0 findings, A-4083. Parents7c42367d+eaed08bb confirmed. All11 task production/test blobs unchanged; exact shard manifest devunion+config-set:machine, all dev/candidate entries preserved. Net same12taskfiles; no assertion/bound/policy change. Exact-head typecheck/shards reportedgreen, ref/diffcheck confirmed. Independently read Coordinator18b25b41 authorizing merge and requiring new exact-head droplet after review. C1/C2/C3/C4/C6/C7 source marks current; C5 execution waits new gate (A-4077 prior-head only). No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C6 verified, C7 verified.

### rev-31 · 2026-10-16T19:08:06.944Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-633-merge-evidence-1
commit: 536b3717b6abf7501f74f8663aa3cf38921dfaa3
scope: evidence
findings: [{"severity":"medium","text":"Machine readiness deadline stops required merged-head verification before any test counts or Neovim evidence; infrastructure blocker, not a demonstrated task regression."}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, A-4135. Independently inspected A-4134/4f679a3f at exact reviewed/current536b3717: exit1 machine readiness deadline, platform unavailable, no test counts; raw log only host typecheck prelude. C5 merged-head execution remains pending; C1/C2/C3/C4/C6/C7 source/A-4083 current. No task criterion failed. Prior A-4077 applies to old7c42367d; Coordinator18b25b41 explicitly required new merged-head gate. Obtain authorized unchanged-head retry/infrastructure disposition; no source change indicated. All claimant done marks present. Lifetime204s/cost$0.0142 perhub, no completed Linux claim. No Reviewer edits/tests.

### rev-31 · 2026-10-16T19:34:08.718Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-633-merge-evidence-2
commit: 536b3717b6abf7501f74f8663aa3cf38921dfaa3
scope: evidence
findings: [{"severity":"medium","text":"External T-603 pinned-account case passes behavior but exceeds unlisted5s duration budget at5.750s, stopping full gate before Neovim.","file":"hub/test/claude-code-adapter.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, A-4149. Independently inspected exact-head dee1fe37/A-4148:1979pass/0fail/5skip but exit1 solely T-603 pinned-account duration5.750s>5s; Neovim not reached. All8 config-set cases5of5, no own regression. C1/C2/C3/C4/C6/C7 merge-source current; C5 final full gate pending. Tech debt/XS aside existing shared T-603 allowance gap; obtain Coordinator shared-fix/merge or explicit disposition, no task criterion failed and no waiver inferred. Earlier infrastructure blocker no longer describes this retry. Lifetime1472s/cost$0.1022 perhub. No Reviewer edits/tests.

### rev-31 · 2026-10-16T19:35:17.395Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-633-delta-2
commit: 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Dev-merge source delta clear; Standards0/Spec0 findings, A-4151. Same12 task paths and every added/removed task line identical to prior reviewed parent delta. Exact shard union dev+config-set:machine preserves quarantine/candidates; durations byte-identicaldev so preliminary posted allowance pick has no extra delta. Inherited local_fallback render/default/boolean parser/reload integration composes with template-derived config setter. No dense source conflict, diffcheckclean; exact-head typecheck/shards reportedgreen. Independently read Coordinator b78f6217 authorizing merge after pick and requiring submission HOLD until explicit lift after restart. C1/C2/C3/C4/C6/C7 current; C5 awaits fresh exact-head full gate after lift. No gate waiver or new-head full-green claim. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C6 verified, C7 verified.

### impl-633 · 2026-10-16T20:45:07.414Z

Fresh same-head no-mode droplet verification c83bdfc0-ec29-4481-966b-d6de02243ebe passed at 111b4b4a09cbdb1f1b63714b777fffc01e3549ad. Full suite exit 0: 2393 tests / 2385 pass / 0 fail / 8 skipped, including Neovim; quarantined T-674 and T-526 cases both passed. Linux c-8 lon1, Node v24.21.0, Neovim v0.12.5, receipt reports workers 4, lifetime 1787s, cost $0.1241. Log A-4190: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4190-suite-c83bdfc0-ec29-4481-966b-d6de02243ebe-auto-at-111b4b4.log. Source remains unchanged since delta clear; final Reviewer evidence settlement pending.

### rev-31 · 2026-10-16T20:45:15.494Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-633-merge-final
commit: 111b4b4a09cbdb1f1b63714b777fffc01e3549ad
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; Standards0/Spec0 findings, A-4191. Independently inspected exact-head c83bdfc0/A-4190 full exit0:2385pass/0fail/8skip, complete Neovim390pass/0fail/3skip. All8 config-set identities ordinary green and5of5, including apply-now/startup/refusal reporting, no-hub no-write and atomic stale-source handling. C5 verified; C1/C2/C3/C4/C6/C7 delta-2/A-4151 marks current at unchanged111b4b4a, all7claimant done marks present. No failed-run exception needed. Lifetime1787s/cost$0.1241 perhub. No Reviewer edits/tests.

Criteria: C5 verified.

### rev-31 · 2026-10-16T20:46:48.242Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-633-conflict-delta
commit: ca5ba66d753730b81b1de848d52d0fdc1aee2b45
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict-only delta clear; Standards0/Spec0 findings, A-4193. Parents111b4b4a+38ec6f70 confirmed; all11 task implementation/test blobs byte-unchanged and every task added/removed line matches prior patch. Exact manifest devunion+config-set:machine preserves roles-editor/quarantine/candidate entries. No dense production conflict; independent diffcheckclean, exact-head typecheck/shards reportedexit0. Coordinator5cad9402 independently read explicitly retains greenA-4190/111b4b4a and forbids new droplet for this conflict-only merge; integrated cover immediately follows landing. C1–C7 continuity verified atca5ba66d under that disposition. No exact-current-head execution claimed. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
