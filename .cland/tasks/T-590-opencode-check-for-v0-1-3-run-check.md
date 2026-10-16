---
id: T-590
kind: task
title: "OpenCode check for v0.1.3: run check:opencode against the newest 2.x before the dry run"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.3
  - release
assignee: null
parent: E-426
blocked_by: []
topic: topic-371
branch: t/T-590-opencode-check-for-v0-1-3-run-check
created: 2026-10-16T11:08:34.466Z
updated: 2026-10-16T11:11:56.346Z
closed: 2026-10-16T11:11:56.346Z
---

## Summary

E-426 C4: before v0.1.3's dry run, run `npm run check:opencode` from a clean task worktree, as `.agents/skills/release/OPENCODE-CHECK.md` describes. A pass moves the exclusive bound in `hub/src/doctor/ranges.ts`, reviewed and merged before the preview. A failure keeps the range and files a Bug in Bugs (C-325). Per E-426, neither outcome blocks the release.

## What to build

- In this task's worktree, run `npm run check:opencode` once. It is a network check: it downloads and integrity-checks the newest stable OpenCode 2.x, then runs one turn against a local fake provider with scratch HOME, XDG directories and OPENCODE_DB.
- Save its whole output as an artifact in the item topic, named so the release brief can cite it (OC_ART).
- On PASS: commit the `ranges.ts` change the check made (only that file, plus any test fixture the check names), push, and request review. Run `hub/test/doctor*.test.ts` and any test that asserts the OpenCode range, one file at a time.
- On FAIL: commit nothing. Report the failure lines and the Bug id the check filed, or file the Bug under C-325 yourself if the check reports `Bug filing failed`.
- Never run the real `opencode` CLI against default data, and never print environment values.

## Acceptance criteria

- [x] C1. `npm run check:opencode` ran once at a clean head on dev, and its full output is an artifact in the item topic, naming the tested version, the newest stable 2.x and PASS or FAIL.
  - done: impl-590 · 2026-10-16T11:10:35.857Z
  - verified: rev-30 [reviewer] · run rev-20261016-590-final · 2026-10-16T11:11:48.236Z · commit 9f00cd0c6a8453e21bb31c80fbb17d3202de24de
- [x] C2. On PASS, `hub/src/doctor/ranges.ts` carries the new exclusive bound with `min` unchanged, and every test asserting the range passes. On FAIL, the range is unchanged and an open Bug under C-325 names the failure.
  - done: impl-590 · 2026-10-16T11:10:36.169Z
  - verified: rev-30 [reviewer] · run rev-20261016-590-final · 2026-10-16T11:11:48.236Z · commit 9f00cd0c6a8453e21bb31c80fbb17d3202de24de

## Comments

### impl-590 · 2026-10-16T11:09:15.101Z

Starting the one authorized check from clean task head 9f00cd0c. Full output will be preserved in the item topic; shared-machine constraints prohibit parallel test files or other heavy work.

### rev-30 · 2026-10-16T11:11:48.236Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-590-final
commit: 9f00cd0c6a8453e21bb31c80fbb17d3202de24de
scope: evidence

# T-590 evidence review clear

Reviewed unchanged `9f00cd0c6a8453e21bb31c80fbb17d3202de24de`, branch `t/T-590-opencode-check-for-v0-1-3-run-check`. Local task ref equals the named dev head; task worktree read-only status is clean and there is no branch/source diff. No remote task ref is required: this is an explicitly authorized no-commit/no-merge evidence task. Took hold and read current claimant, C1/C2 done and QA scope none.

**Primary Coordinator109584b5-dc40-4422-b24b-f3fb94f17e4c**, independently read in topic history, confirms PASS with no diff, requests these three targeted files then evidence review at9f00cd0c, and explicitly directs **no commit, no cland verify, no merge**; Coordinator closes after clear. This resolves the spec's normal 'commit updated range' path when the desired bound is already present.

## Standards

No high/medium/low findings; no source change to review. Read release/OPENCODE-CHECK.md and task-specific instructions. Generic skill's failure-blocking language is superseded by E-426/task's explicit nonblocking PASS/FAIL policy; this receipt is PASS, so no failure disposition or bug filing is needed. No empty commit, unrelated allowance change or invented full-suite receipt.

Read existing check implementation solely to understand the receipt: registry stable2.x selection, compared protocol/event files, sha512 binary archive integrity, exact platform binary smoke, and range write only after successful smoke. The unchanged smoke uses standalone loopback server/local fake provider with a constructed scratch HOME/XDG directories/OPENCODE_DB/config/password environment, rather than inherited user data, and cleans the owned process group before scratch removal. Reviewer runs none of it and prints no environment values.

## Spec / C1

**A-3883** durable full command output identifies `npm run check:opencode` and node hub/bin/check-opencode.ts, tested baseline **2.0.24**, check-observed newest stable2.x **2.0.30**, **10 wire operations/15 adapter event names compatible**, authenticatedHTTP/SSE and fake-provider smoke passed, final **PASS >=2.0.24 <2.0.31**. This is the probe's observed release snapshot, not an independently refreshed current registry query. Claimant records exactly one invocation at clean named head; clean task status and unchanged source verified. No additional network/binary run needed.

## Spec / C2

At the reviewed commit, ranges.ts already has `opencode: { min: [2,0,24], below: [2,0,31] }`. Existing checker computes nextpatch-exclusive2.0.31 and replaces only below, preserving min; rewriting the already-correct value yields no source diff. The explicit Coordinator disposition accepts this evidence-only outcome.

**A-3884** contains complete three serial whole-file outputs, independently parsed **30tests/30pass/0fail/0cancel/0skip**: doctor22,doctor-isolation1,opencode-check7. Search of hub/test for ranges.ts/TESTED_RANGES/[2,0,31]/tested-range assertions identifies doctor and opencode-check; doctor-isolation covers the additional doctor*.test.ts requirement. Tests include OpenCode unsupported-major/newer2.x reporting, additive/removed route and response contracts/events, real release-CLI fixture happy path bound advancement and contract/smoke failure retention. No range-assertion test is omitted from this relevant set.

Final evidence **clear**, verify **C1/C2** at9f00cd0c. No extra commit, verification suite or merge under primary109584b5. This item evidence does not itself publish a release or replace the release preview/QA process. No per-item QA. Reviewer only reads source/evidence, no edits/test/compiler/binary/provider calls/subagents.

Findings: Standards0; Spec0.

Artifact A-3885 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3885-t-590-evidence-clear-opencode-2-0-30-pass-existing-range-current-30-targeted-pas.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T11:11:56.346Z

Closed without a merge: check:opencode PASSED at 9f00cd0c (A-3883). Newest stable 2.x is 2.0.30, already within the tested range >=2.0.24 <2.0.31, so ranges.ts is unchanged and the branch has no diff. Targeted tests 30/30 (A-3884); evidence review clear.
