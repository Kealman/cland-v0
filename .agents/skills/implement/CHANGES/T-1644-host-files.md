# T-1644 Host atomic files

Add publishFile (create-only / replace), appendFile and stat with one shared native
implementation; migrate OpenCode ignore, log offsets and rollback; remove local
boundary exemptions. Remote discovery rotates changed host secrets atomically.

Consumer inventory: searched Host imports, fileOperations, writeFile, fileType,
prepareIgnore, hubFileMeta, refusal text, discovery writer and protocol op names
across hub/src including colocated tests, hub/test all tiers, shared, shipped
skills, docs and qa. Production consumers changed: local/ssh/test Host,
agent operations/server mutation admission, OpenCode server/ignore, LaunchFiles,
discovery and transport refusal classification. Existing wire operations and
reply shapes stay unchanged. Other Host users and doubles inherit additive
operations from localHost/testHost and do not need migration. Tests changed:
host-contract (both wrappers), host-agent-files, host-launch-layout,
session-host-placement, host-ssh-contract, remote-discovery(-host), boundary lint.
Unchanged local baselines retain exact bytes/modes. Existing old-shape protocol
controls remain in host-agent / host-prepared tests. Historical stage-3 brief is
annotated; current subsystem and file-test references describe the new behavior.
No CLI setting, permission or role clause changes.

## Complete import inventory

The following consumers either migrate above or keep the unchanged existing Host
methods/replies. Test doubles use spreads; strict typecheck checks additive coverage.

- `hub/test/host-boundary.test.ts`
- `hub/test/transport-ssh.test.ts`
- `hub/test/transport-records.test.ts`
- `hub/src/hub/store.ts`
- `hub/src/hub/artifact-upload.ts`
- `hub/src/hub/dispatch.ts`
- `hub/src/hub/core.ts`
- `hub/test/name-reservation.test.ts`
- `hub/src/hub/artifacts.ts`
- `hub/test/launch-files.test.ts`
- `hub/test/host-supervisor.test.ts`
- `hub/src/hub/worktrees.ts`
- `hub/src/hub/daemon.ts`
- `hub/test/lifecycle-serialization.test.ts`
- `hub/src/system-processes.ts`
- `hub/test/transport-status.test.ts`
- `hub/test/codex-sandbox-host.test.ts`
- `hub/test/session-host-routing.test.ts`
- `hub/test/host-ssh-contract.test.ts`
- `hub/test/host-contract.ts`
- `hub/test/session-host.test.ts`
- `hub/test/host-local-contract.test.ts`
- `hub/test/project-hub.test.ts`
- `hub/test/host-secret-admission.test.ts`
- `hub/test/territory-task-branch.test.ts`
- `hub/test/host-prepared.test.ts`
- `hub/test/codex-host.test.ts`
- `hub/test/transport-forwards.test.ts`
- `hub/test/host-ssh-registry.test.ts`
- `hub/test/opencode-host.test.ts`
- `hub/test/lead-permissions-component.test.ts`
- `hub/src/territory.ts`
- `hub/test/transport-contract-fixture.ts`
- `hub/test/host-command-environment.test.ts`
- `hub/src/host/command-environment.ts`
- `hub/src/host/legacy-worktree-git.ts`
- `hub/test/worktree-host.test.ts`
- `hub/src/host/test-host.ts`
- `hub/src/host/registry.ts`
- `hub/src/accounts/poller.ts`
- `hub/src/host/local.ts`
- `hub/src/transport/transport.ts`
- `hub/src/transport/ssh.ts`
- `hub/test/fixtures/tracker-snapshot/items.json`
- `hub/src/adapters/opencode/server.ts`
- `hub/src/host/ssh-host.ts`
- `hub/src/host/process-host.ts`
- `hub/test/host-records.test.ts`
- `hub/src/adapters/opencode/ignore.ts`
- `hub/src/host/remote-layout.ts`
- `hub/src/adapters/sessions.ts`
- `hub/src/adapters/index.ts`
- `hub/src/adapters/codex.ts`
- `hub/src/adapters/opencode.ts`
- `hub/src/adapters/claude-code-local.ts`
- `hub/src/adapters/claude-code.ts`
- `hub/src/adapters/launch-files.ts`
- `hub/src/adapters/contract.ts`
- `hub/test/host-agent-files.test.ts`
- `hub/test/fake-ssh.test.ts`
- `hub/test/claude-code-host.test.ts`
- `hub/src/init/config.ts`
- `hub/test/remote-discovery-host.test.ts`
- `hub/test/ssh-host-fixture.ts`
- `hub/test/host-local-liveness.test.ts`
- `hub/test/host-launch-layout.test.ts`
- `hub/test/artifact-host.test.ts`
- `hub/test/fakes/fake-ssh-common.ts`
- `hub/test/fakes/fake-host.ts`

## Source review corrections

SSH publish/append now use prepared file kinds, sharing parseAgentFile with the
original direct RPCs. PreparedOperations owns validation, commit, durable result,
startup recovery and close; server records file-token owners and fences them at
native stream close. Interrupted committing-file recovery remains pending,
never replays or cleans a possibly accepted effect. Existing non-file kinds and
wire results are unchanged. Tests cover actual-agent held writes, lost accepted
replies, cross-stream mutation refusal, exact-once final bytes and interrupted
restart ownership. Renamed duration keys were removed with no replacement
measurements; unrelated baselines/allowances stay intact.
