---
id: T-670
kind: task
title: The droplet runs [verification] prepare where it ran npm ci and the Neovim pin
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-668
  - T-669
topic: topic-669
branch: t/T-670-the-droplet-runs-verification-prepare
created: 2026-10-16T16:35:26.848Z
updated: 2026-10-19T23:34:31.102Z
---

## Summary

The droplet executor runs the project's `prepare` in the prepared image's builder and in every run's delivery, where it ran `npm ci` and seeded the Neovim pin (E-614 C2). This repository's `prepare` becomes a script of its own that keeps today's lock and pin check, in the same merge. Demo: a shell-stack scratch project verifies on the fake droplet after its `prepare` ran there, and a planted failing test turns the run red with its output (E-614 C3).

## What to build

- **The builder** (`prepareSnapshot` in `hub/src/executor/droplet/prepare.ts`). The `install` step runs the root's `[verification] prepare` in the checkout, through `sh -c` as `runner`, in place of `npm ci; node nvim/bin/nvim-path.ts`. It runs with `CLAND_PREPARE_KEY` set to the key being built, as JSON. Without `prepare` the step logs `prepare: not set` and the image holds only the checkout. A failing `prepare` fails the step as `install: prepare failed (exit <n>)`, with its output in the prepare report.
- **Delivery** (`DropletRun.deliver` in `run.ts`). After the checkout and `git clean`, delivery runs the job's recorded `prepare` (ticket T-666) on every run, with `CLAND_PREPARE_KEY` set to the snapshot's key. This replaces the lock and Neovim checks. `prepare` must therefore be idempotent, and the snapshot makes it warm. Its output goes to `delivery.log` and so into the suite log. A failing `prepare` turns the run red with `prepare failed (exit <n>)` and its output, and no `check` or `test` runs. The clean stays as it is (`-e node_modules -e .cache`). Outputs a project's `prepare` writes elsewhere in the checkout are rebuilt by its own run, and its caches under `$HOME` survive from the image. The head and cleanliness checks after the install stay. What `prepare` writes in the checkout must be ignored by git, as `node_modules` is. A `prepare` that leaves untracked, unignored files fails the run with `prepare left the checkout dirty: <paths>`.
- **This repository's `prepare`.** `.cland/config.toml` gets `prepare = "node hub/bin/verify-prepare.ts"`. The script reads `CLAND_PREPARE_KEY` and does exactly what the delivery does today. When the SHA-256 of `package-lock.json` differs from `key.lock`, it prints `dependencies changed: npm ci` and runs `npm ci`, and otherwise prints `dependencies match snapshot`. When `nvim/NVIM_VERSION` differs from `key.nvim.tag`, it prints `Neovim pin changed: seed` and runs `node nvim/bin/nvim-path.ts`, and otherwise prints `Neovim pin matches snapshot`. When the key is absent, as in the builder's first image, it runs both steps. The script lands in the same merge as the code that runs it.
- **Fixtures.** The prepare and droplet fixtures (`executor-prepare.test.ts`, `droplet-fixture.ts`, `remote-fixture.ts`, `prepared-project.ts`) set a `prepare` that keeps their assertions. An `npm ci` assertion uses `prepare = "npm ci"`.
- **Snapshot freshness.** `prepare` runs at every delivery, so a changed `prepare` command never makes a snapshot wrong. It only makes the image less warm, and the key stays as ticket T-669 left it.

**Keeping cland's own suite intact.** This repository's key keeps its hash (ticket T-669), so no re-prepare is needed. Its delivery prints the same two lines and runs `npm ci` or the seed only when today's check would, from the same snapshot key. Its builder runs `npm ci` and the seed as before, through the script. The stage close after this ticket runs the usual sharded droplet cover on `dev`, after the hub restart. That cover's suite log must show `dependencies match snapshot` and `Neovim pin matches snapshot` on every shard. Put that check on the close checklist.

## Acceptance criteria

- [ ] C1. A shell-stack project (`prepare = "echo prepared > .prepared"`, `check = "sh -n test.sh"`, `test = "sh test.sh"`, the test asserting `.prepared` exists, `.gitignore` listing it) prepares a snapshot and verifies green on the fake droplet. The suite log shows the `prepare` output before `$ <check>` (`executor-run.test.ts`).
- [ ] C2. The same project with a planted failing test turns the fake-droplet run red, with the test's output in the result message.
- [ ] C3. `cland executor prepare` runs `[verification] prepare` in the builder's checkout in place of `npm ci` and the Neovim seed, as the fake machine's call log shows, and an unset `prepare` logs `prepare: not set` (`executor-prepare.test.ts`).
- [ ] C4. A failing `prepare` at delivery turns the run red with `prepare failed (exit <n>)` and its output, and neither `check` nor `test` runs. A `prepare` that leaves an unignored file fails with `prepare left the checkout dirty`.
- [ ] C5. `node hub/bin/verify-prepare.ts` with a matching key prints `dependencies match snapshot` and `Neovim pin matches snapshot` and runs neither step. With a moved lock it prints `dependencies changed: npm ci` and runs `npm ci` (script test with a fake `npm` on the PATH).
- [ ] C6. This repository's `.cland/config.toml` sets `prepare = "node hub/bin/verify-prepare.ts"`, and a cland-shaped fake-droplet run's delivery log shows today's two lines (`executor-run.test.ts`).

## Comments

### impl-670 · 2026-10-19T23:34:31.102Z

Implementation: builder runs root prepare with JSON CLAND_PREPARE_KEY, delivery uses each job's recorded prepare with snapshot key, failures preserve output and dirty paths. cland's script retains exact warm lock/pin lines and uses successful-install marker plus legacy image-marker fallback (Coordinator decision in topic-669) so existing images need no re-prepare. Native focused proofs: executor-run 17/17, executor-prepare 5/5; typecheck/test:lint green. Required executor-*, droplet-*, suite-* and verify-* serial local sweep in progress. Stage close checklist for supervising Lead: after hub restart, usual sharded dev cover must show dependencies match snapshot and Neovim pin matches snapshot on every shard.
