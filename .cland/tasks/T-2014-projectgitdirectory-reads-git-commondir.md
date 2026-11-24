---
id: T-2014
kind: task
title: projectGitDirectory reads .git/commondir with an unbounded readFile; enforce the metadata byte bound while reading
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1738
branch: t/T-2014-projectgitdirectory-reads-git-commondir
created: 2026-11-19T20:18:03.512Z
updated: 2026-11-24T10:50:25.813Z
---

## Summary

`projectGitDirectory` in `hub/src/git-maintenance.ts` reads `.git/commondir` with an unbounded `readFile`. Rule 42 requires a size bound enforced while reading. T-1856's correction reuses this parser rather than copying its grammar, and its own Git command ownership records use a bounded 64 KiB reader. impl-1856 reported this on 2026-11-19.

## What to build

Read `.git/commondir` (and any sibling Git metadata that this parser reads) through a bounded reader that counts the bytes it keeps and refuses oversized input loudly. Migrate every consumer of `projectGitDirectory`.

## Acceptance criteria

- [ ] C1. An oversized `.git/commondir` fixture is refused while reading, with a structured outcome, and a normal one still parses (test).
  - failed: rev-35 [reviewer] · 2026-11-24T10:50:25.813Z · note Five new fake-only proof callbacks lack whole-callback cancellation/setup ownership and positive-close-gated filesystem/native seam restoration.
- [x] C2. Every caller of `projectGitDirectory` is listed with its disposition (rules 20 and 41).
  - done: impl-2014 · 2026-11-24T10:48:27.023Z

## Comments

### impl-2014 · 2026-11-24T10:41:21.734Z

Consumer inventory (rg projectGitDirectory across hub/src, hub/test, docs, .agents; full repo search also inspected): configureProjectGitMaintenance and maintainProjectGit in git-maintenance.ts propagate metadata failures before Git/lock acquisition; git-command-owner.ts gitCommandRoot propagates before owner acquisition; doctor/git.ts checkGitMaintenance catches and produces warning; git-lock-report.ts gitLockReport catches and labels scan incomplete. No direct test/fixture/skill/raw-wire caller found. Existing string|null success API and ENOENT fallback remain; oversized input adds structured Error code/path/limit. All callers automatically use bounded reader; no signature migration needed.

### impl-2014 · 2026-11-24T10:43:24.910Z

Red/green at local macOS, Node v24.21.0: new T2 git-directory.test.ts initially 3 fail / 1 pass (commondir missing expected rejection; .git invalid-file error lacked size fields; no handle close observed). After bounded reader: 5/5 pass, including exactly 65,537 bytes read from 2 MB input, short reads, exact 64 KiB acceptance, linked worktree/fallback, and close-error secondary diagnostic. Both metadata formats use the same reader. T1 transitive importer scan found 64 reachable files plus 3 uncertain files included conservatively; running these serially before verify-window request.

### rev-35 · 2026-11-24T10:50:25.813Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2014-source-1
commit: b22a3d403f3a06ab2a89c065942edfa81f5d3412
scope: full
findings: [{"severity":"medium","text":"M1: the five new fake-only callbacks install global native/fs seams through raw t.after/t.mock without a whole-callback cancellation join or separate bounded setup. Native guard restoration is registered before filesystem restoration, and synthetic close rejection has no later positive-close/restoration fence. Use the shared pre-acquisition owner, keep original callbacks joined and fs seams behind the guard until confirmed close, and add held/cancelled/rejected-then-confirmed close controls while preserving exact byte-budget/outcome assertions.","file":"hub/test/git-directory.test.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22847: Standards1medium/Spec0additional. M1 raw t.after/t.mock global seams lack whole-callback join/separate setup and restore native guard before fs seams, without close-failure repair fencing. Lead29885ec1 confirms gap, while noting fake handles are in-memory: no actual descriptor leak claimed. Fixed allocation+overflow/short-read/awaited-close reader and all5 consumer dispositions check out. C1 failed for test proof; C2 done/unverified. Authored local5T2/902selectedT1/lint/typecheck are scoped normal checks, no configured result. No reviewer execution/edit. Hold releases for consolidated test correction and fresh source review before verification; no dev merge/full task-head suite requested.

Criteria: C1 failed (Five new fake-only proof callbacks lack whole-callback cancellation/setup ownership and positive-close-gated filesystem/native seam restoration.).
