---
id: T-665
kind: task
title: Suite and executor test fixtures name their commands and carry a stub of cland's runner
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-664
topic: null
branch: null
created: 2026-10-16T16:35:23.892Z
updated: 2026-10-16T16:36:05.016Z
---

## Summary

Prefactoring, with no change to behaviour. The temporary projects that the suite and executor tests verify write `[verification] check` and `test` matching their package scripts. They also carry a stub `hub/test/run-suite.ts`, so they stay "cland-shaped" when ticket T-666 makes verify read the commands and ticket T-667 keeps cland's selection for candidates with the runner. An option builds an "other stack" project without the stub, for the tests that follow.

## What to build

- **Commands.** The fixtures that write a `package.json` with `typecheck` and `test` scripts also write `check = "npm run typecheck"` and `test = "npm test"` into the `[verification]` table of their `config.toml`: `hub/test/suite-fixture.ts`, `close-run-fixture.ts`, `remote-fixture.ts`, `prepared-project.ts` and `droplet-fixture.ts`. The tests that write such a project directly get the same lines: `executor.test.ts`, `suite-cancel.test.ts`, `suite-human.test.ts`, `suite-cache-recovery.test.ts` and `task-card.test.ts`. Find the rest with a grep for `scripts:` and `"scripts"` under `hub/test`. A test that plants a typecheck failure keeps planting it through its script.
- **The runner stub.** The same fixtures commit a stub `hub/test/run-suite.ts` by default. Today the hub probes the candidate's runner file in two places. In the suite worker, a missing file or one containing `inheritedLease` means the runner borrows the worker's lease. At submission, a file containing `reduceCoverage` turns coverage recording on. The stub's text names `inheritedLease` and not `reduceCoverage`, so both probes decide as they do today without the file. Tests that already write their own runner file, such as `suite-close.test.ts` with its `reduceCoverage` stub, keep it.
- **Other stacks.** The fixtures take an option (for example `stack: 'other'`) that writes neither the stub nor a `package.json`. With it, the caller passes its own `check` and `test` lines, such as `sh -n test.sh` and `sh test.sh`.
- **Shard manifest.** The stub lies outside the hub shard globs (`*.test.ts`), so `hub/test/shards.json` and `npm run test:shards` are unaffected. Confirm that.

**Keeping cland's own suite intact.** Only test fixtures change, and the stub keeps both runner probes' decisions. The hub reads none of the new lines until ticket T-666, so the whole suite passes with no assertion changed.

## Acceptance criteria

- [ ] C1. Every fixture project that writes package scripts also writes matching `check` and `test` lines, and a grep under `hub/test` finds no writer without them.
- [ ] C2. The fixtures commit a stub `hub/test/run-suite.ts` that the worker reads as borrowable and the submission reads as not coverage-capable (assertion added in `suite-fixture.ts`'s own test or `suite.test.ts`).
- [ ] C3. A fixture built with the other-stack option has no `package.json` and no runner stub, and its `config.toml` holds the caller's lines.
- [ ] C4. The hub-level suite and executor tests pass with no assertion changed, and `npm run test:shards` passes.
