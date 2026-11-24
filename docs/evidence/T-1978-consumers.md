# T-1978 consumer inventory

Search: PreparedOperations, prepare-spawn/stop/worktree/publishFile/appendFile/
moveDirectory, commit-prepared, settle-prepared, committing, and the unknown
commit reason strings across hub/src, hub/test (all tiers), nvim/test, web/test,
docs and shipped .agents/skills. No wire fields, persisted shapes or CLI text change.

| Plan kind | Production caller and disposition |
| --- | --- |
| publishFile | ssh-host.ts publishFile → server.ts prepare-publishFile/commit-prepared; newly protected from committing re-entry (create-only and replace). |
| appendFile | ssh-host.ts appendFile → server.ts prepare-appendFile/commit-prepared; newly protected. |
| moveDirectory | ssh-host.ts moveDirectory → server.ts prepare-moveDirectory/commit-prepared; existing refusal preserved. |
| spawn | ssh-host.ts spawn → server.ts prepare-spawn/commit-prepared; committing re-entry now refuses; settlement still uses operationReceipt. |
| stop | ssh-host.ts stop → server.ts prepare-stop/commit-prepared; committing re-entry now refuses; captured-tree settlement unchanged. |
| worktree | ssh-host.ts worktreeAdd → server.ts prepare-worktree/commit-prepared; committing re-entry now refuses; git-running fence and checkout recovery unchanged. |
| run | server.ts run-host and login-disk use runCommand, not commit; its committing plan cannot enter commit again. Command completion and settlement unchanged. |

Direct writeFile/truncate, direct publish/append compatibility RPCs, log opens
and other agentOperations paths do not call PreparedOperations.commit and are
unaffected. Truncation is not a separate prepared kind.

Production importers are server.ts (owner) and agent/closure.json (packaging).
The manifest pins exact runtime file bytes: regenerated with
`node hub/bin/generate-host-agent-closure.ts` for the new prepared.ts hash.
package.ts validates those hashes in agentBundle; host code-delivery.ts and
adapters/processes.ts consume that bundle without a shape change.
host-agent-closure.test.ts checks the full frozen graph and hashes (T1);
host-agent-restart.test.ts exercises delivered bundles (T3). Both consume the
regenerated manifest, rather than treating packaging as unaffected.
ssh-host.ts already settles failed/lost commits instead of recommitting. AgentClient
transports opaque requests; no reply shape changes. Previous-agent hello-shape
coverage remains in opencode-host.test.ts.

Tests/fixtures: opencode-host.test.ts adds publish/append cases alongside existing
move cases. host-prepared.test.ts retains interrupted file, spawn, worktree and
Git-writer coverage. host-ssh-contract.test.ts and ssh-host-fixture.ts drop commit
replies to test settlement. host-agent.test.ts, host-command-environment.test.ts,
host-ref-watch-recovery.test.ts, host-revoke-native.test.ts,
host-login-disk.test.ts, login-key-spawn.test.ts and claude-code-remote.test.ts use
the same unchanged RPCs; no consumer migration required. No nvim/web raw reader
or frozen CLI usage bytes depend on the guard. T3 evidence remains T3.

Docs: ssh-host.md, host-agent.md and the opencode-host test guide describe the
guard. Existing claude-code-remote test guidance, docs/evidence/T-1741-consumers.md
and implement CHANGES/T-1599-consumers.md, T-1607-release-loss-20-runs.md,
T-1644-host-files.md and T-1607-review-corrections.md record unchanged receipt
flows or historical evidence. No skill procedure or role permission changes.

Raw persisted-result search additionally finds host-clone-integration.test.ts
and host-ssh-contract.test.ts reading prepared-results JSON for accepted native
command cancellation. Their runCommand receipt shape and outcome are unchanged.
T-1607-shared-stop-budget.md and T-1607-remote-claude.md also record unchanged
native command/stop contracts. Other `prepared/committing` hits in host/executor
image preparation, suite-candidate, setup-hosts and tracker snapshot fixtures
describe different concepts, not PreparedOperations plans.
