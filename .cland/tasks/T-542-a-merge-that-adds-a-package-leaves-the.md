---
id: T-542
kind: task
title: A merge that adds a package leaves the root checkout without it, and the next root-run typecheck fails
state: open
status: review
size: S
criterion_seq: 3
labels:
  - bug
  - hub
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-929
branch: t/T-542-a-merge-that-adds-a-package-leaves-the
created: 2026-10-15T21:42:23.476Z
updated: 2026-10-24T07:38:30.667Z
---

## Summary
T-427 merged at 21:28Z (bd2fdba4). It switched the typecheck script to `typescript7@npm:typescript@7.0.2`. `cland merge` doesn't install dependencies, so the root checkout's `node_modules` had no `typescript7`. The next root run, E-387's stage close 02c7cfc7 at 21:40Z, failed in 9 s with "host typecheck failed (exit 1); no droplet created", and a `MODULE_NOT_FOUND` showed in the log. Task worktrees resolve `node_modules` from the root, so every implementer's typecheck after rebasing on dev would fail the same way. The Coordinator recovered with `npm install` in the root, which left the lockfile unchanged.

## Acceptance criteria
- [x] C1. When a merge changes `package.json` or `package-lock.json`, the root's dependencies are brought up to date (an incremental install that doesn't remove packages a running hub may load), or the merge report names the install as required.
  - done: impl-542 · 2026-10-24T07:32:19.510Z
- [x] C2. A host typecheck that fails with MODULE_NOT_FOUND for a dependency named in the lockfile reports "dependencies out of date: run npm install", not just exit 1.
  - done: impl-542 · 2026-10-24T07:32:19.602Z
- [x] C3. `task claim` leaves a new task worktree resolving the root's dependencies (playwright-core included), or links them, and the report names a stale worktree install (test).
  - done: impl-542 · 2026-10-24T07:38:30.667Z

## Comments

### coord · 2026-10-15T22:43:24.442Z

Second form, 22:41Z: task worktrees an implementer filled with its own `npm ci` hold their own node_modules, so a later dependency change on dev doesn't reach them either. impl-499's verify c6147dd0 at 289b3c17 failed with "host typecheck: MODULE_NOT_FOUND …/T-499/node_modules/typescript7". Worktrees without node_modules resolve the root's, which is updated. C1 should cover the worktree case too: the worktree preparation installs from the lockfile at its base, or verify checks the lockfile hash before the host typecheck.

### impl-542 · 2026-10-24T07:32:32.188Z

Implemented and pushed 6054e5aa. Required root npm install reporting replaces automatic shared-tree mutation; task prep links dependencies and reports stale installs; locked MODULE_NOT_FOUND gets an explicit install hint. Local macOS npm run check passed (lint report-only, zero refusals); targeted task-worktrees 11/11, merge-recovery 17/17, merge-queue 13/13 plus queue CLI assertion, suite-queue-policy 6/6. Details: A-10382, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10382-t-542-implementation-and-targeted-tdd-evidence.md. Source review requested from reviewer; exact-head hub verification follows clear source verdict. No per-item QA required (none/after-stage).

### rev-23 · 2026-10-24T07:35:56.659Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-542-source
commit: 6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1
scope: full
findings: [{"severity":"medium","text":"M1: inspect actual installed required package artifacts/manifests, not just node_modules/.package-lock.json. Matching metadata can hide missing/old packages; add claim/reclaim controls and preserve installs.","file":"hub/src/hub/worktrees.ts","line":137},{"severity":"medium","text":"M2: do not mark valid omitted optional or inapplicable OS/CPU packages as stale. The root lock lists many platform packages absent in a healthy local install; add healthy negative controls.","file":"hub/src/hub/worktrees.ts","line":139}]
finding_counts: {"high":0,"medium":2,"low":0}

T-542 full source review — not clear

Head 6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1; tree fe3078daa96ffb70a1b9498dec4f4a05d6545688. Fixed parent d9ffa83083f437f19f4a46c426ba83d0d828873a. Comparison git diff d9ffa830...6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1: 27 files, 285 additions / 24 removals. Run rev-20261024-542-source.

## Standards

M1 (medium), hub/src/hub/worktrees.ts:137–140: installation metadata alone does not establish installed artifacts. The code compares the candidate lock with node_modules/.package-lock.json but never reads actual package directories/manifests. Matching metadata can therefore suppress a stale warning even if required playwright-core is missing or its actual package.json is old. A claim then returns a seemingly fresh root link/own install that cannot resolve the required dependency. Add claim/reclaim controls with matching hidden-lock metadata and missing/older actual packages; audit the installed artifacts while preserving existing installations.

M2 (medium), same lines: the expected-lock loop treats every absent package as stale, including optional entries for other OS/CPU targets and valid optional omissions. A healthy install gets false stale warnings. Independent read-only comparison of this repository lock and installed hidden lock finds 61 absent platform-specific optional entries, including Android/FreeBSD/Linux Oxlint bindings on this Darwin arm64 install. Respect package applicability/optional omission while validating advertised installed artifacts; add healthy negative controls. Do not make the M1 fix simply require every lock entry to exist.

Both accepted by the implementer; complete finding set is M1/M2 only. Existing narrow module boundaries and optional wire additions otherwise fit the design. Tests reuse existing classified component seams, scratch package trees and injected Git/host-check machinery; the CLI queue check uses the executable because its rendering is the subject. No installer/download is added. No independent smell finding.

## Spec

C1/C2 source paths otherwise look sound. Coordinator 1a5574f4 explicitly confirms the install-required-report alternative and requires queue/landing/enqueuer visibility without modifying live shared dependencies. Changed package.json/package-lock.json paths, including workspace manifests, are sorted/deduplicated. Queue entries carry optional metadata mirrored in shared/wire; CLI queue/landing rendering guards its absence. Landed squash-commit paths are reread for normal/recovered results; durable comments and Agents text retain the requirement, and batch landing emits an idempotent notice addressed to enqueuer/item lead. No npm invocation or shared tree replacement is performed.

The host-check path retains exit/no-droplet failure and appends “dependencies out of date: run npm install” only for a missing module/package represented in the candidate lock. ESM names and absolute node_modules CJS paths are handled; unknown imports and ordinary type errors are negative controls. Local/remote host-gate branches use the helper and original log output remains.

C3 links an absent worktree node_modules to root, preserves existing installs, and returns path/kind warnings through shared claim/launch preparation and plain claim output. That behavior is incomplete until M1/M2 distinguish genuinely stale artifacts from healthy platform-specific installs. C3 fails source review; C1/C2 remain runtime pending. Help, README, tracker docs, relevant skills/test notes describe this scope; clauses are unchanged.

## Evidence and limits

A-10382 reports local macOS working-tree check pass with report-only lint/zero refusals; task-worktrees 11/11, merge-recovery 17/17, merge-queue 13/13 plus the later queue CLI assertion separately, suite-queue-policy 6/6. It distinguishes the initial cover-quiet refusal from admitted red/green. These are summaries, not a configured/Linux receipt. Preserve original command/stdout/exits/timing with precise source/platform attribution without reruns for transcription; corrected checks should have separate receipts.

Task worktree is tracked-clean at reviewed head. No verification has been submitted and no per-item QA brief/criteria under none/after-stage policy. Fix M1/M2, update the matching freshness documentation, commit/push and request fresh source review before mode-free verification. Reviewer inspected source/Git/artifacts only, no tests/probes, installs, browser, edits, merge or delegation. Both axes completed in-session.

Standards: two medium findings. Spec: no separate finding; C3 blocked by M1/M2.
Durable review A-10387.

Criteria: C3 failed (Freshness trusts hidden-lock metadata without checking installed artifacts and flags valid missing optional/platform packages as stale; claim cannot reliably identify stale own/link installs.).

### impl-542 · 2026-10-24T07:37:31.860Z

Addressed review M1/M2 in dcb96064 (pushed): actual installed manifests are checked, while optional/platform omissions are allowed. Corrected-head local macOS receipt: task-worktrees.test.ts 19/19 and fresh npm run check passed (test lint report-only, zero refusals). Correction evidence A-10391: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10391-t-542-m1-m2-corrections-at-dcb96064.md. Fresh source review requested from reviewer; verification held pending clear source verdict.

### rev-32 · 2026-10-24T07:38:15.983Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-542-source-2
commit: dcb96064ac74df66473b0e2b8f50e8d325a1ca1e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-542 corrected source review — clear
Head dcb96064ac74df66473b0e2b8f50e8d325a1ca1e; tree 49fd1e84fe8f59567972c7a6cd0273c8d720b9e8.
Parent 6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1. Correction comparison: git diff --no-ext-diff --no-textconv 6054e5aa...dcb96064 --; four files, 67 additions/4 removals. No intervening dev merge. This full corrected-source pass carries rev-23's accepted original source scope in A-10387 and audits the complete correction personally, without delegation.

## Standards
No outstanding findings. M1 is resolved: expected/hidden-lock metadata is followed by reading the actual installed package.json and checking its version. Missing/unreadable manifests or older actual versions produce the existing path-and-install-kind warning. The check is read-only and preserves both existing own installs and links.
M2 is resolved: optional entries omitted from the installed lock, and optional bindings inapplicable to the current OS/CPU, are allowed; advertised applicable entries still undergo metadata/artifact checks. Required missing entries remain stale.
The new T2 regression cases reuse the existing scratch-root, FakeClock, injected-territory and in-process hub fixture. Four missing/older required-package permutations exercise own/link installs with matching hidden metadata and assert preservation. Two healthy controls cover own/link installs with optional omissions. They await claim completion and assert the resulting warning/filesystem facts; no sleeps, native Git, installers, downloads or new process lifecycle are introduced.
hub/README.md now describes actual manifest checks and optional omissions; the matching per-file test note records both corrections. Original help/tracker/skills documentation remains at the accepted source. No independent smell finding.

## Spec
C1/C2 production and accepted behavior are unchanged. I also reread the original dependency helper, merge/queue/landing notice integrations, CLI formatting, host-check failure diagnosis and mirrored optional wire additions at the reviewed head. Coordinator decision 1a5574f4 permits the explicit required-install report, requires root npm install and enqueuer visibility, and forbids automatic shared-install replacement. Those source paths still match.
C3 now distinguishes the originally reported stale required artifacts from valid optional omissions while preserving installs and linking an absent worktree install to root. The original package-resolution proof remains alongside the new warning controls.
No new spec findings. All C1–C3 execution-dependent verification remains pending the post-source mode-free receipt at this exact head. The tracker currently retains the earlier C3 failed mark; the claimant must restore its done mark after addressing that finding. No verified criterion is claimed by this source pass.

Evidence: A-10391 explicitly attributes corrected task-worktrees 19/19 and npm run check to the local macOS working tree immediately before this commit, with test lint report-only/zero refusals. It is a summary, not an original raw/configured/Linux receipt; other-file executions remain attributed to 6054e5aa. Preserve retained original tool receipts with exact provenance without rerunning solely for transcription. No configured verification has yet run at this corrected head. QA policy none/after-stage, no per-item QA criterion.
Reviewer performed source/Git/document/artifact reads only; no tests, probes, edits, installs, browser actions or merge.
Standards: 0 outstanding findings. Spec: 0 outstanding findings.
Durable audit A-10396: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10396-t-542-corrected-source-review-at-dcb96064.md
