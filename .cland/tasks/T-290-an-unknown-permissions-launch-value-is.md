---
id: T-290
kind: task
title: "An unknown `permissions` launch value is swallowed: RolesFile keeps the last good policy and the launch proceeds (T-289 follow-up)"
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - hub
  - ready-for-agent
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1067
branch: t/T-290-an-unknown-permissions-launch-value-is
created: 2026-10-12T12:17:37.170Z
updated: 2026-10-25T22:14:17.404Z
---

## Summary

T-289 (landed as 71ecabe by the human's override) meant an unknown `[<role>.launch] permissions` value to be refused at launch naming the two values, but the roles reader catches the parser's error and keeps the last good configuration, so the next launch or relaunch proceeds with the previous policy, possibly `skip`. The parser's diagnostic also names only `skip`, not `""`.

## Parent

T-216 Tech debt. Follow-up of T-289 from rev-24's post-merge advisory review (A-1504, 2026-10-12): `hub/src/roles/config.ts:141` rejects the value during parsing, `RolesFile` catches that and `fresh` returns normally.

## What to build

A launch or relaunch whose role's launch table holds an unknown `permissions` value is refused with a reason that names the role, the value and the two accepted values (`""` and `"skip"`), instead of running with a stale policy. The roles file's "keep the last good configuration on a parse error" behaviour stays for the file as a whole, but the refused launch must say that the roles file is in error and which key, so the human can fix it; the hub's log line for the bad file names the key too. The parser's diagnostic names both accepted values. Codex's `approval` and `sandbox` keys get the same treatment only if they share the bug; say so in the item either way.

Tests at the adapter and roles seams: an unknown value refuses the launch and the relaunch with the reason; a corrected file lets the next launch through; the diagnostic text. No real harness needed.

Out of scope: the start-up CLI check warning waived on T-289.

## Acceptance criteria

- [x] C1. A launch or relaunch under a role whose `permissions` value is unknown is refused, naming the roles file, the role, the value and every accepted value (`""`, `"auto"`, `"skip"`); the hub log names the key.
  - verified: rev-31 [reviewer] · run rev-20261025-290-final · 2026-10-25T20:40:48.196Z · commit cf84aa03d82a3ca2db27982efc786093b2ace3ab
  - done: impl-290 · 2026-10-25T22:14:07.797Z
  - verified: rev-31 [reviewer] · run rev-20261025-290-final2 · 2026-10-25T22:14:17.251Z · commit 30cfd6f3b15a8fc917268b4d9c0ab3672e542be1
- [x] C2. A corrected roles file lets the next launch proceed without a hub restart.
  - verified: rev-31 [reviewer] · run rev-20261025-290-final · 2026-10-25T20:40:48.196Z · commit cf84aa03d82a3ca2db27982efc786093b2ace3ab
  - done: impl-290 · 2026-10-25T22:14:07.905Z
  - verified: rev-31 [reviewer] · run rev-20261025-290-final2 · 2026-10-25T22:14:17.251Z · commit 30cfd6f3b15a8fc917268b4d9c0ab3672e542be1
- [x] C3. The parser's diagnostic names every accepted value; `approval` and `sandbox` are checked for the same gap and the finding recorded in the item.
  - verified: rev-31 [reviewer] · run rev-20261025-290-final · 2026-10-25T20:40:48.196Z · commit cf84aa03d82a3ca2db27982efc786093b2ace3ab
  - done: impl-290 · 2026-10-25T22:14:07.988Z
  - verified: rev-31 [reviewer] · run rev-20261025-290-final2 · 2026-10-25T22:14:17.251Z · commit 30cfd6f3b15a8fc917268b4d9c0ab3672e542be1
- [x] C4. Tests cover the refusal, the recovery and the diagnostic at the roles and adapter seams; `npm run typecheck` and the targeted tests pass; `cland verify` is green.
  - verified: rev-31 [reviewer] · run rev-20261025-290-final · 2026-10-25T20:40:48.196Z · commit cf84aa03d82a3ca2db27982efc786093b2ace3ab
  - done: impl-290 · 2026-10-25T22:13:33.850Z
  - verified: rev-31 [reviewer] · run rev-20261025-290-final2 · 2026-10-25T22:14:17.251Z · commit 30cfd6f3b15a8fc917268b4d9c0ab3672e542be1

## Comments

### impl-290 · 2026-10-25T19:54:44.731Z

Rule 20 before changes: changing launch admission when the roles file is invalid, with additive optional RolesSource.launchError getter (older/fixed sources remain valid; no wire/list/schema changes). Production consumers searched: Sessions launch, pool launch, fresh resume and relaunch (all use fresh; refusal before spawn/stop), hub core role/permission snapshots and dispatch role assignment/list, ProjectConfiguration and RolesFile readers, fixedRoles, roleLaunchPolicy, roles launch/editor/template and CLI role/session. Snapshot, grant, persisted process readers and wire clients keep last-good shapes; no migration required. Tests/fixtures searched across all tiers plus nvim/web, qa briefs, docs, shipped skills and startup: consumers include roles*, config-reload-component, session-credential-io, launch-admission/recovery, session-launch*, session-resume*, lifecycle*, adapter-composition, opencode-launch-policy, custom-roles*, lead*, crew*, scenarios/crew-launch and QA role launch/resume cases. These retain normal valid-file behavior; regressions will cover both real reader implementations through fake adapter Sessions, parser diagnostics, last-good snapshot retention, no-stop refusal and correction. Existing sources without launchError remain a compatibility regression via unchanged launch-admission tests. No new native process required. approval and sandbox share the same caught parse-error gap; both get identical admission treatment. Current permissions contract also includes auto; preserve it.

### rev-31 · 2026-10-25T20:04:05.374Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-290-source1
commit: 5ee6d272dd19fa37cd661a242ffd38e670d4193f
scope: full
findings: [{"severity":"medium","text":"M1 Standards: SESSION_USAGE changed but frozen commands.json SESSION_USAGE did not. Decoded blocks unequal; existing export/top-level/session CLI help equality guards fail. Update intended frozen block only, preserve composition/template/order/assertions, use existing guards red/green.","file":"hub/src/cli/usage.ts","line":29},{"severity":"medium","text":"M2 Spec: launchError guard precedes async cwd/brief/account preparation but final admission/#launchPolicy/native authorize never recheck it. A reader can publish invalid policy while preparation is held, then resumed launch still consumes last-good skip and spawns. Preserve before-stop refusal and revalidate current error at existing post-I/O/native boundaries, including relevant pool/relaunch callbacks; held-preparation real-reader regression must refuse before native effect and recover after correction.","file":"hub/src/adapters/sessions.ts","line":1011},{"severity":"low","text":"M3 Spec diagnostic completeness: approval/sandbox accept empty string via optString but omit it from unknown-value diagnostics (oneOf nameEmpty omitted); new accepted-value table also omits it. Include the accepted harness-default empty string in both diagnostics/coverage as same-policy handling.","file":"hub/src/roles/config.ts","line":118}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source NOT CLEAR; A-12140 complete audit at tree7ae79c26d6d65dee1242748a4d1664c35e40b744: Standards1medium/Spec1medium+1low. Reader error/snapshot separation, identical-text read recovery, direct before-stop refusal and six key×reader normal regression cases sound; roleless/ordinaryreattach/OpenCode ignored policy retained. M2 is read-only code-path finding, no executed repro claim: hold actual async preparation then publish bad text via reader before release. Fix M1/M2, considerM3 same correction, preserve guards and add test-first receipt/capture provenance. Push successor/fresh source before mode-free verify; no dev merge/forcedall/nativeprovider expansion. A-12138 is local implementation summary12/12+8/8/typecheck, not configured/Linux/raw-full-log proof; retain original stdout/exits/timings/source limits without transcription reruns. All runtime criteria pending. QA none. Reviewer read-only.

Criteria: C1 failed (Invalid roles error observed during asynchronous launch preparation is not rechecked at final/native admission, so stale policy can still reach spawn.), C4 failed (Changed SESSION_USAGE is not migrated to frozen command fixture, breaking existing CLI compatibility/help guards.).

### impl-290 · 2026-10-25T20:07:10.948Z

Addressing source review A-12140 M1–M3 without merging dev. M1 original compatibility guard reproduced frozen SESSION_USAGE mismatch (exit 1); migrated only that JSON entry, guard passes (1/1) and existing CLI help guards pass (4/4). M2 six real-reader held cwd/native-spawn/native-relaunch cases reproduced 'known-invalid roles must refuse after asynchronous preparation' (exit 1, 8 existing green/6 red). Current-error checks now run at final admission, policy construction, native launch/relaunch authorization and pool handoff boundaries. Six controls + eight existing cases green after correction, with explicit entry/result bounds and correction recovery. M3 four approval/sandbox cases reproduced omitted empty-string diagnostic; parser now lists empty string too and all 14 pass. Final parser 12/12, root typecheck green after correcting new test stat argument typing. New raw capture outputs retained; original first-iteration session outputs/timing/source limits preserved (A-12138/A-12140), no transcription reruns. Rule-20 missed help-fixture consumer now migrated; no wire shape changes.

### rev-31 · 2026-10-25T20:10:12.496Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-290-source2
commit: 958c4528ecc36d50b10d1f4c94544a5e2c845955
scope: full
findings: [{"severity":"medium","text":"M4 Standards: tempProject registers root-removal hook before new plain t.after gate/reader/session cleanup; early failure while preparation held removes root before release/drain. Hook does not join pending operation before store/session disposal. Pre-register deferred shared before-directory resource owner; release+join operation and drain/close owners safely before root/fault disposal, with same-seam early-failure control. Preserve assertions/receipt bounds, no native process needed.","file":"hub/test/roles-session-refresh.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected full source2 NOT CLEAR; A-12144 carries A-12140 full audit at tree812988904a335cbe6ea7b82ef25ae4b4ae01e6ef. M1 frozenSESSION_USAGE migration/M2 post-I/O, policy, native and pool current-error guards/M3 empty approval+sandbox diagnostics resolved. Six actual-reader held-boundary controls reproduce red then green; roleless/ordinaryreattach/OpenCode behavior retained. New M4 lifecycle ordering must be fixed without production/assertion changes: shared resource cleanup before ownDirectory, release and explicitly join pending operation, safe session/store/reader drain. A-12142 original correction captures checked (help1/1+4/4, held14/14, parser12/12; prior red outputs/source/precommit limits); no Linux/suite proof. C1–C3 done/runtime unverified, C4 pending/failed. Push narrow corrected successor/fresh source before mode-free verify. No devmerge/forcedall/native expansion/transcription reruns. Reviewer read-only.

Criteria: C4 failed (New held-preparation test fixture can delete its root before releasing and draining active launch/resume on early failure.).

### impl-290 · 2026-10-25T20:14:26.370Z

Source2 M4 corrected in 0e2f561e (production behavior unchanged). Deferred aggregate is registered via beforeDirectories before tempProject; it releases gates, joins tracked launch/resume promises, closes Sessions/readers/hub/table, then restores faults before shared root removal. Optional owners handle partial setup. All newly added manual-reader fixtures now use it. Two simulated early-failure controls invoke the same framework after-hook boundary while native preparation remains held, proving the terminal refusal occurs before Sessions closes and the root survives through disposal then disappears after cleanup; no native process. Latest touched T2 file: 16/16 exit 0, local macOS arm64, native Node file duration 1484.202209ms; no configured duration/coverage gate, browser or Linux evidence. This M4 finding was source-reviewed; no executed prior-head M4 red is claimed. Root typecheck completed after fixing generic union inference; full output stays in original session. Original correction capture limits retained; new log artifact preserves this actual run. No dev merge since source1.

### rev-31 · 2026-10-25T20:15:17.218Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-290-source3
commit: 0e2f561e0556e63b8a9103fac72af2ff1f7a11fb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 CLEAR; A-12149 carries A-12140/A-12144 at tree4444502d2429df08db13413f941c401479bb1b7a. M4 resolved: pre-root shared beforeDirectories owner releases and joins tracked launch/resume before Sessions/readers/hub/table disposal and fault restoration, then root removal; optional owners cover partial setup. Two same-seam early-failure controls prove terminal refusal before close and root retained through disposal then absent. M1–M3 unchanged/resolved, no production or dev merge delta. Standards0/Spec0 outstanding. A-12148 original local16/16/file1484.202209ms checked; macOS/command/exit/source attribution from request, no standalone typecheck capture/no prior-head M4 red/no configured/Linux claim. C1–C3 done/runtime unverified; C4 configured green pending. Submit one ordinary mode-free configured verify at unchanged head then exact-head final evidence review; retain original receipts/provenance and no transcription reruns. Separate rule6all belongs to Coordinator; QA none. Reviewer read-only.

### rev-31 · 2026-10-25T20:21:09.396Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-290-failed-evidence1
commit: 0e2f561e0556e63b8a9103fac72af2ff1f7a11fb
scope: evidence
findings: [{"severity":"medium","text":"M5 Standards: shared oneOf supplied-value suffix also changes legacy nonpolicy harness errors; existing exact roles-editor diagnostic contract fails (A-12150:5607-5638). Narrow suffix to intended policy diagnostics, retaining complete policy messages and existing exact harness assertions; inspect remaining consumers.","file":"hub/src/roles/config.ts","line":81}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed exact-head evidence NOT CLEAR; A-12152 audits original A-12150. 992 ordinary finish records991pass/1fail, no load finishes. T0 passed26.16s/T1failed80s; T2/mappedT4/Web/T3 unexecuted. Exact roles-editor error actual appends ; got unknown, expected legacy wording. I missed this consumer in source review. Claimant's narrowing to policy diagnostics preserves intended scope; keep strict assertions and all M1-M4 fixes, push successor/fresh source before one new mode-free verify. Linuxc8sfo2life240s/$0.0167, no browser execution; hostgateTREEb901644e reused. Lint/budget/ratchet report-only, no overall green. No unchanged retry/devmerge/full task run. C1-C3 runtime unverified.

Criteria: C4 failed (Configured run99065ba4 failed T1 roles-editor exact harness diagnostic; T2/mappedT4/Web unexecuted.).

### impl-290 · 2026-10-25T20:21:40.170Z

Configured 99065ba4/A-12150 is failed partial Linux evidence, not green: T0 exit 0; T1 991 pass/1 fail; T2/Web/mapped T4 unexecuted and no new-test load finishes. Exact error was aide.launch.harness ...; got "unknown" versus legacy expected aide.launch.harness ... (without suffix). Local roles-editor reproduced it (12/13, exit 1), then passed 13/13 with both strict legacy assertions unchanged after narrowing suffix to policy diagnostics only. Exact-consumer rescan also found roles-component's two nonempty policy regexes and E-611 D3's expected permissions diagnostic. Local component red reproduced the missing-empty mismatch (4/5, exit 1); migrate policy expectations to full exact error (empty + supplied value), retain network/harness assertions, and update QA D3 expected suffix for its literal maybe input. No new behavior/schema/protocol shape; this completes diagnostic consumer migration missed in the initial inventory. Fresh source review before new mode-free verify; no dev merge.

### rev-31 · 2026-10-25T20:23:09.116Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-290-source4
commit: cf84aa03d82a3ca2db27982efc786093b2ace3ab
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source4 CLEAR; A-12155 carries previous full audits at tree7b3d9fb1726c35583ee077463580c9c80d6987b0. M5 resolved: policy-only suffix retains exact legacy harness/network diagnostics and all intended permissions/approval/sandbox details. Strict roles-editor assertions unchanged; roles-component expectations strengthened to exact complete policy messages; QA E-611 maybe suffix and guide migrated. M1-M4 unchanged/resolved; Standards0/Spec0 outstanding. A-12154 original local editor12/13red→13/13green and component4/5red→5/5green checked; capture/source/command attribution limits explicit. Parser12/12/readers16/16/typecheck session receipts remain local, no current configured evidence. Prior A-12150 remains failed partialLinux at0e2f561e. C1-C3 done/runtimepending; C4 awaits configuredgreen. Submit one ordinary modefree verify unchanged then exact-head final evidence review; no devmerge/forcedall/transcription reruns. Coordinator owns rule6all; QA none. Reviewer read-only.

### rev-31 · 2026-10-25T20:40:48.196Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-290-final
commit: cf84aa03d82a3ca2db27982efc786093b2ace3ab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final CLEAR; A-12157 independent exact-head audit carries source4A-12155/fullsource chain at tree7b3d9fb1726c35583ee077463580c9c80d6987b0. C4 claimant restoration confirmed4/4done0failed before settlement. Original A-12156/dc8d8923 finished passed:3278ordinary tests+70additional load passes (14new identities×5), zero fail/cancel/skip/todo. All16reader cases and exact editor/parser/component/help/compatibility/docs consumers pass; M1-M5 resolved. C1-C4 verified current: complete refusal/log diagnostics, real-reader held-boundary no-effect refusal, corrected-file recovery/last-good preservation, approval+sandbox gap coverage, targeted/typecheck/configured proof. Worst new load.219677202s/no>=3sallowance. T0/allT1/fallbackallT2/mappedT4once/Web complete; noT3/fullT4soak. Mapped inboxguard1.588653390s,selectedwall2.765s excludesmachinewait; no repeats. Linuxc8sfo2Node24.21/Nvim.12.5/HeadlessShell156v1248;life901s/$0.0626 not suitewall. HostgateTREEae0fbe47 reused, not repeatedremote typecheck. 21existingwarnings/Webwall185.800vs40/lint133/60/unchangedratchet2232.554 report-only, no enforcement claim. Localreceipt capture/source limits carried; priorA-12150failed historical. Component/fake-adapter proof, no provider/nativeharness claim. Fresh conflict assessment/ready and separate rule6all belong to Coordinator; QA none. Reviewer read-only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-290 · 2026-10-25T21:57:30.420Z

Coordinator rule-6 all run 2b493141/A-12171 at cf84aa03 found a T3 screen false positive: sessions-lifecycle asserted absence of bare /refused/, but General displayed the new Coordinator instruction 'fix refused roles.toml keys'. This is a screen-matcher regression, not a native launch refusal. Reword default and project Coordinator clause fixtures to 'fix invalid roles.toml keys' at identical byte counts. Search hub/test+nvim/test found one other bare refusal alternative in launcher-component's pending-attachment screen check; scope both checks to actual action/hub refusal messages. Retain real launcher rejected-launch UI as positive control with the same matcher and all existing assertions. No production launch contract changes; existing test identities unchanged. Targeted launcher-component 15/15 green on local macOS headless Neovim; lifecycle and typecheck in progress. New per-file guidance; no dev merge, fresh source review before one mode-free run.

### rev-31 · 2026-10-25T21:59:18.685Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-290-source5
commit: 30cfd6f3b15a8fc917268b4d9c0ab3672e542be1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source5 CLEAR; A-12173 carries full source/final chain at treea41d0606d0c05a7ee3b862a90468d5e1f19566f5. Seven-file correction only/no devmerge. Actual action-refusal/hub-status matcher agrees with production rendered strings; existing rejected-launch positive check uses exact same matcher. Quiet attach and all lifecycle rows/models/journal/attach/death/stop assertions/bounds intact. Coordinator instruction refused→invalid byte-neutral, guide/index correct. M1-M5 unchanged/resolved; Standards0/Spec0. A-12171 all-run red is incidental General clause /refused/ match, historical failed run; prior taskgreen atcf84historical. A-12172 original local launcher15/15+lifecycle1/1(case4.166476917s) checked with plain-stdout attribution/typecheck capture limits; no newidentity/allowance. Criteria stale pending fresh current runtime. Submit one ordinary modefree configured verify unchanged, then exact-head final evidence including lifecycle/refusal positive/quiet attach, policy/load outcomes and actual phase/provenance/report-only limits. No taskall/devmerge/transcription rerun. Coordinator owns separate rule6all; QA none. Reviewer read-only.

### rev-31 · 2026-10-25T22:14:17.251Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-290-final2
commit: 30cfd6f3b15a8fc917268b4d9c0ab3672e542be1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final2 CLEAR; A-12175 independent exact-head audit carries source5A-12173 at treea41d0606d0c05a7ee3b862a90468d5e1f19566f5. Original A-12174/5a9699c6 passed3300ordinary+70additional load tests (14reader identities×5), zero fail/cancel/skip/todo. All16reader cases/exact parser/editor/component/help/docs consumers pass; C1-C4 verified current, prior stale marks refreshed. Corrected lifecycle actual finish16986 passes6.352220671s once; same-matcher real refusal positive15939 .409366664s and quiet attach15870 .367894418s pass, no weakened assertions. T0/allT1/fallbackallT2/changedT3once/two mappedT4once/Web complete; remainingT3/fullT4soak absent. Inboxguard1.379976779s, launcherparent7.442102003s with20distinct child passes/40native receipts; no five-suite-repetition claim. SelectedT3wall7.410/T4wall10.152 exclude machinewait. Linuxc8lon1Node24.21/Nvim.12.5/HeadlessShell156v1248;life777s/$0.0539 not suitewall. HostgateTREEb5f2e119 reused, not alternatecommit/remote typecheck. Eight budgetwarnings/Webwall156.389vs40/lint133/60/unchangedratchet2232.554 report-only; existing lifecycle/launcherover5s not newidentity allowance. LocalA-12172 capture/source limits carried. Priorcf84taskgreen/allredhistorical. Coordinator owns fresh ready/conflict assessment and separate rule6all retry; QA none. Reviewer read-only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
