---
id: T-1808
kind: task
title: A shared evidence-publish helper that calls artifact.create only after a clean secret scan with a positive control
state: closed
status: done
size: M
criterion_seq: 3
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1625
branch: t/T-1808-a-shared-evidence-publish-helper-that
created: 2026-11-11T00:11:39.952Z
updated: 2026-11-18T14:18:21.574Z
closed: 2026-11-18T14:18:21.574Z
---

## Summary

Three times on 2026-11-10, an implementer's ad-hoc export script published evidence after its secret scan had exited 1: A-18360 (impl-1778), A-18454 (impl-1780) and A-18526 (impl-1788). Each was archived, and each match turned out to be a false positive (a test title, a test path, a tracked filename). But a gate that depends on each session's own orchestration fails repeatedly. A shared helper should own the scan and the publication together, so a non-zero scan, a missing exit code or a missing positive control can never reach `artifact.create`.

## Context

- Rule-batch proposal P-coord-publishgate.
- Rule 15 requires that nothing is published until a secret scan finds no matches.
- False positives are redacted in the export (an id plus a hash). The scanner itself changes only through its own reviewed item.

## Acceptance criteria

- [x] C1. One shared helper (CLI or library) scans every file of an evidence folder or file with the repo's scanner and a planted positive control, and publishes only when the scan exits 0 with the positive control matched (test).
  - done: impl-1808 · 2026-11-18T12:53:53.717Z
  - verified: rev-36 [reviewer] · run rev-36-1808-final-1 · 2026-11-18T13:31:28.228Z · commit 1582550eed1848b7815e13e6c3452f07c424432a
- [x] C2. A non-zero exit, a missing exit code, a missing or unmatched positive control, or a scan of the wrong path refuses publication and prints the file and position of each match without the matched value (test).
  - done: impl-1808 · 2026-11-18T12:53:54.891Z
  - verified: rev-36 [reviewer] · run rev-36-1808-final-1 · 2026-11-18T13:31:28.228Z · commit 1582550eed1848b7815e13e6c3452f07c424432a
- [x] C3. The implement skill and the QA kit point to the helper for evidence publication (test: docs reference check).
  - verified: rev-36 [reviewer] · run rev-36-1808-source-3 · 2026-11-18T12:30:27.101Z · commit 38c6e090d91b964d1cc907e856cfafd0195e91f3
  - done: impl-1808 · 2026-11-18T12:53:55.985Z
  - verified: rev-36 [reviewer] · run rev-36-1808-source-4 · 2026-11-18T12:55:48.662Z · commit 1582550eed1848b7815e13e6c3452f07c424432a

## Comments

### impl-1808 · 2026-11-18T11:18:48.845Z

Consumer search: assertPublishable / qa-demo-policy referenced by .agents/skills/qa/qa-demo-record.ts (pre-copy remote capture scan), hub/test/qa-demo-policy.test.ts (T1 policy), docs/agents/qa-demo-recording.md, QA skill and its per-file guide. No scanner CLI found. New shared library will reuse the scanner unchanged; raw artifact.create wire consumers remain compatible. Evidence authoring references: implement SKILL, QA SKILL/BRIEF, hub README, docs/agents. Awaiting Coordinator confirmation of scanner/location seam.

### impl-1808 · 2026-11-18T11:20:22.075Z

Scanner comparison: capture-safety additionally catches any standalone Bearer word, generic token/API-key assignments, /Users/ and /home/ paths; qa-demo-policy additionally catches provider formats, private-key headers and decoded URL/JSON spellings. Helper runs both, without changing either. Consumers also include native login-card/signin/resignin diagnostic tests and QA briefs E-1533/E-1535/E-1537/E-1538 (existing capture checks unchanged). First red on macOS Node 24.21.0: ERR_MODULE_NOT_FOUND for evidence-publish.ts; first green: nested-folder byte-copy test, fake artifact callback, no network/process. No full-suite evidence yet.

### impl-1808 · 2026-11-18T11:27:42.659Z

Implementation head f3110b5aa pushed to origin; clean worktree. Local macOS arm64 Node 24.21.0: full npm run test:lint exit 0 (130 report-only findings, 0 refusals), root npm run typecheck exit 0, final evidence-publish T2 file 11/11; earlier existing scanner policy/site consumer T1 25/25. No full-suite/browser/executor evidence. A-21186 is a durable progress artifact published by helper itself. Waiting for required T-1894 landing, then merge current origin/dev and rerun pre-review lints/typecheck before source review. Coordinator notified to deliver landing event; no polling or verify submission.

### rev-36 · 2026-11-18T11:52:55.018Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1808-source-1
commit: 4d6e36c9183c39e969ea8bdc6f2439c08fc8d1b4
scope: full
findings: [{"severity":"medium","text":"Standards/rules15/39: mkdtemp at50 is outside sanitization, and awaited rm in finally can replace a successful artifact receipt or safe refusal with a raw filesystem rejection. Keep setup errors safe and preserve the selected publication result/refusal with sanitized secondary cleanup diagnostics; add setup/removal failure controls. Author confirms no other owner.","file":"hub/src/evidence-publish.ts","line":107},{"severity":"medium","text":"Standards/rules9/12: new filesystem callbacks acquire mkdtemp before cleanup registration and lack pre-acquisition whole-caller join/fences, root adoption and named setup bounds. Own acquisition and original continuations before deleting source/retained roots or restoring guards; retain current assertions.","file":"hub/test/evidence-publish.test.ts","line":9},{"severity":"medium","text":"Standards/rule38: fake artifact callbacks are semantic isolation only; no positively controlled callback/custom/sync/lower-spawn launch guard covers setup/body/cleanup. Enroll the shared guard under the corrected joined caller owner and verify zero non-control attempts after cleanup before restoration.","file":"hub/test/evidence-publish.test.ts","line":1},{"severity":"medium","text":"Spec/C1: copy preserves empty descendant directories but only regular-file names enter the scan Map. A clean file plus an unsafe empty descendant name reaches publication unscanned. Scan every published name or refuse empty descendants; add a synthetic negative control and align the guide. Author confirms no earlier exclusion.","file":"hub/src/evidence-publish.ts","line":58},{"severity":"medium","text":"Spec/C3: copied implement/QA/BRIEF links resolve to a host-project guide that provisionDocs never supplies, with no shipped helper/document locator or approved repo-only restriction. Supply a usable self-contained installed-package consumption path and check it from a disposable provisioned project; substring tests at repo paths do not establish it.","file":".agents/skills/qa/BRIEF.md","line":5}]
finding_counts: {"high":0,"medium":5,"low":0}

A-21205 full first source review, tree58f47bc4e25f9219e44ad8e6e4314ffb37d31595 vs fixed merge-base6031921da5d7be6ba32f8d5757ebaa43fa7874e0. Standards3medium, Spec2medium, all author-confirmed; no high/low. Private exact-byte snapshot, per-call synthetic control, fail-closed nominal receipts, both unchanged scanner policies and unknown-publication retention inspected positively; those do not settle listed failure paths. Coordinator2c949313 approved union/conservative positions, T-1966 consolidation remains separate. A-21200/A-21202/A-21204 retain selected36+29 command/completion/source epochs, corrected transitiveT1remote-docs unexecuted disposition and exact prefixed-line digest object; six redacted line hashes independently match generated source names. Missing invocation trees/raw logs/native fields remain unknown;65selected outcomes and final typecheck/lint0refusals are not whole-tier/configured or gap coverage. A-21186 remains earlier progress publication. Frozen help/wire/scanner bytes unchanged. No Reviewer tests/scanners/checkers/native/browser/source changes, quiet respected. Fail C1/C2/C3, verify none. Hold released for consolidated correction; quiet restrictions still govern testing. Fresh pushed-head source review precedes Coordinator mode-free window; no full task-head suite/provenance rerun/scanner-policy merge requested.

Criteria: C1 failed (Empty descendant directory names can be published without scanning.), C2 failed (Setup and final removal errors can bypass sanitized refusal handling and replace the selected publication receipt.), C3 failed (Provisioned implement/QA links point to a missing host-project guide and provide no usable helper locator.).

### impl-1808 · 2026-11-18T12:03:05.768Z

Behavioral red after quiet over, before source corrections: new owned/guarded T2 file on 4d6e36c9 source + uncommitted test revision ran 16 tests, 10 pass/6 fail, macOS arm64 Node 24.21.0 exit 1. Literal failures include `Missing expected rejection.` for unsafe empty descendant, expected cleanup disposition vs `[]`, expected snapshot receipt vs `undefined`. New provisioning fixture initially had a test setup bug (Report missing root); corrected before the targeted provisioning red. These failures are retained, not coverage or passes.

### impl-1808 · 2026-11-18T12:06:12.234Z

Correction selected checks at staged source tree 655652ad01196706dff2855174e8791dc577beb0 (HEAD remains reviewed 4d6e36c9; no dev merge): node --test evidence-publish, qa-demo-policy, screenshot-capture, skills-invocation, skills-qa-catalogue, init-skills-update, remote-docs. Native tool exit 0; reporter tests 106/pass 106/fail 0/cancelled 0/skipped 0/todo 0; macOS arm64 Node 24.21.0, local ordinary T1/T2. Includes all 16 new helper controls and complete T1 remote-docs wrapper. No full suite or browser. Root typecheck passed after final code edits. Full test:lint running. Earlier red and fixture setup/regex corrections are retained, not passing evidence.

### rev-36 · 2026-11-18T12:19:09.788Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1808-source-2
commit: 12782a885c301f4994ffe3ec3cc467b991a2dee8
scope: full
findings: [{"severity":"medium","text":"Spec/C3: BRIEF is documented to be copied to qa/briefs/T-<n>.md, where its sibling EVIDENCE.md link breaks. No transform or destination guide exists; current provisioning test resolves only the kit template location. Preserve self-containment at the actual copied brief destination and test that copy flow; author confirms.","file":".agents/skills/qa/BRIEF.md","line":6},{"severity":"medium","text":"Spec/C3: locator accepts only realpath ending /hub/bin/cland.ts. Supported Homebrew bin/cland is a write_env_script wrapper (packaging/homebrew/cland.rb.in:17), so it is skipped. No existing resolver or approved exclusion exists; source/symlink test does not cover it. Support the actual layout with fake filesystem/disposable controls, no real Homebrew launch.","file":".agents/skills/qa/publish-evidence.ts","line":13}]
finding_counts: {"high":0,"medium":2,"low":0}

A-21219 full corrected-source pass at tree90bedfd1ab80f65a15f7923af188be8ad05c618e vs base6031921da5d7be6ba32f8d5757ebaa43fa7874e0, parent4d6e36c9/no dev merge. Standards0/Spec2medium. Prior setup/removal outcome preservation, pre-acquisition caller ownership, positive native guard and unsafe empty descendant findings are resolved in source; selected controls retain semantic assertions and separately observe retained/removed roots. C3 provisioned-kit/symlink path works but actual copied-brief and Homebrew consumers remain missing, both author-confirmed. A-21214 retains107/107 selected outcome summary incl17helper cases and full remote-docs wrapper;101 visible checkmarks plus6 redacted declared test lines, not independently rederived raw-line digests or107 top-level identities. Recorded staged tree matches final commit; no postcommit launch inferred. Root typecheck/full lint0refusals,130report-only findings; failed earlier rounds preserved. C1/C2 implementation done but runtime-unverified, fail onlyC3. Scanner policies/frozen/wire unchanged; T-1966 separate. No Reviewer runtime/scanner/checker/native/Homebrew/browser/source actions. Hold released; consolidate two C3 fixes then fresh source review before configured window. No native install/full task-head suite/provenance rerun requested.

Criteria: C3 failed (Copied briefs still lose their guide link, and the installed helper locator skips Homebrew wrappers.).

### impl-1808 · 2026-11-18T12:21:06.296Z

C3 consumer correction red→green: filesystem-only copied-brief and Homebrew wrapper tests both failed at 12782a885 source + new test revision (ENOENT for qa/briefs/EVIDENCE.md; helper unavailable for wrapper), then both passed after relative destination link and adjacent-libexec locator fixes. No wrapper execution or real Homebrew probe. Final staged tree bfc9ced6b2d445ebbfd43fe2f4c9fdca7594f017; affected selected run 108/108, exit0 on macOS arm64 Node24.21.0, local T1/T2 only. Existing assertions, scanner policies and prior evidence retained. Typecheck/lint preflight follows before fresh source review.

### rev-36 · 2026-11-18T12:30:27.101Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1808-source-3
commit: 38c6e090d91b964d1cc907e856cfafd0195e91f3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21233 full corrected-source clearance at treebfc9ced6b2d445ebbfd43fe2f4c9fdca7594f017 vs base6031921da5d7be6ba32f8d5757ebaa43fa7874e0. Standards0/Spec0. Five-file correction from12782a885, no dev merge; exact source/origin clean. BRIEF link now explicitly resolves from its documented qa/briefs destination, and regression copies the actual provisioned template there before access. PATH locator retains source/curl entry and supports Homebrew wrapper's adjacent libexec after realpath; owned/guarded filesystem case imports exact helper by function identity without shell parsing/execution. Earlier setup/removal outcome preservation, empty-descendant refusal and caller/native-guard fixes unchanged and accepted. C3 source/reference criterion verified; C1/C2 stay runtime-unverified. A-21228 retains candidate-content tree/108selected outcome summary incl18helper controls and full remote-docsT1, final typecheck/full lint0refusals130report-only;102visible checkmarks plus6redacted declared test records, not108top-level identities or rederived raw-line hashes. Prior failed/107/65 epochs remain separately scoped. macOSarm64 Node24.21, no configured/browser/T3/T4/native/Homebrew/provider execution or Reviewer runtime. A-21228 publication's unknown snapshot retention remains qualified; no duplicate publication inferred. Our artifact reply loss was reconciled after reconnect: topic list and item-file read showed no source3 artifact/verdict; single retried keyed artifactA-21233 now confirmed. No source/checker/probe action. Hold released; lead may request Coordinator mode-free window at this exact head; any head change needs fresh source review. Future evidence checks18helper names/repetitions; no full task-head suite or provenance/native-install rerun requested.

Criteria: C3 verified.

### rev-36 · 2026-11-18T12:49:37.748Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1808-evidence-1
commit: 38c6e090d91b964d1cc907e856cfafd0195e91f3
scope: evidence
findings: [{"severity":"medium","text":"Configured T1 fails the named state-path inventory: actual ['evidence-publish.ts:20: home/temp resolver: tmpdir()'], expected []. Coordinator769bff86 attributes this to T-1808 and directs the shared named temp resolver/inventory, preserving the checker, local state-path checks, fresh source review and a new window.","file":"hub/src/evidence-publish.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

A-21244 settles only immutable38c6e090d/run53ba63ba-bab7-4244-9731-b2cc2b9ce509/A-21240 as FAILED/PARTIAL. Task-view owner failed, native owner exit1 at11871, exact assertion11789–11805; typed failure8481/timing8482. T0exit0, complete T1phase227/228filepass+1fail,1861/1862basepassincl2nested;210loadpasses separate, combined interrupted count2071/2072 includes loads. T2/Neovim package/Web/T3/T4 phases unexecuted; all18helper configured identities/repetitions absent. Linuxx64droplet Node24.21.0/nvim0.12.5, runtime tree1501d85a42cf7da38e9cf23b1a0c6a6c312fbd6a,cached:null,browsernull. Report-only budgets/lint do not excuse assertion. Coordinator message calls phaseT2; runner authority confirmsT1. C1failed,C2runtime-unverified,C3source mark retained fromA-21233. Readback found staged evidence-publish/state-paths correction whileHEADunchanged; author confirms authorized work/checks already in flight before hold delivery, exact start timestampsunknown, stagedtree18ae2b1a9533eaffeeee06928b73c3359fe5c246/localred9+green27/typecheckinflight not reviewed or promoted here. No undo/probe/retry by Reviewer. Hold released for authorized correction completion; fresh committed-head source review/new Coordinator window required. No full task-head suite/provenance/native rerun or checker relaxation.

Criteria: C1 failed (Configured run53ba63ba failed T1 because helper tmpdir() is outside the named state-path inventory; helper T2 proof was not reached.).

### rev-36 · 2026-11-18T12:55:48.662Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1808-source-4
commit: 1582550eed1848b7815e13e6c3452f07c424432a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21250 full corrected-source clearance, tree18ae2b1a9533eaffeeee06928b73c3359fe5c246 vs base6031921da5d7be6ba32f8d5757ebaa43fa7874e0; parent38c6e090d/no dev merge, clean/pushed. Two-file Coordinator769bff86 fix: helper calls central evidenceSnapshotStagingPrefix, whose expression is identical join(tmpdir(),'cland-evidence-'). Existing named state-path architecture accepts resolver module; no checker/inventory exception/allowance relaxation. Only helper consumes new export; other state paths, scanner policies, snapshot/guard/return semantics, copied brief/Homebrew locator/frozen/wire unchanged. Standards0/Spec0. C3 source criterion reverified unchanged; C1/C2 remain runtime-unverified. A-21247 retains exact local red9/8pass1fail then green27, staged-tree117selected summary and root typecheck/full lint0refusals130report-only on matching candidate bytes; this summary is not complete raw/native invocation proof or whole-tier/configured coverage. Original53ba63ba/A-21240 stays failed/partial. All18helper names unchanged; future configured audit must check them/repetitions plus positive state-path conformity. No Reviewer runtime/source/provenance probe. Hold released; lead may request new Coordinator mode-free window at this exact head. Changed head needs fresh source review; no full task-head suite, native/install probe, allowance or provenance rerun requested.

Criteria: C3 verified.

### impl-1808 · 2026-11-18T13:30:01.257Z

Configured run6ade9f89 at1582550ee completed exit0, T0/T1/T2/Web, aggregate6801/6801 with nofail/cancel/skip/todo. A-21268 official log; A-21270 incremental structured facts audit confirms state-path inventory pass and all18helper names each1base+5load repetitions. Linuxx64 Node24.21.0, dropletc-8ams3 lifetime1580s/$0.1097; HeadlessShell1248 ChromeForTesting156.0.8078.4. Budget/lint advisories report-only; remainingT3 deferred to batch/T4 unexecuted. Reviewer asked for C1/C2 final settlement. Original53ba63ba retained failed/partial; no pass inferred for its unexecuted groups. No source change or run retry.

### rev-36 · 2026-11-18T13:31:28.228Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1808-final-1
commit: 1582550eed1848b7815e13e6c3452f07c424432a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21272 final same-head evidence review of configured 6ade9f89-fb32-427a-9699-f6794aa4ce06 / A-21268, source basis rev-36-1808-source-4/A-21250. Standards 0 / Spec 0. Exact unchanged clean HEAD/origin 1582550eed, source Git tree 18ae2b1a9533eaffeeee06928b73c3359fe5c246; recorded verification tree 886603830f9c2648a6fa3de453393dd964a6d6d7, cached:null. Owner finished passed; command end/Finished exit0 at39530/39532. T0/T1/T2/Web all exit0; exact manifest sets 228/228 T1,431/431 T2 (including44 Neovim),55/55 Web base file envelopes pass, no missing/extra files or unmatched starts. Structured base outcomes 6656 top-level+145 nested=6801 pass;300 load passes kept separate. All18 source-generated helper cases have1 base pass+positive timing+5 distinct load-gate passes and explicit5/5 proof; A-21272 lists exact names/log lines. Previously failed state conformity now has positive base/timing8484/8485 and whole-file pass8499; shared resolver8519 and complete T1 scanner/skill/provisioning/remote-docs consumers also pass. Verify C1/C2; retain current same-head C3 source mark (guidance/copied brief/inert Homebrew layout also pass in this run). Original53ba63ba/A-21240 stays failed/partial, never promoted. Linuxx64 droplet c-8ams3 Node24.21.0/nvim0.12.5; actual isolated chromium_headless_shell-1248 Google Chrome for Testing156.0.8078.4 at provenance39599. T3(270 files)/T4(17) unexecuted here; no full runtime-tier/native installer claim. Machine lifetime1580s/$0.1097 is not suite wall; T0 local146.915s separate. Budgets,ratchet,130 lint findings/0refusals and known install/build notices report-only, no performance-pass inference. A-21270 agrees with independent audit. No Reviewer runtime/source/scanner/provenance rerun. QA none; evidence hold released, hub handles ready/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T14:18:21.574Z

Merged a343e305a19df293fb9b7fee91a27086a89f8c1a onto dev.
