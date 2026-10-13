---
id: T-324
kind: task
title: "The release row shows its version: R-228 0.1.2 Working with items (T-269 DoD gap)"
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1.2
  - nvim
  - hub
  - ready-for-agent
assignee: null
parent: E-269
blocked_by: []
topic: topic-202
branch: t/T-324-the-release-row-shows-its-version-r-228
created: 2026-10-13T12:05:47.468Z
updated: 2026-10-13T13:50:31.526Z
---

## Summary

T-269's Definition of done and spec §3.1 want the release row to read `R-228 0.1.2 Working with items`: the prefixed id, the version, then the title with its kind word stripped. The merged code draws no version. The items panel's scope header and the `all` tree show `R-228 Working with items`, the top bar shows `Working with items`, and `cland task view` heads `R-228  Working with items`. The QA brief writer found this gap on 2026-10-13. Close it before T-269's epic demo.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.1, the titles.

## What to build

- Wherever a release item is drawn as a row or header, show its version between the id and the title: the items panel's scope header and its `all` tree, the top bar's release, and the item view's header. `cland task view` heads `R-228  0.1.2  Working with items`.
- A release whose title is its version (`v0.1.1`, after T-316 strips "Release:") shows the version once, never twice.
- Other kinds are unchanged.

## Constraints

- Neovim headless tests on the stub hub, read with `screenstring()`. A CLI test for `task view` on a temporary project.
- Do not run the migration on this repo's tracker. The Coordinator runs it live.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. English everywhere.
- D25: request review first, then run `cland verify` at the reviewed head.

## Acceptance criteria

- [x] C1. The items panel's scope header and `all` tree, the top bar and the item view show a release as `R-<n> <version> <title>`, and a release whose title is its version shows it once.
  - done: impl-324 · 2026-10-13T12:14:27.253Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-2 · 2026-10-13T12:15:33.006Z · commit a9c8952458ca17c4f8a1930f56b38b3728272ada
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-4 · 2026-10-13T12:34:11.074Z · commit 5f21ccb7bfc2a4c54c15cf81b40041e98dc5fb23
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-5 · 2026-10-13T13:37:04.124Z · commit b5da10d308f3c5170864b134ed8f181a440c3e9f
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-6 · 2026-10-13T13:50:15.272Z · commit b5da10d308f3c5170864b134ed8f181a440c3e9f
- [x] C2. `cland task view` on a release heads with id, version and title.
  - done: impl-324 · 2026-10-13T12:12:33.685Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-2 · 2026-10-13T12:15:33.006Z · commit a9c8952458ca17c4f8a1930f56b38b3728272ada
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-4 · 2026-10-13T12:34:11.075Z · commit 5f21ccb7bfc2a4c54c15cf81b40041e98dc5fb23
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-5 · 2026-10-13T13:37:04.125Z · commit b5da10d308f3c5170864b134ed8f181a440c3e9f
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-6 · 2026-10-13T13:50:15.272Z · commit b5da10d308f3c5170864b134ed8f181a440c3e9f
- [x] C3. Headless and CLI tests cover both cases, `nvim/README.md` shows the release row, and `cland verify` is green.
  - done: impl-324 · 2026-10-13T13:49:43.555Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-324-6 · 2026-10-13T13:50:15.272Z · commit b5da10d308f3c5170864b134ed8f181a440c3e9f

## Comments

### impl-324 · 2026-10-13T12:11:46.619Z

Implemented a shared Neovim display title for release versions across the scope header, all tree, top-bar chip and item header. CLI ancestry now carries optional versions so task view shows versions on releases and their child ancestry. Tests cover a named release, version-only titles with/without v, and an unversioned release. Added the README release-row example. No live tracker migration.

### rev-23 · 2026-10-13T12:14:08.787Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-324-1
commit: cd8cf63aef483091dfd32e864a2856fad0c625fe

Medium — nvim/lua/cland/bars.lua:86 and nvim/lua/cland/item_view.lua:203 hard-code the release kind, failing the existing Lua container-name guard and omitting the header id for renamed configured releases. Use the configured first root kind. No other source blocker found: duplicate suppression, optional CLI ancestry version, unchanged other titles and coverage match the task. Full verification/C3 remains pending D25. Evidence A-1934: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1934-t-324-review-at-cd8cf63-configured-release-kind-bypass.md.

Criteria: C1 failed (Top-bar and item-header id formatting hard-codes release instead of the configured first root kind and violates the existing Lua container source guard.).

### impl-324 · 2026-10-13T12:14:45.776Z

Review finding fixed in a9c8952: bars/item headers use the configured top kind. Added a configured initiative root screen test. vboard 17/17, source guard 3/3, typecheck passed. New review requested before full verification under D25.

### rev-23 · 2026-10-13T12:15:33.006Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-324-2
commit: a9c8952458ca17c4f8a1930f56b38b3728272ada

No high or medium source findings remain. Configured top-kind checks resolve A-1934, and the new initiative screen regression retains all prior heading/duplicate tests. C1/C2 verified against UI and real CLI coverage. C3 is not verified: tests/README are present, but full cland verify remains pending under D25. Submit the complete run at this exact reviewed head; final readiness requires its green result. Evidence A-1936: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1936-t-324-source-review-clear-c1-c2-at-a9c8952-c3-suite-pending.md.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-13T12:31:48.449Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-324-3
commit: a9c8952458ca17c4f8a1930f56b38b3728272ada

Medium — nvim/test/qa.test.ts:203,396 omit the new configured release id in the top-bar regex; update those two expectations and retain all QA state and sandbox checks (STATE-001.lua itself passes). Medium — nvim/test/shell.test.ts:1302 omits the SemVer version in the release header; update it while retaining selection/folding/orphan guarantees. No new production finding. A-1944: 1784/1787, three Neovim failures, zero skips/cancellations; C3 is not green. Evidence A-1946: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1946-t-324-full-review-three-stale-release-heading-expectations.md.

Criteria: C3 failed (Complete verification fails three stale Neovim release-heading expectations at qa.test.ts:203,396 and shell.test.ts:1302; retain their QA sandbox and scope/fold checks when correcting them.).

### impl-324 · 2026-10-13T12:33:17.947Z

Full run A-1944 was 1784/1787: three stale heading assertions. Commit 5f21ccb updates those three expectations only, preserving QA sandbox/state and scope/folding guarantees. Affected targeted cases pass 3/3, typecheck passes. Merged origin/dev 5ec95c2; requested re-review before the next full verification. Evidence A-1947.

### rev-23 · 2026-10-13T12:34:11.075Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-324-4
commit: 5f21ccb7bfc2a4c54c15cf81b40041e98dc5fb23

No high or medium source findings. The three stale QA/scope heading expectations are corrected exactly; sandbox/state/folding/orphan assertions and STATE-001.lua remain unchanged. Dev/T-321 integration has no conflict-resolution delta and retains version ancestry/formatting. C1/C2 verification refreshed at this head; C3 remains pending the complete green cland verify result under D25. Evidence A-1948: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1948-t-324-corrected-integration-review-clear-at-5f21ccb.md.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-13T13:37:04.125Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-324-5
commit: b5da10d308f3c5170864b134ed8f181a440c3e9f

No high or medium integration findings. Migrated dev eefc0ef adds only tracker records/item migration and managed config; hub/Neovim source and tests are unchanged, including configured-kind and stale-heading fixes. C1/C2 verification refreshed at b5da10d. C3 remains pending a fresh complete green cland verify result under D25. Evidence A-1957: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1957-t-324-migrated-dev-delta-review-clear-at-b5da10d.md.

Criteria: C1 verified, C2 verified.

### impl-324 · 2026-10-13T13:49:44.234Z

Final full verification at reviewed head b5da10d308f3c5170864b134ed8f181a440c3e9f is green: run 6ea7a56f-7a18-489b-9cc8-4dad4cedd45b, 1791/1791 passed, zero failures/skips. Evidence A-1959 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1959-suite-6ea7a56f-7a18-489b-9cc8-4dad4cedd45b-all-at-b5da10d.log. C3 marked done; awaiting the Reviewer's exact-head final verification.

### rev-23 · 2026-10-13T13:50:15.272Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-324-6
commit: b5da10d308f3c5170864b134ed8f181a440c3e9f

No high or medium findings remain. C1–C3 verified at the unchanged head: configured release id/version/title formatting and duplicate suppression on all UI/CLI surfaces, retained QA/scope checks, tests and README. Complete exact-head cland verify 6ea7a56f / A-1959 passed typecheck and 1791/1791 across all phases, zero failures/skips/cancellations. Prior source/integration reviews remain applicable. Evidence A-1960: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1960-t-324-final-review-clear-c1-c3-at-b5da10d.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-13T13:50:31.526Z

Merged 17f4009694bfae492fac1d48f435e8095e8b429e onto dev.
