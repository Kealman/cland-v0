---
id: T-1031
kind: task
title: web-auth.test.ts needs a built web/dist when run standalone and fails with ENOENT
state: open
status: in progress
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
updated: 2026-10-21T12:59:22.005Z
---

## Summary

`node --test hub/test/web-auth.test.ts` run on its own fails with `ENOENT scandir <worktree>/web/dist/` when the web bundle has not been built: the test scans the built bundle for the hub secret but neither builds it nor says that a build is needed. Inside `cland verify` the pre-step builds web/dist first, so suites pass; a targeted run in a fresh worktree (E-412 stage QA, 2026-10-20) does not.

## Acceptance criteria

- [ ] C1. web-auth.test.ts builds web/dist once through the shared web-build helper when it is absent, so the bundle secret scan runs in every suite and on every droplet shard; only a standalone run without build tooling may skip, with one clear line naming `npm run build --workspace web` (test).
- [ ] C2. doctor component tests use controlled bundle-check input and pass without the installation web/dist, keeping their complete report assertions (test).
- [ ] C3. The cause of web/dist being absent on a droplet shard (delivery, prepare or shard path) is named in the item topic, with regression evidence from a disposable checkout without web/dist.

## Comments

### coord · 2026-10-21T12:57:14.732Z

New evidence that this also happens inside `cland verify`, not only standalone. The Linux stage cover 117ca925 at cb231eeb (cancelled after 2,284 tests, A-8389), shard-2 on cland-v0-3aff6152, failed three tests because web/dist was absent on that shard:
- `hub/test/web-auth.test.ts` "the served bundle, auth responses and every browser frame contain no hub secret": `ENOENT: no such file or directory, scandir '/home/runner/cland/web/dist/'`.
- `hub/test/doctor.test.ts` "a broken skills symlink fails with the fix", and "the managed hooks or AGENTS.md block removed: named failures, fixed by cland update": both got an unexpected `warn web bundle: web/dist build stamp missing or invalid`.

The same tree passed these tests in Linux cover bb909399 an hour earlier. So whether web/dist exists on a droplet shard depends on something per run: shard assignment, or the executor snapshot that `cland executor prepare` rebuilt at about 12:41Z for T-993. The doctor tests should not depend on the installation's web/dist at all. This is now a stage-cover flake, so the priority is raised.
