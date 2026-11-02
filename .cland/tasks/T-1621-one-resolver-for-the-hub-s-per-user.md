---
id: T-1621
kind: task
title: One resolver for the hub's per-user state, and an inventory of what the hub writes outside the project
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1332
branch: t/T-1621-one-resolver-for-the-hub-s-per-user
created: 2026-11-02T03:34:17.764Z
updated: 2026-11-02T12:40:27.543Z
closed: 2026-11-02T12:40:27.543Z
---

## Summary

One module names where the hub keeps per-user state: `CLAND_EXECUTOR_STATE`, else `XDG_STATE_HOME/cland`, else `HOME/.local/state/cland`. The spend ledger moves onto that resolver with no change of path. A test starts a hub with `HOME` and `XDG_STATE_HOME` on one temporary directory and proves that every file it writes outside the project lands there. A lint keeps later code from escaping, apart from a named allow-list of per-machine runtime paths.

Hot files: new `hub/src/state-paths.ts`, `hub/src/executor/droplet/spend.ts` [E-1534 adds a category], new `hub/test/state-inventory.test.ts`, new `hub/test/state-paths-lint.test.ts` with its allow-list

## Acceptance criteria

- [x] C1. One resolver returns the per-user state directory (`CLAND_EXECUTOR_STATE`, else `XDG_STATE_HOME/cland`, else `HOME/.local/state/cland`), and the spend ledger, its lock and its migration record resolve through it (test).
  - verified: rev-37 [reviewer] · run rev-37-1621-source-2 · 2026-11-02T06:12:05.381Z · commit 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-1 · 2026-11-02T06:35:53.654Z · commit 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
  - done: impl-1621 · 2026-11-02T07:23:59.105Z
  - verified: rev-37 [reviewer] · run rev-37-1621-delta-1 · 2026-11-02T07:25:04.961Z · commit 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-2 · 2026-11-02T07:43:13.661Z · commit 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
- [x] C2. The legacy `~/.cland/executor/spend.json` is still read and reconciled as today, and `executor-spend.test.ts` passes with no test edited.
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-1 · 2026-11-02T06:35:53.654Z · commit 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
  - done: impl-1621 · 2026-11-02T07:24:00.113Z
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-2 · 2026-11-02T07:43:13.661Z · commit 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
- [x] C3. A hub started with `HOME` and `XDG_STATE_HOME` on one temporary directory, running a droplet lease on the fake DigitalOcean API and a fake-harness session, writes every file outside the project under that directory, apart from the allow-listed per-machine runtime paths (test).
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-1 · 2026-11-02T06:35:53.654Z · commit 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
  - done: impl-1621 · 2026-11-02T07:24:00.970Z
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-2 · 2026-11-02T07:43:13.661Z · commit 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
- [x] C4. A lint test fails on any `homedir()`, `HOME` join, `tmpdir()` or `/tmp` path in hub source outside the resolvers and an allow-list that names each per-machine runtime path with its reason (test).
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-1 · 2026-11-02T06:35:53.655Z · commit 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
  - done: impl-1621 · 2026-11-02T07:24:01.897Z
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-2 · 2026-11-02T07:43:13.661Z · commit 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
- [x] C5. The same lint fails on a macOS-only path or command (`Library/`, `caffeinate`, `open`) in hub source that no platform guard covers, so nothing macOS-only lies in the serving path (test).
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-1 · 2026-11-02T06:35:53.655Z · commit 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
  - done: impl-1621 · 2026-11-02T07:24:02.197Z
  - verified: rev-37 [reviewer] · run rev-37-1621-evidence-2 · 2026-11-02T07:43:13.662Z · commit 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40

## Notes

Shared files: see Hot files

## Comments

### impl-1621 · 2026-11-02T05:44:28.033Z

Consumer inventory before implementation: spendPath exported from executor/droplet/spend.ts is used by droplet.ts, cli/executor.ts, executor-spend.test.ts, init-machine.ts and retirement/component tests; ledger lock, migration and retirement derive dirname(spendPath). Legacy reader and project HOME safety check are in spend.ts. HOME consumers outside spend: accounts/registry.ts; adapters/claude-code.ts; setup/steps/{accounts,trust}.ts; CLI {init,setup,open}.ts root guards. Runtime temp consumers: project socket fallback, termination-owner, suite-lock, verification-tree, Codex cland-run/sandbox, fixture-processes, QA scratch roots, droplet run/temp/provision scripts and health observation; suite lock defaults in init/config, daemon, suites and suite-worker. Search also covered hub/src colocated tests, all hub/test tiers, docs, skills, QA and shared. New API: hub/src/state-paths.ts exports userStateDirectory(env=process.env), userHome(env=process.env), legacySpendPath(env), and exact-source out-of-project exceptions with reasons. Existing spendPath API/wire and persisted ledger shapes remain unchanged. E-1532 paths must stay project-local or register exact runtime uses here.

### impl-1621 · 2026-11-02T05:51:39.908Z

Full consumer inventory: A-15593 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15593-t-1621-state-contract-consumer-inventory.md). No existing paths or wire/persisted formats change; existing fixtures and client consumers remain compatible. Local macOS/Node v24.21.0 targeted evidence so far: state-paths.test.ts 1/1, state-paths-lint.test.ts 3/3 (including planted controls, TS+shell inventory), state-inventory.test.ts 1/1 (fake harness, scripted provider lease, positive ledger and transient-lock observations), unchanged executor-spend.test.ts 20/20. Root typecheck passed. test:lint initially found missing new-file tier entries; added explicit T1/T2 registrations and rerunning. No T3/T4 or browser run; no full suite yet.

### rev-37 · 2026-11-02T06:02:38.898Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1621-source-1
commit: fa301a6c23119ccba9a3abb5ec8bc5fc6da7195a
scope: full
findings: [{"severity":"medium","text":"Shell inventory does not recognize HOME: pure scanner call on mkdir \"$HOME/escape\" returns no findings. Register shell HOME/braced references and planted controls, retaining exact-source exceptions.","file":"hub/test/state-paths-lint.ts","line":17},{"severity":"medium","text":"Ordinary unguarded macOS forms bypass scanner: const command=\"open\";spawn(command,[]), aliased execFile calling caffeinate, and join(home,\"Library\",\"Caches\") each return []. Resolve simple command aliases/constants and path components; add guarded/unguarded controls.","file":"hub/test/state-paths-lint.ts","line":38},{"severity":"medium","text":"Write collector omits native SQLite opens/sidecars and createWriteStream destinations; DatabaseSync startup I/O bypasses patched fs methods. Inventory can miss outside-project database/stream writes. Observe production database seam/streams and add positive controls.","file":"hub/test/state-inventory.test.ts","line":22}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear with3medium coverage gaps. Confirmed C4/C5 by executing pure exact-head statePathFindings only: all named controls return[]. No hub/native/browser run. C3 source review shows SQLite startup opens/sidecars and stream destinations bypass current fs method collector; no actual state leak claimed. Resolver/spend/legacy extraction otherwise preserves behavior, C1/C2 runtime evidence unverified. Lead acknowledged corrections9ee9d63e. Fixed head needs fresh source review before mode-free verify; no full tier pass claimed.

Criteria: C3 failed (Every-write inventory misses SQLite native writes/sidecars and stream writes.), C4 failed (Unregistered shell HOME path returns no lint finding.), C5 failed (Unguarded command variable/import alias and split Library path return no lint finding.).

### impl-1621 · 2026-11-02T06:08:42.207Z

Corrective source head pushed: 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25. Addresses review rev-37-1621-source-1 C3/C4/C5: shell HOME expansions and tilde are scanned; native launcher import aliases/namespaces and command constants are followed; split Library path components are checked with conjunctive platform guards. New planted test failed against the previous scanner on mkdir "$HOME/escape", then all 4 scanner tests passed on corrected tree. Runtime observer now covers createWriteStream and the existing openDatabase seam, conservatively fences SQLite companions, and requires real scratch SQLite row/WAL and drained stream escape controls outside HOME/project before the serving window. Inventory 1/1 and root typecheck passed on corrected tree. test:lint currently running. No merge of dev since first review; no verify submitted before fresh source clear.

### rev-37 · 2026-11-02T06:12:05.381Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1621-source-2
commit: 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, Standards/Spec no findings. All3 prior mediums resolved: shell HOME/braced/tilde and ordinary command aliases/constants/split Library controls recognized with guarded paths preserved; exact expanded exceptions reasoned. Inventory injects existing DB seam, fences SQLite companion destinations and observes streams. Real disposable SQLite row/WAL and drained-stream escape controls precede serving observation; positive hub.db/ledger/lock and joined cleanup retained. C1 source-verified unchanged resolver/spend precedence; C2–C5 await exact-head mode-free verify and named scanner/inventory/unedited spend outcomes. Local corrected reports supplemental only, no full tier/cloud/browser claim. No Reviewer execution on this pass.

Criteria: C1 verified.

### rev-37 · 2026-11-02T06:35:53.655Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1621-evidence-1
commit: 37a992f3df35ddc4fb0fdc8b9d82fc28de442f25
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; no findings. A-15661 run03192ac6-0165-474a-ab3b-76f08bbaac70 at exact source-clear head/tree exits0, aggregate4705/4705 pass, zero fail/cancel/skip/todo. Independently streamed generated test finish records: resolver1/1, scanner4/4 (including planted shell HOME/alias/command/split-Library controls), inventory1/1 (fake-provider lease/harness and SQLite/stream positive controls), unchanged executor-spend20/20 (legacy reconciliation preserved). C1–C5 verified across A-15630 source and A-15664 evidence. Linux x64 droplet c-8 lon1, Node24.21.0, Neovim0.12.5, isolated Headless Shell156.0.8078.4 r1248. T0/T1/all-T2 fallback/Web complete; T3 deferred merge batch, no T4 executed; no cache. Lint122/59files, budgets/ratchets report-only, skip-reason report missing0. Reviewer read-only evidence inspection, no execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### hub · 2026-11-02T07:19:09.412Z

Merge-delta assessment (report-only)
{"reviewed":"37a992f3df35ddc4fb0fdc8b9d82fc28de442f25","head":"4dee31cf89f4c8a535f41268f1bc4cbddcec465a","dev":"5bd17987b839cdd0d634046aa90c299e84cd83bd","mergeBase":"c14994a248fee18f1affcc4e49e2c67288f91dfe","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":[".agents/skills/implement/CHANGES/T-1621-state-paths.md",".agents/skills/implement/SKILL.md","docs/agents/tests/hub-test-state-inventory.test.ts.md","docs/agents/tests/index.md","hub/README.md","hub/src/executor/droplet/spend.ts","hub/src/state-paths.ts","hub/test/harness.ts","hub/test/state-inventory.test.ts","hub/test/state-paths-inventory.ts","hub/test/state-paths-lint.test.ts","hub/test/state-paths-lint.ts","hub/test/state-paths.test.ts","hub/test/tiers.json"],"devPaths":[".agents/skills/implement/CHANGES/T-1584-withdrawal-ownership.md",".agents/skills/implement/CHANGES/T-1590-host-records.md",".agents/skills/implement/SKILL.md",".cland/tasks/E-1531-the-host-interface-and-the-local-host.md",".cland/tasks/E-1536-users-and-sign-in-modes.md",".cland/tasks/T-1566-the-invite-page-with-a-password.md",".cland/tasks/T-1567-the-sign-in-page-and-sign-out.md",".cland/tasks/T-1568-passkeys-on-the-invite-and-sign-in-pages.md",".cland/tasks/T-1572-remote-pairings-belong-to-a-user.md",".cland/tasks/T-1584-users-mode-withdrawal-checks-message.md",".cland/tasks/T-1587-host-file-writes-ports-forwards-and-the.md",".cland/tasks/T-1588-the-host-agent-s-protocol-its-client-and.md",".cland/tasks/T-1589-the-fake-ssh-stand-in-and-fake-hosts.md",".cland/tasks/T-1590-host-records-and-per-host-secrets.md",".cland/tasks/T-1591-the-per-host-git-socket-and-git-daemon.md",".cland/tasks/T-1592-the-spoke-edge-on-a-unix-socket.md",".cland/tasks/T-1615-the-hub-lock-records-its-host-identity.md",".cland/tasks/T-1617-hub-start-stop-status-doctor-and-the.md",".cland/tasks/T-1618-droplet-and-key-deletion-is-confirmed-by.md",".cland/tasks/T-1621-one-resolver-for-the-hub-s-per-user.md",".cland/tasks/T-1626-the-droplet-executor-and-the-host.md",".cland/tasks/T-1627-the-first-hourly-verification-wait.md","docs/agents/tests/hub-test-host-records.test.ts.md","docs/agents/tests/hub-test-topic-withdraw.test.ts.md","docs/agents/tests/hub-test-web-authority-unit.test.ts.md","docs/agents/tests/index.md","docs/agents/tests/web-test-withdraw.test.ts.md","hub/README.md","hub/src/host/records.ts","hub/src/hub/core.ts","hub/src/hub/daemon.ts","hub/src/hub/dispatch.ts","hub/src/hub/store.ts","hub/src/protocol.ts","hub/test/host-records.test.ts","hub/test/tiers.json","hub/test/topic-withdraw.test.ts","hub/test/web-authority-unit.test.ts","qa/briefs/E-1531.md","shared/wire/index.ts","shared/wire/message-ownership.ts","web/README.md","web/src/MessageBlock.tsx","web/src/connection.ts","web/test/withdraw.test.ts"],"overlap":[".agents/skills/implement/SKILL.md","docs/agents/tests/index.md","hub/README.md","hub/test/tiers.json"],"dependency":{"status":"known","importers":["hub/test/harness.ts","hub/test/state-inventory.test.ts"]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1621 · 2026-11-02T07:20:58.924Z

Coordinator-directed batch repair: merged origin/dev (includes T-1590 hostPaths) after explicit instruction 6b93d2eb, then committed/pushed 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40. A-15715 failure reproduced exactly on merged tree: host/records.ts:47 tmpdir() and '/tmp' were absent from the exact-expression inventory. Added those two expressions with parent contexts and reason (per-host short sockets, macOS 104-byte bound, same as layout().socket); retained state remains project-local. Added control accepting only those expressions and rejecting another temp path in the same file. Added registration procedure for later E-1532 fallback paths. Corrected tree local macOS/Node24.21.0: scanner 5/5, state-paths 1/1, root typecheck passed; test:lint running. Old ready/verification applies only to 37a992f3d; new head requires delta source review then exact-head mode-free verification. No other source changed after the authorized dev merge.

### impl-1621 · 2026-11-02T07:24:25.900Z

A-15721 count clarification: the failed batch's 1325 pass / 1 fail count describes its complete executed prefix, not T1 alone. T0 completed; T1 failed; T2/T3 were unexecuted. Current corrected-head local tests are scanner 5/5 and resolver 1/1. Delta source review requested at 37d8df657; no new verify before clear.

### rev-37 · 2026-11-02T07:25:04.961Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1621-delta-1
commit: 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear after Coordinator-directed dev merge; Standards/Spec no findings. A-15722. Corrective33lines/4files add exact host/records.ts tmpdir()/literal-/tmp node+parent exceptions for short machine socket fallback, reasoned104-byte macOS bound; accepted-expression and rejected-sibling controls preserve file coverage. README/file-specific registration procedure updated. Landed host records keep retained material project-local; existing injected database observed. Resolver/spend/lock/migration, inventory observer, scanner implementation, harness seam and unchanged spend test untouched by merge. C1 source reverified. A-15721 local macOS5scanner/1resolver/typecheck/lint supplemental only. Old head A-15661 evidence and failed batchA-15715 do not verify this head; C2–C5 await exact-head mode-free named receipts. No Reviewer execution/browser/edits.

Criteria: C1 verified.

### rev-37 · 2026-11-02T07:43:13.662Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1621-evidence-2
commit: 37d8df657ad2fd62d7fcb5791ec3d1ecc354ea40
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final repaired-head evidence clear, no findings; all C1–C5 verified. A-15736 run e809dbcf-254a-44b9-af73-e2df12639c16 at source-clear37d8df657 exits0,4716/4716 with no fail/cancel/skip/todo. Independently streamed finish outcomes: resolver1/scanner5/inventory1/unchanged spend20 all pass, including new exact host fallback exception/rejected sibling and complete source scan. Merged guards host-records7/topic-withdraw7/web-authority-unit7/web withdraw9 all pass. A-15737 maps criteria and run limits. Linux x64 droplet Node24.21.0 Neovim0.12.5 isolated Headless Shell156.0.8078.4r1248; T0/T1/all-T2/Web complete, T3 deferred merge batch/T4 unexecuted; uncached, canonical treef1e55b82a07c5491b71cb022aa445cc319795eb1. Lint122/59files and budget/ratchet notices report-only, skip reason report missing0. Reviewer inspection only, no tests/browser/edits. Failed predecessor batch remains failed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-02T12:40:27.543Z

Merged 6d0c8efdaa171187f4b0c7a143fabe3ec7239ac3 onto dev.
