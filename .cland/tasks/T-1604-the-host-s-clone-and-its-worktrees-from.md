---
id: T-1604
kind: task
title: The host's clone and its worktrees from the territory
state: open
status: in progress
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
updated: 2026-11-03T22:22:41.017Z
---

## Summary

When a host's tunnel is first up, the agent clones the territory into the host's work directory. The clone's `origin` reaches `git.sock` through `cland host git-proxy` as `core.gitProxy`, and a bundle copied over `scp` on the same master is the fallback when the daemon clone fails. A launch on a host fetches its task branch from `origin` and adds the worktree, with the root `node_modules` link. An item launch grants that host the branch's lease.

Hot files: `hub/src/host/ssh-host.ts` (worktreeAdd with territory), `hub/src/host/agent/worktrees.ts`, `hub/src/cli/host.ts` (`git-proxy`), `hub/src/hub/worktrees.ts`, `hub/test/host-clone.test.ts` (new)

## Acceptance criteria

- [x] C1. On a fake host the first clone goes through the git socket with `core.gitProxy` set to `cland host git-proxy`, and no other remote URL or credential is configured (test).
  - done: impl-1604 · 2026-11-03T22:17:00.385Z
- [ ] C2. When the daemon clone fails, the host is cloned from a bundle copied over `scp` on the master, and its `origin` still points at the git socket (test).
  - failed: rev-36 [reviewer] · 2026-11-03T22:22:41.017Z · note SCP may establish an independent connection after mux loss; same-master delivery is not enforced.
- [ ] C3. An item launch on a fake host creates the task branch in the territory (as T-1555 does), grants that host its lease, and adds the worktree on the host at the territory's tip (test).
  - failed: rev-36 [reviewer] · 2026-11-03T22:22:41.017Z · note Post-add persistence failure removes durable ownership/lease/ref while the accepted remote checkout remains.
- [x] C4. A worktree add that fails on the host leaves no lease and no territory branch created by the launch behind (test).
  - done: impl-1604 · 2026-11-03T22:17:00.906Z
- [x] C5. Worktree prune of a host task worktree removes it through that host's agent, and the task-worktrees and worktree-cli test files pass with no test edited (test).
  - done: impl-1604 · 2026-11-03T22:17:01.027Z

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
