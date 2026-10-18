---
id: T-644
kind: task
title: "The root package.json version is cland's only version: --version, the spoke and the managed marks read it"
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - init
  - hub
assignee: null
parent: E-612
blocked_by: []
topic: topic-497
branch: t/T-644-the-root-package-json-version-is-cland-s
created: 2026-10-16T16:23:58.514Z
updated: 2026-10-18T09:20:11.163Z
---

## Summary

Every tag from v0.0.1 to v0.1.3 reports version 0.1.0: `hub/src/version.ts` reads `hub/package.json`, and the spoke hard-codes `'0.1.0'`. The root `package.json` gains a version and becomes the only source: `cland --version`, the spoke's MCP server info, the hub's discovery file and the managed marks all read it (spec v0.1.4 §3.1, "The package version"; Q-599 resolution 7).

## What to build

- **The source.** A `version` in the root `package.json` (the value is an open question in the README; recommended `0.1.3`, the last tag, until E-617's bump commit). `hub/src/version.ts` reads the root file (`../../package.json` from `hub/src/`); `CLAND_VERSION_OVERRIDE` keeps working for the tests that simulate a bump.
- **One source.** `hub/package.json` loses its `version` (a private workspace needs none), and `package-lock.json` follows; after the merge the root needs `npm install`, not `npm ci` (the dependency-merge rule).
- **The spoke.** `hub/src/spoke/spoke.ts` drops its constant and reports `VERSION` from `version.ts` in its MCP server info.
- **Consequences.** The managed marks (`MANAGED_BY`, the `.gitignore` header, AGENTS.md's managed block, the hooks) now carry the root version, so doctor asks this repository for a `cland update` after the merge; the Coordinator runs it in the root and commits the rewritten marks. The hub README's version paragraph says where the version lives and that the bump is an ordinary commit merged before the release's dry run.

## Acceptance criteria

- [ ] C1. `cland --version` prints the root `package.json` version (cli.test.ts, whose test reads the root file instead of the hub's).
- [ ] C2. A spoke started against a test hub reports the same version in its MCP `initialize` server info (spoke test through `hub/test/harness.ts`).
- [ ] C3. `cland init --json` reports that version, and a managed file it writes carries `managed by cland <that version>` (init test).
- [ ] C4. No source file under `hub/src` holds a version literal: a test greps for `'0.1.0'` and for reads of `hub/package.json`'s version and finds none.
- [ ] C5. `hub/package.json` has no `version` key, and `npm install` in the root leaves `package-lock.json` unchanged after the commit.
