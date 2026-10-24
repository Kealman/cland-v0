---
id: T-339
kind: task
title: cland task view (text) crashes on a hub frame without T-330's criteria counts (CLI and hub version skew)
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - hub
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-932
branch: t/T-339-cland-task-view-text-crashes-on-a-hub
created: 2026-10-13T17:31:48.747Z
updated: 2026-10-24T07:47:07.678Z
closed: 2026-10-24T07:47:07.678Z
---

## Summary

`cland task view <id>` in text mode crashes with "cannot read properties of undefined (reading 'verified')" when the hub's `task.view` frame has no criteria counts. QA found it on 2026-10-13 during E-268's demo (run qa-2026-10-13-27-5) at dev 94c5f01, on T-266, T-267 and T-302. Cause: the live hub started at 17:13Z, before T-330 (merged 17:28Z) added the card fields, and the dev CLI's text renderer reads `criteria.verified` without a guard. `--json` works.

## What to build

- The CLI's text view renders a frame without T-330's fields: no criteria counts, no closed time, no latest verify. It shows them only when present.
- A CLI test against a frame without those fields.

## Acceptance criteria

- [x] C1. `cland task view` in text mode never crashes on a `task.view` frame missing the card fields, and shows the rest of the item.
  - done: impl-339 · 2026-10-24T07:25:16.864Z
  - verified: rev-23 [reviewer] · run rev-20261024-339-final · 2026-10-24T07:41:59.547Z · commit 244fc357a102279cf93363eaf2658dbba308f812
- [x] C2. A test covers the old-hub frame shape.
  - done: impl-339 · 2026-10-24T07:28:30.092Z
  - verified: rev-23 [reviewer] · run rev-20261024-339-final · 2026-10-24T07:41:59.547Z · commit 244fc357a102279cf93363eaf2658dbba308f812

## Comments

### coord · 2026-10-13T17:53:00.795Z

Also hits the CLI's write commands: `cland task comment` in text mode writes the comment, then crashes rendering the item (seen 2026-10-13 17:52Z on E-268). With --json it succeeds.

### impl-339 · 2026-10-24T07:23:12.070Z

Added an executable CLI regression against a literal old-hub task.view/task.comment reply omitting criteriaCounts, closed and verify. First local run was refused by cover-quiet run b758f647-15ae-499c-8d41-0b26369f5a40 before fixtures; no behavior result yet. Source fix pending admitted red run.

### impl-339 · 2026-10-24T07:25:55.798Z

Implemented and pushed 60ff9df4. Red reproduced the undefined verified read; guarded criteriaCounts and retained populated card output. Local macOS targeted CLI/CLI-usage/test-docs: 7/7 passed; npm run check passed (test lint report-only, 0 refusals). Optional card fields audited. origin/dev fetched and merged before first review (already current). C1/C2 done; review requested from reviewer in topic-932; evidence A-10369. Mode-free verification pending clear source verdict.

### rev-23 · 2026-10-24T07:27:37.342Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-339-source
commit: 60ff9df4feddbfe96d4bd7b606cbf3edba308be3
scope: full
findings: [{"severity":"medium","text":"M1: register stub/peer disposal through the existing beforeDirectories/onCleanup lifecycle; tempProject's earlier ownership hook removes the root before this separate later t.after guarantees server closure. Preserve assertions and await closure.","file":"hub/test/cli.test.ts","line":93}]
finding_counts: {"high":0,"medium":1,"low":0}

T-339 full source review — not clear

Head 60ff9df4feddbfe96d4bd7b606cbf3edba308be3; tree b8134575eccb921c7a23729990b83097d5e1efc3. Fixed parent d9ffa83083f437f19f4a46c426ba83d0d828873a. Comparison git diff d9ffa83083f437f19f4a46c426ba83d0d828873a...60ff9df4feddbfe96d4bd7b606cbf3edba308be3. Seven files, 87 additions / one removal. Run rev-20261024-339-source.

## Standards

M1 (medium), hub/test/cli.test.ts:93–96. The new Unix-socket fixture closes through a separately registered t.after, after tempProject has registered its ownership cleanup hook. process-cleanup.ts's cleanupSteps hook runs its owned resources/hubs/directories/checks; the stub's later native hook is outside that ordering, so owned root removal precedes guaranteed server/peer closure. This contradicts the new guidance's explicit close-before-root-removal promise and the repository resource ownership contract. Register disposal through beforeDirectories/onCleanup, with awaited server closure and peer destruction, so the resource is integrated into the existing lifecycle rather than relying on later native after-hook order. Preserve all behavior assertions. The implementer accepted this finding and is correcting it.

The actual CLI calls use the existing sealed, bounded executable helper and are awaited. Native CLI execution is justified at T2 because the executable itself is the subject. The in-process stub owns a literal old reply rather than using current tracker projection code; this is a strong compatibility seam. Existing cli.test.ts classification is retained and the new per-test note/index entry follows T-1199. No other Standards/smell finding.

## Spec

No additional source finding. The production change guards criteriaCounts presence before formatting. closed and verify were already guarded. Optional version/status, followStatus, answers, mergeQueue, GitHub, warnings and usage, plus size/regression/found-by scalars, already have presence guards or fallback behavior. Required old-frame collections (ancestry/labels/blocked/holds/criteria/comments/verdicts) remain part of the literal supported old shape. The change need not accept arbitrary malformed partial objects.

The literal regression omits criteriaCounts, closed and verify for both task view and task comment, preserves heading, labels, path, body and comments, rejects missing card rows/undefined output, and checks actual command request types. A populated-card reply checks that counts/closed/verify (including cached indication) still render. The shared viewText path also covers other item-returning commands. CLI help, hub README and tracker docs accurately describe this display compatibility, without changing wire format or producer capability order.

C1's implementation is source-sound but runtime pending. C2's regression cannot be accepted until M1's fixture ownership ordering is corrected. Complete source finding set: M1 only.

## Evidence and limits

A-10365/A-10369 report an admitted executable red with the exact verified-property crash, then local macOS CLI 4/4, final cli/usage/docs 7/7 and npm run check passing (132 existing report-only lint findings, zero refusals). These are local baseline-plus-working-tree/source receipts; no configured task result exists. The earlier cover-quiet refusal occurred before fixtures and is explicitly not red/green evidence. Original raw output/exits with source/platform/cleanup provenance have been requested without transcription reruns.

Task worktree remains tracked-clean at the reviewed head and diff whitespace check passes. No per-item QA brief/criteria under none/after-stage policy; after-stage QA separate. Reviewer performed read-only source/Git/artifact inspection, no tests/probes, browser, edits, merge or delegation. Both review axes completed in-session.

Correct M1, commit/push and request fresh source review before mode-free verification. Standards: one medium finding. Spec: zero additional findings.
Durable review A-10371.

Criteria: C2 failed (New CLI regression closes its Unix stub through a later native t.after outside tempProject's resource-before-directory cleanup, permitting root removal before guaranteed server/peer closure.).

### rev-23 · 2026-10-24T07:29:43.856Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-339-source2
commit: 244fc357a102279cf93363eaf2658dbba308f812
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-339 corrected full source review — clear

Head 244fc357a102279cf93363eaf2658dbba308f812; tree c6d4c22e6b1516733ac49468bcc7e857c5b51590. Fixed base d9ffa83083f437f19f4a46c426ba83d0d828873a; full comparison git diff d9ffa830...244fc357a102279cf93363eaf2658dbba308f812. M1 correction additionally compared against previous reviewed 60ff9df4. No dev merge. Run rev-20261024-339-source2, scope full as requested; findings []; C1/C2 runtime pending.

## Standards

M1 resolved. The Unix stub's disposal is registered with beforeDirectories, which participates in the ownership hook's resource/hub-before-directory ordering and signal cleanup. Peers are destroyed and server.close completion is awaited before owned root removal. The helper coalesces repeated cleanup invocations. The per-test note now names this actual contract. The correction changes only the import, registration and corresponding prose; no behavior assertion or observation bound is removed.

Full source review A-10371 carries forward with M1 closed. Native CLI execution remains justified in existing T2 coverage because CLI behavior is the subject; each cland invocation uses the sealed, bounded, awaited harness helper. The literal in-process old-hub fixture is independent of current tracker projections. Documentation/index/usage updates follow the repository layout. No other Standards or smell finding.

## Spec

No findings. The production criteriaCounts presence guard skips absent counts without altering populated rendering. Existing verify/closed guards and other optional card fallbacks remain sound. Required prior-frame collections are retained in the literal old reply.

The executable regression covers both task view and task comment, retaining heading, labels, path, body and comments while rejecting absent criteria/closed/verify rows and undefined output. It observes actual task.view/task.comment requests; the populated reply retains exact counts, closed timestamp and verify/cached text checks. Help, tracker docs, hub guide and test note agree with the supported old/new shape. No wire protocol change or producer restart dependency.

## Evidence and limits

A-10373 preserves original local red/green/final-targeted tool output and exits with baseline-plus-working-tree attribution. It explicitly corrects the earlier cleanup claim: passing pre-M1 tests did not prove compliant resource-before-directory ordering. The exact red is the reported verified-property crash, not the earlier cover-quiet admission refusal.

A-10374 separately preserves revised local Darwin arm64 targeted output: cli/cli-usage/test-docs 7/7, zero failures/skips/cancellations, command exit 0. The old-hub identity took 254.484834 ms. Full npm run check output/exit 0 is retained, with 132 existing report-only lint findings and zero refusals. Source is described as the tree committed as 244fc357; no unsupported claim that every command began at committed HEAD, no independent OS cleanup probe and no Linux/configured/load evidence. Revised runs were warranted by the M1 change; no rerun for transcription.

Current task worktree remains tracked-clean at reviewed head. Both criteria's implementation/test shape is source-sound, but final settlement waits for same-head configured evidence. Proceed with mode-free verification at this exact head. QA policy none/after-stage, no per-item brief/criteria; after-stage QA remains separate. Reviewer performed read-only source/Git/artifact inspection without runtime reproduction, edits, browser, merge or delegation; both axes completed in-session.

Standards: zero outstanding findings, M1 resolved. Spec: zero findings.
Durable review A-10375.

### rev-23 · 2026-10-24T07:41:59.547Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-339-final
commit: 244fc357a102279cf93363eaf2658dbba308f812
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-339 final evidence review — clear

Exact reviewed head 244fc357a102279cf93363eaf2658dbba308f812, tree c6d4c22e6b1516733ac49468bcc7e857c5b51590. Source clearance A-10375 carries forward with M1 resolved. Configured run 9e92da7b-d334-4705-bf47-91fce3307be3 / raw A-10400 exits 0. Run rev-20261024-339-final; findings []; C1 and C2 verified.

## Standards

No outstanding findings. Independent raw suite-progress parsing confirms 2,787 ordinary tests / 418 files passed, plus five actual load-gate test/file completions for the new compatibility identity. There are zero failed/skipped/cancelled ordinary or load tests. The 2,787 ordinary total does not include those five repetitions; no repetition claim comes from the generic header.

Compatibility identity ordinary duration is 0.569686495 s; all five load repetitions pass, maximum 0.693850498 s. No new allowance is needed. No tier-mismatch records name cli.test.ts. Existing executable CLI checks, including ancestry/version rendering, also pass. The reviewed beforeDirectories resource-before-directory disposal remains unchanged; successful worker completion includes the awaited cleanup lifecycle. No independent OS cleanup probe is claimed.

## Spec / criteria

C1 verified through the production presence guard and exact-head executable regression: a literal old-hub reply omits criteriaCounts/closed/verify for task view and task comment, each exits successfully while preserving heading/facts/body/comments and omitting absent card rows/undefined text. Current populated counts/closed/verify/cached rendering remains checked.

C2 verified through that literal wire-shape test at the public executable CLI seam and its five passing load repetitions. This does not claim arbitrary malformed-object compatibility; required old-frame collections remain in the supported literal shape.

A-10373 preserves the original verified-property red and pre-M1 green with corrected cleanup limits. A-10374 preserves revised local Darwin arm64 7/7 targeted and complete check exit 0, not relabelled Linux/configured evidence. Earlier cover-quiet refusal remains pre-admission history, not a red assertion or bypass. The new configured receipt provides missing final runtime proof.

## Provenance and limits

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-f4204e0f, Node 24.21.0 / Neovim 0.12.5; workers 2 and Web runner 4, lifetime 612 s / $0.0425. Actual T1 completed (134 files), all fallback T2 across hub and Neovim (240 files), Web completed (44 files). Actual suite wall durations 50.33 / 318.09 / 141.13 s; Web shard 141.02 s. Projections are not wall measurements.

Complete host check output is retained with zero refusals and 132 existing report-only lint findings in 59 files. Host gate d425ed21801353fd43862b1e3ac7a67c052e255b is independently confirmed as a Git tree object; matching host check was reused, not repeated on the droplet. Generic duration/lint/ratchet/projected Web wall diagnostics remain report-only, including one missing baseline/incomplete-base-timing notice. No failed gate is hidden by passing assertions. T3 is deferred to periodic/integrated policy, T4 absent; no integrated or after-stage QA proof.

Tracked task worktree remains clean at reviewed head. The lead reports a post-result fetch of dev 26dfd3a2 and conflict-free merge-tree exit 0 without merge/head mutation. QA policy none/after-stage with no per-item brief/criteria; after-stage QA remains separate. Reviewer performed source/Git/raw artifact inspection only, without tests/probes, browser, edits, fetch/merge or delegation.

Standards: zero findings. Spec: zero findings; C1/C2 verified at this head.
Durable review A-10406.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T07:47:07.678Z

Merged c880aedd6a3719e1b845affd5f41e6a517749ffe onto dev.
