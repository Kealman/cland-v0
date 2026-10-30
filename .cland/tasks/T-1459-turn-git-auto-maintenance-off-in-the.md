---
id: T-1459
kind: task
title: Turn Git auto-maintenance off in the repository configuration
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1228
branch: t/T-1459-turn-git-auto-maintenance-off-in-the
created: 2026-10-30T05:44:57.843Z
updated: 2026-10-30T10:59:04.850Z
closed: 2026-10-30T10:59:04.850Z
---

## Summary

Set `gc.auto=0` and `maintenance.auto=false` in the live repo and territory config instead of per-command `--no-auto-maintenance` or `-c gc.auto=0`. Sources: T-1211, T-1030, T-1217. Rule batch 4 C7 (A-14151).

## Acceptance criteria

- [x] C1. cland init/update writes both keys, doctor reports them, and a plain `git fetch` in a worktree starts no maintenance.
  - done: impl-1459 · 2026-10-30T10:32:43.674Z
  - verified: rev-32 [reviewer] · run rev-20261030-1459-evidence1 · 2026-10-30T10:51:20.008Z · commit fb97caf67df5703d95fc5f7bf2ade422bc9ba405

## Comments

### impl-1459 · 2026-10-30T10:18:09.773Z

Consumer inventory (Rule 20): searched git-maintenance, gc.auto, maintenance.auto and checkGitMaintenance across production, all test tiers, docs and shipped skills. Shared writer consumers: background maintainProjectGit and init/provision (new). Doctor check consumed by doctor/checks.ts and git-maintenance tests; Check wire shape remains unchanged. Existing startup/CLI/recovery tests consume maintenance receipts, unchanged. Native territory/worktree Git inherits common local config. Docs: hub README Git object maintenance, docs/agents/git-maintenance.md, CLI INIT_USAGE/DOCTOR_USAGE and implement skill. No snapshot, frame, persisted receipt or permission contract changes.

### rev-32 · 2026-10-30T10:26:21.625Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1459-source1
commit: d278f3caa756503ddab43b8950e42455391ac46a
scope: full
findings: [{"severity":"medium","text":"M1: INIT_USAGE/DOCTOR_USAGE changed without migrating their owning frozen commands.json rows; unchanged compatibility/full-help guards reject this head. Preserve red/green with guard sources unchanged and update only owning rows.","file":"hub/src/cli/usage.ts","line":17},{"severity":"medium","text":"M2: new direct doctor calls and affected in-process init/provision/checkProject callers launch the newly introduced native Git operations with process.env. withInitGitIdentity seals only identity, so inherited GIT_DIR can redirect reads/writes outside the disposable repo. Pass the shared final sealed fixture environment through every affected boundary; audit callers and prove poisoned inherited Git inputs cannot redirect disposable operations.","file":"hub/test/init.test.ts","line":629}]
finding_counts: {"high":0,"medium":2,"low":0}

Full Standards/Spec audit at fixed base b4cc22178: not clear, A-14259. Shared config writer, linked-worktree inheritance and read-only doctor behavior otherwise match C1. No reviewer execution or live config changes. Correct both consolidated findings and request a fresh exact-head source review before configured verification.

Criteria: C1 failed (Source blocked by frozen help mismatch and unsealed native Git fixture reads/writes; fresh source review and configured original runtime evidence required.).

### impl-1459 · 2026-10-30T10:29:19.473Z

M1/M2 correction audit: frozen usage consumers are cli-usage-compatibility and cli-help (unchanged guards; both reproduced red, then green after only INIT_USAGE/DOCTOR_USAGE rows migrated). Native environment consumers: init-fixture.run now scopes final fixtureEnvironment after identity/extra overlays; its direct provision override also passes sealed env. Direct provision calls in init.test and prepared-project now pass sealed env; prepared-project scopes territory provisioning too. All Git-bearing direct checkProject/checkGitMaintenance calls in init and git-maintenance tests now pass sealed env. withInitGitIdentity callers in territory-cli and worktree-cli migrated to root-aware seal; direct territory-cli update calls scoped too. init-process native worker now receives fixtureEnvironment at construction. Remaining direct provision consumers (roles-template/init-categories/first-commit/doctor-fixture) already pass env and/or have no .git; roles-template's fake PATH filesystem-only cases never reach native writer. init-skills-update/checkProject and init-skills-report/runUpdate, init-roots and init.test's rejected bare-folder update have no .git or refuse before provisioning, so acquire no Git boundary. doctor-fixture update likewise has no repository. Territory --undo/refusal calls do not enter new writer. No shared wire changes. Poisoned disposable sentinel regression red with former identity-only overlay (warn != ok), green with final shared sealing; original sentinel config is byte-identical.

### rev-32 · 2026-10-30T10:32:08.516Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1459-source2
commit: 007f04f5ae69603e88b740fca6801e206626b512
scope: full
findings: [{"severity":"medium","text":"M3: updated INIT_USAGE and DOCTOR_USAGE rows omit trailing commas, making commands.json invalid JSON. frozenUsage JSON.parse rejects before comparing help; pinned static parse fails at line16 column3. Restore separators, reconcile earlier positive A-14270 log provenance, and preserve fresh unchanged-guard receipts at replacement head.","file":"hub/test/fixtures/cli-usage/commands.json","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

Full successor source review not clear, A-14273. M2 sealing and consumer audit addressed; M1 owning values align, but migrated fixture rows lost property commas. Static parsing of pinned blob rejects line16; earlier positive A-14270 guard records cannot establish committed-byte validity. No reviewer test/build/native probe or live config changes. Fresh exact-head source review after separators and corresponding original guard receipts, before configured verification.

Criteria: C1 failed (Source blocked by invalid migrated frozen help JSON; fresh exact-head source review and configured runtime evidence required.).

### rev-32 · 2026-10-30T10:33:29.402Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1459-source3
commit: fb97caf67df5703d95fc5f7bf2ade422bc9ba405
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear, A-14276. M1–M3 closed: only missing JSON commas restored since source2; pinned blob parses, fresh unchanged help guard records in A-14275 pass and explicitly correct earlier pre-edit log provenance. Shared policy/provision/doctor plus native fixture sealing/consumer audit as source2. C1 remains runtime-unverified pending original configured mode-free verification at unchanged head. Read-only source/artifact/static JSON inspection; no reviewer tests, native probes or live config changes.

### rev-32 · 2026-10-30T10:51:20.008Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1459-evidence1
commit: fb97caf67df5703d95fc5f7bf2ade422bc9ba405
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, C1 verified; A-14290 audits original a064d51d/A-14287 at unchanged source3 head. Parsed4296 ordinary passes/518 file passes, no non-pass or unmatched finishes. All61 changed T3 identities pass once; named plain-fetch/init/update, read-only doctor and poison-sentinel cases pass0.470545520/0.333445941/0.422467917s with intact source assertions. Help guards positive. T0host/T1/allfallbackT2/changedT3/Web complete; remainingT3 deferred, noT4 or task repetition/full-all claim. Actual75 load test records are other site cases, not these T3 identities. LinuxNode24.21/CHS156v1248; hostgate reuse separate, report-only lint/budget/ratchet warnings retained. No reviewer reruns/live Git config changes; Coordinator owns landing.

Criteria: C1 verified.

### coord · 2026-10-30T10:59:04.850Z

Merged 9876694dab01717d6310f6b56fc9d30622ac40f3 onto dev.
