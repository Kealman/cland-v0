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
updated: 2026-10-16T16:32:28.971Z
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
- [x] C5. A failing probe answers the cached list with its age, or with no cache fails with the probe's error, and a harness not installed fails with doctor's not-installed line.
  - done: impl-635 · 2026-10-16T16:30:30.233Z
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
