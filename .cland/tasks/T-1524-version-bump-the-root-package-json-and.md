---
id: T-1524
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.2"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1284
branch: t/T-1524-version-bump-the-root-package-json-and
created: 2026-10-31T14:43:42.045Z
updated: 2026-10-31T19:03:04.024Z
closed: 2026-10-31T19:03:04.024Z
---

## Summary

Move the root `package.json` and both lockfile version fields to 0.3.2 for the R-1523 release, as T-1496 did for 0.3.1.

## Acceptance criteria

- [x] C1. The root `package.json` version and both version fields in `package-lock.json` read 0.3.2, `npm run typecheck` passes, and no other file changes.
  - done: impl-1524 · 2026-10-31T18:36:19.502Z
  - verified: rev-26 [reviewer] · run rev-20261031-1524-evidence-1 · 2026-10-31T18:56:19.522Z · commit 94825120aae95d22cf54e240a0f465d29f455070

## Comments

### impl-1524 · 2026-10-31T18:35:42.317Z

C1 red-first: temporary Node test on disposable copies failed with actual ['0.3.1','0.3.1','0.3.1'] vs expected ['0.3.2','0.3.2','0.3.2']; after three literal edits the same test passed (1/1) on macOS, Node native. npm run typecheck passed (hub, nvim, shared/wire and web including colour/hooks checks). Source diff remains package.json + package-lock.json only. origin/dev fetched and merge reports already up to date. test:lint in progress. No shared contract, command, permission or documentation changes.

### rev-26 · 2026-10-31T18:36:45.704Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1524-source-1
commit: 94825120aae95d22cf54e240a0f465d29f455070
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15030 source clear: exactly two files and three literal version replacements; pinned root manifest and both lockfile version fields parse as 0.3.2. No other dependency/script/integrity/workspace change. C1 source portion checked; its typecheck/runtime portion remains unverified pending original same-head configured evidence. A-15029 local acceptance excerpts and typecheck/lint summary retain platform/advisory limits. No reviewer workload. Proceed with one proposed configured mode-free verify at this unchanged head; no full run requested.

### impl-1524 · 2026-10-31T18:55:31.089Z

Configured same-head verification 83abd7bc-d8a1-496f-9dd7-7803e55179eb passed at 94825120aae95d22cf54e240a0f465d29f455070 (tree ef7e022c2172b9f518678806419866320755d1df), original log A-15038. T0 host typecheck/check completed, T1/all T2 fallback/Web exit 0, 4511 tests passed. Linux x64 droplet Node v24.21.0, Chrome Headless Shell 1248 / Chrome for Testing 156.0.8078.4. T3 deferred per task policy, no changed T3/T4 tests. No cached receipt. Report-only budgets/lint findings retained. Final evidence review requested; source/head unchanged.

### rev-26 · 2026-10-31T18:56:19.522Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1524-evidence-1
commit: 94825120aae95d22cf54e240a0f465d29f455070
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15039 records independent original A-15038/run83abd7bc audit at unchanged source-clear head. C1 verified: exact two-file/three-version-substitution diff plus original npm run check host-gate typecheck completion, T0 exit0; remote typecheck explicitly reused that gate. 5,960 complete progress pairs: 4,511 ordinary test passes/519 file passes plus separate 465 load-gate test/465 file passes, zero adverse/unpaired outcomes, four empty failure arrays. T0/T1/all fallback T2+Neovim/Web exit0; T3/T4 unexecuted. Named CLI and MCP root-package-version cases passed. Candidate/host tree ef7e022c differs from Git tree f1f2380c only by excluded tracker/rules paths. Linux x64 droplet c-8 lon1 Node24.21.0/Nvim0.12.5, actual isolated Headless Shell1248 Chrome156.0.8078.4; cache/occasion null, skips[]. Report-only budget/ratchet/lint findings retained; T-1484 advisory remains incomplete, not pass. Local A-15029 Darwin disposable-copy receipts remain separate. No reviewer workload.

Criteria: C1 verified.

### coord · 2026-10-31T19:03:04.024Z

Merged 618eb9c48ece8adbfc51a26e7b07c19ebf28b3df onto dev.
dependencies out of date: package-lock.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
