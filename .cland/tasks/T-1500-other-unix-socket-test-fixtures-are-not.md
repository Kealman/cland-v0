---
id: T-1500
kind: task
title: Other Unix-socket test fixtures are not safe under a deep TMPDIR on macOS
state: open
status: review
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1272
branch: t/T-1500-other-unix-socket-test-fixtures-are-not
created: 2026-10-31T04:21:28.348Z
updated: 2026-10-31T15:17:46.763Z
---

## Summary

T-1499 fixed the admission exchange socket, which exceeded macOS's 104-byte `sun_path` limit under the suite temp root. Its rule 20 audit, recorded on T-1499, found the remaining direct Unix-socket fixture paths in hub/test, nvim/test and web/test. They fit today's suite root but are not safe under a deeper TMPDIR. A longer suite root or project path would break them on macOS the same way. Follow-up of T-1499 (0.3.1).

## Acceptance criteria

- [x] C1. Every Unix-socket listener created by test fixtures allocates its path through one shared helper that budgets UTF-8 bytes including the NUL under 104, independent of TMPDIR depth, and a control proves a deep TMPDIR (≥ 90 bytes) still binds.
  - done: impl-1500 · 2026-10-31T14:50:46.362Z

## Comments

### impl-1500 · 2026-10-31T14:45:21.575Z

C1 seam: shared fixture path allocator + real native listen/close with >=90-byte TMPDIR. Consumer audit searches .sock, listen, createServer/createSocketEdge, controlPath, --listen across hub/test, nvim/test, web/test. Production layout and absent socket/discovery assertions remain unchanged. Migrating explicit stub/listener/control paths and matching client reads; no wire contract changes.

### impl-1500 · 2026-10-31T14:48:58.660Z

Consumer audit complete: explicit hub fixture listeners migrated in account-cli, admission-exchange, artifact-lifecycle, cli, codex-native, cover-quiet, fakes/legacy-remote-hub, harness-framing, hub-status-component, init-machine-lifecycle (generated child import), item-lead, name-reservation, plan-stage-fixture, prompt-races, request-guard, roles-snapshot-cli, session-brief[-component], session-credential-io, suite-admission, task-card-component, test-admission, tracker-rank, verify-submission, visibility-component, web-auth and web-authority. Neovim stub callers and all control lookups migrated, plus client.ts native RPC --listen and startup-budget-support listener. Web tests have no direct Unix listeners; they consume migrated hub/Neovim fixtures or production daemons. Remaining sockets: production daemon/layout/edge lifecycle assertions, fake-codex receiving production argv, absent/occupied socket controls and textual test-lint samples stay unchanged to preserve production contracts. Raw frames/previous wire shapes unchanged; endpoint is still an ordinary path. Native server.close retains unlink ownership; no directory writer/cleanup order changes. Full exact file inventory will accompany source review artifact.

### rev-26 · 2026-10-31T14:55:23.230Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-1
commit: 82572ae35d467546104ea6cbabedce049e00194c
scope: full
findings: [{"severity":"medium","text":"M1: new sockets live directly in global /tmp outside owned fixture roots. Neovim ownStubClient deliberately SIGKILLs its group, bypassing native close/unlink; root/dir cleanup now leaves RPC/control nodes behind. Admission loses private socket-root owner too. Add private short-path ownership cleanup after positive listener/child+peer drainage, retain on incomplete drain, and normal/killed/incomplete controls.","file":"test-support/socket-path.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14895 full source review: consolidated M1 only, no additional findings. UTF8+NULbudget/shared identity/path migration/native deepTMPDIRbind source reviewed; all nonimport hunks and listener/client inventory checked, remaining production/absent/occupied/static launch paths have documented dispositions. C1done/runtime-unverified; ownership finding does not refute native path-budget fact, no failed criterion marked. Reported local58file/typecheck/lint outcomes remain partial, original output/provenance needed at final audit. Related inherited-credential failure independently documented inT1525. Finish M1 with shared lifecycle owners/controls, fresh exact pushed-head source review before configured verify. No tests run by reviewer; no dev merge/full local run requested.

### impl-1500 · 2026-10-31T14:59:51.977Z

Addressing review M1: shared allocator now creates private 0700 short directories per canonical fixture root; endpoints remain stable within the owner process and are passed to child listeners through argv/env. removeFixtureSockets is called only by hub and Neovim directory owners beyond resource/native-child drainage. Hub cleanup now matches Neovim's existing incomplete-drain retention: resource errors retain directories, with remaining disposals and final checks still run. Consumer audit includes ownDirectory callers/generated process-cleanup fixtures, hub signalDirectoryCleanup/removeDirectory and nvim ownDirectory/beforeDirectories. Existing positive process ownership and signal fences unchanged. Adding native normal-close, SIGKILL residual endpoint cleanup, and live-endpoint retention after a failed drain; privacy regression failed first on global /tmp mode 0777 vs required 0700.

### rev-26 · 2026-10-31T15:07:31.155Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-2
commit: 68e0372b9ac3a52c91dda8afbd15b4165b727e7d
scope: full
findings: [{"severity":"medium","text":"Remaining M1: random external private socket directories are known only to the allocating process's Map. SIGKILL of that worker loses the association; fixture guard/suite recovery has an empty registry and removes the root while leaving socket directories behind. Preserve recoverable identity-bound ownership before allocation is lost, then prove a separate recovery owner drains the killed allocator/listener and removes both roots; retain evidence on incomplete drain. Existing killed-listener control keeps its allocating parent alive and misses this boundary.","file":"test-support/socket-path.ts","line":6}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14912 full source2 review: private 0700 ownership, normal/killed-listener cleanup and incomplete-drain retention reviewed; all 12 revision paths read, no further findings. Remaining M1 is allocating-worker crash recovery, with pinned existing fixture-guard/suite-lock/load-gate source receipts in artifact. C1 done/runtime-unverified; no failed mark because native path-budget fact is not refuted. Local 59-file output A-14905 and final 3/3 lifecycle excerpt A-14906 stay targeted Mac evidence; intermediate timeout remains incomplete. Finish consolidated M1, fresh exact pushed-head review before verification. No reviewer test execution/dev merge.

### impl-1500 · 2026-10-31T15:11:21.285Z

Remaining source2 M1 now addressed without a process-local ownership registry: actual socket nodes are in private .fixture-sockets directories under disposable roots. Short /tmp symlink aliases have reciprocal root-owned records installed before alias creation. Recovery incrementally scans only the captured disposable root tree without following symlinks; it validates each alias shape and exact reciprocal target, then unlinks the alias (no external recursive deletion, no global sweep). Existing directory owners still fence this behind writer drainage and own ordinary root removal. New nested worker-allocates/binds -> SIGKILL -> fresh-parent close/removal control failed first with Missing expected rejection, then passed. Final lstat checks prove alias deletion rather than only a dangling target. Deep UTF-8 TMPDIR native bind remains green on macOS.

### rev-26 · 2026-10-31T15:17:46.763Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-3
commit: 35d278d9f9ef740a00692c7e331f435831509c8e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14921 full source3 clear: remaining M1 closed by root-owned actual nodes plus reciprocal short aliases, recoverable by independent fixture and public suite owners after existing native/root-identity drainage. All eight revision paths read; no new process/quarantine authority, global sweep or external recursive deletion. Native separate-worker controls require lstat alias deletion; normal/killed-listener/incomplete controls and deep UTF8 bind remain. C1 done/runtime-unverified, no verified mark. A-14918 raw59-file + two final5-case runs/A-14919 Mac provenance remain targeted local evidence; earlier intermediate timeout remains incomplete. Submit one mode-free configured verify at frozen35d278d9f, then original-record final review. No reviewer tests/dev merge.
