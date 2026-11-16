---
id: T-1899
kind: task
title: Release preflight independent of covers
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1876
topic: topic-1548
branch: t/T-1899-release-preflight-independent-of-covers
created: 2026-11-16T07:29:46.730Z
updated: 2026-11-16T13:13:15.523Z
closed: 2026-11-16T13:13:15.523Z
---

## Summary

Run tools, PATH, auth, clean-root and version checks before any release cover, and list every refusal instead of the first. §7 #8 (with T-1876, T-1877 and T-1878).

Kind: product. Triage ticket H-11 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. A release preflight mode reports every non-cover refusal (`gh` on the hub PATH, clean root, version files) without needing green covers (test).
  - done: impl-1899 · 2026-11-16T11:43:07.783Z
  - verified: rev-38 [reviewer] · run rev-38-1899-final-1 · 2026-11-16T12:14:47.192Z · commit 620917f05c302bf4c26d82e18ba86f8e50f1f0a5
- [x] C2. The release skill runs it right after the release epic's brief (docs check).
  - done: impl-1899 · 2026-11-16T11:31:57.910Z
  - verified: rev-38 [reviewer] · run rev-38-1899-source-2 · 2026-11-16T11:44:44.393Z · commit 620917f05c302bf4c26d82e18ba86f8e50f1f0a5
  - verified: rev-38 [reviewer] · run rev-38-1899-final-1 · 2026-11-16T12:14:47.192Z · commit 620917f05c302bf4c26d82e18ba86f8e50f1f0a5

## Dependencies

T-1876

## Comments

### impl-1899 · 2026-11-16T11:26:18.265Z

Rule 20 consumer sweep: searched release frame/type/function names, ReleaseRequest, ReleaseResult, releaseDescription, dryRun and release-version across hub/src, shared/wire, nvim, web, shipped skills, QA briefs and every test tier. Production consumers: CLI release.ts, protocol.ts, shared wire and hub dispatch/Releases; migrated additively via release.preflight. Existing release wire shape/results/refusal codes remain unchanged (homebrew.test.ts retains previous-wire regression). Neovim/web do not initiate release; web denies unclassified frames by default. Existing QA briefs E-412, E-612, E-617, E-420, E-1314, E-1539 and T-117 exercise unchanged final dry-run/publication paths. Release tests release, release-item, release-t3-component, tracker-native-boundary remain unchanged consumers; wire-conformance checks request parity. No persisted preflight record, positional reader, startup probe or T4 release-frame consumer found. New preflight is report-only and uses no green-cover dependency.

### rev-38 · 2026-11-16T11:39:08.685Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1899-source-1
commit: 7bccdfbb62a90ebc3c1fd254ba0e3328580b6558
scope: full
findings: [{"severity":"medium","text":"The release.preflight -> release alias occurs after session CLI admission. #toolCall at lines975–978 does not recognize release.preflight (KNOWN_TOOLS contains only release), and SESSION_CLI_FRAMES omits it, so the early guard at lines2745–2751 refuses a Coordinator's CLAND_SESSION_ID call before this handler. Map the frame through the shared release permission classification before admission and retain denied-role coverage; exercise an authenticated Coordinator CLI rather than only a human/stub caller.","file":"hub/src/hub/dispatch.ts","line":2981},{"severity":"medium","text":"runGit trims git-show file bytes and managedIgnore at line27 additionally compares trimEnd-normalized text. A committed managed .gitignore missing its final newline or containing trailing whitespace is reported stable even though ensureGitignore (project.ts:162) compares exact bytes and rewrites it on startup. Preserve file bytes and share the actual startup rewrite predicate; add missing-newline/trailing-whitespace controls.","file":"hub/src/release-preflight-native.ts","line":15},{"severity":"medium","text":"RELEASE_USAGE adds --preflight but hub/test/fixtures/cli-usage/commands.json retains the previous block. The existing cli-usage-compatibility.test.ts:7–9 deepEqual therefore fails at this head. Migrate the documented release block while preserving all other frozen blocks and compatibility assertions.","file":"hub/src/cli/usage/release.ts","line":2}]
finding_counts: {"high":0,"medium":3,"low":0}

Full pinned source review in A-20000 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20000-t-1899-full-source-review-three-blocking-findings-at-7bccdfbb6.md). Three medium findings, no high/low findings. C2's immediate-after-brief documentation order is source-established but remains unverified on this not-clear pass. A-19992/A-19995 targeted candidate evidence is limited as recorded; no configured exact-head suite receipt, Reviewer run, browser or load claim. Fix all findings and request fresh source review at the replacement committed head before verification.

Criteria: C1 failed (Coordinator session CLI preflight is refused before its handler; managed-ignore stability normalizes bytes that startup rewrites; frozen help consumer is unmigrated.).

### impl-1899 · 2026-11-16T11:41:29.921Z

Review rev-38-1899-source-1 follow-up: added previously missed rule-20 consumers to inventory: early Dispatcher #toolCall/#permitted admission and hub/test/fixtures/cli-usage/commands.json (frozenUsage, cli-usage-compatibility, help/usage tests). They are migrated with one releasePermissionTool mapping and a release-block-only fixture edit. Startup ensureGitignore and preflight now share gitignoreNeedsRewrite; git-show bytes remain exact. New authenticated Coordinator CLI and byte-difference regressions were observed red before fixes; no real Git/gh/network tools execute in these fake-only fixtures.

### rev-38 · 2026-11-16T11:44:44.393Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1899-source-2
commit: 620917f05c302bf4c26d82e18ba86f8e50f1f0a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement source clear, Standards and Spec, no findings. All three source-1 findings resolved: shared permission alias before early session CLI admission; exact Git-show bytes and shared startup rewrite predicate; release-only frozen help migration retaining existing assertions. Authenticated Coordinator/denied Implementer and byte-difference controls reviewed. A-20005 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20005-t-1899-replacement-source-clear-at-620917f05.md) records review and evidence limits. C2 docs checked; C1 remains run-dependent and unverified pending same-head configured receipt. A-20003 candidate tree a339811b61f9864d32ba787cc8719059f9b68f05 matches this commit tree; targeted macOS Node24.21 receipts do not substitute for configured verification. No Reviewer execution/browser/load claims.

Criteria: C2 verified.

### rev-38 · 2026-11-16T12:14:47.192Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1899-final-1
commit: 620917f05c302bf4c26d82e18ba86f8e50f1f0a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear. A-20041 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20041-t-1899-final-c1-c2-evidence-clear-at-620917f05.md) reconciles task.verify, source clear A-20005 and executed run3d5aef56/A-20040. Independently reproduced candidate identity7ae3f10aba52650ada341502c7551b486d1cd239 from full treea339811b61f9864d32ba787cc8719059f9b68f05 using production metadata exclusions. T0/T1/all fallbackT2/Web exit0; streamed6406 ordinary pass plus250 separate load pass, no negative/skip/cancel/todo outcomes. All eight preflight/report/admission/byte/Web-refusal cases have base+5 load passes; frozen usage and previous release wire regressions pass. Linux x64 dropletNode24.21/Neovim0.12.5, pinned HeadlessShell1248/Chrome for Testing156.0.8078.4. C1 runtime settled; C2 same-head docs checked. T3/T4 unexecuted here, T3 merge-batch deferred. Budget/lint/ratchet advisory findings retained, report-only. No Reviewer runtime execution. Findings:[].

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T13:13:15.523Z

Merged f780708702cdb19c4c2a4cbb398435411a0627df onto dev.
