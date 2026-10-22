---
id: T-1102
kind: task
title: The web picks an unversioned release as the current release
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
regression_of: T-1071
topic: topic-842
branch: t/T-1102-the-web-picks-an-unversioned-release-as
created: 2026-10-22T09:25:03.407Z
updated: 2026-10-22T09:47:14.509Z
closed: 2026-10-22T09:47:14.509Z
---

## Summary

The web's `currentRelease` in `web/src/items-tree.ts` sorts open releases by `(a.version ?? '').localeCompare(b.version ?? '', …)`, so a release without a version sorts first and becomes the current release. Since the human split E-778 into the unversioned release R-1100 "Public launch" (2026-10-22), the Items tree on a copy of the live tracker opens R-1100 instead of R-377 (v0.2). The macOS stage cover f02c3de0 (A-9069, dev ff6edeaa) failed `web/test/items.test.ts` "the Items tree reads the copied live tracker snapshot": `waiting for … [data-object-id="R-377"] to be visible`. Neovim's `items.open_releases` already orders unversioned releases last (`version_less`), as the tracker docs and the Coordinator clause say ("lowest-semver open release, unversioned last").

## Acceptance criteria

- [x] C1. With an open unversioned release beside an open versioned one, the web's current release, the Board's default scope and every other `currentRelease` caller pick the lowest semver release; an unversioned release comes after every versioned one and unversioned releases order by rank; pre-release ordering matches Neovim's `version_less` (Web or unit test, with a planted unversioned release).
  - done: impl-1102 · 2026-10-22T09:30:05.927Z
  - verified: rev-23 [reviewer] · run rev-20261022-1102-final · 2026-10-22T09:42:07.156Z · commit 84de9678c91f81acb7b703fc75330b8b3385a795
- [x] C2. `web/test/items.test.ts` "the Items tree reads the copied live tracker snapshot" passes on a tracker copy that contains R-1100 (test).
  - done: impl-1102 · 2026-10-22T09:30:05.999Z
  - verified: rev-23 [reviewer] · run rev-20261022-1102-final · 2026-10-22T09:42:07.156Z · commit 84de9678c91f81acb7b703fc75330b8b3385a795

## Comments

### impl-1102 · 2026-10-22T09:27:03.711Z

Red first on unchanged source (macOS, local targeted T1, no suite gate): node --test hub/test/web-release.test.ts fails with actual 'R-21' !== expected 'R-1'. The planted open unversioned release incorrectly wins. Test covers currentRelease and shared Tree/Board default models, numeric core/prerelease precedence, metadata and rank/id ties. Copied-tracker Web fixture now explicitly plants R-1100 in scratch; its pre-fix run is in progress.

### impl-1102 · 2026-10-22T09:30:38.867Z

Implemented and pushed 84de9678c91f81acb7b703fc75330b8b3385a795. Final test seam is the shared pure current-release module at T1 (2/2 pass); Tree/Board/Graph defaults are proven in the existing copied-tracker Web case (full items.test.ts 8/8 pass on macOS local Headless Shell). Also fixed connection.ts's duplicate sort, which fed Shell's explicit release selection. Typecheck and static/test lint pass (lint report mode, zero refusals). No Linux/full-suite claim yet; requesting source review before mode-free verification.

### rev-23 · 2026-10-22T09:32:07.655Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1102-source
commit: 84de9678c91f81acb7b703fc75330b8b3385a795
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards0/Spec0 findings. Shared comparator matches native SemVer precedence, versioned-before-unversioned with rank/id ties; currentRelease callers and connection/Shell both use it. Explicit selected release behavior retained. Pure T1 registry/test and scratch-planted R-1100 Web proof reviewed. Local summaries A-9071 support source but are not configured/Linux/load evidence. C1/C2 final verification pending ordinary mode-free exact-head receipt; after-stage QA separate.

### rev-23 · 2026-10-22T09:42:07.156Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1102-final
commit: 84de9678c91f81acb7b703fc75330b8b3385a795
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear: original A-9073 / 0287fb1b matches accepted source; independently audited2435 ordinary passes/373 file passes and both owned T1 identities five unique load passes plus explicit5/5 (10 total). Max load0.004067197s/0.001948334s. Existing copied-tracker Web case with scratch R-1100/Tree/Board/Graph checks passes at24.457822814s; duration overage retained, not a fast-budget claim. Actual Linux T1/all-T2/Web pass; hostd99af874 reused; report-only diagnostics/seven missing baselines retained. C1/C2 verified; no T3/T4/stage/QA claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-22T09:47:14.509Z

Merged e003eb69d7e5cf71c78b513b26ea9671693e0e03 onto dev.
