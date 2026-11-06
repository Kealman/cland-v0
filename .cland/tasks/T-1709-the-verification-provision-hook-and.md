---
id: T-1709
kind: task
title: The `[verification] provision` hook, and Neovim and Chromium leave the recipe
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1402
branch: t/T-1709-the-verification-provision-hook-and
created: 2026-11-06T10:47:58.346Z
updated: 2026-11-06T12:12:40.518Z
---

## Summary

`[verification] provision` names a script the executor's image builder runs once as root, after the recipe and before `prepare` runs as `runner`. The snapshot key drops its Neovim pin and gains the hook's content digest. This project's own hook installs its Chromium runtime libraries and its pinned Neovim, which leave `provision.sh` in the same change, so the executor's droplet snapshot keeps passing this project's suites.

Hot files: `hub/src/executor/droplet/provision.sh`, `hub/src/executor/droplet/prepare.ts` (`PrepareKey`, `prepareKey`, `sameKey`, `staleParts`), `hub/src/init/config.ts` (`[verification]`), `hub/bin/verify-prepare.ts`, this project's hook script (new), `.cland/config.toml`, `hub/test/executor-prepare.test.ts`

## What to build

- the config key, with its template comment;
- the builder step that copies the hook and runs it as root, its output logged with `executor-prepare-install`;
- the key change and its staleness report;
- `verify-prepare.ts` reading a key without `nvim`;
- this project's hook with the Neovim tag and digest embedded, so that a pin change changes the hook's content.

Notes: `provision.sh` is read from the running hub's code, so the new recipe and key take effect at the hub restart after landing, which triggers one snapshot rebuild. The Coordinator restarts and watches the first droplet run before any batch relies on it (epic constraint "The executor stays green").

## Acceptance criteria

- [x] C1. On the scripted machine, the builder runs the hook as root before `prepare` runs as `runner`, and a failing hook fails the prepare with its output (test).
  - done: impl-1709 · 2026-11-06T11:02:48.400Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
- [x] C2. The snapshot key carries the hook's content digest and no Neovim field, and editing one byte of the hook marks the snapshot stale with `provision` named in its stale parts (test).
  - done: impl-1709 · 2026-11-06T11:02:49.063Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
- [x] C3. `provision.sh` installs no `nvim` and none of the Chromium runtime packages (test).
  - done: impl-1709 · 2026-11-06T11:02:49.768Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
- [x] C4. This project's hook installs those Chromium packages and the Neovim tag and digest of `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, which a test keeps equal (test).
  - done: impl-1709 · 2026-11-06T11:02:50.486Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
- [x] C5. `cland config` documents `[verification] provision`, and a project without it prepares exactly as before apart from the key (test).
  - done: impl-1709 · 2026-11-06T11:02:51.264Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e

## Comments

### impl-1709 · 2026-11-06T10:51:05.659Z

Rule 20 sweep before edits: searched hub/src, hub/bin, hub/test (all tiers), nvim, web, docs, qa/briefs and .agents/skills for PrepareKey/prepareKey/sameKey/staleParts, key.nvim, NVIM_VERSION/SHA256 and verification prepare. Migrate prepare.ts, droplet.ts status/options, config.ts, verify-prepare.ts; key assertions in prepare-key, executor-prepare (T3), verify-prepare, suite-task-selection; scripted fixtures may retain previous wire keys for compatibility. Other executor consumers (dependencies, recovery, run, admission, retry, prepared-project, droplet-fixture) pass keys opaquely; nvim pin readers and run platform receipts remain project-specific and unaffected. QA briefs do not construct the key; historical specs remain records. Update current running/tests guidance. No Host/frame/API method change.

### impl-1709 · 2026-11-06T10:56:12.339Z

Consumer sweep addendum: Machine.result gains an optional final user parameter (default runner); all production callers and fakes retain their old arguments. Scripted transport result fake signature updated only to observe C1 user ordering; scripted-machine key parameter accepts the previous Neovim wire shape for compatibility. Coordinator expanded scope to generic recipe SHA-256 plus recipe stale reason: target-project base cannot identify running-hub code for other projects. Old snapshot JSON remains readable, with missing recipe stale rather than invalid. Test edits so far: executor-prepare-component adds C1 and legacy persisted key cases; prepare-key moves recipe package assertions to project hook and adds digest/template cases; executor-prepare removes superseded Neovim-key assertions and adds committed hook-byte case; verify-prepare supplies a key without nvim. executor-droplet, executor-safety, executor-run and suite-selection assertions are unchanged.

### impl-1709 · 2026-11-06T10:58:24.863Z

Package move from starting HEAD provision.sh lines 11–13: libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2. Neovim substitutions at lines 17–18 and installation at 25–31 move to hub/bin/verify-provision.sh lines 8–18, pins v0.12.5 / bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875. Hook lines 19–22 are new cache seeding: previously verify-prepare invoked nvim-path.ts on the cold builder and downloaded another copy into .cache/nvim/<tag>. The resolver ignores /usr/local/bin/nvim; the hook now links its verified /opt installation into that same ignored runner-owned cache. Without this, suites still use the correct pin but cold prepare redundantly downloads it and depends on a second network fetch. Seed call remains for cold/changed project pins; warm receipt behavior is unchanged.

### impl-1709 · 2026-11-06T11:06:43.320Z

Native executor-run red at 8d2f72f16: warm-delivery assertion expected dependencies match snapshot / Neovim pin matches snapshot, actual dependencies match snapshot / Neovim pin changed: seed. remote-fixture.ts line 94 copied the executor key into the project installation marker, so removing key.nvim dropped the installed pin. Consumer sweep missed this read-then-serialize alias; correcting the fixture receipt, preserving executor-run assertions. Coordinator additionally requires hook to persist installed tag+digest and differing-hook-pin delivery regression. Hook writes .cache/nvim/.cland-installed.json (outside npm ci deletion); verify-prepare reads it independently of key. Hook source test observed red then green. Native new hook receipt test is written and awaiting the next authorized preservation slot for its red run before implementation. Source reviewer has been told to hold final verdict pending new head.

### impl-1709 · 2026-11-06T11:12:23.529Z

Review corrections pending new pin: captured provisionPath is additive beside provision digest; consumers prepareKey, sameKey, staleParts, DropletExecutor key work and prepareSnapshot migrated. The applied configuration supplies path to key capture; concurrency shares work by path; mismatched path/digest presence refuses before current reuse or builder. Prior keys remain readable. The scripted disk-edit/input-refusal regression and complete component/key set pass 27/27 locally on macOS Node24.21.0. Stale duration keys removed without sample transplant. Native prepare-key adds third-argument capture and committed symlink rejection tests; native verify-prepare adds hook-receipt match/mismatch cases, awaiting next preservation slot for red before reader/gate implementation. remote-fixture no longer conflates executor key with project installed pin receipt and now passes fixtureEnvironment to prepareKey.

### impl-1709 · 2026-11-06T11:34:18.532Z

Coordinator decision 4a3cb8b1-3994-4063-997e-c81bff648a72: the 16 additional direct-T3 consumers consist of suite-selection (targeted 161/161 green) and the following 15 files deferred to the merge batch's T3: hub/test/cover-quiet.test.ts, hub/test/demo-release.test.ts, hub/test/executor-health.test.ts, hub/test/remote-fixture-lifecycle.test.ts, hub/test/suite-cancel.test.ts, hub/test/suite-candidate-remote.test.ts, hub/test/suite-close-recovery.test.ts, hub/test/suite-close.test.ts, hub/test/suite-recovery.test.ts, hub/test/suite-remote-process.test.ts, hub/test/suite-timeouts.test.ts, hub/test/suite.test.ts, hub/test/telegram-polling-restart.test.ts, hub/test/telegram-voice-command.test.ts, hub/test/verification-workers.test.ts. Run targeted only if the batch reds on one. Earlier local receipts remain labelled ancestry evidence, not corrected-head full T3. Core corrected batch: prepare 5/5, droplet 14/14, safety 17/17, run 19/19, verify-prepare 1/1, suite-selection 161/161, every child exit 0 with no skips/cancels/todo. Scripted/config/key/selection group 54/54 green; full root typecheck and T0 lint pass (lint advisory findings report-only, zero refusals). All local macOS Node v24.21.0, fake API/transport only, no browser. Production source unchanged throughout corrected native batch. Receipt and symlink tests observed red before fixes. New test samples remain below 3 seconds; no allowance added. provisionPath is additive, consumer inventory migrated; previous keys remain readable.

### rev-35 · 2026-11-06T11:36:35.730Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1709-source-1
commit: 9a87a274a31fda20e148d0f9c92fcae62e2f91f4
scope: full
findings: [{"severity":"medium","text":"Same-tag/different-digest receipt calls nvim-path.ts, whose ensureNvim fast path reuses the existing tag-cache binary without digest verification; line44 then publishes the requested digest although old bytes may remain. Refuse conflicting installed facts before seed/marker publication or establish verified replacement under the cache owner. Add a planted old cached executable regression; a seed-call logger is insufficient.","file":"hub/bin/verify-prepare.ts","line":42}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17083 records full source review at 9a87a274a. Prior regular-file hook validation, applied provision input binding before reuse/admission, and timing-baseline corrections are resolved. One installed-fact finding remains, confirmed by Implementer c1d3606e. C1–C5 remain unverified; no runtime criterion failure inferred from this source finding. Local A-17080 and Coordinator-authorized deferred T3 scope remain qualified; no configured verify/rebuilt-image/QA pass claimed. Fresh corrected committed source review before verification.

### impl-1709 · 2026-11-06T11:43:33.719Z

Source finding rev-35-1709-source-1 fixed: same-tag/different-digest installed receipt now refuses before npm/seed/marker publication. Regression runs real nvim-path.ts against a planted old tag-cache executable, observes missing expected rejection red on 9a87a274a, then green after correction with unchanged cached bytes and no matching marker. Legacy tag-only marker uses old image tag+digest rather than treating missing digest as known conflict. Authorized short native slot completed: test 1/1, exit 0, no skips/cancels/todo, macOS arm64 Node24.21.0; red child exit1 2.216s including startup, green child exit0 1.468s including startup (test body1.093s). No new duration allowance. Previous core native receipts are ancestry evidence; same-head configured verification still pending fresh source review. Coordinator retains 15 direct-T3 deferrals to merge batch.

### rev-35 · 2026-11-06T11:47:29.932Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1709-source-2
commit: 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Cumulative corrected source clear; A-17097 (see source artifact in topic) records inspection. All-receipt digest conflict refusal precedes npm/resolver/marker; planted real-resolver cache and older-marker precedence regressions preserve bytes/no false marker. Legacy tag-only project marker may use complete old-image evidence. Prior hook regular-file, applied-input binding and baseline corrections remain resolved. No Reviewer execution. C1–C5 remain unverified pending same-head configured evidence. A-17080 broader native/T0 is ancestry evidence; A-17095 final local targeted summary is qualified. Explicit 15-file T3 deferral and affected after-stage QA remain separate.

### rev-35 · 2026-11-06T12:12:40.294Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1709-final-1
commit: 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17106: final same-head clear, C1–C5 verified. A-17103 runa01a6474 exit0 hub5195pass/zero fail,cancel,skip,todo; base5047pass, six empty failure arrays. Independently matched execution tree cfcd3e8f654beeb7219511c95180733167b29222. Inspected exact root success/failure, committed-byte/symlink/path key, recipe/package/pin/config, no-hook and real-resolver installed-receipt outcomes; ten relevant newT1/T2 identities5/5. T0/T1/allT2/changedT3 six identities once/mappedT4base/Web complete; T4repetitions skipped, otherT3 deferred. A-17097 local transcriptions/timeline linkage retain prior-tree, overwritten-output and red/incomplete limits. Linuxx64 Node24.21/Nvim0.12.5 c8nyc1 uncached, HeadlessShell1248/CfT156.0.8078.4. Report diagnostics advisory. Existing-image configured pass does not establish Coordinator-owned post-landing restarted-hub snapshot rebuild/first new-image run or affected after-stageQA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
