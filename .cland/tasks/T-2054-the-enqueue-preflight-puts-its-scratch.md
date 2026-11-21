---
id: T-2054
kind: task
title: The enqueue preflight puts its scratch HOME inside the candidate worktree, so npm's logs make the worktree unremovable and every enqueue fails
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
regression_of: T-1901
topic: topic-1704
branch: t/T-2054-the-enqueue-preflight-puts-its-scratch
created: 2026-11-21T12:21:17.741Z
updated: 2026-11-21T14:47:45.542Z
closed: 2026-11-21T14:47:45.542Z
---

## Summary

Hub restart #93 (2026-11-21 12:17Z, dev 55479f075) put T-1901's enqueue preflight live. The first enqueue, `cland merge T-2046` at 12:19:56Z, failed with `merge-git: git worktree remove …/.cland/run/merge-batches/enqueue-78b3a77c…: fatal: … contains modified or untracked files, use --force to delete it`. `enqueue-preflight-native.ts` runs the check command with `fixtureEnvironment(candidate.cwd, env)`, so the scratch HOME is inside the candidate worktree. `npm run check` writes `home/.npm/_logs/*.log` and `home/.npm/_update-notifier-last-checked` there, and `removeMergeBatch` then refuses the unclean worktree. Every enqueue on a live hub fails the same way, so the merge queue is closed. The hub was rolled back to 782f2a58e, which predates T-1901, until this lands.

## What to build

Give the preflight command a scratch HOME (and XDG and npm cache directories) outside the candidate worktree, owned and removed with the candidate, so the worktree's status stays clean. Keep removal of an unclean worktree refusing, as today, so a real stray write is still caught. Search every caller of `fixtureEnvironment` that passes a worktree as its base for the same pattern (rule 20).

## Acceptance criteria

- [x] C1. An enqueue preflight whose check runs a real npm script leaves the candidate worktree clean, and the candidate is removed (test with a real npm child, red before).
  - done: impl-2054 · 2026-11-21T12:37:18.856Z
  - verified: rev-35 [reviewer] · run rev-35-2054-evidence-1 · 2026-11-21T13:47:57.007Z · commit 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a
  - verified: rev-35 [reviewer] · run rev-35-2054-evidence-2 · 2026-11-21T14:20:43.921Z · commit 7e7c8d96da85eed58e8e09f2c7d6274b17ebc285
- [x] C2. The scratch HOME and its contents are removed with the candidate on success, failure and cancel (test).
  - done: impl-2054 · 2026-11-21T12:37:19.070Z
  - verified: rev-35 [reviewer] · run rev-35-2054-evidence-1 · 2026-11-21T13:47:57.007Z · commit 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a
  - verified: rev-35 [reviewer] · run rev-35-2054-evidence-2 · 2026-11-21T14:20:43.921Z · commit 7e7c8d96da85eed58e8e09f2c7d6274b17ebc285
- [x] C3. An item comment records the literal failure and the contents (names only) of the stale `enqueue-78b3a77c` candidate worktree as the reproduced cause.
  - done: impl-2054 · 2026-11-21T12:28:07.264Z
  - verified: rev-35 [reviewer] · run rev-35-2054-source-2 · 2026-11-21T12:38:56.984Z · commit 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a
  - verified: rev-35 [reviewer] · run rev-35-2054-delta-1 · 2026-11-21T13:53:04.931Z · commit 7e7c8d96da85eed58e8e09f2c7d6274b17ebc285

## Comments

### coord · 2026-11-21T12:23:56.152Z

Post-landing step (Coordinator, not a merge criterion): after T-2054 lands and the hub restarts onto it, clean the stale `.cland/run/merge-batches/enqueue-78b3a77c-54e3-47f4-a02a-e470ae1d70e2` candidate through the hub's own removal path, and confirm the next enqueue succeeds on the live hub.

### impl-2054 · 2026-11-21T12:25:09.098Z

C3 evidence (read-only): original enqueue failure was merge-git: git worktree remove …/.cland/run/merge-batches/enqueue-78b3a77c…: fatal: … contains modified or untracked files, use --force to delete it. git status --short --untracked-files=all confirms home/.npm/_logs/2026-11-21T12_18_58_405Z-debug-0.log, 12_18_58_640Z, 12_18_58_724Z, 12_19_01_180Z, 12_19_02_956Z, 12_19_03_039Z, 12_19_04_130Z, 12_19_04_213Z (same date and -debug-0.log suffix) and home/.npm/_update-notifier-last-checked. find home -maxdepth 3 confirms home/.npm/_logs. No contents read and no removal attempted. npm account writes inside the checkout caused the refusal; Coordinator owns hub cleanup after landing.

### impl-2054 · 2026-11-21T12:26:43.705Z

Consumer audit (rule 20): searched every fixtureEnvironment( call across repository TS, docs, skills, QA briefs and fixtures, plus enqueuePreflight, owner.gitdir, scratchGitEnvironment and worktree/checkout/candidate bases. Production caller: hub/src/hub/enqueue-preflight-native.ts only (migrated). Native adapter consumers: hub/test/merge-batches.test.ts (fake checkout ownership and HOME assertion migrated), hub/test/merge-queue.test.ts (native backend only for skipped check: no environment constructed), hub/test/harness.ts (fake backend unchanged). Worktree-aware Git wrappers/callers in task-worktrees-lifecycle, worktree-cli, merge-support, merge-native-support, release-support, stage-qa-support, session-archive-merge, suite-stage-cover, executor-run, suite-candidate-remote and suite-close use scratch checkout bases for Git only; Git does not create HOME/XDG/npm cache, so unaffected. Generic cwd Git wrappers in lead-permissions, session-stop-races, push, tracker-status, default-subscriptions-workflow, release-item, aide-claims-lifecycle, tracker-ready-native and session-native-lifecycle likewise unaffected. push clone, measure-memory source, git-maintenance subject, suite-protocol base.cwd and nvim-path base are disposable repository/fixture roots, not preflight candidates requiring clean worktree removal. Other root/f.root/scratch/dir/account bases belong to disposable fixture owners and keep their existing lifetime. The shared environment builder and wire/persisted ownership schema are unchanged; no CLI/help bytes change. Updated runtime references and native-file guidance. Added real npm coverage in existing T3 merge-batch-dependencies.test.ts, retaining previous tier classification.

### rev-35 · 2026-11-21T12:33:53.422Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2054-source-1
commit: b6276045da6ef69b2b30d94975ea5bd646a0a9a3
scope: full
findings: [{"severity":"medium","text":"M1: Later raw after hook releases/joins retained.settled only after shared teardown can remove root on assertion rejection; checkpoint metadata writes may follow disposal. Pre-own release and retained continuation before admission and prove rejected-body guarded cleanup ordering.","file":"hub/test/merge-batch-dependencies.test.ts","line":50},{"severity":"medium","text":"M2: New rev-parse/committed-tree setup probes run outside a separately bounded setup observation; sequence ownership alone supplies no deadline. Put them inside a named owned setup bound.","file":"hub/test/merge-batch-dependencies.test.ts","line":41},{"severity":"low","text":"L1: Qualify npm cache as its default HOME-relative cache, matching implementation/running guide; project npm configuration can override that location.","file":"hub/README.md","line":32}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source not clear; A-22491. M1 medium at native test:50: retained.settled release/join is a later raw after hook, so rejected assertions can permit fixture disposal before metadata writer/retained removal. M2 medium at:41: new rev-parse/tree identity probes lack separate setup observation deadline. Implementer confirms both gaps (d26838ef/7c9d5f39). Add pre-admission release/continuation ownership and real rejected-body guarded cleanup control; bound setup probes. L1 low: README should qualify npm's default HOME-relative cache. Production scratch root under captured candidate gitdir and unchanged guarded removal meet intended design; no force removal or additional production defect established. C3 recording comment matches revised criterion; live stale cleanup is Coordinator post-landing work, not this review. C1/C2 failed; C3 unverified on NC. A-22490 reports selected local7native/154T1 plus lint/typecheck, not configured proof. No Reviewer execution/edit/live cleanup. Hold releases for one consolidated correction/fresh source review before Coordinator full verify all; no Implementer submission.

Criteria: C1 failed (New native identity setup probes are outside separate setup observation bounds; keep original work owned inside a named setup deadline.), C2 failed (Rejected-body path can remove fixture root before the later raw after hook releases/joins retained metadata checkpoint/removal work; pre-own and fence this continuation.).

### impl-2054 · 2026-11-21T12:37:07.148Z

Consolidated source1 corrections M1/M2/L1: native cases now pre-enroll release and positive-close ownership with fenced stageCase, including late native receipts and retained metadata continuation; removed raw t.after. New controlled rejected-assertion case drains real fixture cleanup and asserts retained join in directory beforeRemove plus final root absence. Head/tree identity probes have a named setup deadline. README qualifies default HOME-relative npm cache. Corrected native file 8/8, full lint and typecheck exit 0. Evidence A-22492 retains the earlier 7/8 self-join failure separately. No production change or dev merge since source1. Fresh source review next; Coordinator owns full verify all after clear.

### rev-35 · 2026-11-21T12:38:56.984Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2054-source-2
commit: 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear, findings=[]; A-22493. M1 resolved by pre-acquisition stageCase/fenced cleanup: deferred release handles late native receipts, required-close joins retained checkpoint/removal before root hooks. New rejected-assertion control invokes actual fixture drainage, beforeRemove requires retainedJoined, then root ENOENT; no raw late after hook. M2 setup identity probes now named/bounded; L1 README default-cache qualifier corrected. Production/T1 fake-owner changes exactly source1 blobs; no dev merge. C3 comment records literal refusal and names-only npm artifacts under revised criterion; live cleanup/next enqueue are Coordinator post-landing work. Verify C3 only; C1/C2 await same-head configured evidence. A-22492 reports local native8/8 plus lint/typecheck; self-join failed round retained, prior T1 evidence remains prior. No Reviewer execution/edit/live cleanup. Hold releases; fixed head for Coordinator full verify all, no Implementer submission.

Criteria: C3 verified.

### impl-2054 · 2026-11-21T13:46:30.073Z

Same-head full verification 7b7ce05a / A-22504 at 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a: T0, T1, T2, T3 and Web exit 0; no T4 run. Linux x64 6.8.0-149-generic droplet c-8 ams3, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4. 9466 pass, 0 fail, 13 skipped per aggregate receipt; budget findings report-only. Inspected structured suite timing records in durable log: every one of the 8 merge-batch-dependencies cases has outcome pass, including npm success/failure/cancel/incomplete/stray-write/rejected-assertion and both existing dependency cases. This is actual full-run evidence, not a cache hit. Head unchanged. Reviewer owns final same-head settlement; Coordinator owns post-landing live cleanup.

### rev-35 · 2026-11-21T13:47:57.007Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2054-evidence-1
commit: 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-22505, findings=[]. Full7b7ce05a/A-22504 finished/passed at source2-reviewed6c427d4c8; refs unchanged. Typed starts/pass finishes confirm all6 new real-npm cleanup identities each base+5 distinct load passes (success/failure/cancel/incomplete/stray write/rejected assertion), plus2 dependency preservation base passes. Source2 reviewed actual guarded HOME/XDG removal/retained continuation fence. File finishes match all241T1/443T2/273T3/55Web; T0 exit0. Producer9466pass/13prerequisite skips/0fail/cancel; no18T4 runtime claim. Linux x64 c-8ams3 Node24.21 Nvim0.12.5, isolated HeadlessShell1248/Chrome for Testing156.0.8078.4. Canonical2959e552 differs by definition from Git8bc3680e. Report-only budgets/lint not enforced timing proof. Verify C1/C2; C3 remains current from source2. Original Git128/intermediate failed controls retained. No Reviewer execution/edit/live cleanup. Hold releases; no duplicate run/manual relay. Live stale candidate cleanup/next enqueue remains Coordinator post-landing operation.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-21T13:53:04.931Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2054-delta-1
commit: 7e7c8d96da85eed58e8e09f2c7d6274b17ebc285
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, findings=[]; A-22507. Parents verified: full-green6c427d4 and dev9b8107d85 under Coordinatorb3ac71ce rule11 request. Union95paths:89 exactdev/4 exacttask, only README/running docs combine; task production/native/T1 blobs byte-identical to full-green parent. README keeps HOME/XDG/default-cache paragraph plus upstream timing policy/wait wording; running.md preserves environment fence and upstream timing/deployment/wait sections, stale no-timing-gate text replaced. A-22506 reports merged-head full lint/typecheck and five actual README reader files64/64 T1/T2; no new native/browser/full-suite claim. C3 documentary criterion remains source-established, refreshed here only. C1/C2 await new-head runtime evidence; old full7b7ce05a/A-22504 stays old-head. No Reviewer execution/edit/merge. Hold releases; ask Coordinator window, then exactly authorized mode-free verify. No new all requested; live cleanup remains Coordinator post-landing.

Criteria: C3 verified.

### impl-2054 · 2026-11-21T14:19:16.750Z

Merged-head mode-free receipt b4fcc966 / A-22508 at 7e7c8d96d: actual Linux droplet T0/T1/all fallback T2/selected T3/Web exit 0; 7408 passing, 1 skip. Inspected structured suite timing: all 8 merge-batch-dependencies cases outcome pass. Native npm success/failure/cancel/incomplete/stray-write/rejected-assertion each passed once, with both dependency controls. Executor c-8 ams3 Linux6.8.0-149-generic, Node24.21.0, Neovim0.12.5; browser Chrome Headless Shell Google Chrome for Testing156.0.8078.4. Not cached. Budget findings remain report-only. Remaining T3 belongs to merge batch; no T4 receipt claimed. Reviewer owns final new-head settlement. Prior full run7b7ce05a remains prior-head proof only.

### rev-35 · 2026-11-21T14:20:43.921Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2054-evidence-2
commit: 7e7c8d96da85eed58e8e09f2c7d6274b17ebc285
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear under Coordinatorb3ac71ce accepted mode-free-after-conflict bar; A-22509, findings=[]. b4fcc966/A-22508 finished/passed at delta-reviewed7e7c8d96, refs unchanged. All8 required native npm/dependency identities have matching base start/pass receipts. Actual files all243T1/444T2/55Web plus4selectedT3 (merge-batch-dependencies/suite-candidate/suite-runner/executor-run) pass; T0 exit0. Remaining269T3 deferred batch,18T4 unexecuted; nested generated launch-timeout fixture is not another project tier file. Producer7408pass/1platform skip/0fail/cancel; task selected phases one base/no repetitions. Linuxc8ams3 Node24.21 Nvim0.12.5, isolated HeadlessShell1248/Chrome156.0.8078.4; canonicalf08391d7 distinct from Gitf08f42f8. Report-only timing/lint advisory. Prior full7b7ce05a stays parent-head evidence, not merged-head full proof. Refresh C1/C2; C3 current from delta1. No Reviewer execution/edit/live cleanup. Hold releases; no new all/manual relay, integrated T3/live cleanup remain assigned.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T14:47:45.542Z

Merged 4cafa60404a8c2e68a68431a3f25d129954d48d6 onto dev.
