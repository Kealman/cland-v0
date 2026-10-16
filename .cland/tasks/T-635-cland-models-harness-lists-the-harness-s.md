---
id: T-635
kind: task
title: cland models <harness> lists the harness's model ids from a cached probe
state: open
status: review
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-391
branch: t/T-635-cland-models-harness-lists-the-harness-s
created: 2026-10-16T16:04:12.499Z
updated: 2026-10-16T19:08:08.394Z
---

## Summary

`cland models <harness>` lists the model ids the harness offers, from a probe of its model list that the hub caches, so the onboarding's crew round names only a model the harness lists and the launcher's model field can offer them. In the live run `opencode models` printed nothing and the Aide needed several probes to find an id (Q-600 question 17).

## What to build

- **The command.** `cland models claude-code | codex | opencode [--account <name>] [--refresh] [--json]` prints one id per line, the harness's default marked, then where the list came from and its age ("probed now", "cached 3 h ago"). `--json` prints `{harness, account, models: [{id, default}], source, probedAt}`. The usage text lists it.
- **Through the hub.** The hub probes in the environment it launches the harness with (cland's own OpenCode database, an account's directory with `--account`), so the list is the one a launch would see. Any session may read it; the launcher reads the same answer.
- **The probes.**
  - OpenCode: the OpenCode server's model list, as the adapter already reads it to pick a free model, never the `opencode models` command; a server that answers an empty list just after start is asked again until it lists models or a short timeout passes (the fake OpenCode answers an empty list for its first 400 ms).
  - Codex: the model list of a short-lived Codex app-server.
  - Claude Code: as the Coordinator decides (open question in the README); the source line names it.
- **The cache.** Per harness and account, kept by the hub across restarts, for a lifetime the plan sets (recommended 24 hours). A call within it answers from the cache; `--refresh` probes again. A failed probe answers the cached list with its age, or, with no cache, fails with the probe's error. A harness that is not installed fails with doctor's not-installed line.
- **The fakes.** The fake Codex answers the app-server model list; the fake OpenCode's model list is used as it is; both count their probes for the tests.

## Acceptance criteria

- [x] C1. `cland models opencode` and `cland models codex` print the ids the fake OpenCode server and the fake Codex app-server list, the default marked (new CLI test against a temporary project's hub).
  - done: impl-635 · 2026-10-16T16:30:26.722Z
- [x] C2. A second call within the cache's lifetime answers without a probe and `--refresh` probes again, as the fakes' probe counts show.
  - done: impl-635 · 2026-10-16T16:30:27.601Z
- [x] C3. The OpenCode probe waits out the fake's empty first answer and returns its models.
  - done: impl-635 · 2026-10-16T16:30:28.610Z
- [x] C4. `cland models claude-code` prints Claude Code's list with its source named, as decided for Claude Code.
  - verified: rev-30 [reviewer] · run rev-20261016-635-source · 2026-10-16T16:28:49.387Z · commit 396d635928d01a75e7cbee88561ca0458a05fd33
  - done: impl-635 · 2026-10-16T16:30:29.570Z
  - verified: rev-30 [reviewer] · run rev-20261016-635-path-delta · 2026-10-16T16:32:28.971Z · commit a1bef9deff1c54d971f922d75de2f30389a25d26
  - verified: rev-30 [reviewer] · run rev-20261016-635-import-correction · 2026-10-16T17:23:58.036Z · commit ab3867ec6b8a0c84814db357d1898084c337a176
- [x] C5. A failing probe answers the cached list with its age, or with no cache fails with the probe's error, and a harness not installed fails with doctor's not-installed line.
  - done: impl-635 · 2026-10-16T17:22:16.310Z
- [x] C6. `--account <name>` probes in that account's environment and keeps its cache apart from the default's, and `--json` prints the documented shape.
  - done: impl-635 · 2026-10-16T16:30:31.102Z

## Comments

### impl-635 · 2026-10-16T16:08:07.830Z

Implementation started. Scope: hub models.list frame and durable 24-hour per-harness/account cache, CLI rendering, native short-lived probes, and isolated fake-driven tests for C1–C6.

### impl-635 · 2026-10-16T16:17:39.250Z

Implementation includes CLI/frame catalog, durable cache, native probes, fake probe receipts and launcher model cycling. Initial model tests 5/5 green; doctor regression 22/22 green; existing shell cases 84/84 green. New shell test corrected its initial mode setup. Current source typecheck exit 0. Merged origin/dev 0df55de7 before first review. Final targeted reruns wait for Coordinator's load gate (1-minute load must be <15); source review has not been requested yet.

### impl-635 · 2026-10-16T16:25:40.003Z

Source ready at 396d635928d01a75e7cbee88561ca0458a05fd33, committed and pushed to origin; origin/dev 605671ea merged before first review. Typecheck exit 0 at this head. Final models.test.ts 5/5 passed; launcher-focused shell tests 6/6 passed (new catalog case 0.619 s). Shard lint and diff check exit 0. Duration allowance records the 5.362 s account-isolation case. QA policy none/after-stage; no per-item QA required. Implementation evidence artifact posted in topic-391. Requesting source review, then exact-head droplet verification.

### impl-635 · 2026-10-16T16:27:10.730Z

C4 authority cross-reference for review: parent E-611 Coordinator comment (D51) at 2026-10-16T16:04:29.444Z, decision (6): cland models claude-code returns a static alias list labelled static; cache per harness and account for 24 h. The four aliases default/sonnet/opus/haiku are the implementation's choice under that disposition; source line is 'Claude Code static aliases'.

### rev-30 · 2026-10-16T16:28:49.387Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-635-source
commit: 396d635928d01a75e7cbee88561ca0458a05fd33
scope: full
findings: [{"severity":"low","text":"Relative PATH entries produce a relative executable path; model probes then change cwd to scratch and may fail ENOENT despite successful installation lookup. Return an absolute resolved PATH candidate before spawning.","file":"hub/src/doctor/report.ts","line":126}]
finding_counts: {"high":0,"medium":0,"low":1}

# T-635 source review

Commit 396d635928d01a75e7cbee88561ca0458a05fd33; fixed point 605671eaad5b400fe48c51ddcbca1ea0969c137d. Local and origin task tips agree. Reviewed all 17 changed files against T-635 and v0.1.4 §3.5. Both axes performed in-session; role delegation is disabled.

## Standards
No findings. CLI and launcher share the hub catalog rather than independent discovery paths. Probe processes have a common bounded lifecycle: 10-second deadline, bounded captured output, process-group termination, awaited child close before scratch removal, and cancellation joined on dispatcher shutdown. Doctor's installation diagnosis is reused through asynchronous filesystem lookup. New test classification and one measured reasoned duration allowance are present. Diff whitespace check passes.

## Spec
L1 — low — hub/src/doctor/report.ts:126 (used by hub/src/models.ts:88): relative PATH entries yield a relative executable path. For example, PATH=./bin resolves installation from the hub's current directory, but spawn then resolves bin/codex from the scratch probe cwd and fails with ENOENT despite the executable being installed. Resolve the found PATH candidate to an absolute path before returning it. Explicit slash-containing overrides already resolve absolutely. This is a nonblocking edge case; the supplied probes use absolute fake executable overrides.

Otherwise the implementation matches the requested surfaces:
- Per-harness/account durable cache identity also includes effective directory selections; default and named accounts remain separate. A fresh hit avoids the probe; refresh bypasses it; concurrent probes of one key coalesce. Probe failures retain the prior list and timestamp, while no-cache failures propagate the native error. Installation absence uses doctor's shared diagnostic.
- OpenCode uses authenticated server /api/model, never the models CLI. It retries an initially empty catalog within the deadline, formats active model ids and marks the adapter's selected free/default choice. Default probes use cland's database; account overlays clear conflicting database/data-home selections. Inherited private OpenCode config/password variables are removed before the probe creates its own config and password.
- Codex uses initialized short-lived stdio app-server model/list, validates model/default fields, follows pagination and refuses repeated cursors. It does not create a conversation.
- CLI prints ids, default markers and source/age; JSON removes the internal cached flag and exposes exactly the documented five fields.
- models.list is a typed validated read frame permitted to session shells. Launcher requests use selected harness and matching role account, share the hub cache, retain empty-model default selection, and reject replies after form/harness/account/field changes. The UI regression checks native model cycling and role-account routing.

C4 is established by source and its policy origin. Independently read parent E-611's Coordinator comment D51 at 2026-10-16T16:04:29.444Z: decision (6) chooses labelled static Claude aliases and a 24-hour per-harness/account cache. The implementation labels default/sonnet/opus/haiku as static and marks default. This is not a live Claude catalog claim.

## Evidence and criteria
A-4002 is summarized claimant validation: exact-head typecheck exit 0, models.test.ts 5/5, launcher-focused shell tests 6/6, shard/diff checks clean. The source tests cover native fake catalogs, empty OpenCode startup, probe counts, failure fallback, absent executable, directory/account isolation, documented JSON, persisted cache across hub stop/start, expiry and coalescing. Broader doctor 22/22 and shell 84/84 passes are recorded in the topic before final adjustments; the final targeted reruns are distinguished. No Reviewer probes, tests or compiler execution occurred.

Source clear with one low finding and no high/medium findings. C4 source verified; C1–C3/C5/C6 and final execution await normal same-head droplet verification and new-test repetitions. All claimant done marks were absent at the initial item read; record the applicable marks as evidence is completed. No per-item QA is required. Any source correction needs a fresh source verdict before verification.

Standards 0 findings; Spec 1 low finding.
Artifact: A-4005 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4005-t-635-source-clear-cached-native-model-catalogs-one-path-edge-case.md

Criteria: C4 verified.

### impl-635 · 2026-10-16T16:30:47.878Z

Fixed Reviewer's sole low from A-4005: async executable lookup now resolves PATH candidates absolutely before model probes change cwd. Regression uses the real CLI/frame and fake Codex reached through relative PATH. Pushed a1bef9deff1c54d971f922d75de2f30389a25d26; no dev merge after first source review. models.test.ts 6/6 green (relative-PATH case 0.683 s), typecheck exit 0 at committed head; latest account-test allowance measured 6.567 s. C1–C6 done marks recorded. Requesting delta source review before verification.

### rev-30 · 2026-10-16T16:32:28.971Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-635-path-delta
commit: a1bef9deff1c54d971f922d75de2f30389a25d26
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-635 PATH correction source review

Commit a1bef9deff1c54d971f922d75de2f30389a25d26, direct child of source-reviewed 396d635928d01a75e7cbee88561ca0458a05fd33 / A-4005. Local/origin tips agree; no intervening dev merge. Delta limited to three files.

## Standards
No findings. whichAsync now resolves PATH entries against its explicit lookup cwd before checking/returning candidates. Absolute entries and slash-containing override behavior remain correct; synchronous doctor lookup is untouched. The one owned allowance changes only its measured seconds from 5.362 to 6.567 with the existing detailed reason. Diff whitespace check passes.

## Spec
Prior low L1 is resolved. Model probes receive an absolute executable and can change cwd safely. The new integrated CLI regression clears the binary override, places fake Codex in a relative PATH directory, then requires the expected default catalog and exactly one native probe receipt. Its test fixture callback computes the relative entry against the embedded hub's real lookup cwd without changing the parent cwd.

The remaining cache/probe/launcher design and parent E-611 D51 policy are unchanged from A-4005. C4 source verification is refreshed to this head. No findings remain.

A-4010 summarizes models whole-file 6/6, new regression 0.683 seconds, exact-head root typecheck exit 0 and clean diff. The six-model-test receipt is distinguished from the original five-test source receipt; broader launcher checks remain A-4002. No Reviewer execution occurred.

Source clear. All claimant C1–C6 done marks are now present. C1–C3/C5/C6 and final runtime acceptance await same-head no-mode droplet verification, including the new catalog and PATH regression repetitions. No further source change or task run has yet been reviewed.

Standards 0 findings; Spec 0 findings.
Artifact: A-4012 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4012-t-635-delta-clear-absolute-path-resolution-and-integrated-regression.md

Criteria: C4 verified.

### impl-635 · 2026-10-16T16:32:58.486Z

Delta source clear at a1bef9deff1c54d971f922d75de2f30389a25d26, rev-20261016-635-path-delta (A-4012), no remaining findings. Submitted exact-head verification 8130ab79-10d4-4fe5-abd4-7b7a9c3b5251 with --executor droplet and no mode; queue position 3 at submission, worker pending. Result routes to Reviewer and item lead in topic-391. Going idle until the hub result.

### rev-30 · 2026-10-16T17:10:00.946Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-635-gate-red
commit: a1bef9deff1c54d971f922d75de2f30389a25d26
scope: evidence
findings: [{"severity":"medium","text":"M1: New failed-refresh/cache-error case passes but takes 7.626969842 s without the required exact-identity reasoned allowance; task gate fails its duration budget.","file":"hub/test/models.test.ts","line":75},{"severity":"medium","text":"M2: New static doctor/toolchain import pulls nvim/bin/nvim-path.ts into hub startup, but the real-production-source coverage fixture copies only hub sources and lacks that file. Ordinary execution and 0/5 repetitions fail ERR_MODULE_NOT_FOUND. Fix the fixture source closure or shared dependency seam, retaining its coverage assertions.","file":"hub/src/models.ts","line":11}]
finding_counts: {"high":0,"medium":2,"low":0}

T-635 evidence not clear at a1bef9deff1c54d971f922d75de2f30389a25d26. A-4045 / 8130ab79-10d4-4fe5-abd4-7b7a9c3b5251 is exact-head Linux c-8 evidence: 1955 tests, 1948 pass, two ordinary failures, five unrelated prerequisite skips; full-mode Neovim not reached. Exit 1, suite 1447.08 s, peak load 13.59, lifetime 1518 s, $0.1054. Host/remote typechecks complete.

All six models.test.ts identities pass ordinarily and each 5/5 load repetitions (30/30). Failed-refresh behavior passes in 7.626969842 s, account case 8.444470601 s (existing reasoned allowance), relative-PATH regression 0.978925524 s. This is positive owned behavior evidence, not a green overall gate.

Medium M1 — hub/test/models.test.ts:75: new failed-refresh/cache-error case exceeds the 5 s budget (7.627 s) without an exact reasoned allowance. Add its measured allowance or correct a demonstrated avoidable delay; source-review the resulting head before another task run.

Medium M2 — hub/src/models.ts:11: new static import of harnessInstallation from doctor/toolchain.ts introduces that module's static ../../../nvim/bin/nvim-path.ts dependency into ordinary hub startup (dispatch.ts:1 imports HarnessModels). The production-source coverage fixture copies hub/src and hub/bin but only creates nvim/test; its new import graph cannot resolve nvim/bin/nvim-path.ts. A-4045:4426 states the exact missing module, and this case fails ordinarily and 0/5 repetitions. This is an integration consequence of T-635, not an unrelated load flake. Update the fixture's required source closure or narrow the shared installation module dependency, preserving its real CLI/daemon/spoke coverage assertions and malformed-receipt checks; prove the affected whole file after correction. No Reviewer process reproduction was run.

The other ordinary red is hub/test/suite.test.ts:52, process.kill(job.pid!, SIGKILL) receives null (A-4045:4472–4479). Its historical cause/classification is not established by this receipt; report to lead T-635 as an S Bugs candidate for Coordinator classification rather than assuming the missing-module cause or known status. No other hard budget line appears in the full tail.

C4 source policy proof remains applicable. C1–C3/C5/C6 final execution acceptance remains pending; C5 failed for the owned budget and unresolved integration gate. No unchanged retry is appropriate while these owned fixes remain. Fresh source review is required for any corrected head, then normal verification including Neovim.
Review artifact A-4047.

Criteria: C5 failed (Failed-refresh case misses 5 s budget (7.627 s), plus T-635's new startup dependency breaks copied-source coverage fixture; Neovim not reached. A-4047.).

### impl-635 · 2026-10-16T17:11:39.855Z

Verify 8130ab79 / A-4045 failed: all six model cases passed ordinary plus 30/30 repetitions; owned failed-refresh budget 7.627 s and startup import closure require fixes. Corrected source now isolates shared harness installation metadata/lookup in doctor/harnesses.ts, so models no longer imports doctor/toolchain.ts or Neovim's nvim-path; coverage test remains unchanged. Added exact reasoned 7.627 s allowance. Coordinator classifies unrelated null-PID SIGKILL test as T-526; no diagnosis or fix there. Corrections committed/pushed; no dev merge. Waiting for Coordinator's census all-clear before typecheck and whole-file suite-coverage/models checks, then fresh delta source review and droplet verification.

### impl-635 · 2026-10-16T17:23:18.426Z

Corrections at pushed ab3867ec6b8a0c84814db357d1898084c337a176 now validated after census all-clear: typecheck exit 0; unchanged whole suite-coverage.test.ts 2/2 green (formerly failing capture case 2.975 s); models.test.ts 6/6 green; doctor.test.ts 22/22 green; diff check green and tree clean. Shared metadata/lookup moved to doctor/harnesses.ts to remove models' Neovim/toolchain dependency. Exact failed-refresh budget allowance records A-4045's 7.627 s with its multi-process reason. No external test changes, no dev merge, no diagnosis/change for Coordinator-classified T-526. C5 done restored. Requesting delta source review, then new-head droplet verification.

### rev-30 · 2026-10-16T17:23:58.036Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-635-import-correction
commit: ab3867ec6b8a0c84814db357d1898084c337a176
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-635 corrected source clear at ab3867ec6b8a0c84814db357d1898084c337a176, delta from a1bef9de. Four files only; no dev merge or external test changes. Standards and Spec axes reviewed in-session, no findings.

M2 resolved at the shared seam: doctor/harnesses.ts contains only typed installation metadata and the existing async executable lookup/diagnosis. Models imports this module instead of doctor/toolchain.ts. Its runtime dependency is doctor/report.ts (Node APIs only); HarnessId is type-only. Doctor spreads exactly the same metadata and calls the extracted lookup, preserving messages/auth/version/database checks without dragging the Neovim module into ordinary hub startup. The previously failing real-source coverage fixture remains unchanged.

M1 resolved: exact failed-refresh test identity receives 7.627 s measured in A-4045, with a reason naming both harnesses' native discovery, failed refresh/cache age, no-cache errors and process cleanup. No assertion, deadline or unrelated allowance changed. The earlier relative-PATH correction remains intact.

A-4063 is claimant summarized validation at this head, after census all-clear: typecheck exit 0; whole suite-coverage 2/2 (former failure 2.975 s); models 6/6 (failed-refresh 2.589 s); doctor 22/22. No raw bundle or Reviewer test execution claimed. Independent diff whitespace check passes. The claimant reports Coordinator classification of the separate null-PID SIGKILL red as T-526; no change made to that case and no gate waiver inferred here.

C4 static-Claude policy/source proof refreshed at this head; C1–C3/C5/C6 remain pending normal exact-head mode-free droplet verification, including full Neovim selection. C5 done restoration is present in the tracker. Both medium findings resolved; proceed with new-head verification under Coordinator routing.
Review artifact A-4065.

Criteria: C4 verified.

### impl-635 · 2026-10-16T17:24:13.407Z

Correction delta source clear at ab3867ec6b8a0c84814db357d1898084c337a176, rev-20261016-635-import-correction / A-4065, no remaining findings. Submitted new exact-head verification 7d03777a-e251-40d2-80f5-4cdf46bec124 with explicit --executor droplet and no mode; queue position 2 at admission, worker pending. Reviewer and item lead receive the result in topic-391. Going idle until the hub result.

### impl-635 · 2026-10-16T19:08:08.394Z

Coordinator 19:07Z shared-fix plan: hold for posted dev SHA containing T-526/quarantine plus T-585/T-603 fixes; then fetch/merge origin/dev (explicit exception to rule 11), typecheck and shard lint, push, delta review scoped dev merge only, then droplet verify. Clarified current corrected-head run 7d03777a at ab3867ec is still queued (not a new red); A-4045 was the earlier run whose owned import/budget findings are already fixed. No source changes or resubmission until the Coordinator post.
