---
id: T-644
kind: task
title: "The root package.json version is cland's only version: --version, the spoke and the managed marks read it"
state: open
status: in progress
size: S
criterion_seq: 5
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
updated: 2026-10-18T09:25:09.632Z
---

## Summary

Every tag from v0.0.1 to v0.1.3 reports version 0.1.0: `hub/src/version.ts` reads `hub/package.json`, and the spoke hard-codes `'0.1.0'`. The root `package.json` gains a version and becomes the only source: `cland --version`, the spoke's MCP server info, the hub's discovery file and the managed marks all read it (spec v0.1.4 §3.1, "The package version"; Q-599 resolution 7).

## What to build

- **The source.** A `version` in the root `package.json` (the value is an open question in the README; recommended `0.1.3`, the last tag, until E-617's bump commit). `hub/src/version.ts` reads the root file (`../../package.json` from `hub/src/`); `CLAND_VERSION_OVERRIDE` keeps working for the tests that simulate a bump.
- **One source.** `hub/package.json` loses its `version` (a private workspace needs none), and `package-lock.json` follows; after the merge the root needs `npm install`, not `npm ci` (the dependency-merge rule).
- **The spoke.** `hub/src/spoke/spoke.ts` drops its constant and reports `VERSION` from `version.ts` in its MCP server info.
- **Consequences.** The managed marks (`MANAGED_BY`, the `.gitignore` header, AGENTS.md's managed block, the hooks) now carry the root version, so doctor asks this repository for a `cland update` after the merge; the Coordinator runs it in the root and commits the rewritten marks. The hub README's version paragraph says where the version lives and that the bump is an ordinary commit merged before the release's dry run.

## Acceptance criteria

- [x] C1. `cland --version` prints the root `package.json` version (cli.test.ts, whose test reads the root file instead of the hub's).
  - done: impl-644 · 2026-10-18T09:22:48.094Z
- [ ] C2. A spoke started against a test hub reports the same version in its MCP `initialize` server info (spoke test through `hub/test/harness.ts`).
  - failed: rev-31 [reviewer] · 2026-10-18T09:25:09.631Z · note Copied/archived real-source consumers omit the new root package version, breaking coverage discovery/MCP and archived selector imports.
- [x] C3. `cland init --json` reports that version, and a managed file it writes carries `managed by cland <that version>` (init test).
  - done: impl-644 · 2026-10-18T09:22:51.414Z
- [ ] C4. No source file under `hub/src` holds a version literal: a test greps for `'0.1.0'` and for reads of `hub/package.json`'s version and finds none.
  - failed: rev-31 [reviewer] · 2026-10-18T09:25:09.631Z · note The guard misses nested relative reads of hub/package.json; resolve package references per source file and add the nested negative control.
- [x] C5. `hub/package.json` has no `version` key, and `npm install` in the root leaves `package-lock.json` unchanged after the commit.
  - done: impl-644 · 2026-10-18T09:22:56.663Z

## Comments

### impl-644 · 2026-10-18T09:22:00.907Z

Red/green evidence: CLI --version expected root 0.1.3 and observed stale 0.1.0 before version.ts switched to root; MCP initialize expected root 0.1.3 and observed spoke literal 0.1.0 before shared VERSION import. Both are green now. The T0 guard failed on hub/package.json's version key before removal. Existing init contract now checks root version in JSON plus managed marks; override coverage remains. Added root version 0.1.3 per ticket (no release bump).

### rev-31 · 2026-10-18T09:25:09.632Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-644-source-1
commit: 9b808216a1296504b852a5026263fce22e491c8e
scope: full
findings: [{"severity":"medium","text":"M1: ../../package.json in a nested hub/src consumer resolves to the forbidden hub package but escapes the flat-path regex.","file":"hub/test/lint-version-source.ts","line":11},{"severity":"medium","text":"M2: real-source carriers do not preserve the root version dependency: coverage writes a versionless root package, and selection-replay archives no root package at all.","file":"hub/test/suite-coverage.test.ts","line":45}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-644 source review — not clear

Commit:9b808216a1296504b852a5026263fce22e491c8e.
Fixed point:226bd904a90b269e80b3faa5b514a0ea2f367fff.
Scope:full. Read-only review, no Reviewer execution or edits.

## Standards

M1 medium — hub/test/lint-version-source.ts:11. The guard rejects ../package.json or literal hub/package.json, but a nested source consumer can read ../../package.json, resolving to hub/package.json, without matching it. C4's one-source regression guard therefore misses the same forbidden package from a different directory. Resolve static package references against each source file and add a planted nested-consumer negative control, alongside valid root references. Implementer confirms the gap and has reproduced/fixed the control (53e9569b), pending new committed review head.

M2 medium — hub/test/suite-coverage.test.ts:45–49 and hub/test/selection-replay.ts:37. The moved version dependency is not included in real-source carriers. Coverage copies hub/src but generates a root package containing only type:module; VERSION becomes undefined and readDiscovery rejects discovery because version is not a string (project.ts:180). Archived-selector replay copies hub/src and hub/package.json without root package.json; suite-coverage imports project, which imports version, so the new read fails on a missing file. Preserve the root package/version and audit analogous fixed copy/archive lists, retaining coverage/replay assertions and historical-ref support.

No other finding identified. Root0.1.3 is the task's recommended pre-release value; shared VERSION and CLAND_VERSION_OVERRIDE are correctly retained. The spoke imports VERSION, init/discovery/managed marks already consume it. Workspace/lockfile version removal is consistent; README assigns release bumping to an ordinary pre-dry-run commit.

## Spec

C1/C2/C3 production version consumers otherwise match the requested source. New MCP/discovery test uses the real in-process spoke and socket fixture; CLI version checks read root package, and init CLI helper now checks JSON version plus existing managed-mark/override assertions.

C4 remains incomplete for M1. C2's copied-source consumer path is broken by M2, although the main repository MCP test can pass. C5 removes the workspace version key and aligns root/lock versions without dependency changes; npm-install stability is reported in A-5108.

A-5108 documents CLI/MCP red-before observations and current local cli3/3,in-process-spoke3/3,init13/13, typecheck/lint and post-commit npm-install unchanged lockfile. These targeted results do not exercise the two broken carriers. No task verification has run.

## Verdict

Source not clear for M1/M2. Fail C4 and C2 with the above scope. Fresh source review is required after corrections; no verify yet. After eventual merge, Coordinator still owns root npm install and cland update/managed-mark commit per the task.
Standards:2 medium findings. Spec:C4 guard and copied-source integration partial; remaining production consumer changes consistent.

Durable review:A-5113.

Criteria: C4 failed (The guard misses nested relative reads of hub/package.json; resolve package references per source file and add the nested negative control.), C2 failed (Copied/archived real-source consumers omit the new root package version, breaking coverage discovery/MCP and archived selector imports.).
