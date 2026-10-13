---
id: T-224
kind: task
title: "Release from the item, dry run: `cland release --item T-n --dry-run`
  refuses open children or a missing version, and previews the tag and the
  notes"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
  - v0.1
assignee: impl-224
parent: E-117
blocked_by: []
topic: topic-138
branch: t/T-224-release-from-the-item-dry-run-cland
created: 2026-10-11T15:38:09.626Z
updated: 2026-10-11T16:11:15.128Z
closed: 2026-10-11T16:11:15.278Z
---

## Parent

T-117 (Release from the item), tracer bullets 1–2. These bullets were never ticketed: T-196, T-117's only child, was the epic close gate. Found while drafting T-117's QA brief, 2026-10-11.

## What to build

`cland release --item T-n [--dry-run] [--json]` reads the release item and does the following:
- Refuses when the item isn't a release, has open children, or has no version, and names the reason and the open children.
- With an explicit version given too, requires it to match the item's version.
- Previews the tag `v<version>` and the notes:
  1. the item's `## Notes` section;
  2. its epics, each with the first sentence of its `## Goal` as a one-line deliverable;
  3. the commit subjects, as today.

The `release` frame and the protocol carry the item. A release without `--item` behaves exactly as today. The dry run stays read-only, as today's dry run is.

## Acceptance criteria

- [x] C1. `--item` with open children, no version, a non-release item, or a version that disagrees with the item is refused, and the refusal names the reason (and the open children).
  - done: impl-224 · 2026-10-11T15:46:07.348Z
  - verified: rev-16 [reviewer] · run rev-20261011-224-2 · 2026-10-11T16:10:54.966Z · commit 400a2d3f8b576bdb1126aff6f7a8783974408845
- [x] C2. The dry-run preview shows `v<version>` and notes in the order: the item's Notes, then the epics with their one-line deliverables, then the commit subjects.
  - done: impl-224 · 2026-10-11T15:46:07.437Z
  - verified: rev-16 [reviewer] · run rev-20261011-224-2 · 2026-10-11T16:10:54.966Z · commit 400a2d3f8b576bdb1126aff6f7a8783974408845
- [x] C3. A release without `--item` is unchanged. Existing release tests pass untouched.
  - done: impl-224 · 2026-10-11T15:46:07.516Z
  - verified: rev-16 [reviewer] · run rev-20261011-224-2 · 2026-10-11T16:10:54.966Z · commit 400a2d3f8b576bdb1126aff6f7a8783974408845
- [x] C4. Protocol and CLI tests in a scratch project with a bare territory and a GitHub stand-in, as hub/test/release.test.ts sets them up. `npm run typecheck && npm test` pass.
  - done: impl-224 · 2026-10-11T16:10:20.480Z
  - verified: rev-16 [reviewer] · run rev-20261011-224-2 · 2026-10-11T16:10:54.966Z · commit 400a2d3f8b576bdb1126aff6f7a8783974408845

## Comments

### impl-224 · 2026-10-11T15:39:07.642Z

Claimed on dev 994b761. Implementing item-backed dry-run validation and notes through the existing release protocol and CLI, tested only in scratch projects with bare territory and GitHub stand-in. No-item behavior and existing release tests remain untouched; T-225 owns publication and close.

### impl-224 · 2026-10-11T15:45:37.672Z

Implemented and pushed 03f15537cecef799a9d2c7ae30fe2965dd35d6cf on t/T-224-release-from-the-item-dry-run-cland after fetching and merging origin/dev a9f131a. Four item-release protocol/CLI tests pass in scratch repositories; typecheck passes. Artifact A-1303 records scope and validation at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1303-t-224-implementation-and-validation.md. T-225 owns publication and close; this head explicitly requires --dry-run for --item.

### rev-16 · 2026-10-11T15:56:57.359Z

verdict: review
result: not clear
by: rev-16 [reviewer]
run: rev-20261011-224-1
commit: 03f15537cecef799a9d2c7ae30fe2965dd35d6cf

Medium — hub/src/territory-release.ts:93: the new `versionRefusal('release', ...)` call hard-codes a compiler-typed container Kind. A-1305's required tracker-container-source test rejects it, so npm test exits 1 and C4 is unmet. Preserve item SemVer validation without the hard-coded Kind and rerun the full suite at the corrected head.

Typecheck passed; hub tests 1235/1236. The four new scratch protocol/CLI item tests and untouched legacy release tests passed; Neovim was not reached. No other source findings remain against the T-224 dry-run scope.

Criteria: C4 failed (Full suite 8d4fe993 exited 1: container-kind compiler guard rejects versionRefusal('release', ...) at hub/src/territory-release.ts:93 (A-1305).).

### impl-224 · 2026-10-11T15:58:06.139Z

Addressed rev-20261011-224-1 / C4 at 400a2d3f8b576bdb1126aff6f7a8783974408845. Extracted the tracker's pure isSemverVersion predicate so Git validation no longer hardcodes a compiler-typed container kind. Reproduced the existing guard failure before the fix; guard now passes 2/2, item-release scratch tests 4/4, relevant tracker version/Notes tests 3/3. Fetched and merged origin/dev a6b4177 before the new final suite. Correction evidence A-1307: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1307-t-224-full-suite-finding-and-correction.md.

### impl-224 · 2026-10-11T16:10:20.591Z

Final full suite 42c09ac3-a252-4124-a02e-2c47ee9fcbd4 passes at exact head 400a2d3f8b576bdb1126aff6f7a8783974408845: typecheck plus all hub/Neovim tests, 1523 passed, 0 failures, exit 0. Durable evidence A-1308: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1308-suite-42c09ac3-a252-4124-a02e-2c47ee9fcbd4-all-at-400a2d3.log. C4 marked done after this result; all four criteria are implemented. Awaiting the review verdict, retaining the claim through merge.

### rev-16 · 2026-10-11T16:10:54.966Z

verdict: review
result: clear
by: rev-16 [reviewer]
run: rev-20261011-224-2
commit: 400a2d3f8b576bdb1126aff6f7a8783974408845

No high, medium or low findings remain. The previous C4 finding is resolved: hub/src/territory-release.ts:93 uses shared pure isSemverVersion; hub/src/tracker/item.ts:125-129 preserves existing SemVer rules and configured-kind validation. A-1308 confirms the compiler guard passes.

C1 verified: named missing-version/non-release/version-mismatch/open-descendant refusals through scratch CLI and protocol tests. C2 verified: exact Notes → epic first-Goal-sentence deliverables → existing commit notes preview, with read-only ref/item/receipt checks. C3 verified: unchanged legacy release.test.ts blob and all 17 legacy tests pass; no-item behavior stays intact. C4 verified: exact-head full suite 42c09ac3 (A-1308), npm run typecheck and npm test exit 0, 1523/1523 tests, zero failures or skips.

Standards and spec axes each have zero remaining findings; details in A-1309.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T16:11:15.128Z

Merged a8a8da0db14986821b5f1ee1d5972128ed0e6f20 onto dev.
