---
id: T-1593
kind: task
title: The host agent's file, command and worktree operations
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1588
topic: topic-1349
branch: t/T-1593-the-host-agent-s-file-command-and
created: 2026-11-02T03:33:53.695Z
updated: 2026-11-03T09:58:39.567Z
closed: 2026-11-03T01:19:57.526Z
---

## Summary

The agent answers the Host's file and command operations on its host. These are run (a short command with output and a timeout), statDirectory with device and inode, realpath, fileType, readFile (bounded size), listFolder, writeFile with a mode, makeDirectory, removePath, freePort on loopback, occupants, and worktreeAdd and worktreeRemove in a given root with the root `node_modules` link.

Hot files: `hub/src/host/agent/` (`files.ts`, `worktrees.ts`, the op table), `hub/test/host-agent-files.test.ts` (new)

## Acceptance criteria

- [x] C1. run returns exit code, stdout and stderr and kills the command at its timeout, and statDirectory, realpath, fileType, readFile and listFolder give the same answers as the `local` host for the same fixtures (test).
  - done: impl-1593 · 2026-11-02T23:54:46.894Z
  - verified: rev-36 [reviewer] · run rev-36-1593-final-1 · 2026-11-03T00:17:16.763Z · commit 9ab8f82608bdab9d9b494245f75ba522c072f28d
- [x] C2. readFile refuses a directory, a missing path and a file over the size cap, and transfers exact bytes (test).
  - done: impl-1593 · 2026-11-02T23:46:59.942Z
  - verified: rev-36 [reviewer] · run rev-36-1593-final-1 · 2026-11-03T00:17:16.763Z · commit 9ab8f82608bdab9d9b494245f75ba522c072f28d
- [x] C3. writeFile, makeDirectory and removePath act only on the given path with the given mode, and removePath never follows a symlink out of it (test).
  - done: impl-1593 · 2026-11-02T23:47:01.191Z
  - verified: rev-36 [reviewer] · run rev-36-1593-final-1 · 2026-11-03T00:17:16.763Z · commit 9ab8f82608bdab9d9b494245f75ba522c072f28d
- [x] C4. In a scratch repository worktreeAdd adds a worktree on the given branch with the root `node_modules` link and today's stale-install warning, and worktreeRemove removes it and refuses one with changes (test).
  - done: impl-1593 · 2026-11-02T23:47:01.442Z
  - verified: rev-36 [reviewer] · run rev-36-1593-final-1 · 2026-11-03T00:17:16.763Z · commit 9ab8f82608bdab9d9b494245f75ba522c072f28d
- [x] C5. occupants answers by real paths, including through a symlinked alias, as the `local` host does (test).
  - done: impl-1593 · 2026-11-02T23:47:02.851Z
  - verified: rev-36 [reviewer] · run rev-36-1593-final-1 · 2026-11-03T00:17:16.763Z · commit 9ab8f82608bdab9d9b494245f75ba522c072f28d

## Notes

Shared files: the agent protocol module (ops)

## Comments

### impl-1593 · 2026-11-02T23:42:01.635Z

Rule 20 inventory before edits: agent/server.ts dispatch, agent-client.ts generic request, cli/host.ts bootstrap, agent/protocol.ts framing and host-agent{,-boundary}.test.ts consume protocol. New ops are additive, protocol=1 and existing process replies/unknown-op refusal retained. Host consumers: local.ts, host.ts/test.ts, adapters sessions/claude-code/codex/opencode, hub/worktrees/dispatch/artifacts/artifact-folder/artifact-lifecycle, territory, session-checkpoint, process identity/usage and Host test doubles. Shared helper consumers: adapters/session-cwd.ts (statDirectory); hub/artifact-folder.ts (folderFiles with ArtifactError and resumed callback); host/occupants.ts; host/worktree-install.ts; doctor/report.ts run/probeTimeout (many doctor/executor/CLI/test callers). Plan: share built-in implementations under agent with compatibility exports preserving all old import paths/error classes/callbacks; local Host behavior unchanged. Search covered field/function names plus importers across hub/src, hub/test every tier, web/nvim/shared, QA briefs, skills and docs. No persisted file/wire reader migrates; old process client regression remains unedited. New file wire uses base64 exact bytes and explicit cap below 1MiB frame; T-1600 SSH Host will consume additive ops.

### impl-1593 · 2026-11-02T23:47:03.763Z

Implementation head 04298016a9fbba7477f1ad653dd4d474944a8135 pushed. Contract inventory durable A-15997; shared helpers migrated with compatibility exports, existing process wire remains unchanged. Local macOS arm64 Node24.21.0 68/68 targeted cases across 7 files pass (5 new +63 unchanged), typecheck and lint exit0 (advisories report-only). Full tiers/Linux/Web not run. No launch layout change; modDir remains ssh Host stage. Fresh origin/dev 986afe46b fetched/merged (already up to date), merge-tree exit0. Source review requested next; after-stage QA policy, no per-item QA brief.

### rev-35 · 2026-11-02T23:52:07.142Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1593-source-1
commit: 04298016a9fbba7477f1ad653dd4d474944a8135
scope: full
findings: [{"severity":"medium","text":"Teardown is registered only after serveAgent and AgentClient.connect both succeed. A failed/timed-out authentication connection after server startup leaves its listening socket, memory/recovery work and scratch root with no cleanup hook; a setup failure can hang the suite or leak writers. Register ownership immediately as resources are acquired (or use the shared cleanup stack), stop/drain agent before deleting root, and add a bounded failed-connect/setup control (rule12).","file":"hub/test/host-agent-files.test.ts","line":19},{"severity":"low","text":"The newly exposed run RPC inherits an unbounded stdout/stderr collector; the 1MiB response cap in server.ts:79 is checked only after command completion and JSON allocation. A noisy command can consume far more memory before the documented frame refusal. Bound collection for RPC callers and retain explicit overflow/cleanup reporting; keep legacy doctor caller behavior deliberate.","file":"hub/src/host/agent/command.ts","line":71}]
finding_counts: {"high":0,"medium":1,"low":1}

T-1593 full source review at 04298016a9fbba7477f1ad653dd4d474944a8135, branch tip verified. Live claimant impl-1593; item C1–C5/body/inventory read. Fixed comparison origin/dev...04298016; one item commit, no edits by Reviewer.

## Standards

One medium and one low:
- hub/test/host-agent-files.test.ts:19: Teardown is registered only after serveAgent and AgentClient.connect both succeed. A failed/timed-out authentication connection after server startup leaves its listening socket, memory/recovery work and scratch root with no cleanup hook; a setup failure can hang the suite or leak writers. Register ownership immediately as resources are acquired (or use the shared cleanup stack), stop/drain agent before deleting root, and add a bounded failed-connect/setup control (rule12).
- hub/src/host/agent/command.ts:71: The newly exposed run RPC inherits an unbounded stdout/stderr collector; the 1MiB response cap in server.ts:79 is checked only after command completion and JSON allocation. A noisy command can consume far more memory before the documented frame refusal. Bound collection for RPC callers and retain explicit overflow/cleanup reporting; keep legacy doctor caller behavior deliberate.

The setup failure is blocking: the new shared fixture owns a live server before registering cleanup. AgentClient.connect cleans up its own failed client, not the server's timers/socket. Agent.close owns timer cancellation, pending request/process drain and listener closure; it must run even if fixture construction throws. This concerns new T3 fixture lifecycle, not an observed runtime failure. Use an early shared ownership stack and an injected post-startup connection failure to prove cleanup.

Output collection is a low follow-up in the shared pre-existing helper newly reachable via RPC; the documented post-completion cap remains enforced, so it does not block the five ordinary feature criteria.

## Spec

No production behavior mismatch found in inspected C1–C5 paths. Additive authenticated operation dispatch leaves protocol1/hello/process operation names and unknown-op handling intact. Success replies enforce MAX_LINE_BYTES; canonical-base64 512KiB read/write caps leave frame headroom. boundedRead opens once, checks regular-file size and caps actual bytes, closes in finally; directory/missing/oversize refusals and exact bytes covered by new source tests. File mutators retain existing single-path/mode/truncate/rmdir semantics; unlinking a symlink preserves its target. Canonical occupants and sibling exclusion share local logic. Worktree ops preserve root link/stale warning/dirty Git remove and optional territory/reuse/detached behavior; beforeInstall remains a local callback and is explicitly absent from wire.

Independently compared pinned old/new blobs: occupants and worktree-install moved byte-for-byte; command body moved byte-for-byte. statDirectory preserves old refusal/identity logic. Artifact-folder wrapper retains ArtifactError class/code and resumed callback around moved traversal; localHost overrides listFolder with the compatibility wrapper. Existing import paths remain exports. Host WorktreeAdd type extraction does not change shape.

Rule20 inventory A-15997 and item comment cover protocol/client/CLI, local/test Host callers, adapter/worktree/territory/artifact/doctor consumers, fixtures/QA/docs and all test tiers. Existing process-wire, local Host, worktree, doctor and artifact regressions are unedited. Matching subsystem/per-test docs and tier entry added. No dependency or new role grant.

Five new T3 generated cases cover file parity/refusals/cap, mutation/modes/symlink/freePort, canonical occupants, command output/timeout and Git worktree behavior. Fixture uses shared filtered scratch environment. Normal teardown drains before root removal, but setup failure bypasses it (medium above). No runtime test/typecheck/lint/browser executed by Reviewer. Implementer reports macOS arm64 Node24.21 68 targeted passes/typecheck/lint; full queued/Linux/Web evidence absent. None counted as a queued pass.

Verdict not clear due to rule12 fixture ownership. C1 failed test-lifecycle verification: native-agent fixture has no teardown on post-startup connection failure; this is not a reported command implementation failure. All other runtime criteria remain unverified. Fix and fresh source review before verification. After-stage QA unchanged.

Totals: Standards2 (worst medium); Spec0.

A-16003: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16003-t-1593-source-review-fixture-setup-ownership.md

Criteria: C1 failed (New native-agent fixture registers teardown only after connection succeeds; setup failure after agent startup leaves live socket/timers/root without a cleanup owner (rule12).).

### impl-1593 · 2026-11-02T23:53:47.661Z

A-16003 remediation: new failed-connect regression first failed with actual directory vs expected missing ('failed setup must finish owned cleanup before rejecting'). Fixture now registers cleanup immediately after root acquisition, joins in-flight setup, closes client/drains server before root removal, and cleans before rethrowing setup failure. Regression independently owns fallback cleanup and observes native socket refusal after removal. New file 6/6 passes locally macOS arm64 Node24.21.0; final typecheck exit0, lint rerunning. Production unchanged from source head 04298016a; low unbounded-output finding deferred by Coordinator to T-1645. Fresh source review before verification; no dev merge.

### rev-36 · 2026-11-02T23:56:00.988Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1593-source-2
commit: 9ab8f82608bdab9d9b494245f75ba522c072f28d
scope: full
findings: [{"severity":"low","text":"The run RPC still collects unbounded stdout/stderr before server response-size validation. Coordinator deferred this pre-existing helper concern to T-1645 (Tech debt S), preserving doctor behavior.","file":"hub/src/host/agent/command.ts","line":71}]
finding_counts: {"high":0,"medium":0,"low":1}

# T-1593 corrected source review

Head: 9ab8f82608bdab9d9b494245f75ba522c072f28d
Prior source: rev-35-1593-source-1 / A-16003 at04298016a9fbba7477f1ad653dd4d474944a8135.
Run rev-36-1593-source-2; scope full; clear with one low.

## Standards

Blocking fixture finding resolved. The complete correction touches only host-agent-files.test.ts and its guide. Cleanup ownership is registered immediately after mkdtemp, before boot write, serveAgent or connect. Its single shared closing promise joins setup even on cancellation, closes the acquired client, awaits server.close (listener/timers/in-flight requests/process drain), then removes the root. Setup rejection awaits this cleanup before rethrowing. No acquisition/teardown await cycle is introduced: cleanup observes the already-settled setup promise on the rejection path.

The sixth generated test injects authenticated setup failure after obtaining the live server; the wrong-secret native client supplies the concrete rejection. It then asserts the scratch root is missing and observes a native socket close with ENOENT/ECONNREFUSED. The observer is armed before socket connect and keeps its final assertion. Independent fallback cleanup owns the red control; test timeout bounds the campaign. The original five feature assertions remain unchanged. A-16007 reports red actual-directory-versus-missing and corrected six-case local pass; these are targeted observations, not queued evidence.

Low retained: hub/src/host/agent/command.ts:71 collects unbounded stdout/stderr before server.ts frame-size validation. Coordinator decision3f46904f filed T-1645 (Tech debt S), deliberately preserving legacy doctor behavior. No high or medium findings remain.

## Spec

No production mismatch found; production is byte-identical to prior reviewed04298016a. Rechecked additive authenticated operation dispatch, shared local file/worktree helper adoption, canonical 512KiB base64 read/write bounds and native timeout close behavior. Protocol1/process operation shapes remain unchanged. Bounded read uses one open handle with regular-file check, size and actual-read caps and finally close. Mutators preserve mode/truncate/symlink rules; worktree operations share existing install and dirty-remove behavior. Artifact compatibility wrapper preserves ArtifactError and resumed callback. Earlier source assessment of unchanged occupants/helper movement remains applicable. Item consumer inventory and relevant docs/tier registration are present.

## Verification boundary

C1 source lifecycle failure is resolved; C1–C5 remain runtime-unverified pending same-head post-source cland verify and named required facts. A-15998's 63 preservation passes belong to the prior head; A-16007's six-case macOS arm64 Node24.21.0 result is targeted and supplies no full Linux/Web/tier claim. Carry the prior-head evidence honestly if appropriate, and identify every newly executed case/platform at final review. No dev merge since first review. QA affected/after-stage; no per-item QA. Reviewer ran no tests/browser and made no edits.

### impl-1593 · 2026-11-03T00:16:44.407Z

Exact-head run 29e8fcfc-e10d-4350-aeda-141aa3b2d3a4 / A-16030 exit0, 4840/4840 reported pass; uncached (provenance cached:null), head 9ab8f82608bdab9d9b494245f75ba522c072f28d. Linux x64 6.8.0-142-generic, droplet c-8 sfo2, Node24.21.0/Nvim0.12.5; Chrome Headless Shell1248 Google Chrome for Testing156.0.8078.4. T0/T1/fallback all T2/changed T3 (one file, six passing test identities)/Web completed. Remaining T3 deferred to merge batch; T4/repetitions unexecuted. Streamed A-16030 named finish facts independently: C1/C2 bounded exact reads, C3 modes/symlink/freePort, C5 real-path occupants, C1 command timeout/output, C4 worktree warning/dirty refusal, and failed-connect cleanup all pass (six test records plus file receipt). Duration/lint/ratchet/skip-reason advisories report-only; missing skip reasons0. Droplet lifetime1016s cost$0.0705 (lifetime is not suite wall time). Prior local preservation evidence remains labeled prior-head A-15998. Fresh origin/dev fetch3536669d515e64e225b69c7abdf4f46e69ba9c39, merge-tree exit0/tree323f15ca238b66aee63bfa23ee22205f01ea8046; head unchanged, no dev merge, working tree clean.

### rev-36 · 2026-11-03T00:17:16.763Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1593-final-1
commit: 9ab8f82608bdab9d9b494245f75ba522c072f28d
scope: evidence
findings: [{"severity":"low","text":"The run RPC still collects unbounded stdout/stderr before server response-size validation. Coordinator deferred this pre-existing helper concern to T-1645 (Tech debt S), preserving doctor behavior.","file":"hub/src/host/agent/command.ts","line":71}]
finding_counts: {"high":0,"medium":0,"low":1}

# T-1593 final evidence review

Head9ab8f82608bdab9d9b494245f75ba522c072f28d, branch tip independently unchanged. Run rev-36-1593-final-1, scope evidence; clear with one retained low. Source rev-36-1593-source-2/A-16008. C1–C5 verified.

## Standards

Low retained at hub/src/host/agent/command.ts:71: run buffers unbounded stdout/stderr before reply-size validation; Coordinator-filed T-1645 (Tech debt S), preserving existing doctor behavior. No high/medium findings. Fixture setup ownership correction has an actual passing native failure-path case in this run. Earlier A-15998 preservation is explicitly prior-head macOS evidence, not relabeled as current Linux execution.

## Spec

Independently streamed all six actual A-16030 generated timing outcomes, each pass:
1. agent C1/C2 file reads match local and transfer exact bounded bytes — local metadata/list parity; all256 byte values; inclusive512KiB; directory/missing/oversize/canonical-base64 refusals.
2. agent C3 mutations preserve modes, single-path and symlink boundaries; freePort releases loopback — exact mode/bytes/truncate, nonempty directory refusal, symlink target retained and returned port rebound.
3. agent C5 occupants matches local real paths through aliases and excludes siblings — exact canonical names and sibling exclusion.
4. agent C1 short command output and timeout match local — exit7/stdout/stderr parity and bounded timeout native-close result without incomplete cleanup.
5. agent C4 worktrees share root install, preserve stale warning and refuse dirty removal — actual scratch Git, root node_modules link, stale warning, reuse parity and dirty-remove refusal then successful removal.
6. agent fixture drains server and removes root after failed connection setup — rejected wrong-secret setup observes removed root and refused native socket after cleanup.

Additionally current-run preservation receipts include unchanged host-agent-boundary2, doctor-run5, artifact-folders7, doctor20 and contract-coverage4. A-15998's host-local-contract14/worktree-host17/host-agent18 are prior-head targeted observations; these unselected T3 files are not claimed current-run passes. Required item behavior is independently covered by the six current Linux cases.

## Run provenance and limits

29e8fcfc-e10d-4350-aeda-141aa3b2d3a4/A-16030 exit0,4840pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/changed host-agent-files T3/Web completed. Six T3 identities had one base execution, no repetitions; remaining T3 merge-batch deferred,T4 unexecuted. Task evidence, not a full all-tier occasion.

Recorded verification tree684f51fda8fbb82022c097b94a80724466edd75c; uncached droplet c-8sfo2, Linuxx64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5, workers2. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Budget/lint/ratchet/skip checks report-only, skips[]/missing0/occasion null. Native lifetime1016s/$0.0705 are resource facts, not test-only wall time. QA after-stage unchanged. Reviewer ran no tests/browser and made no source edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-03T01:19:57.526Z

Merged 53ecaf87343b3719a51f09f818871bcfb70272cf onto dev.

### coord · 2026-11-03T09:58:39.567Z

Seam note (T-1599, coord decision 2026-11-03 09:58Z): the agent protocol gains additive two-phase operations (prepare/capture/install), so the ssh Host can run the Host contract's hub-side callbacks at their contract points: spawn authorize after the remote log opens, stop authorize/beforeSignal after the agent captures the process tree, worktree beforeInstall after Git. The existing monolithic spawn/stop/worktreeAdd frames and their tests stay unchanged. A prepared operation expires on a deadline and on agent restart, and its partial state is cleaned. The agent advertises the capability in its hello, and a hub meeting an agent without it refuses that host, naming the missing capability; it never falls back silently.
