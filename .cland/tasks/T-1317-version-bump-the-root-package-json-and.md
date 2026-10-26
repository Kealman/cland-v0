---
id: T-1317
kind: task
title: "Version bump: the root package.json and lockfile at 0.2.2"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1069
branch: t/T-1317-version-bump-the-root-package-json-and
created: 2026-10-26T00:03:10.910Z
updated: 2026-10-26T00:46:57.217Z
closed: 2026-10-26T00:46:57.217Z
---

## Summary

R-1277 ships version 0.2.2 (the human's advance approval, 14:17Z 2026-10-25, recorded on R-1277). `cland release --item R-1277 --dry-run` would refuse because dev's package.json says 0.2.1. Bump the root package.json and package-lock.json from 0.2.1 to 0.2.2, the same way T-1272 did for 0.2.1 (179047f1).

## What to build

Set `version` to 0.2.2 in the root package.json and in the root entries of package-lock.json, and change nothing else in the lockfile. Leave web/package.json's own version alone, as T-1272 did.

## Acceptance criteria

- [x] C1. The root package.json and both root version entries in package-lock.json read 0.2.2, and `npm install --package-lock-only --ignore-scripts` leaves the lockfile unchanged (test).
  - done: impl-1317 · 2026-10-26T00:04:38.595Z
  - verified: rev-26 [reviewer] · run rev-20261026-1317-evidence-1 · 2026-10-26T00:40:45.444Z · commit cb3dff8065752ab5f07594199d4940f2859164ea

## Comments

### impl-1317 · 2026-10-26T00:03:50.985Z

Scope confirmed by Coordinator: exactly three version lines, following T-1272; no new test file. C1 evidence will be npm install --package-lock-only --ignore-scripts in a disposable sealed workspace, identical SHA-256 before/after, typecheck and later same-head mode-free verify. Cover-quiet currently prohibits local test files and verification. No shared reply/schema/policy contract changes or docs/help/skill/role behavior changes.

### rev-26 · 2026-10-26T00:05:09.404Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1317-source-1
commit: cb3dff8065752ab5f07594199d4940f2859164ea
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR; A-12201 at tree ce4730a0a836e287c47e7eb6c4ab6b400ba54dc9. Standards 0 / Spec 0 findings. Exactly package.json version and package-lock.json's two root versions change 0.2.1 to 0.2.2; no other lockfile edits, web/package.json unchanged. A-12200 reports local sealed npm lock-only install exit 0 with identical SHA-256 and typecheck exit 0; supplementary summary, not configured evidence. C1 claimant done retained; final runtime verification remains pending. Cover-quiet is active: submit the ordinary same-head mode-free verify only after Coordinator explicitly ends it, then request final evidence review. Preserve original local command outputs/exits/capture limits without transcription reruns. No new tests requested; reviewer performed reads only.

### impl-1317 · 2026-10-26T00:40:30.411Z

Same-head mode-free verify 5038f39c-3688-404e-9e10-46cf3cb19e6e completed exit 0, A-12209: 3321 pass, 0 fail/cancel/skip/todo; T0, all T1, package-manifest fallback all T2 and Web on droplet linux x64, Node v24.21.0, Neovim v0.12.5. Droplet c-8 lon1 lifetime 683 s, $0.0474. T3/T4 did not run; periodic/integrated coverage deferred (queue enabled, T3 absent from batch tiers). Lint/duration findings report-only. Host typecheck gate 98ce6918 not repeated remotely; original candidate-local typecheck passed. Final evidence review requested from Reviewer at unchanged cb3dff80.

### rev-26 · 2026-10-26T00:40:45.444Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1317-evidence-1
commit: cb3dff8065752ab5f07594199d4940f2859164ea
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR; A-12210 carries source1/A-12201 and original 5038f39c/A-12209. Actual T0/all T1/fallback all T2/Web exit 0, 3321 ordinary passes/446 file passes, no fail/skip/cancel and no load executions; T3/T4 absent/deferred. Linux c-8 lon1, Node24.21.0/Neovim0.12.5, Headless Shell156.0.8078.4/v1248, workers2, lifetime683s/$0.0474. Host check at prepared tree98ce6918, not remotely repeated typecheck; report-only lint/budget/ratchet warnings retained. C1's three source versions plus sealed lock-only install stability A-12200 are established; committed lock SHA independently matches recorded unchanged hash0c8439a0...d53b9. Original local stdout/exits preserved in claimant session, no transcription rerun. Standards/Spec no findings; C1 verified. Coordinator owns enqueue/landing/release, no publication or QA claim. Reviewer reads only.

Criteria: C1 verified.

### coord · 2026-10-26T00:46:57.217Z

Merged acffddc58ea2a9ac6393a0c2c3a1e8adbdf7c66d onto dev.
dependencies out of date: package-lock.json, package.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
