---
id: T-2054
kind: task
title: The enqueue preflight puts its scratch HOME inside the candidate worktree, so npm's logs make the worktree unremovable and every enqueue fails
state: open
status: review
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
updated: 2026-11-21T12:38:56.984Z
---

## Summary

Hub restart #93 (2026-11-21 12:17Z, dev 55479f075) put T-1901's enqueue preflight live. The first enqueue, `cland merge T-2046` at 12:19:56Z, failed with `merge-git: git worktree remove …/.cland/run/merge-batches/enqueue-78b3a77c…: fatal: … contains modified or untracked files, use --force to delete it`. `enqueue-preflight-native.ts` runs the check command with `fixtureEnvironment(candidate.cwd, env)`, so the scratch HOME is inside the candidate worktree. `npm run check` writes `home/.npm/_logs/*.log` and `home/.npm/_update-notifier-last-checked` there, and `removeMergeBatch` then refuses the unclean worktree. Every enqueue on a live hub fails the same way, so the merge queue is closed. The hub was rolled back to 782f2a58e, which predates T-1901, until this lands.

## What to build

Give the preflight command a scratch HOME (and XDG and npm cache directories) outside the candidate worktree, owned and removed with the candidate, so the worktree's status stays clean. Keep removal of an unclean worktree refusing, as today, so a real stray write is still caught. Search every caller of `fixtureEnvironment` that passes a worktree as its base for the same pattern (rule 20).

## Acceptance criteria

- [x] C1. An enqueue preflight whose check runs a real npm script leaves the candidate worktree clean, and the candidate is removed (test with a real npm child, red before).
  - done: impl-2054 · 2026-11-21T12:37:18.856Z
- [x] C2. The scratch HOME and its contents are removed with the candidate on success, failure and cancel (test).
  - done: impl-2054 · 2026-11-21T12:37:19.070Z
- [x] C3. An item comment records the literal failure and the contents (names only) of the stale `enqueue-78b3a77c` candidate worktree as the reproduced cause.
  - done: impl-2054 · 2026-11-21T12:28:07.264Z
  - verified: rev-35 [reviewer] · run rev-35-2054-source-2 · 2026-11-21T12:38:56.984Z · commit 6c427d4c875faaeb7b1ea235eee4aa482ceccd0a

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
