---
id: T-1303
kind: task
title: cland qa lint crashes in a production install since T-1225 (protocol-frame.ts not shipped)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
regression_of: T-1225
found_by: cover
topic: topic-1055
branch: t/T-1303-cland-qa-lint-crashes-in-a-production
created: 2026-10-25T12:52:03.115Z
updated: 2026-10-25T13:23:10.123Z
closed: 2026-10-25T13:23:10.123Z
---

## Summary

Since T-1225 (8fa66512), `cland qa lint` fails in a production install: `hub/src/qa-lint.ts` now imports `./protocol.ts` (for `isVerifyOccasion`) and `./verification-occasion.ts`, and `protocol.ts` imports `shared/protocol-frame.ts`, which a production install does not ship. The T3 case `hub/test/qa-lint-build.test.ts` "qa lint validates named titles from a production install without dev dependencies" fails with `ERR_MODULE_NOT_FOUND … install/shared/protocol-frame.ts imported from … install/hub/src/protocol.ts`. It passes at 8fa66512^ and fails at 8fa66512 and dev bf26b423 (Coordinator, local macOS); the periodic dev T3 run fee2e7ee (A-11934) caught it. T-1225's merge batch ran T1 only. This would ship broken in v0.2.2 for Homebrew and install.sh users.

Fix: keep `qa lint`'s import graph inside what a production install ships. Either import the occasion predicate from a module with no `shared/protocol-frame.ts` dependency, or add the missing shared file to the production install's file set, whichever matches how the install is defined; record which and why.

## Acceptance criteria

- [x] C1. `hub/test/qa-lint-build.test.ts` passes at the fix head, including "qa lint validates named titles from a production install without dev dependencies", with its assertions unchanged.
  - done: impl-1303 · 2026-10-25T13:00:19.527Z
  - verified: rev-31 [reviewer] · run rev-20261025-1303-final · 2026-10-25T13:17:03.742Z · commit 77afb33320c407fd7c6eadb6ff65d2b1ba4c633f
- [x] C2. A test (the existing production-install case or a new T1 import-graph check) fails if `qa lint`'s module graph reaches a file the production install does not ship; a negative control re-adding the T-1225 import shape fails it.
  - done: impl-1303 · 2026-10-25T12:57:23.115Z
  - verified: rev-31 [reviewer] · run rev-20261025-1303-final · 2026-10-25T13:17:03.742Z · commit 77afb33320c407fd7c6eadb6ff65d2b1ba4c633f

## Comments

### impl-1303 · 2026-10-25T12:54:11.515Z

Pre-edit red (macOS local, Node v24.21.0): existing T3 production-install case failed ERR_MODULE_NOT_FOUND install/shared/protocol-frame.ts imported from install/hub/src/protocol.ts (282.8 ms). C1/C2 reuse this public CLI/install seam with its assertions unchanged; rerunning original imports supplies the C2 negative control. No contract changes: move identical static occasion/policy definitions, retain old exports and class identity. Consumer search: protocol suiteStartIssues, CLI suite.ts, hub dispatch/demos, spoke tools; verification-occasion runtime env/selection; suite-stage-rules and merge-batches tests; wire-conformance/shared wire mirror; static tracker-container guard. Docs/skills/QA fixtures/startup/persisted readers and all test tiers searched via VERIFY_OCCASIONS/isVerifyOccasion/authorizeVerifyMode/authorizeVerifyOccasion/VerifyAllReserved; no other runtime definition consumers. Existing imports remain compatible and wire shape/values/refusals unchanged.

### impl-1303 · 2026-10-25T12:56:35.107Z

Implementation choice: extract unchanged occasion enum/predicate and mode/occasion authorization into dependency-free hub/src/verification-policy.ts, imported by qa-lint. Keep protocol.ts and verification-occasion.ts compatibility re-exports (including the shared error class). Avoid expanding the offline command’s transport/credential graph; package payload unchanged. Updated T0 enum-location guard and QA help/docs/skill; role clause unchanged because no permission or flow changes and clauses are at reserve. C2 explicit post-fix mutation: restoring original T-1225 imports made the unchanged production-install assertion fail with ERR_MODULE_NOT_FOUND install/shared/protocol-frame.ts (253.6 ms, macOS local Node 24.21.0); restored fixed imports immediately. Existing test only gains explanatory comments so mode-free verification selects its T3 file. No new test identities or Linux duration allowance required.

### rev-31 · 2026-10-25T12:59:20.826Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1303-source1
commit: 7f8f84fa0524303da95869dc309c2788850529be
scope: full
findings: [{"severity":"medium","text":"M1: QA_LINT_USAGE changed without its frozen commands.json block; decoded values differ, so retained named-export and real-help byte guards disagree. Update only this owning block; preserve guards/export composition/template.","file":"hub/src/cli/usage.ts","line":69}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1303 full source review — NOT CLEAR

Reviewed head 7f8f84fa0524303da95869dc309c2788850529be / tree 8031862185db3957076413c6cd5ec35f806b3547 on t/T-1303-cland-qa-lint-crashes-in-a-production. Fixed comparison 2f49bf6da0841149be52d9d556e43fd8084c718c...7f8f84fa0524303da95869dc309c2788850529be; pre-review dev integration is included. Branch tip matches. Both criteria claimant done, no configured receipt yet. Standards and Spec reviewed personally, no delegation/execution.

## Standards

M1 — medium, hub/src/cli/usage.ts:69: QA_LINT_USAGE adds the production-install sentence but hub/test/fixtures/cli-usage/commands.json retains the old owning block. Read-only decoded comparison is false. Existing cli-usage-compatibility named-export equality and real CLI help byte assertions will therefore disagree. Update only the intended QA_LINT_USAGE frozen block, preserving export composition, root help template and all guards. This is a source-determined mismatch, not a Reviewer-run failure.

Otherwise the extraction is small and appropriate. New verification-policy.ts has no runtime imports; no transport, credentials, executor or dev dependency enters it. Existing public exports and exception class refer to this single definition. Fixed operational-enum exemption moves to only the new declaration path and retains contextual Kind, arbitrary-literal, wrong-name and use-site refusal controls; it is not broadened. QA guide/README/skill updates match offline behavior. The QA skill is cland-owned and has no upstream provenance/CHANGES obligation. No new test identity or process is introduced; production-install test changes only two explanatory comments, preserving all original assertions and T3 registration.

## Spec

No finding. Static enum values/predicate, role/mode/occasion authorization and refusal texts are unchanged. protocol.ts imports/re-exports the same policy, and verification-occasion.ts re-exports authorization functions and the one VerifyAllReserved class, preserving instanceof behavior for dispatch and QA lint. Runtime suiteTestEnv/selection remains in the original module. Direct qa-lint import avoids protocol.ts/shared protocol-frame and verification-occasion.ts/executor-credentials. The rest of the existing offline import graph remains unchanged; production payload is not expanded.

Consumer inventory covers CLI suite validation, dispatcher, spoke enum tools, demos, shared wire mirror/conformance, verification occasion/selection, and static guard consumers across tests/docs/QA. No wire/role permission change is inferred from the move.

C1 retains the existing copied public executable/source install with no node_modules/shared payload and exact success/SHA assertion. C2's explicit original-import negative control is recorded in A-11944; the unchanged install-shaped test remains sensitive to that missing-file dependency. Both runtime criteria await same-head configured evidence after source correction.

## Evidence and disposition

A-11944 is a local macOS Node24.21.0 implementation-tree summary: pre-fix missing shared/protocol-frame failure, post-fix original-import negative control exit1 /253.6ms, final three T3 cases pass /4.632s file, typecheck and static controls reported. Corpus reads dev 2f49bf6d /87 briefs, zero false file/title absences, with historical lint findings retained. It is not a complete original stdout/stderr export or exact-commit configured/Linux proof. Preserve available original invocation/output/exit/native timing records with actual precommit attribution and missing-capture limits, without reruns for transcription.

Full NOT CLEAR. Standards 1 medium (M1), Spec 0. C1 fails the matching public help/frozen guard obligation; C2 remains runtime-unverified. This is the consolidated finding set. Correct only the owning frozen help block, commit/push, restore done and request fresh exact-head source review before one ordinary mode-free configured verify. No dev merge, full/forced run or new runtime test/allowance requested. QA none/after-stage, no per-item brief. Reviewer performed immutable source, artifact and metadata inspection only; no tests, browser, fetch, process signals or Git mutation.
Durable review: A-11946.

Criteria: C1 failed (M1: the changed QA lint public help disagrees with the retained frozen compatibility/real-help byte guards.).

### impl-1303 · 2026-10-25T13:00:19.455Z

M1 corrected at 77afb333: only frozen commands.json QA_LINT_USAGE block changed. Existing cli-usage-compatibility assertion reproduced ERR_ASSERTION with the missing production-install line before the fixture correction, then passed unchanged (1/1, 1.08 ms test/66.6 ms file, local macOS Node 24.21.0). Existing export composition, root template and guards preserved. No dev merge after first review. Original A-11944 evidence remains a precommit local summary with native tool-output receipts in session history; it is not a complete exported stdout/stderr capture. No reruns for transcription.

### rev-31 · 2026-10-25T13:00:54.782Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1303-source2
commit: 77afb33320c407fd7c6eadb6ff65d2b1ba4c633f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1303 corrected full source review — CLEAR

Head 77afb33320c407fd7c6eadb6ff65d2b1ba4c633f / tree 71694c159e9bf7080a16ee55023291dc7252c3d3, direct parent 7f8f84fa0524303da95869dc309c2788850529be. Branch tip matches. Carry complete Standards/Spec audit A-11946. No dev merge; only hub/test/fixtures/cli-usage/commands.json changes. C1 done restored, C2 done retained, no configured receipt.

## Standards

M1 resolved. Decoded fixture comparison shows exactly one changed key, QA_LINT_USAGE, and its value now equals the source byte-for-byte. Existing named exports, export composition, root help template, source help and all assertions remain unchanged. No additional finding.

## Spec

No findings. The accepted dependency-free verification-policy extraction, exact enum/predicate/authorization/refusal semantics, protocol and verification-occasion compatibility re-exports and single VerifyAllReserved identity are unchanged. Offline qa-lint stays outside transport/credential/dev-dependency imports. No packaging, wire or permission change. The fixed enum declaration guard still targets one exact path with retained negative controls.

The unchanged production-install/public CLI regression and original-import negative control remain the criterion seams; the comment-only T3 edit keeps the file selected. No new test identity or duration baseline is added.

## Evidence and disposition

Lead reports the unchanged cli-usage-compatibility guard reproduced M1 red and passes 1/1 after the fixture correction on local macOS Node24.21.0. This is a local correction report, not configured runtime proof or Reviewer execution. A-11944's preceding production-import red, explicit original-import negative control, three-case green and corpus/typecheck/static summaries retain actual implementation-tree/capture limits. Preserve original available correction call/output/exit/timing records with explicit missing-record limits, without transcription reruns.

Source CLEAR, Standards 0 / Spec 0, findings empty. C1/C2 remain runtime-unverified until one ordinary mode-free configured verify at unchanged 77afb333 and final exact-head evidence review. Retain exact production-install and committed-source/corpus outcomes, actual changed-T3 phase and executor/platform/gate/browser provenance and exclusions. No full/forced run, dev merge, additional stress or new native case requested. QA none/after-stage, no per-item brief. Reviewer performed read-only immutable source/artifact/metadata inspection only.
Durable review: A-11948.

### rev-31 · 2026-10-25T13:17:03.742Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1303-final
commit: 77afb33320c407fd7c6eadb6ff65d2b1ba4c633f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1303 final exact-head evidence — CLEAR

Unchanged head 77afb33320c407fd7c6eadb6ff65d2b1ba4c633f / tree 71694c159e9bf7080a16ee55023291dc7252c3d3 remains branch tip. Carry full source A-11946 and corrected source A-11948. task.view confirms ordinary configured mode-free bc8e1434-d0f2-495b-99ba-065608e1dabe finished/passed at this head; raw original log A-11963. C1/C2 done marks current.

## Criteria

C1 verified. Exact changed-T3 identities all finish pass, with unchanged assertions:
- qa lint reads named tests and selectors from the requested commit rather than the working tree — 0.851170615s.
- qa lint validates named titles from a production install without dev dependencies — 0.278046439s.
- committed brief corpus has no false absent file or title reports against the compiler source oracle — 4.648777032s.

The public production-install case copies candidate hub executable/source into a disposable install without node_modules/shared transport files and asserts successful lint with a full selected source SHA. It now executes successfully on the Linux executor. File finish 6.934441724s differs from summed native case observations, selected added wall 7.107s excluding machine wait, runner suite 7.18s and T3 phase12s. No new test identity was added; these are three existing cases executed once, not load repetitions.

C2 verified across accepted source and original control attribution. A-11944 records the actual local pre-fix ERR_MODULE_NOT_FOUND install/shared/protocol-frame.ts failure and explicit post-fix mutation restoring T-1225's original imports (exit1/253.6ms), then fixed imports restored. This is implementation-tree local macOS evidence with summary/capture limits, not a current-head Linux mutation run. The corrected child's only source delta is the frozen help fixture, so the same install-shaped assertion and qa-lint dependency-free import fix carry unchanged. The exact-head Linux positive pass above confirms the fixed graph; no dependency payload expansion or weakened test substitutes for it.

Corpus diagnostic explicitly selects candidate HEAD 77afb333, not dev: 87 briefs, 1327 retained findings, 152 absentTitles, zero unresolved and zero falseAbsentFilesOrTitles against the TypeScript5.9.3 dev-only oracle. This proves no false file/title absence, not clean historical briefs or a dev corpus receipt. T1 compatibility/static and fallback component consumers also pass; the extracted policy keeps legacy exports and the shared exception identity.

## Scope and provenance

Independent unique progress finish parsing excluding file containers yields 3210 ordinary passing test outcomes, no fail/cancel/skip/todo and zero additional load-gate outcomes. New-test load gate logs describe policy; they do not establish repetitions absent from the actual records. No new Web files/repetitions.

Completed T0 host check exit0/27.204s, all T1 exit0/76s (149 files/973 reported cases), fallback-all hub+Neovim T2 exit0/426s (248/1899), selected changed qa-lint-build T3 exit0/12s (one file/three identities once), Web exit0/182s (44/225). Shared protocol contract triggers all-T2 fallback. Remaining T3 is deferred periodic/integrated and absent configured batch tiers; T4 did not run. No all-tier/stage/provider QA claim.

Executed droplet c-8 lon1 cland-v0-6af29a96, Linux x64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5, overall workers2 (T1one, Web internallyfour). Machine lifetime802s/cost$0.0557 is not suite wall. Log prepares isolated Chrome Headless Shell156.0.8078.4 / Playwright chromium-headless-shell v1248 linux64 at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248; native Web fixture cleanup observations retained. Reviewer started no browser.

Host typecheck gate.tree 57ad0f25db4051b717ffd21198e9616a7f1ce272 was reused, not repeated remotely or an alternate candidate commit. Original local typecheck and correction guard summaries retain their source/capture limits.

Test lint133 findings/60files, ten summarized duration warnings, four missing baselines (artifact-create-unit, dependency-install, install-claims, harness-framing), Web actual phase wall176.528s versus40s, and T3 ratchet2209.786s unchanged remain report-only. They are not enforced-budget passes. Existing corpus identity4.648777032s is not an invented new allowance; no new identity or candidate-source mutation occurred.

## Disposition

Final CLEAR, C1/C2 verified, findings empty. Source M1 frozen help correction and original dependency regression are resolved. Coordinator owns enqueue after the lead's fresh conflict check; no dev merge, further test/repetition or transcription rerun requested. QA none/after-stage. Reviewer performed immutable source/log/data/metadata inspection only; no tests, browser, fetch, process signals, native subjects or Git mutation.
Durable final review: A-11965.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T13:23:10.123Z

Merged 0ef4dde1073566f8a0a18aec323e3addfb6f874b onto dev.
