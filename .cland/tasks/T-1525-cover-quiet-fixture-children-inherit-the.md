---
id: T-1525
kind: task
title: cover-quiet fixture children inherit the crew session's identity and reach the live hub
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1274
branch: t/T-1525-cover-quiet-fixture-children-inherit-the
created: 2026-10-31T14:50:34.890Z
updated: 2026-10-31T15:28:38.213Z
closed: 2026-10-31T15:28:38.213Z
---

## Summary

When `hub/test/cover-quiet.test.ts` runs from a crew session's shell, its nested fixture children inherit the session identity: `CLAND_LAUNCH_TOKEN`, `CLAND_ROLE`, `CLAND_SESSION_ID` and `CLAND_SESSION_NAME`. Carrying it, they reach the live hub. The live hub refuses them ("session … credential is missing or invalid"), and the test fails. That breaks rule 15. Droplet runs carry no session variables, so the defect stays hidden in verify.

## Evidence

impl-1500, 2026-10-31 14:47–14:50Z (topic-1272):
- From the session shell, the file failed in nested test-admission and remote fixture children.
- With exactly those four names removed, all 17 cases passed on darwin arm64, Node 24.21.0.
- No hub state changed: the live hub refused the nested admission.
- The spawn that keeps the identity is `target()` at cover-quiet.test.ts:46: `runnerFixtureEnvironment(cwd, childEnv)`, where `childEnv` starts from `process.env` (line 40). `runnerFixtureEnvironment` deliberately preserves the session and admission controls.

## Acceptance criteria

- [x] C1. cover-quiet's children are built through the shared fixture environment builder with the inherited `CLAND_*` session identity removed. The file passes from a shell that carries session variables, and the test never contacts the live hub. A positive control first proves that the old environment reached a sentinel hub.
  - done: impl-1525 · 2026-10-31T14:58:58.450Z
  - verified: rev-31 [reviewer] · run rev-20261031-1525-final1 · 2026-10-31T15:21:26.305Z · commit 7afe188fdd58565c2f47ccd1225719073e2aead9
- [x] C2. Every other test spawn that uses `runnerFixtureEnvironment` starting from `process.env` is listed in the item. Each one is fixed, or recorded as needing the session controls, with the reason.
  - done: impl-1525 · 2026-10-31T14:58:58.581Z
  - verified: rev-31 [reviewer] · run rev-20261031-1525-source2 · 2026-10-31T15:01:52.152Z · commit 7afe188fdd58565c2f47ccd1225719073e2aead9
  - verified: rev-31 [reviewer] · run rev-20261031-1525-final1 · 2026-10-31T15:21:26.305Z · commit 7afe188fdd58565c2f47ccd1225719073e2aead9

## Comments

### impl-1525 · 2026-10-31T14:51:17.365Z

Seam: cover-quiet target() native child admission against a disposable Unix-socket sentinel (positive old-environment control, then isolated target), plus retained cover-quiet integrated/lease regressions. No wire or shared runner contract changes planned. Auditing every runnerFixtureEnvironment caller for inherited process.env controls.

### impl-1525 · 2026-10-31T14:52:47.451Z

C2 complete consumer audit (`rg runnerFixtureEnvironment` across all tracked TS/JS/MJS, including hub/web/nvim, docs and skills): cover-quiet.test.ts target() fixed to fixtureEnvironment plus explicit owned inputs; borrowed-lease child cwd now disposable. Other process.env-derived runner launchers intentionally retain original pre-fixture admission/session controls: fixture-worker-lifecycle.test.ts:43 and remote-fixture-lifecycle.test.ts:18 (fresh test owners admit inherited cover before fixtures); project-hub-lifecycle.test.ts:45,73 and session-stop-races-cleanup.test.ts:62 (fresh node:test workers admit parent cover before cleanup tests); startup-smoke.test.ts:32,75 (fresh scenario worker admits cover before daemon setup); suite-timeouts.test.ts:121 (fresh fault worker admits parent cover before fixtures); suite-selection.test.ts:384,393,642 and suite-coverage.test.ts:138 (package runners test original admission/transported selection before owned package work); spawn-census.test.ts:62,113 (fresh runner/launcher exercises inherited preload/admission instrumentation); compile-cache-check.ts:37 (manual real-test runner admits original cover). suite-support.ts:46 explicitly removes session NAME/ID/ROLE and lease before overlaying synthetic envExtra; synthetic session controls exercise queue attribution, inherited LAUNCH_TOKEN alone supplies no actor. Already stripped before builder: topics.test.ts:27, edges.test.ts:29, init-process.test.ts:194, claude-code-sessions-lifecycle.test.ts:180, skills-tracker-jq.test.ts:110, v01-migration.test.ts:18, task-worktrees-lifecycle.test.ts:164, cli-imports.test.ts:34,91, scenarios/startup-smoke.test.ts:41. suite-selection-fetch.test.ts:21 supplies PATH-only constructed base (no session). Runner helpers run-suite.ts:247, load-gate.ts:100, web-repetitions.ts:26,54 must propagate admitted execution controls to real phase/repetition workers; run-suite.ts:142 version probe launches no cland/admission and uses original environment only for sealed binary execution. fixture-environment.test.ts:82 intentionally tests preservation using synthetic values; lint-child-environment.ts planted source strings are static controls, not launches. Compatibility re-export hub/test/fixture-environment.ts and shared implementation unchanged. No shared contract, protocol, command, setting or role change.

### impl-1525 · 2026-10-31T14:56:38.170Z

C2 review audit correction: suite-timeouts.test.ts:51 also starts from {...process.env} and uses runnerFixtureEnvironment for the cleanup-failure worker. It retains original pre-fixture cover admission, for the same reason as that file's fault worker at :121. Other inventory dispositions unchanged.

### rev-31 · 2026-10-31T14:58:34.941Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261031-1525-source1
commit: 579e277a2a660ff8d431395cb647b38e6213740d
scope: full
findings: [{"severity":"medium","text":"M1: later standalone t.after(server.close) follows tempProject's shared directory cleanup, so listener survives root removal; listen/close promises unbounded and accepted sockets not owned/drained on setup failure. Move bounded acquisition/disposal into fixture lifetime after child resources/before root removal, retain removal fence and omitted/aborted cleanup controls.","file":"hub/test/cover-quiet.test.ts","line":72}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source1 A-14899: one medium M1, correct location cover-quiet:72 (artifact:78 is a line-reference typo). Shared isolation builder/disposable borrowed cwd and old-synthetic/isolated actor proof otherwise source-sound. Preserve both actor assertions and owned child close; successor committed bounded sentinel/socket lifetime and setup controls required before verify. C2 inventory low omitted suite-timeouts:51 reported corrected in item, no remaining inventory finding; source mark pending successor. A-14892 local18/typecheck/lint summaries retain scope, not configured proof. No Reviewer workloads. Refresh C1 and request source after same-base correction.

Criteria: C1 failed (New sentinel can remain listening while its owned root is removed and lacks bounded setup/close ownership on failure.).

### rev-31 · 2026-10-31T15:01:52.152Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261031-1525-source2
commit: 7afe188fdd58565c2f47ccd1225719073e2aead9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear A-14904, Standards0/Spec0. M1 resolved: pre-owned abortable/bounded listen observer; beforeDirectories disposal after child resources; tracked peer/native listener close receipts within separate bound; same rejected disposal fences root removal. Omitted/pre-aborted/listening controls and original synthetic/isolated actor assertions retained. C2 source verified: complete runner inventory including suite-timeouts:51, original-admission vs scratch roles documented. Isolation builder/borrowed cwd unchanged and source-sound. A-14900 red run explicitly incomplete/interrupted; local24/24/typecheck/lint summaries scoped, not configured proof. C1 runtime pending; one mode-free verify frozen exact head then original evidence review. No Reviewer workloads.

Criteria: C2 verified.

### impl-1525 · 2026-10-31T15:20:17.618Z

Frozen-head runtime evidence: e44b1556-d640-4621-af36-d9ac0f7eedb7 / A-14923 exit0, tests4463/pass4463/fail0/cancel0/skip0/todo0. Provenance head7afe188fdd58565c2f47ccd1225719073e2aead9 tree66a166baa6592537aeea880c05fd87e62f389106, droplet Linux x64 6.8.0-142-generic Node24.21.0 Neovim0.12.5; uncached ordinary task run. T0/T1/T2/Web plus changed T3 cover-quiet, 21 passing top-level changed identities, one base execution without repetitions. Remaining T3 deferred; no T4 selected. Browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. skipReasonCheck report missing0. Duration/budget/ratchet and 122 lint findings report-only. Droplet lifetime1004s cost$0.0697. Final evidence review requested; fresh fetch and merge-tree against origin/dev currently clean, without merging dev after source review.

### rev-31 · 2026-10-31T15:21:26.305Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261031-1525-final1
commit: 7afe188fdd58565c2f47ccd1225719073e2aead9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-14926, Standards0/Spec0. Original A-14923/e44b1556 exact source2 head confirms4463 ordinary passes plus125 separate load-gate passes,0 fail/cancel/skip/todo; unique starts/finishes match. C1 named synthetic old-actor/isolated-null case23385 passes0.268493927s; omitted/aborted/listening cleanup parents and nested setup controls pass, with original17 admission/lease controls retained. Changed T3 cover-quiet ran21 top-level/24 generated cases once, no repetitions; T0/T1/fallback allT2/Web complete, remainingT3/T4 excluded. C2 source inventory remains verified including suite-timeouts:51. Local crew-shell/red summaries retain earlier-stage provenance and interrupted sentinel red remains incomplete, not passing. Linux/pinned browser/uncached provenance audited; host typecheck gate reused, not repeated remotely. Advisory timing/lint/ratchet diagnostics preserved, no enforce-mode or all-tier claim. No Reviewer workloads.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-31T15:28:38.213Z

Merged bb2c7d38c2c231dc9625de8971c6702be14b9b7a onto dev.
