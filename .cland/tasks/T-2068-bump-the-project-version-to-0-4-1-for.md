---
id: T-2068
kind: task
title: Bump the project version to 0.4.1 for the v0.4.1 release
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1719
branch: t/T-2068-bump-the-project-version-to-0-4-1-for
created: 2026-11-24T02:43:23.822Z
updated: 2026-11-24T03:52:13.689Z
closed: 2026-11-24T03:52:13.689Z
---

## Summary

R-1880 ships as 0.4.1 (the human's decision on ask b17eb4ec). `cland release --dry-run` refuses until the root package.json matches the item version, so the version bump is an ordinary item merged before the release, as T-967 did for 0.1.5.

## What to build

Set the version to 0.4.1 everywhere 0.4.0 is recorded as the project version. That means the root package.json and package-lock.json, plus any other file the 0.4.0 bump touched. Find that bump with `git log --oneline --grep "0.4.0"`, then `git show --stat` it. No behaviour changes.

## Acceptance criteria

- [x] C1. `node hub/bin/cland.ts --version` prints 0.4.1, and every file the 0.4.0 bump changed now says 0.4.1; `npm run typecheck` is green.
  - done: impl-2068 · 2026-11-24T02:46:12.116Z
  - verified: rev-35 [reviewer] · run rev-35-2068-evidence-1 · 2026-11-24T03:17:26.714Z · commit 9dc3f43a42479b11d52f2189d69ecc3b29701fb3

## Comments

### impl-2068 · 2026-11-24T02:45:19.770Z

Scope matches a6e61c3e0 exactly: root package.json version plus package-lock.json top-level and packages[""] versions only. Pre-change assertion red: '0.4.0' !== '0.4.1'; post-change all three fields assert 0.4.1. npm run typecheck passed on macOS arm64 Node v24.21.0. Full npm run test:lint in progress. Merged origin/dev ac5ce55fe before first review. No new tests or dependency changes.

### rev-35 · 2026-11-24T02:47:51.994Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2068-source-1
commit: 9dc3f43a42479b11d52f2189d69ecc3b29701fb3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22738 records source clear. Exact three-field0.4.0→0.4.1 bump in root package.json/package-lock.json mirrors priora6e61c3e0, located through Git history and inspected; both prior-bump files covered. Parsed-JSON normalization confirms no other content/dependency/install/workspace changes. CLI VERSION reads root package.json and --version writes it; default now0.4.1. A-22737 reports isolated localCLI0.4.1, full typecheck/lint0, selectedT1/T2help11/11; these are producer-reported scoped checks, not configured/Linux/T3/T4/Web proof. C1 remains unverified pending same-head configured result. QA none. Read-only review/no execution or findings; hold releases for normal mode-free verify after Coordinator grant, no source/install/dev merge/full task suite requested.

### impl-2068 · 2026-11-24T03:15:38.564Z

Configured verification e9cf1714-c012-4df6-8335-03e7c990fb17 finished passed at exact reviewed head 9dc3f43a42479b11d52f2189d69ecc3b29701fb3; artifact A-22739. Droplet Linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5, workers 2, lifetime 1535 s, cost $0.1066. T0/T1/T2/selected T3/Web exited 0: 7461 passed, 1 skipped, 0 failed. No T4 executed; remaining T3 deferred to merge batch. Duration/lint budgets report-only. Head unchanged; awaiting assigned Reviewer C1/final settlement. Earlier full local lint and typecheck both passed.

### rev-35 · 2026-11-24T03:17:26.714Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2068-evidence-1
commit: 9dc3f43a42479b11d52f2189d69ecc3b29701fb3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-22740 combines source/A-22738 and completed e9cf1714/A-22739. Three prior-bump fields remain0.4.1 with no dependency changes. Exact matched CLI case 'cland --version prints the version of the root package' passes0.309657904s, asserting both --version/-v native0 and VERSION stdout; A-22737 separately reports isolatedstdout0.4.1/full localtypecheck0. Suite typecheck host gate at canonicalbbc13c73 not repeated;T0 passes, compiler-path integration passes31.632325825s. C1 verified. All243T1/fallback445T2/55Web plus7selectedT3 pass;266T3 deferred,18T4 unexecuted. Aggregate7462tests/7461pass/1skip/0fail/cancel/todo;5separate prerequisite loaded skips,3knownF2finish-only entries separately accounted. Linuxc8sfo2 Node24.21/Nvim0.12.5 Headless1248/CfT156.0.8078.4, report-only budgets/lint. Git treeeeb4bb93 differs from verificationbbc13c73;cache null unknown. No findings or reviewer execution; no additional run/install/source change requested.

Criteria: C1 verified.

### coord · 2026-11-24T03:52:13.689Z

Merged 34ba11b7441f087ec261d6e42343d10ff85ad74b onto dev.
dependencies out of date: package-lock.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
