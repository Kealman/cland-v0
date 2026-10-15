---
id: T-459
kind: task
title: "Demos on a droplet: cland demo start, exec and stop lease a droplet for an epic's QA demo at a named dev commit, and the hub accepts the demo's verdict while dev moves on files outside the epic's surfaces"
state: open
status: in progress
size: L
criterion_seq: 7
labels:
  - v0.1.3
  - hub
  - docs
assignee: null
parent: E-423
blocked_by:
  - T-335
topic: topic-296
branch: t/T-459-demos-on-a-droplet-cland-demo-start-exec
created: 2026-10-15T07:15:15.838Z
updated: 2026-10-15T16:21:12.220Z
---

## Summary

Epic demos freeze `dev` today, because QA runs them in the root at the `dev` tip and reports BLOCKED when `dev` moves. This ticket gives QA a hub-held demo lease: a droplet acquired within `remote_budget` and the daily cap, with the demo commit delivered and prepared as for a suite run, Neovim included. Commands run on the droplet through `cland demo exec`. The hub then accepts an epic verdict whose commit is behind the tip when the later commits touch none of the epic's surfaces, using the surfaces T-335 reads from the `Item:` trailers.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 7 of 7; spec `docs/spec/v0.1.3.md` §3.4 ("Demos off dev"), `docs/spec/v0.1.2.md` §3.14 (the remote executor); the epic's choices "The demo lease" and "Fresh demo verdicts". Builds on E-271 (Remote executors) and T-347 (the remote budget).

## What to build

**The lease (`hub/src/executor/droplet/lease.ts`, `droplet.ts`, `prepare.ts`, `spend.ts`).** A demo lease is a third holder of droplet capacity, beside verification and E-387's sharded close runs.

- `cland demo start <epic> [--commit <sha>]` asks the hub for a droplet for the epic. The commit defaults to the `dev` tip.
- The hub acquires the droplet within `remote_budget` and the daily cap, delivers the commit and prepares it as for a suite run, Neovim included.
- It answers with the lease id, the commit and the droplet's lifetime.
- When no remote slot or budget is left, the command says so with the reason and exits non-zero. QA then runs the demo locally at the same commit.
- `cland demo exec <epic> -- <command…>` runs one command on the droplet as the ordinary user, in the delivered tree, and returns its stdout, stderr and exit code. `cland --headless --qa <case.lua>` runs there the same way.
- `cland demo stop <epic>` releases the droplet.
- The lease also ends at the epic's verdict or at its lifetime (`lifetime` of the remote executor), whichever comes first, through the existing watchdog.
- The droplet's create, its destroy and its cost each post on the epic as a comment.
- Callers: QA holding the epic's hold, the Coordinator and the human. Any other session is refused with `forbidden`.
- The DigitalOcean token is never stored. Sessions never call the provider.
- Frames: `demo.start`, `demo.exec`, `demo.stop` and `demo.status`, plus `hub/src/cli/demo.ts` and its entry in `usage.ts`.

**Fresh demo verdicts (`hub/src/tracker/gate-verdicts.ts`, `freshness.ts`).**

- An epic's QA verdict names its commit.
- The hub accepts it when that commit is on `dev` and every commit after it on `dev` touches none of the epic's surfaces. The surfaces are the files changed by the merges of the epic's tickets, read from `Item:` trailers through the helper T-335 adds for the merge hold.
- A later commit that touches a surface makes the verdict stale. The refusal names the commit and the files.

**The `qa` skill (`.agents/skills/qa/`).**

- The recorder runs each case of an epic demo through `cland demo exec`. Cases that need macOS run locally at the same commit, and the verdict says which ran where.
- The re-check of `dev` after the cases applies the freshness rule above instead of reporting BLOCKED on any move.
- The verdict's evidence names the executor, the commit, the lifetime and the cost.
- When `demo start` reports no slot or budget, the skill runs the demo locally, and the T-335 hold stays in force.

**Tests** run against E-271's fake DigitalOcean API and fake machine (`hub/test/fakes/digitalocean/`). A real droplet is QA's check and never part of `npm test`.

## Acceptance criteria

- [x] C1. `cland demo start <epic>` against the fake DigitalOcean API acquires a droplet within `remote_budget` and the daily cap, delivers the `dev` tip (or `--commit`), prepares it with Neovim, and reports the lease, commit and lifetime.
  - done: impl-459 · 2026-10-15T13:33:29.136Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
- [x] C2. `cland demo exec <epic> -- <cmd>` returns the command's output and exit code from the delivered tree as the ordinary user, and a `cland --headless --qa` case runs there the same way.
  - done: impl-459 · 2026-10-15T13:33:30.300Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
- [x] C3. `cland demo stop`, the epic's verdict and the lease lifetime each release the droplet, and the create, destroy and cost are posted on the epic.
  - done: impl-459 · 2026-10-15T13:33:31.300Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
- [x] C4. With no slot or budget left, `demo start` refuses with the reason and starts nothing, and a session other than QA, the Coordinator or the human is refused with `forbidden`.
  - done: impl-459 · 2026-10-15T13:33:31.967Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
- [x] C5. The hub accepts an epic verdict at a commit behind the `dev` tip when the later commits touch no file the epic's merges changed, and refuses it naming the commit and files when one does.
  - done: impl-459 · 2026-10-15T13:33:32.697Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
- [x] C6. The `qa` skill runs epic cases through `cland demo exec`, runs macOS cases locally at the same commit, applies the freshness rule after the cases, and names executor, commit, lifetime and cost in the evidence.
  - done: impl-459 · 2026-10-15T13:42:15.127Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
- [x] C7. `hub/README.md` describes the demo lease, its commands, budget sharing and the freshness rule.
  - done: impl-459 · 2026-10-15T13:33:34.141Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-source-2 · 2026-10-15T13:42:55.913Z · commit 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b
  - verified: rev-30 [reviewer] · run rev-20261015-459-delta · 2026-10-15T14:15:35.343Z · commit cad57ccf47b605fcf9df8ef79ac848e37e9f9bb9
  - verified: rev-30 [reviewer] · run rev-20261015-459-delta-2 · 2026-10-15T14:52:26.765Z · commit 3b8d0bd3f00a7fec5700fa51b104f4beb40e0b1c
  - verified: rev-30 [reviewer] · run rev-20261015-459-delta-3 · 2026-10-15T15:29:05.778Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb
  - verified: rev-30 [reviewer] · run rev-20261015-459-final · 2026-10-15T15:59:24.451Z · commit 528680a673944d2ed83506ef7ed902ed336e26fb

## Comments

### impl-459 · 2026-10-15T13:20:56.747Z

Read task, E-423 choices, release spec §3.4 and safety constraints. Implementing demo leases on existing DropletExecutor lifecycle/watchdog/budget, plus epic QA freshness and recorder/docs. Tests will use fake DO/SSH only; proposed public frame and verdict seams sent to lead.

### impl-459 · 2026-10-15T13:37:38.227Z

Implementation complete. A-3026 is the review guide (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3026-t-459-implementation-and-review-guide.md). Targeted checks green: demo.test.ts 7 cases; epic-close.test.ts 14; skills-qa.test.ts 16; executor-run.test.ts 18; freshness.test.ts 6; follows.test.ts 10. Typecheck, shard lint and diff whitespace checks pass. Every new demo test stayed under 5 seconds locally; no duration exemptions needed. No real droplets were used. Fetched and merged origin/dev before review. Per-item qaPolicy is none; real-droplet demo remains the epic QA scope.

### rev-30 · 2026-10-15T13:40:32.256Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-459-source
commit: 57fd1e7609a5caf3a4db32253a653868f4772210
scope: full

Source review not clear at 57fd1e7609a5caf3a4db32253a653868f4772210.

Medium — .agents/skills/qa/qa-record.sh:34 (used by the new epic-demo workflow at SKILL.md:36): the recorder still accepts only T-<digits>. Recording this epic as E-423 exits 64 before demo execution or evidence append; substituting T-423 records the wrong canonical item/evidence directory. hub/test/demo.test.ts:102 masks the gap by recording hard-coded T-1 instead of its created epic id. Accept canonical planning-container item ids safely, update the skill invocation, and exercise remote run plus note/local fallback recording with the actual epic id. This blocks C6.

Standards: no additional findings against AGENTS.md, documented executor/test practices or the code-review baseline. The narrow Machine.result wrapper keeps transport errors separate from normal command exit 255, shell-quotes arguments and defaults SSH to runner; token removal remains in machineEnv. Demo metadata reuses existing slot reservation, spend ledger, tagged cleanup and watchdog paths.
Spec: C1–C5 source paths otherwise look consistent. Named commits resolve on dev and committed-object delivery avoids dirty root input; demo controls enforce QA epic hold/Coordinator/human authorization; stop/verdict/deadline reconciliation shares release/accounting. Surface-aware QA admission/close/cache uses Item-trailer task merges, includes renamed/deleted paths and every intervening commit (including reverted changes), and rechecks at publication. Stage QA remains separate. C7 README covers the commands, sharing, lifetime and freshness.

Reviewed git diff 53292737320dd085686dcd1cd8cf64a89c03facb...57fd1e7609a5caf3a4db32253a653868f4772210, two commits, 23 files; both Standards and Spec axes directly, no sub-agents permitted by role. git diff --check passes. A-3026 reports fake-only targeted validation; no real droplets or Reviewer tests/edits. C1–C5 and C7 remain unverified in this not-clear source pass; no full verification should run until a revised head receives source clearance.

Criteria failed: C6 — Canonical epic ids are rejected by the recorder, so the epic demo cannot record run/note evidence under its actual item id.

Criteria: C6 failed (Recorder accepts only T-<digits>; canonical epic ids such as E-423 fail before recording demo evidence.).

### impl-459 · 2026-10-15T13:42:28.605Z

Addressed C6 source-review finding in 05cff0dd: safe canonical item ids in recorder, actual epic id in skill/test/evidence paths, and prefix traversal validation. A-3040 records delta and red/green evidence. Targeted demo 7/7, skills-qa 16/16 and typecheck pass. Re-review requested at the pushed head before verification.

### rev-30 · 2026-10-15T13:42:55.913Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-459-source-2
commit: 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b
scope: full

Source re-review clear at 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b; no high, medium or low findings remain.

Standards: no findings. The recorder's one-letter uppercase kind prefix followed by digits remains a single safe path component, preserving traversal/nondigit rejection while admitting canonical epic and configured planning-kind ids.
Spec: prior C6 blocker resolved. qa-record.sh:34 now accepts E-423/I-42; the skill uses E-423 consistently for lease and evidence item; demo.test.ts uses its created epic id and checks both line.item and the canonical capture path. skills-qa tests exercise E/I note records and unsafe input rejection. A-3040 reports the exact recorder case red with exit 64 before the fix and green after; demo 7/7, skills-qa 16/16, typecheck and shell syntax pass.

The rest of source review rev-20261015-459-source stands: no additional findings in shared lifecycle, authorization, committed-object delivery, surface-aware freshness admission/close/cache, or remote capture flow. Reviewed delta 57fd1e76..05cff0dd is one commit/four files; no other design changes. git diff --check passes; current branch matches requested head. Both review axes performed directly; role disables delegation.

C7 verified from README source. C1–C6 remain unverified pending accepted same-head post-source cland verify; the C6 done mark at this fixed head supersedes the earlier failed mark. No real droplets or Reviewer tests/edits. Per-item QA policy none/after-stage; real-droplet demo is epic QA.

Criteria: C7 verified.

### rev-30 · 2026-10-15T14:10:00.008Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-459-linux-first
commit: 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b
scope: evidence

Evidence review not clear at unchanged 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b.

Medium — hub/test/demo.test.ts:11,41,65,86,114: six new demo test identities exceed the enforced five-second budget on Linux (A-3054:5634–5639): lifecycle/restart 7.120 s, authorization/verdict cleanup 5.884 s, run-timeout watchdog 5.356 s, lifetime watchdog 5.111 s, remote recorder 6.176 s, repeated leases/exit 255 8.519 s. The tests assert successfully, but their missing reasoned allowances are hard gate failures. Add measured lifecycle allowances or reduce work without weakening proofs, then request source review before another verify.
Medium — hub/test/codex-adapter.test.ts:570: immediately after acknowledged Implementer stop, pidAlive remains true (A-3054:3951–3966). Same T-65 test/acknowledgement-before-exit pattern as known T-485, whose summary names the QA pid assertion at :556. This is outside T-459's diff; no demo product defect inferred.

Standards: new duration-budget failures need resolution under docs/agents/tests.md; source review otherwise stands.
Spec: demo 7/7 functional cases pass, including canonical epic recorder; source C6 blocker remains resolved. Earlier full/delta source review supports implementation, but C1–C6 stay unverified pending accepted gate. C7 source mark retained. No implementation criterion failed for the unrelated PID observation or timing allowances.

847a427b/A-3054 names the exact reviewed/current branch head, Linux x64 c-8, host/remote typecheck green, exit 1, 1755 pass/1 fail/3 platform skips/0 cancelled. Selected full run stops before Neovim after hub failure. The known-flake exception does not waive own new-test budget failures. No real provider calls, Reviewer tests or edits.

### impl-459 · 2026-10-15T14:14:21.472Z

A-3054 exposed six own demo duration-budget failures; added reasoned per-test Linux allowances (5.111–8.519 s) and source provenance for 05cff0dd/A-3054, without changing proofs. Merged current dev/T-395; conflict resolution retains shard spend reservation methods plus demo acquisition metadata. All seven post-merge demo tests pass; typecheck and shard lint pass. A-3059 details allowances/integration. Coordinator confirms sole assertion failure codex-adapter:570 is existing T-485 and outside this item; no unrelated source changes made. Requesting fresh source review before the next droplet receipt.

### rev-30 · 2026-10-15T14:15:35.343Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-459-delta
commit: cad57ccf47b605fcf9df8ef79ac848e37e9f9bb9
scope: delta

Delta source review clear at cad57ccf47b605fcf9df8ef79ac848e37e9f9bb9; no high, medium or low findings.

Standards: six per-test duration allowances match A-3054's measured 5.111–8.519 s values and explain the required provisioning, delivery, watchdog, recorder, restart or repeated teardown lifecycle. Source provenance records A-3054 and tested 05cff0dd. Semantic JSON comparison against merged dev d6e222be confirms these six allow entries are the only non-source manifest changes; no whole-file exemption, budget change, weakened assertion or lost dev entry.

Spec/integration: the T-395 merge retains reserveShards/releaseShardReservations and active shard ownership alongside demo metadata, the earlier-of-run/lifetime demo deadline, and restart retention. spend.ts is byte-identical to dev. Demos and demo.test.ts are byte-identical to previously reviewed 05cff0dd, including canonical epic recorder handling. Dispatcher retains both sharding callbacks and demo reconciliation/control paths; no merge conflict artifacts or changed authorization.

Prior source review rev-20261015-459-source-2 stands. C7 reverified from current README; C1–C6 await accepted new-head gate. A-3059 and requester report post-merge demo 7/7, typecheck and shard lint. git diff --check passes. Both review axes performed directly; no Reviewer tests, file edits or provider calls.

Old A-3054 remains red and cannot be combined as a clean own-test receipt because its own budget errors are now fixed at a changed head. Submit a new default droplet verify after this delta verdict. Coordinator classified the unrelated T-65 PID assertion as T-485.

Criteria: C7 verified.

### rev-30 · 2026-10-15T14:50:32.373Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-459-local-fallback
commit: cad57ccf47b605fcf9df8ef79ac848e37e9f9bb9
scope: evidence

Evidence review not clear at cad57ccf47b605fcf9df8ef79ac848e37e9f9bb9; accepted gate pending.

Medium — hub/test/handover.test.ts:103: old Coordinator-clause regex fails (A-3079:3972–4035), exact shared fix b8ae050b.
Medium — hub/test/orphan-servers.test.ts:346: second SQLite connection fails “database is locked” (A-3079:4047–4050), exact known T-499.
Both are outside T-459's diff; no new task source defect established.

Standards: six duration allowances resolve the previous hard budget failures. All seven demo tests pass, and no duration-budget diagnostic appears in A-3079.
Spec: prior delta/source verdict stands. C7 verified; C1–C6 remain unverified pending accepted gate and full selected phases. Functional demo/recorder evidence supports the implementation, but this run stops before Neovim.

e58e41d8/A-3079 matches reviewed/current head, but hub default admission fell back locally due remote 4/4 capacity. It is darwin arm64, exit 1, 1771 pass/2 fail/0 skips/0 cancelled; host typecheck passes. It is neither a green gate nor a Linux receipt for the two-Linux rule. Prior A-3054 is Linux at an older head with own budget failures and also cannot supply an accepted pair. New source changes need delta clearance before further verify. No Reviewer tests or edits.

### impl-459 · 2026-10-15T14:51:52.685Z

A-3079 ran locally due hub fallback: demo 7/7 and own duration budgets pass, but shared handover regex and exact T-499 SQLite lock failed before Neovim. Merged current dev including b8ae050b (and T-458), without conflicts, producing 3b8d0bd3. Targeted handover.test.ts now passes 4/4; typecheck and shard lint pass; own diff whitespace clean. No T-499 or unrelated source edit. Requesting delta review before new Linux gate evidence.

### rev-30 · 2026-10-15T14:52:26.765Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-459-delta-2
commit: 3b8d0bd3f00a7fec5700fa51b104f4beb40e0b1c
scope: delta

Delta source review clear at 3b8d0bd3f00a7fec5700fa51b104f4beb40e0b1c; no high, medium or low findings.

Standards: inherited handover test uses exact shared b8ae050b regex and preserves all surrounding assertions. Requester reports handover 4/4, typecheck and shard lint; git diff --check passes.
Spec/integration: demo manager, executor changes, demo tests, duration allowances and QA recorder/skill are unchanged from reviewed cad57ccf. Dispatcher/protocol merge adds T-458's independently reviewed workbench origin rules and rules.changed event without altering demo request authorization/lifecycle. Inherited T-458 has full Linux proof A-3068. No source finding introduced by the integration.

Reviewed delta cad57ccf..3b8d0bd3 against current merged dev 4095dd11. C7 reverified from current README; C1–C6 remain pending accepted new-head gate. Earlier A-3079 is local red, not Linux evidence; A-3054 is older Linux red with task budget failures. Submit default cland verify at this exact head. Both review axes performed directly; no Reviewer tests, edits or provider calls.

Criteria: C7 verified.

### rev-30 · 2026-10-15T15:22:01.176Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-459-linux-current
commit: 3b8d0bd3f00a7fec5700fa51b104f4beb40e0b1c
scope: evidence

Evidence review not clear at unchanged 3b8d0bd3f00a7fec5700fa51b104f4beb40e0b1c; gate pending lead disposition.

Medium — hub/test/codex-adapter.test.ts:739: old accepted-steer staging regex fails (A-3109:3998–4063), exact known T-467, now merged elsewhere.
Medium — hub/test/heartbeat.test.ts:260: newly observed watched transition is counted stale, exact T-506 as classified by Coordinator eea1467c in T-495 (A-3109:4074–4080).
Medium — hub/test/heartbeat.test.ts, “busy and approval-waiting Coordinators coalesce heartbeats into the next turn without steering”: hard new-test duration budget failure 5.113 s > 5 s (A-3109:5771). Outside T-459's source, needs lead disposition/shared allowance; ordinary duration regression notices do not resolve this hard failure.

Standards: all seven demo tests pass and T-459's measured allowances are effective; no task test-budget failure or new source finding.
Spec/evidence: prior source/delta reviews stand, C7 verified; C1–C6 runtime behavior is supported by functional tests but remains unverified pending accepted gate. Full selected run stops before Neovim. No implementation criterion failure mark for these outside issues.

44712045/A-3109 matches reviewed/current head, Linux x64 c-8, host/remote typecheck green, exit 1, 1769 pass/2 fail/3 platform skips/0 cancelled, plus the hard heartbeat budget diagnostic. Earlier A-3079 is local red; older A-3054 has task budget errors. No accepted Linux pair established yet. Requester is holding source/runs for lead decision. No Reviewer tests or edits.

### impl-459 · 2026-10-15T15:28:29.570Z

Applied Coordinator-directed shared test-only picks: 71050454 (T-467 accepted steer-recovery fix) as bab4c145, e9578029 as 9198e4e3, and 18e5c465 as 528680a6. Manifest conflict resolved by moving only the requested heartbeat entry into allow; every existing allowance and all other fields are unchanged. Typecheck and shard lint pass. Coordinator decision 5504295f (brief A-3091) confirms no local rerun is needed for these shared picks, A-3109 remains first receipt, and instructs delta review then one --executor droplet verification. No own implementation/proof changes; no nvim files belong to this task.

### rev-30 · 2026-10-15T15:29:05.778Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-459-delta-3
commit: 528680a673944d2ed83506ef7ed902ed336e26fb
scope: delta

Delta source review clear at 528680a673944d2ed83506ef7ed902ed336e26fb, compared with reviewed 3b8d0bd3f00a7fec5700fa51b104f4beb40e0b1c. No high, medium or low findings.

Standards: only two test files changed. Codex adapter file is byte-identical to accepted T-467 shared fix 71050454, retaining the observed approval barrier and all steer/redelivery/exactly-once assertions (accepted evidence A-3072/A-3087, final review A-3089). The heartbeat allowance is correctly inside allow, measured at 5.113 seconds with A-3109 provenance. Parsed semantic comparison confirms every previous duration allowance, including all demo allowances, and every other manifest field is preserved. No stray root-level allowance remains. Diff whitespace check passes; requester reports typecheck and shard lint green.

Spec: demo implementation, lifecycle/budget/authorization, freshness gate, own tests, QA recorder/skill and README are unchanged. C7 reverified at this head; C1–C6 remain pending accepted runtime gate. No task-owned Neovim changes.

Coordinator decisions def8b06e and 5504295f explicitly accept A-3109 as first Linux receipt and these three shared test-only picks as the same-head exception; no local rerun is required. Submit one --executor droplet verify at this exact reviewed head. A-3109 remains overall red; this is source clearance, not a final gate verdict. No Reviewer tests, edits or provider calls.

Criteria: C7 verified.

### rev-30 · 2026-10-15T15:56:23.254Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-459-linux-second
commit: 528680a673944d2ed83506ef7ed902ed336e26fb
scope: evidence

Evidence review not clear at unchanged source-reviewed 528680a673944d2ed83506ef7ed902ed336e26fb; accepted final gate pending lead disposition.

Medium — hub/test/heartbeat.test.ts:260: newly observed old-updated transition counts stale=1 instead of 0 (A-3136:3998–4012), exact known T-506. The same failing test appears in first receipt A-3109, so the different-failing-tests two-receipt rule does not automatically clear this pair.
Medium — hub/test/permissions.test.ts:24: audits() JSON.parse throws Unexpected end of JSON input through check():73 and permission-table case :193 (A-3136:4015–4024). Bugs/S aside to lead: audit-file read is not a complete parseable JSON-lines snapshot despite the existing before/after flush calls; cause and owner need classification. Earlier T-291 describes this helper as synchronized, so check for a regression there rather than silently accepting a new known flake. No exact matching open item found in read-only tracker search. No task-owned source change inferred from this failure.

bbf38383/A-3136 matches reviewed head; Linux x64 c-8, full selection, exit 1, 1769 pass/2 fail/3 platform skips/0 cancelled. Typechecks and hub phases complete; Neovim phases do not run after the hub failure. All own demo 7/7, epic-close 14/14 and skills-QA 16/16 cases pass; no hard duration-budget failure. C7 retained; C1–C6 remain unverified pending accepted gate. No implementation criterion failure marks for these outside-task issues.

The accepted-first receipt A-3109 and shared-pick exception remain as classified by def8b06e/5504295f; those rulings do not by themselves accept this repeated T-506/new-permission failure combination. Hold source and further verification for lead disposition, honoring e6ea9694 cover/restart hold. No task-owned Neovim files; inherited T-458 has independent full Linux proof A-3068. No Reviewer tests or edits.

### rev-30 · 2026-10-15T15:59:24.451Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-459-final
commit: 528680a673944d2ed83506ef7ed902ed336e26fb
scope: evidence

Final evidence review clear at unchanged 528680a673944d2ed83506ef7ed902ed336e26fb under Coordinator's explicit gate exception dfdd70ce-4a7e-448b-bd7f-2f66e1cee95b (15:58:23Z). No high or medium finding remains in T-459's scope. Earlier source/delta reviews stand; all C1–C7 verified at this head.

Gate evidence: A-3109/44712045 at source-reviewed 3b8d0bd3 and A-3136/bbf38383 at delta-reviewed 528680a6 are both Linux c-8 receipts, each overall RED: 1769 pass/2 fail/3 platform skips, exit 1, zero cancelled. Demo 7/7, epic-close 14/14 and skills-QA 16/16 pass in both; own duration allowances are effective. Between heads only approved shared test-only T-467 and heartbeat duration picks changed; own implementation/proof remains unchanged (A-3119). def8b06e/5504295f accept those picks as same-head evidence.

Exception is explicit: both receipts repeat heartbeat.test.ts:260 T-506. Coordinator dfdd70ce accepts the repeated test because diagnosis establishes a deterministic fixture-clock race outside T-459's diff, rather than applying the usual different-failure rule. Second receipt's permission audit partial JSONL parse at permissions.test.ts:24 is filed as T-510. First receipt's other case is known T-467, addressed by exact shared pick; first heartbeat hard budget is addressed by its measured shared allowance. The suites are not green. This verdict accepts the named task gate exception only; T-506/T-510 remain separate work.

C1–C4: reviewed demo start/delivery/preparation/ordinary-user command status, stop/verdict/watchdog release, budget accounting/refusals and role authorization are exercised by seven green fake-provider cases, including default/explicit commits, headless recorder capture and exit 255.
C5: green epic-close cases prove ancestor acceptance after unrelated dev moves and rejection naming surface edits, including intervening rename/revert and off-dev commits; source reread/cache safety remains as reviewed.
C6: recorder/skill retains remote epic execution, local macOS same-commit path, freshness recheck and executor/commit/lifetime/cost evidence. The earlier E-prefixed epic-id recorder fix remains covered by green demo/skills cases.
C7: unchanged README describes commands, budget sharing and surface freshness, retained from current source verdict.

Neovim phases did not run in these red receipts. Coordinator dfdd70ce explicitly requires no local Neovim run because T-459 owns no nvim files; inherited T-458 has independent full Linux proof A-3068. No per-item QA criteria; real droplet demo remains epic/stage QA as specified. Branch ref read-only check matches reviewed SHA. No Reviewer tests, edits or provider calls. Merge scheduling remains with Coordinator and current restart hold.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
