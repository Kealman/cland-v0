---
id: T-1876
kind: task
title: cland release fails with a bare "gh auth failed (ENOENT)" when the hub's PATH has no gh; doctor doesn't check gh on the hub's PATH
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1535
branch: t/T-1876-cland-release-fails-with-a-bare-gh-auth
created: 2026-11-15T23:29:25.796Z
updated: 2026-11-16T08:01:37.612Z
---

## Summary

On 2026-11-15 at 23:29Z, after E-1539 closed, `cland release --item R-1530 --dry-run` exited with `cland: gh auth failed (ENOENT); check the release machine's tools and existing gh authentication`. The release runs inside the hub (`hub/src/hub/releases.ts` → `territory-release.ts` → `release-web.ts` `checkWebRelease`, active because `web_bundle = true`), and it execs `gh` with the hub's process environment. The hub had been started through launchd by `zsh -ic`, which reads `~/.zshrc` but not the login profile that adds `/opt/homebrew/bin`. So `gh` wasn't on the hub's PATH, although it was on the caller's. The message names neither the PATH nor the process whose PATH was searched, and `cland doctor` doesn't check that the hub can run `gh` when `web_bundle` is on.

## What to build

When a release tool isn't found (ENOENT), the release error says which binary is missing, that the hub's own PATH was searched, and how to fix it: restart the hub with the tool on PATH. `cland doctor` adds a check, only when `[release] web_bundle` is on, that `gh` resolves on the hub's PATH. It makes no network or auth call. Fakes only in tests.

## Acceptance criteria

- [x] C1. A release whose hub PATH lacks `gh` refuses with a message naming `gh`, the hub's PATH and the restart fix (test).
  - done: impl-1876 · 2026-11-16T07:40:05.621Z
- [ ] C2. `cland doctor` warns when `web_bundle` is on and `gh` isn't on the hub's PATH, with the fix, and makes no network call (test).
  - failed: rev-35 [reviewer] · 2026-11-16T08:01:37.612Z · note New native resolver regression fixtures lack complete failure-path producer ownership before root disposal (rule 12).

## Comments

### impl-1876 · 2026-11-16T07:34:07.648Z

Contract sweep before edits: searched hub.status, HubStatus, checkWebRelease, AssetCommand, checkToolchain and ToolchainRequirements across hub/web/nvim/shared, skills, QA and docs including all test tiers; inventory at worktree .cland/T-1876-consumers.txt. Plan: additive opt-in hub.status releaseTools boolean and optional releaseTools.gh resolution result. Existing production clients, startup probes, persisted readers, socket fixtures and all prior status requests retain their exact shape; only doctor opts in. Prior wire shape gets an explicit client regression (missing result stays unknown). No existing fields, notices, admission or outcome classes change.

### rev-37 · 2026-11-16T07:46:09.159Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1876-source-1
commit: d5294969f470f2544e4f700d5fb4dda4c271a4ca
scope: full
findings: [{"severity":"medium","text":"releaseTools.gh uses which(), which skips empty PATH entries and resolves relative entries against process.cwd() instead of the release root; doctor can warn gh is missing although execFile with cwd:root resolves it. Preserve native default PATH semantics too.","file":"hub/src/hub/dispatch.ts","line":2532}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review at exact d5294969f: not clear. One medium Spec/shared-fact finding at hub/src/hub/dispatch.ts:2532 (details A-19842). C1 error guidance and sanitized fallback are present; runtime criteria remain unverified. Default status shape and prior-wire unknown handling are preserved; docs/help/golden/skills align otherwise. No Reviewer runs or edits. A-19838 local results are reported summaries; hub-status-component 4/8 remains a failed fixture observation assigned by Coordinator to E-1882, not a pass. Corrected head needs fresh source review before mode-free verify within an authorized machine window. A-19842: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19842-t-1876-source-review-hub-path-lookup-semantics.md

Criteria: C2 failed (Hub-side lookup differs from release executable resolution for empty/relative PATH components; missing PATH is also conflated with empty.).

### rev-35 · 2026-11-16T08:01:37.612Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1876-source-2
commit: 272860efef214504ad784ddf11d66bd2b71c44cb
scope: full
findings: [{"severity":"medium","text":"New native fixture bodies lack a stop/admission fence and whole-sequence join before root disposal; per-child completion/census does not join setup and later loop admissions on interruption. Both test bodies need an owner registered before acquisition and a held-work failure-path control.","file":"hub/test/executable-path.test.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source pass A-19870. Prior A-19842 PATH selection finding resolved; one new medium fixture-lifetime finding confirmed by implementer from source. Product release guidance/opt-in/old-wire handling otherwise aligned. C1/C2 not finally verified; candidate success and report-only lint do not prove failure-path ownership or configured coverage. No Reviewer runtime work. Hold released for correction and fresh review.

Criteria: C2 failed (New native resolver regression fixtures lack complete failure-path producer ownership before root disposal (rule 12).).
