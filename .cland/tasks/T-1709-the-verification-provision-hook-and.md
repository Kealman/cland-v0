---
id: T-1709
kind: task
title: The `[verification] provision` hook, and Neovim and Chromium leave the recipe
state: closed
status: done
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
updated: 2026-11-06T17:45:51.783Z
closed: 2026-11-06T17:45:51.783Z
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
  - verified: rev-37 [reviewer] · run rev-37-1709-evidence-1 · 2026-11-06T12:34:42.524Z · commit 6f3d831fe9fe2304af2c88ef76f469ed20a09923
- [x] C2. The snapshot key carries the hook's content digest and no Neovim field, and editing one byte of the hook marks the snapshot stale with `provision` named in its stale parts (test).
  - done: impl-1709 · 2026-11-06T11:02:49.063Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
  - verified: rev-37 [reviewer] · run rev-37-1709-evidence-1 · 2026-11-06T12:34:42.524Z · commit 6f3d831fe9fe2304af2c88ef76f469ed20a09923
- [x] C3. `provision.sh` installs no `nvim` and none of the Chromium runtime packages (test).
  - done: impl-1709 · 2026-11-06T11:02:49.768Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
  - verified: rev-37 [reviewer] · run rev-37-1709-evidence-1 · 2026-11-06T12:34:42.525Z · commit 6f3d831fe9fe2304af2c88ef76f469ed20a09923
- [x] C4. This project's hook installs those Chromium packages and the Neovim tag and digest of `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, which a test keeps equal (test).
  - done: impl-1709 · 2026-11-06T11:02:50.486Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
  - verified: rev-37 [reviewer] · run rev-37-1709-evidence-1 · 2026-11-06T12:34:42.525Z · commit 6f3d831fe9fe2304af2c88ef76f469ed20a09923
- [x] C5. `cland config` documents `[verification] provision`, and a project without it prepares exactly as before apart from the key (test).
  - done: impl-1709 · 2026-11-06T11:02:51.264Z
  - verified: rev-35 [reviewer] · run rev-35-1709-final-1 · 2026-11-06T12:12:40.294Z · commit 719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e
  - verified: rev-37 [reviewer] · run rev-37-1709-evidence-1 · 2026-11-06T12:34:42.525Z · commit 6f3d831fe9fe2304af2c88ef76f469ed20a09923

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

### rev-37 · 2026-11-06T12:26:59.942Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1709-delta-1
commit: 6f3d831fe9fe2304af2c88ef76f469ed20a09923
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1709 merge delta source review

Head6f3d831fe9fe2304af2c88ef76f469ed20a09923.
Run rev-37-1709-delta-1; scope delta; result clear; findings[].
Parents719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e (rev-35 source/final clear) and03e1cdf92257a14a58af9c649522aeb10538e574 (landed T-1710).
Read item/criteria/prior source and final verdicts, request, both-parent diffs, combined diff and integration paths. Standards and Spec reviewed in-session; no delegation/tests/typecheck/browser/edits/merge.

Coordinator authorization63f7f361-ad35-4033-a0c9-7af42b71f477 explicitly requires this merge, README-only conflict retention, merged-head root typecheck and verify-prepare targeted, and carries parent verify under rules6/7 instead of a new configured run. Slot order confirmed by da5a1727-5090-4552-855c-0f770e061940.

Spec: no findings.
README retains both complete paragraphs separated by a blank line: optional root verification provision hook/recipe+committed-hook snapshot key and the independent host-image bootstrap/login-disk guide. Links resolve to matching existing sections. Incoming host prelude/helper is an independent exported bootstrap module, not newly called by the executor recipe or project hook; no provision-user/order/key/installed-receipt semantics change in this delta.

Standards: no findings.
Combined diff has only hub/README.md as a manual resolution. Relative to719ed2231, executor/droplet source, verify-prepare/provision script, config parser, required prepare/verify-prepare tests and project config are byte-unchanged. Incoming prelude/helper and their tests match landed dev. Generated test index and tier additions survive alongside task additions. Incoming duration allowance remains labelled as its original T-1710 samples; no task timing transplant.

Evidence limits:
Parent runa01a6474/A-17103 is5195pass at719ed2231, previously independently reviewed by rev-35 in A-17106; it is carried evidence only, not an execution of6f3d831fe. Parent scope T0/T1/allT2/changedT3 once/mappedT4base/Web; remainingT3 and T4repetitions unexecuted/deferred. A-17097 native transcriptions retain earlier-tree/overwritten-output/red/incomplete limits. Coordinator-owned restarted-hub/new-recipe snapshot rebuild/first new-image run and affected after-stageQA remain separate.

C1-C5 are not newly verified by this source pass. Final delta settlement awaits exact-merge root typecheck and targeted verify-prepare native receipt, then may combine them with explicitly authorized carried evidence. No new configured verify requested. Any further source change needs fresh review.

Standards0 findings; Spec0 findings.

A-17110: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17110-t-1709-authorized-readme-merge-delta-at-6f3d831f.md

### impl-1709 · 2026-11-06T12:33:54.313Z

Coordinator-directed merge 6f3d831fe9fe2304af2c88ef76f469ed20a09923 joins verified719ed2231 and dev03e1cdf922. Only manual conflict resolution keeps both README paragraphs; no task runtime/test edits. Delta review clear rev-37-1709-delta-1/A-17110. Merged-head npm run typecheck exit0 and verify-prepare1/1 exit0, signal null, no skips/cancels/todo on macOS arm64 Node24.21.0. Test body1.911s; child2.456s includes startup/cleanup. Retained original native receipt/output and original-tool typecheck transcription in A-17117. Coordinator carries runa01a6474 at719ed2231 under rules6/7; no new configured run. Reviewer final settlement requested; hub restart/new snapshot/first image run and after-stageQA remain Coordinator-owned.

### rev-37 · 2026-11-06T12:34:42.525Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1709-evidence-1
commit: 6f3d831fe9fe2304af2c88ef76f469ed20a09923
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1709 final merge evidence settlement

Head6f3d831fe9fe2304af2c88ef76f469ed20a09923.
Run rev-37-1709-evidence-1; scope evidence; result clear; findings[]; verifiedC1-C5.
Delta source rev-37-1709-delta-1/A-17110 remains applicable; branch head independently unchanged.

Authority: Coordinator63f7f361-ad35-4033-a0c9-7af42b71f477 explicitly authorizes README-only conflict resolution after merging T-1710, merged-head root typecheck and targeted verify-prepare, with carried parent configured verification under rules6/7. This is that specific evidence-carry exception; no configured run or cache hit at6f3d831fe is claimed.

Current-head checks: A-17117 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17117-t-1709-merged-head-typecheck-and-native-receipt-at-6f3d831fe.md).
- Root npm run typecheck completed exit0 at merge head, including hub/nvim/shared-wire/web and web colours/tokens/HTML/hooks checks. Retained original-tool transcription/session61056.
- node --test hub/test/verify-prepare.test.ts: native code0/signalnull; generated 'prepare uses installed snapshot inputs and rebuilds changed or missing installs' passed1/1, nofail/cancel/skip/todo. Test body1.910919125s; recorded whole child2.455893375s includes startup/cleanup and is not suite wall time.
- Local macOS arm64 Node24.21.0, no browser/live provider. Receipt/output are retained redacted transcriptions, not fresh Reviewer executions. Slot released after child and log close.

Carried configured evidence: a01a6474-78a4-43bd-9593-08e9543c6343 / A-17103 at PARENT719ed2231cf7a8bfa7b72ad255c1d6858b52bb4e, previously final-clear rev-35-1709-final-1/A-17106. Exit0, aggregate5195pass with zero fail/cancel/skip/todo. Treecfcd3e8f654beeb7219511c95180733167b29222; Linuxx64 6.8.0-142-generic c-8nyc1 Node24.21.0 Neovim0.12.5 workers2, uncached. Isolated Chrome Headless Shell1248 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; Google Chrome for Testing156.0.8078.4.
T0/T1/fallback-allT2/changedT3six identities once/mappedT4base/Web completed there. RemainingT3 deferred; T4 repetitions skipped. Report budgets/lint/ratchet remain advisory. These limits persist when evidence is carried.

Independently streamed relevant parent completion records, retaining all outcomes before dedup:
executor-prepare-component17unique/37passrecords; prepare-key10/40; executor-prepare5/5; verify-prepare1/1; suite-task-selection10/10. No nonpass outcomes in those files.
C1: both exact root-before-runner hook cases failure=false/true pass, retaining failure output assertions.
C2: committed hook bytes/no-Neovim-field native case, digest stale reason, applied path binding and same-bytes path-change controls pass.
C3/C4: generic-recipe neutrality/project-owned Chromium and pinned Neovim control passes. Original source/final review checked installed-receipt conflict refusal/no false marker.
C5: config template documents optional root provisioning; no-hook generic recipe digest/legacy-key compatibility and prepare behavior controls pass. Current merge verify-prepare again passes installed snapshot/changed-or-missing install checks.

Delta review established task runtime, key, hook and tests byte-unchanged from the verified parent; README keeps both executor provision and independent host bootstrap sections. Incoming T-1710 module/tests match landed dev. Thus authorized carried evidence plus directed current-head checks support C1-C5 verification here.

A-17097 broader native command/transcription evidence retains its prior-tree/overwritten-output/red/incomplete qualifications; none is relabelled new execution. Coordinator-owned restarted-hub/new-recipe snapshot rebuild and first new-image run remain required stage evidence, with affected after-stage QA separate. No hub restart or additional run performed by Reviewer.

No findings. Read-only review only; no tests/typecheck/browser, edits or merge.

A-17118: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17118-t-1709-final-authorized-merge-carry-at-6f3d831f.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-06T12:34:52.901Z

Verify carry (coord, rule 6 conflict waiver plus rule 7). Verify passed at the reviewed 719ed223. Head 6f3d831f differs only by the merge of dev 03e1cdf9: T-1710's additive files, with the hub/README.md conflict resolved by keeping both texts. Evidence at the merged head (A-17117):
- full typecheck exit 0;
- verify-prepare 1/1;
- the delta review is clear (A-17110).
The verify carries, and the merge batch runs T1+T3 on the integrated tree. 15 direct T3 importers are deferred to that batch, listed in the item comment. After landing, the new recipe and snapshot key take effect only at a hub restart, which coord arranges through cland-impl after E-1532's stage-7 covers.

### coord · 2026-11-06T17:45:51.783Z

Merged edb3dd465feaf0d1ea63feb2049862700293dfd1 onto dev.
