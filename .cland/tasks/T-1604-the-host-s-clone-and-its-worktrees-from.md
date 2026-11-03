---
id: T-1604
kind: task
title: The host's clone and its worktrees from the territory
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1597
  - T-1599
topic: topic-1371
branch: t/T-1604-the-host-s-clone-and-its-worktrees-from
created: 2026-11-02T03:33:56.426Z
updated: 2026-11-03T22:53:36.706Z
---

## Summary

When a host's tunnel is first up, the agent clones the territory into the host's work directory. The clone's `origin` reaches `git.sock` through `cland host git-proxy` as `core.gitProxy`, and a bundle copied over `scp` on the same master is the fallback when the daemon clone fails. A launch on a host fetches its task branch from `origin` and adds the worktree, with the root `node_modules` link. An item launch grants that host the branch's lease.

Hot files: `hub/src/host/ssh-host.ts` (worktreeAdd with territory), `hub/src/host/agent/worktrees.ts`, `hub/src/cli/host.ts` (`git-proxy`), `hub/src/hub/worktrees.ts`, `hub/test/host-clone.test.ts` (new)

## Acceptance criteria

- [x] C1. On a fake host the first clone goes through the git socket with `core.gitProxy` set to `cland host git-proxy`, and no other remote URL or credential is configured (test).
  - done: impl-1604 · 2026-11-03T22:17:00.385Z
  - verified: rev-36 [reviewer] · run rev-36-1604-final-1 · 2026-11-03T22:53:36.230Z · commit 6ba0c4889f862a483a2c303b298b43c50140ce4d
- [x] C2. When the daemon clone fails, the host is cloned from a bundle copied over `scp` on the master, and its `origin` still points at the git socket (test).
  - done: impl-1604 · 2026-11-03T22:25:14.599Z
  - verified: rev-36 [reviewer] · run rev-36-1604-final-1 · 2026-11-03T22:53:36.230Z · commit 6ba0c4889f862a483a2c303b298b43c50140ce4d
- [x] C3. An item launch on a fake host creates the task branch in the territory (as T-1555 does), grants that host its lease, and adds the worktree on the host at the territory's tip (test).
  - done: impl-1604 · 2026-11-03T22:25:14.736Z
  - verified: rev-36 [reviewer] · run rev-36-1604-final-1 · 2026-11-03T22:53:36.231Z · commit 6ba0c4889f862a483a2c303b298b43c50140ce4d
- [x] C4. A worktree add that fails on the host leaves no lease and no territory branch created by the launch behind (test).
  - done: impl-1604 · 2026-11-03T22:17:00.906Z
  - verified: rev-36 [reviewer] · run rev-36-1604-final-1 · 2026-11-03T22:53:36.231Z · commit 6ba0c4889f862a483a2c303b298b43c50140ce4d
- [x] C5. Worktree prune of a host task worktree removes it through that host's agent, and the task-worktrees and worktree-cli test files pass with no test edited (test).
  - done: impl-1604 · 2026-11-03T22:17:01.027Z
  - verified: rev-36 [reviewer] · run rev-36-1604-final-1 · 2026-11-03T22:53:36.231Z · commit 6ba0c4889f862a483a2c303b298b43c50140ce4d

## Notes

Shared files: `hub/src/host/ssh-host.ts` (19 after); the lease API (calls grant)

## Comments

### coord · 2026-11-03T14:32:39.627Z

Carried over from T-1600 (coord decision 2026-11-03 14:32Z): T-1600 writes the canonical remote discovery file at `~/.cland-host/run/hub.json` (`remoteHostLayout.discoveryFile`) when the carrier is first up. It is 0600 and holds the per-host secret only, and launched sessions reach it through `CLAND_HUB_FILE`. The host clone doesn't exist until this item. When this item clones the territory on the host, it must also place the clone's `.cland/hub.json`, with the same content and mode, so that CLI, hook and spoke walk-up discovery from a worktree inside the clone finds it. It must be unchanged across a hub restart. Add a test: a CLI run in a host worktree, with no `CLAND_HUB_FILE`, reaches the hub through it.

### impl-1604 · 2026-11-03T22:02:15.004Z

Consumer inventory before shared-contract changes: WorktreeAdd defined in host/agent/worktrees.ts, re-exported by host.ts; implemented by local.ts, test-host.ts, ssh-host.ts, agent/server.ts and prepared.ts; called by territory.ts (creation/recovery/prune), legacy-worktree-git.ts, Host contract, host-agent-files/prepared/ssh-contract and task-worktrees/worktree-cli tests. SSH registry instantiated in daemon.ts and host-ssh-registry tests. CLI host routing/help in cli/host.ts and bin/cland.ts; git proxy existing built-in module/tests. Remote metadata must be additive so old local Worktree/WorktreeEntry callers (CLI, web, shared/wire, merge cleanup, QA briefs) stay compatible. No wire-shape replacement planned; all existing host contract cases retain local path semantics unless project clone configuration is supplied.

### impl-1604 · 2026-11-03T22:11:15.847Z

Approved seam decisions: SshTransport.copyFile (class only) shares pinned ControlPath, has bounded 10s native lifetime and path-free failure; branch grant reuses only active same-root territory lock, preserving normal contention otherwise. Persistence uses additive host_worktrees table in hub.db, not a new file. Readers/writers are Store.hostWorktrees/save/delete, TaskWorktrees #make/#list/prune, host/task-worktrees add/prune, and host-clone-integration restart test; no preexisting wire shape changed. Before remote add, durable phase=adding is stored; unknown results retain branch/lease/record and refuse relaunch/prune until reconciliation. Protocol-1 WorktreeAdd remains compatible. Native Git proved core.gitProxy is an executable filename; atomically published run/git-proxy wrapper is required.

### coord · 2026-11-03T22:13:01.901Z

Coord decision 2026-11-03 22:13Z (supersedes the re-entrant grant approval of 22:06Z): the public grantBranchLease is unchanged and still rejects inside the territory lock. A new export, grantBranchLeaseLocked, mirrors revokeBranchLeasesLocked: it asserts territoryLockHeld for the same realpath'd root, otherwise throws a named error, and never acquires. Only atomic host launch calls it. The git-proxy wrapper is a 0700 atomic script in the host run folder that execs `cland host git-proxy` (core.gitProxy takes an executable path, not shell source); it is set in the clone config only and contains no secrets. host_worktrees is an additive Store table.

### rev-36 · 2026-11-03T22:22:41.017Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1604-source-1
commit: 97bd21718c7ddd4390f13fbb6276cdcabb6f3254
scope: full
findings: [{"severity":"medium","text":"A ready-record write failure after worktreeAdd succeeds enters the generic rollback, deletes the adding record and revokes/deletes its lease/ref while the accepted remote checkout remains. Preserve ownership/fencing until that checkout is positively removed or its accepted result is durably recorded; add a post-add persistence-failure regression.","file":"hub/src/host/task-worktrees.ts","line":31},{"severity":"medium","text":"ControlPath plus ControlMaster=no permits ordinary SSH fallback when the existing mux socket disappears. The in-memory masterReady check cannot prevent that race, so bundle delivery can create an independent connection instead of requiring the admitted master. Disable native connection fallback and cover master loss during copy.","file":"hub/src/transport/ssh.ts","line":199},{"severity":"medium","text":"HOST_USAGE adds git-proxy but the independent frozen HOST_USAGE in hub/test/fixtures/cli-usage/commands.json is unchanged. The unedited cli-usage-compatibility and native cli-help equality guards therefore disagree at this head; update only the owning frozen block and retain the guards.","file":"hub/src/cli/usage.ts","line":46}]
finding_counts: {"high":0,"medium":3,"low":0}

Source review not clear; three medium findings detailed in A-16366. Reviewed exact head 97bd21718c7ddd4390f13fbb6276cdcabb6f3254. C2/C3 failed; C1/C4/C5 runtime evidence unverified. No tests/probes run by Reviewer. Frozen HOST_USAGE must migrate with the intentional help addition. Correct and request fresh source review before verification.

Criteria: C2 failed (SCP may establish an independent connection after mux loss; same-master delivery is not enforced.), C3 failed (Post-add persistence failure removes durable ownership/lease/ref while the accepted remote checkout remains.).

### impl-1604 · 2026-11-03T22:25:14.867Z

Source correction at 6ba0c4889f862a483a2c303b298b43c50140ce4d: accepted checkout + failed ready checkpoint now keeps adding record/lease/ref fenced (CLAND_HOST_OUTCOME_UNKNOWN), rather than generic rollback. copyFile disables independent SSH fallback via ProxyCommand=false while retaining pinned mux options. Only the owning HOST_USAGE frozen block changed, with guards unedited. Fault cases first observed red: ready record undefined instead of adding, and Missing expected rejection on master-loss copy. After correction host-clone-integration 4/4 (2.27s,1.03s,1.57s,0.88s per test), cli-usage-compatibility 1/1, cli-help 7/7 and root typecheck pass on matching source, macOS local Node 24.21.0, no browser or network. Lint refreshing before fresh review; no verification run submitted.

### rev-36 · 2026-11-03T22:26:15.162Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1604-source-2
commit: 6ba0c4889f862a483a2c303b298b43c50140ce4d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact head 6ba0c4889f862a483a2c303b298b43c50140ce4d; all three A-16366 findings resolved. Accepted checkout metadata failure preserves adding ownership/lease/ref; SCP prohibits independent connection fallback; only owning frozen HOST_USAGE migrates. Both fault regressions and updated docs inspected. See A-16367. C1–C5 remain runtime-unverified; no Reviewer tests/probes/checks ran. Same-head mode-free verification may proceed; final evidence must include named criteria and unchanged preservation receipts with provenance and executed/deferred phases.

### rev-36 · 2026-11-03T22:53:36.231Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1604-final-1
commit: 6ba0c4889f862a483a2c303b298b43c50140ce4d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified, no findings. A-16389 independently matches A-16384 exact-head uncached run7c1005a0 exit0/4931pass; all four generated clone integration outcomes pass, both lease cases, clone2, usage1/help7 and task-worktrees19 finish receipts pass. A-16388 exact-head raw local Darwin arm64 Node24.21 native exit0 confirms unchanged task-worktrees19/worktree-cli4. Linux x64 droplet T1/all fallback T2/changed T3 once/Web complete; local macOS T0 host gate; remaining T3/T4 and affected after-stage QA separate/unexecuted. Head/source unchanged. Isolated HeadlessShell1248 ChromeForTesting156.0.8078.4. Budgets/lint/ratchet/skip checks report-only; missing0. Resource lifetime/cost unknown in receipt. No Reviewer runtime checks/probes/browser/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
