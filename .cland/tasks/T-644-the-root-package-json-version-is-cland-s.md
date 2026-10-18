---
id: T-644
kind: task
title: "The root package.json version is cland's only version: --version, the spoke and the managed marks read it"
state: closed
status: done
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
updated: 2026-10-18T10:40:32.177Z
closed: 2026-10-18T10:40:32.177Z
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
  - verified: rev-31 [reviewer] · run rev-20261018-644-final · 2026-10-18T10:02:30.096Z · commit 73f70fe98bab0fa329d3dce71fc6146cbce62fad
- [x] C2. A spoke started against a test hub reports the same version in its MCP `initialize` server info (spoke test through `hub/test/harness.ts`).
  - done: impl-644 · 2026-10-18T09:26:30.161Z
  - verified: rev-31 [reviewer] · run rev-20261018-644-final · 2026-10-18T10:02:30.096Z · commit 73f70fe98bab0fa329d3dce71fc6146cbce62fad
- [x] C3. `cland init --json` reports that version, and a managed file it writes carries `managed by cland <that version>` (init test).
  - done: impl-644 · 2026-10-18T09:22:51.414Z
  - verified: rev-31 [reviewer] · run rev-20261018-644-final · 2026-10-18T10:02:30.096Z · commit 73f70fe98bab0fa329d3dce71fc6146cbce62fad
- [x] C4. No source file under `hub/src` holds a version literal: a test greps for `'0.1.0'` and for reads of `hub/package.json`'s version and finds none.
  - done: impl-644 · 2026-10-18T09:26:35.172Z
  - verified: rev-31 [reviewer] · run rev-20261018-644-source-2 · 2026-10-18T09:29:56.678Z · commit 73f70fe98bab0fa329d3dce71fc6146cbce62fad
- [x] C5. `hub/package.json` has no `version` key, and `npm install` in the root leaves `package-lock.json` unchanged after the commit.
  - done: impl-644 · 2026-10-18T09:22:56.663Z
  - verified: rev-31 [reviewer] · run rev-20261018-644-final · 2026-10-18T10:02:30.096Z · commit 73f70fe98bab0fa329d3dce71fc6146cbce62fad

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

### rev-31 · 2026-10-18T09:29:56.678Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-644-source-2
commit: 73f70fe98bab0fa329d3dce71fc6146cbce62fad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review at 73f70fe98bab0fa329d3dce71fc6146cbce62fad on t/T-644-the-root-package-json-version-is-cland-s. Fixed base 226bd904a90b269e80b3faa5b514a0ea2f367fff. Correction diff against 9b808216 independently inspected; production behavior unchanged. No Reviewer test execution.

## Standards
No findings. The deterministic version guard runs through test:static. Its planted inputs exercise flat and nested package-path resolution without starting processes. Existing process coverage proof retains its assertions and now declares its T3 lifecycle purpose. No added waits or allowances.

## Spec
No findings remain. Prior M1/C4 is resolved: quoted package references resolve relative to the containing source file, with negative controls for hub/src/version.ts ../package.json and hub/src/spoke/spoke.ts ../../package.json, and positive root-reference controls. Prior M2/C2 is resolved: suite-coverage copies the actual root package.json and checks the resulting discovery version; archived selectors carry root metadata too. The other partial compiler carrier already includes root package.json; the suite-selection list is a selection-input table, not a source carrier.

Root version 0.1.3 and lock metadata agree; hub/package.json no longer owns a version. Shared VERSION supplies the CLI, spoke, discovery and managed marks, retaining the test override. Release documentation states the ordinary pre-dry-run version commit.

Evidence inspected: A-5117 records controlled pre-fix coverage startup and archive ENOENT failures, corrected coverage 2/2 in 4.049s, current and historical archived-selector replay, and typecheck/static/lint success. Earlier targeted CLI/spoke/init and post-commit npm install lock-stability reports in A-5108 remain applicable to unchanged behavior. C4 is source-established. C1/C2/C3/C5 await final exact-head verification evidence; no full-green claim or per-item QA requirement.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5130.

Criteria: C4 verified.

### impl-644 · 2026-10-18T10:00:31.821Z

Exact-reviewed-head droplet verification e3723c63-c50e-4f02-b4e1-efe629260507 passed (exit 0) at 73f70fe98bab0fa329d3dce71fc6146cbce62fad. Linux x64, Node v24.21.0, Neovim v0.12.5; 2542 tests / 2534 pass / 8 skipped / 0 failures; suite 1631.14s, droplet lifetime 1718s, cost $0.1193. Mode-free admission selected full because hub/package.json changed. Log A-5173 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5173-suite-e3723c63-c50e-4f02-b4e1-efe629260507-auto-at-73f70fe.log. Reviewer received the result directly; awaiting final verdict without head changes.

### rev-31 · 2026-10-18T10:02:30.096Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-644-final
commit: 73f70fe98bab0fa329d3dce71fc6146cbce62fad
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review at unchanged 73f70fe98bab0fa329d3dce71fc6146cbce62fad, matching origin and source-2 / A-5130.

Independently audited A-5173 / e3723c63-c50e-4f02-b4e1-efe629260507: auto full, exit 0, 2542 total / 2534 pass / 0 fail / 0 cancelled / 8 prerequisite skips. Hub-free 224/224, hub-machine 1919 pass + 5 skips, Neovim 391 pass + 3 skips; full Neovim completed in 187.32s. All phase failure arrays are empty, with no owned quarantine or runtime tier-mismatch receipts.

All 21 ordinary receipts in CLI (3), in-process spoke (3), init (13), and source-carrier coverage (2) are present and positive. The CLI root-version and MCP/discovery identities each pass 5/5 load repetitions (10/10). Init JSON/managed-mark and override-update controls pass. The previously broken real-process coverage carrier now passes in 5.146450189s; current/historical archived-selector replay remains supporting A-5117 evidence. The host check explicitly runs the corrected lint-version-source guard.

C5: root/workspace package metadata and package-lock.json at this head are byte-identical to 9b808216's post-commit npm-install check recorded in A-5108 (up to date, lock unchanged). Independently confirmed the empty diff for those three files across the correction. Root version is 0.1.3, hub package has no version, lock metadata matches. This reuses unchanged package-specific evidence, not a claim of another npm install at the final head.

Linux x64 c-8 lon1, Node24.21.0 / Neovim0.12.5, workers 2, lifetime 1718s, cost $0.1193, peak load 6.17. Existing report-only diagnostics leave raw exit 0 unchanged. C1/C2/C3/C5 verified; C4 remains current from source. No known-red exception, further task run or per-item QA needed. Coordinator's post-merge install/update of managed marks remains separate.

Standards: no new findings. Spec: final clear.
Artifact A-5178.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### coord · 2026-10-18T10:40:32.177Z

Merged a6d141647d2f8a666500b61d4f072de443b18f60 onto dev.
