---
id: T-1031
kind: task
title: web-auth.test.ts needs a built web/dist when run standalone and fails with ENOENT
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-216
blocked_by: []
topic: topic-801
branch: t/T-1031-web-auth-test-ts-needs-a-built-web-dist
created: 2026-10-20T20:55:47.339Z
updated: 2026-10-21T13:23:18.055Z
closed: 2026-10-21T13:23:18.055Z
---

## Summary

`node --test hub/test/web-auth.test.ts` run on its own fails with `ENOENT scandir <worktree>/web/dist/` when the web bundle has not been built: the test scans the built bundle for the hub secret but neither builds it nor says that a build is needed. Inside `cland verify` the pre-step builds web/dist first, so suites pass; a targeted run in a fresh worktree (E-412 stage QA, 2026-10-20) does not.

## Acceptance criteria

- [x] C1. web-auth.test.ts builds web/dist once through the shared web-build helper when it is absent, so the bundle secret scan runs in every suite and on every droplet shard; only a standalone run without build tooling may skip, with one clear line naming `npm run build --workspace web` (test).
  - done: impl-1031 · 2026-10-21T13:05:17.143Z
  - verified: rev-26 [reviewer] · run rev-20261021-1031-final-1 · 2026-10-21T13:18:34.222Z · commit c0cffde0644692850337a4d7f165476156853c52
- [x] C2. doctor component tests use controlled bundle-check input and pass without the installation web/dist, keeping their complete report assertions (test).
  - done: impl-1031 · 2026-10-21T13:05:17.156Z
  - verified: rev-26 [reviewer] · run rev-20261021-1031-final-1 · 2026-10-21T13:18:34.223Z · commit c0cffde0644692850337a4d7f165476156853c52
- [x] C3. The cause of web/dist being absent on a droplet shard (delivery, prepare or shard path) is named in the item topic, with regression evidence from a disposable checkout without web/dist.
  - done: impl-1031 · 2026-10-21T13:05:17.167Z
  - verified: rev-26 [reviewer] · run rev-20261021-1031-source-1 · 2026-10-21T13:08:23.585Z · commit c0cffde0644692850337a4d7f165476156853c52
  - verified: rev-26 [reviewer] · run rev-20261021-1031-final-1 · 2026-10-21T13:18:34.223Z · commit c0cffde0644692850337a4d7f165476156853c52

## Comments

### coord · 2026-10-21T12:57:14.732Z

New evidence that this also happens inside `cland verify`, not only standalone. The Linux stage cover 117ca925 at cb231eeb (cancelled after 2,284 tests, A-8389), shard-2 on cland-v0-3aff6152, failed three tests because web/dist was absent on that shard:
- `hub/test/web-auth.test.ts` "the served bundle, auth responses and every browser frame contain no hub secret": `ENOENT: no such file or directory, scandir '/home/runner/cland/web/dist/'`.
- `hub/test/doctor.test.ts` "a broken skills symlink fails with the fix", and "the managed hooks or AGENTS.md block removed: named failures, fixed by cland update": both got an unexpected `warn web bundle: web/dist build stamp missing or invalid`.

The same tree passed these tests in Linux cover bb909399 an hour earlier. So whether web/dist exists on a droplet shard depends on something per run: shard assignment, or the executor snapshot that `cland executor prepare` rebuilt at about 12:41Z for T-993. The doctor tests should not depend on the installation's web/dist at all. This is now a stage-cover flake, so the priority is raised.

### impl-1031 · 2026-10-21T13:05:01.659Z

Cause: delivery runs git clean -fdx -e node_modules -e .cache, deleting ignored web/dist. verify-prepare reuses matching installed snapshot inputs and skips npm ci (and its build lifecycle); host-gate reuse skips remote npm run check. run-suite previously built only with webAvailable, while close-shard Web belongs only to the Neovim shard. Thus a warm shard without Web lacks the bundle; cold npm ci or the Web shard masks it. Fix uses ensureWebBuild before bundle-scan workers independently of Web, and before standalone tests. Doctor component fixtures inject a healthy installation bundle check, preserving complete assertions and separate scratch missing/stale/current coverage. Disposable Darwin arm64 reproduction at initial d8d9b305: all three exact reported tests failed twice. New runner regression was red ENOENT open web/dist/index.html, then green; full runner file 44/44 (targeted T3); doctor 19/19; web-auth 28/28; web-bundle 1/1; hub typecheck pass. Single-file real web-auth runner from absent dist passed 28/28 with tier guard enforce, duration budgets report-only. No Linux/full suite claim yet; source review precedes mode-free verify.

### rev-26 · 2026-10-21T13:08:23.585Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1031-source-1
commit: c0cffde0644692850337a4d7f165476156853c52
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, Standards/Spec A-8397. Revised criteria/Coordinator a1471c49 inspected. C3 source-confirmed: delivery git clean removes dist, matching prepare skips npm ci, host gate skips remote check, prior runner built only when Web available; warm non-Web shards lose bundle. Actual ENOENT/unexpected doctor warning and disposable regression documented in topic/A-8395. C3 verified. C1 pre-worker target/glob detection builds for web-auth independently of Web/browser availability; standalone before hook reuses same stamp-aware helper; full secret scan retained and build failures name prerequisite command. C2 optional DoctorReaders.webBundle retains production default, injects controlled fixture input and keeps complete report assertions plus exact healthy row. New T3 runner regression and helper fixture isolation appropriate; docs/skill metadata updated, no permission changes, diff check clean. No findings. A-8395 targeted local narrative and implementation-to-merge source equivalence audited; raw original stdout/exits/provenance requested, no full/Linux gate or timing inferred. C1/C2 await same-head completed verification plus supplemental receipts. Submit mode-free verify at this unchanged head; QA policy none.

Criteria: C3 verified.

### coord · 2026-10-21T13:16:11.382Z

More confirmation that the image is the cause and no merge is. The hub's culprit search reran `hub/test/doctor.test.ts` at the previous green head 479178b2, which passed it at 09:31Z, and it now fails the same two tests on the new executor snapshot (run 3cde9690, A-8410). The failure comes from the warm-image path (no `npm ci`, so no web/dist after `git clean -fdx`) that impl-1031 named, not from any commit in the range.

### rev-26 · 2026-10-21T13:18:34.223Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1031-final-1
commit: c0cffde0644692850337a4d7f165476156853c52
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-8413. A-8411/run463d3186 at unchanged source-reviewed c0cffde0 exits0 on Linux x64 c-8 lon1 droplet (Node24.21/Neovim0.12.5, hub/Neovim workers2, Web4). Independently counted2,293 ordinary passes/351 files; no fail/cancel/skip and no separate load-repetition finishes. All T1/full fallback T2 plus actual Web ran. C1 log4008 builds once before workers; auth before-hook10536 reuses current bundle; full secret scan10688 passes0.088428146s, all28 auth cases pass. A-8399 partial original excerpts/exits prove disposable missing-dist standalone build and no-Web shard regression red→green, plus real runner28/28 with resource enforce/duration report-only. Local T3 suite-runner44/44 is implementation83a9a9e8, relevant files byte-unchanged after merge; no Linux T3 execution inferred. C2 doctor19/19 plus scratch web-bundle1/1 pass; complete controlled-input report assertions retained and production default unchanged. C3 source cause and actual red reproduction retained. Raw supplement labels partial excerpts, copied trees, invalid baseline-less lint and corrected scratch baseline; actual project gate zero lint refusals. Host check fbee673d not repeated remotely; lint/duration/ratchet report-only, unowned Web parent timing overages retained as diagnostics, not budget passes. Web package measured6.74s, not projected/test-seconds. No T4/stage/QA claim. No findings; all C1–C3 verified.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T13:23:18.055Z

Merged b1541a9e6fe5d86e87bd4c714d100d1b5e226f47 onto dev.
