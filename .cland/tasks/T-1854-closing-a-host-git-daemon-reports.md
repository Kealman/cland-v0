---
id: T-1854
kind: task
title: Closing a host git daemon reports 'termination incomplete' for a daemon that already exited (Linux)
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1507
branch: t/T-1854-closing-a-host-git-daemon-reports
created: 2026-11-14T09:48:29.281Z
updated: 2026-11-14T10:35:20.534Z
---

## Summary

`hub/test/host-git-daemon.test.ts` "eight admitted daemons per host; excess is refused, logged and close joins native exits" failed in the E-1537 stage-2 Linux droplet cover 61ab02b2 at dev 5757ea8dd (log A-19324, shard-2, linux x64, Node 24.21, 2 workers) with `Error: Git daemon termination incomplete` at hub/src/host/git-daemon.ts:79, after 107 ms. It passed 5/5 alone on macOS (2026-11-14 09:5xZ) and in the stage-1 Linux cover on 2026-11-12. The code and test are unchanged since T-1597.

## Suspected cause (inferred, not yet proven)

`stop()` throws when `!completed && (!proof || !await native.stop(proof))`. `completed` is set only in the child's `close` handler. If a git daemon exits on its own (or after `socket.destroy()`/`stdin.destroy()`) before its `close` event has been delivered, `native.identity` may have resolved to null or `native.stop` may find no process to stop. That would raise "termination incomplete" for a daemon that actually terminated. This is a product shutdown race, not a test timing issue, and it may be Linux-specific (process reaping/identity timing).

## What to build

Reproduce on Linux (Docker, `--init --network none`, repeated runs of the case) and name the cause. Then make close distinguish "already exited or exiting" from "termination could not be proven": wait for the child's close, bounded, before declaring termination incomplete, without weakening the guarantee that a still-running daemon is stopped and that a missing identity proof for a live process still fails. Fakes and disposable roots only.

## Acceptance criteria

- [x] C1. A deterministic test (controlled ordering of child exit, identity probe and stop) reproduces "termination incomplete" for a daemon that has already exited, and the fix makes it pass while a live daemon without an identity proof still fails close (test).
  - done: impl-1854 · 2026-11-14T10:01:49.745Z
  - verified: rev-35 [reviewer] · run rev-35-1854-final-1 · 2026-11-14T10:35:20.388Z · commit b192a00207386444179b192c2daa7455c611c48d
- [x] C2. The case passes 20 repetitions under Linux in Docker and 5 lone repetitions on macOS, plus the task's mode-free verify (test).
  - done: impl-1854 · 2026-11-14T10:01:49.922Z
  - verified: rev-35 [reviewer] · run rev-35-1854-final-1 · 2026-11-14T10:35:20.388Z · commit b192a00207386444179b192c2daa7455c611c48d

## Comments

### coord · 2026-11-14T09:56:24.730Z

Moved into R-1530 by ask d641172c (human, 2026-11-14 09:56Z): fix before rerunning the E-1537 stage-2 cover pair on a new tip.

### impl-1854 · 2026-11-14T09:58:45.420Z

Rule 20 consumer census before change: startGitDaemon.close production owner is host/registry.ts (open rollback, remove, owner close, aggregate cleanup); internal socket-close/stdout-error/chmod-failure call stop. Direct native tests: host-git-daemon, worktree-host, host-clone-integration, host-relaunch, host-relaunch-native, host-relaunch-retry, host-push-on-ref-move; host-allow-list injects daemon owner. Host.stop outcome consumed here from localHost/endProcess (generic Host consumers retain existing boolean contract). Search across hub/src, hub/test all tiers, docs, qa and shipped skills found no additional daemon-close shape consumers. No wire, persisted-record or agent protocol changes intended; existing callers remain compatible.

### impl-1854 · 2026-11-14T10:02:00.163Z

Implementation pushed b192a00207386444179b192c2daa7455c611c48d; origin/dev merge before first review was already current. Evidence A-19330. C2 done mark records implemented criterion and completed targeted repetitions; required exact-head mode-free local verify remains pending source review and must pass before ready. Full T3 is merge-batch evidence and Linux full suite is stage-cover evidence, neither claimed here.

### impl-1854 · 2026-11-14T10:06:37.277Z

Review evidence supplement A-19334 supersedes A-19330 provenance gaps: 974 normalized manifest/source test roots; reached 660 union unknown 17 union explicit gives 679 per-path dispositions in census.json. Actual parent 1c5cd82c5 (5757ea8dd was original stage failure). Native/default consumer chain enumerated in PROVENANCE.md. Preserved original five producer logs, reconstructed scheduling sources labelled, current candidate production/test byte matches reviewed head. Original Mac5 sequential iterations lack proof of no brief Docker overlap; replacement exclusive-slot Mac5 acceptance evidence remains required, as does mode-free local verify after source clear. No provenance-only runtime rerun; reviewed head b192a0020 unchanged.

### rev-35 · 2026-11-14T10:09:38.462Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1854-source-1
commit: b192a00207386444179b192c2daa7455c611c48d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear, no findings. A-19335 records captured identity/authority preserved, bounded post-stop close join, live/no-close refusal, ordered T1 controls, docs/guide/index, and native/default cleanup callers. A-19334 independently corroborates controlled Linux exit/null-identity/reject/close ordering,20 controlled+20 normal green cases and matching fixed production bytes, with original capture/reconstruction/image/candidate limits retained. Conservative679-path census/17unknown flags normalizes correctly; scan14 file hashes match. C2 is not complete: earlier Mac5 overlap cannot be excluded, so five substantive exclusive-slot lone Mac acceptance runs and exact-head mode-free verify remain pending. No provenance-only Linux rerun requested. Broader T3/full Linux/stage evidence separate; Reviewer read-only.

### impl-1854 · 2026-11-14T10:10:57.015Z

C2 replacement acceptance A-19337: exclusive preservation-lock Mac5 at source-clear b192a0020 all native return 0 and one passing capacity case each, retained runner/argv/cwd/completion/logs and positive-control secret scan. Docker ps empty before/after, local queue empty, load 2.53 to 2.72, scratch inventory unchanged 15625. Earlier Mac5 overlap remains qualified. Mode-free local verify admitted f2043f79-dcb5-4016-bbb4-e9220ebbca5b at same head, pending hub receipt.

### impl-1854 · 2026-11-14T10:31:43.745Z

Exact source-reviewed head b192a00207386444179b192c2daa7455c611c48d mode-free local verify f2043f79-dcb5-4016-bbb4-e9220ebbca5b passed (A-19344): 6259 tests/pass, 0 failed/cancelled/skipped/todo. T0, all T1, fallback all T2 and Web completed. Executor local darwin arm64 Node 24.21.0 Neovim 0.12.5; browser Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4 (playwright chromium_headless_shell-1248). Coverage unsupported docs path caused full-T2 fallback; budget and test-lint findings are report-only. No cache hit; remaining T3 deferred to local merge batch, full Linux to stage cover, T4 not run here. Replacement exclusive-slot Mac5 A-19337 and retained Linux evidence A-19334 complete targeted criterion evidence. T-1855 notified machine suite ended. Reviewer receives same-head result directly for final settlement; head remains unchanged.

### rev-35 · 2026-11-14T10:35:20.388Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1854-final-1
commit: b192a00207386444179b192c2daa7455c611c48d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-19347 records independent audit of A-19334 controlled Linux red/fixed 20 controlled+20 normal passes, replacement exclusive-slot Mac5 A-19337 native return0 and named-case passes, and exact-head configured f2043f79/A-19344. Five T1 controls each pass base plus5 load; 6259 ordinary test/692 ordinary file passes, separate150 load test/file positives, no negative finishes. All selected consumers positive:31T1+342T2+54Web;679 census paths/17unknowns retained. Captured child close remains required; live/no-close refuses. Earlier Mac overlap, Docker/candidate/raw-capture limits remain explicit, not retroactively repaired. Broader T3/full Linux stage/T4 unexecuted; budget/lint remain report-only. Clean unchanged head; Reviewer read-only.

Criteria: C1 verified, C2 verified.
