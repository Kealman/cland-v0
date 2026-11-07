# T-1741 contract consumer inventory

Search terms: AgentReply, availableBytes, prepare-spawn, commit-prepared, settle-prepared, PreparedOutcome, AgentProcesses, serveAgent, agent-client, ssh-host. Searched production, all test tiers, docs including QA briefs, and shipped skills before editing.

Migrated: agent/server, processes, protocol, prepared, agent-client and ssh-host. New optional refusal fields preserve existing reply and persisted failed-outcome shapes. Registry memory-event consumption is unchanged. Other production callers, raw socket readers, fixtures, probes, historical evidence and tests below use unchanged success replies, event fields or generic error text, so require no migration. Old protocol-1 hello and fieldless failure remain covered in host-agent-client.test.ts.

Matched paths:

```text
docs/hub/ssh-host.md
.agents/skills/implement/SKILL.md
hub/test/durations.json
.agents/skills/implement/CHANGES/T-1599-consumers.md
docs/hub/per-user-state.md
docs/hub/adapters-and-sessions.md
.agents/skills/implement/CHANGES/T-1607-shared-stop-budget.md
hub/test/transport-ssh.test.ts
hub/src/host/discovery.ts
hub/src/host/registry.ts
hub/src/host/ssh-host.ts
.agents/skills/implement/CHANGES/T-1659-supervised-fixture-cleanup.md
hub/src/host/agent/server.ts
hub/test/claude-code-remote.test.ts
hub/src/host/agent/prepared.ts
hub/src/host/agent/protocol.ts
.agents/skills/implement/CHANGES/T-1599-worklog.md
hub/src/host/agent/ref-push.ts
hub/src/host/agent/processes.ts
hub/src/host/agent/entry.ts
docs/agents/host-agent.md
docs/evidence/T-1698-consumers.md
docs/evidence/T-1696-consumers.md
hub/src/transport/ssh.ts
hub/test/host-push-on-ref-move.test.ts
hub/test/host-ref-watch-compat.test.ts
.agents/skills/implement/CHANGES/T-1607-observer-consumer-sweep.md
hub/test/tiers.json
.agents/skills/implement/CHANGES/T-1607-pinned-retirement.md
hub/src/cli/host.ts
.agents/skills/implement/CHANGES/T-1644-host-files.md
.agents/skills/implement/CHANGES/T-1600-consumers.md
docs/agents/tests/hub-test-claude-stop.test.ts.md
.agents/skills/implement/CHANGES/T-1607-review-corrections.md
docs/agents/tests/hub-test-claude-stop-owner-component.test.ts.md
docs/agents/tests/hub-test-host-agent-client.test.ts.md
hub/test/host-supervisor.test.ts
hub/test/host-survival-native.test.ts
docs/agents/tests/index.md
hub/test/transport-forwards.test.ts
hub/test/host-agent-closure.test.ts
hub/test/host-ssh-contract.test.ts
hub/test/host-prepared.test.ts
hub/test/claude-capture-concurrency.test.ts
hub/test/host-command-environment.test.ts
hub/test/host-flush.test.ts
hub/test/host-reboot-native.test.ts
hub/test/host-agent-restart.test.ts
hub/test/host-relaunch-retry.test.ts
hub/test/transport-contract-fixture.ts
hub/test/host-clone-integration.test.ts
hub/test/opencode-remote.test.ts
hub/test/adapter-generation-forward.test.ts
hub/test/codex-remote-agent.test.ts
hub/test/host-runtime-join.test.ts
hub/test/host-agent.test.ts
hub/test/host-ref-watch-recovery.test.ts
hub/test/host-relaunch-native.test.ts
hub/test/host-agent-files.test.ts
hub/test/claude-stop-owner-component.test.ts
hub/src/roles/default-roles.ts
hub/test/host-boot-source.test.ts
hub/test/fakes/fake-host.ts
hub/test/remote-discovery-host.test.ts
hub/test/host-settlement.test.ts
hub/test/ssh-host-fixture.ts
hub/test/host-revoke-native.test.ts
hub/test/host-relaunch.test.ts
hub/test/host-agent-client.test.ts
```

Direct-import regression selection (all 34 files, including T3/T4 consumers):

```text
hub/test/transport-ssh.test.ts
hub/test/claude-code-remote.test.ts
hub/test/host-push-on-ref-move.test.ts
hub/test/host-ref-watch-compat.test.ts
hub/test/transport-forwards.test.ts
hub/test/host-supervisor.test.ts
hub/test/host-agent-closure.test.ts
hub/test/host-ssh-contract.test.ts
hub/test/host-survival-native.test.ts
hub/test/claude-capture-concurrency.test.ts
hub/test/host-reboot-native.test.ts
hub/test/host-prepared.test.ts
hub/test/host-agent-client.test.ts
hub/test/host-relaunch.test.ts
hub/test/host-agent-boundary.test.ts
hub/test/host-command-environment.test.ts
hub/test/host-agent-restart.test.ts
hub/test/host-flush.test.ts
hub/test/opencode-remote.test.ts
hub/test/host-relaunch-retry.test.ts
hub/test/host-settlement.test.ts
hub/test/host-runtime-join.test.ts
hub/test/host-clone-integration.test.ts
hub/test/host-revoke.test.ts
hub/test/host-agent.test.ts
hub/test/adapter-generation-forward.test.ts
hub/test/remote-discovery-host.test.ts
hub/test/host-revoke-native.test.ts
hub/test/codex-remote-agent.test.ts
hub/test/host-relaunch-native.test.ts
hub/test/claude-stop-owner-component.test.ts
hub/test/host-boot-source.test.ts
hub/test/host-agent-files.test.ts
hub/test/host-ref-watch-recovery.test.ts
```

## Claude launch and fake fixture additions

Coordinator decisions 57f24b36 and 9cb1f4c7 require Linux-only native admission, explicit fake JSON byte units and every harness launch. The run-host work records memory refusal as a durable failed outcome before SSH settlement. ClaudeCodeAdapter preserves that typed error through its diagnostic wrapper and treats it as positive pre-spawn non-admission. Generic commands and old replies stay unchanged. Memory events have the existing numeric shape; platforms with no verdict emit no sample, matching the existing unavailable-reader path. Search found no production availableBytes consumers beyond the agent; registry forwards/ignores events without deriving capacity here.

The shared fake creator adds available-memory JSON beside boot-id; readers of existing fake files remain unchanged. ssh-host-fixture adds an optional memory interval only; prior defaults remain unchanged.

Extended contract search matches:

```text
docs/hub/ssh-host.md
hub/src/host/host.ts
docs/hub/adapters-and-sessions.md
.agents/skills/implement/SKILL.md
hub/src/host/ssh-host.ts
.agents/skills/implement/CHANGES/T-1599-consumers.md
hub/src/host/agent/server.ts
hub/src/host/agent/command.ts
hub/src/host/agent/claude.ts
hub/src/host/agent/prepared.ts
.agents/skills/implement/CHANGES/T-1599-worklog.md
hub/src/adapters/sessions.ts
hub/test/claude-code-remote.test.ts
.agents/skills/implement/CHANGES/T-1607-observer-consumer-sweep.md
.agents/skills/implement/CHANGES/T-1607-remote-claude.md
hub/src/adapters/claude-code.ts
hub/test/host-contract.ts
docs/agents/host-agent.md
hub/test/host-ssh-contract.test.ts
docs/agents/tests/hub-test-host-ssh-contract.test.ts.md
docs/agents/tests/hub-test-host-launch-layout.test.ts.md
hub/test/host-prepared.test.ts
hub/test/host-command-environment.test.ts
hub/test/claude-agent-launch.test.ts
hub/test/claude-code-remote-files.test.ts
hub/test/host-agent-restart.test.ts
hub/test/host-revoke.test.ts
hub/test/host-launch-layout.test.ts
hub/test/ssh-host-fixture.ts
```

Final direct-import regression selection (53 files, including the new T2 policy test):

```text
hub/test/transport-ssh.test.ts
hub/test/transport-forwards.test.ts
hub/test/host-memory.test.ts
hub/test/claude-code-remote.test.ts
hub/test/host-agent-closure.test.ts
hub/test/host-ssh-contract.test.ts
hub/test/host-reboot-native.test.ts
hub/test/init-process.test.ts
hub/test/claude-code-sessions.test.ts
hub/test/host-push-on-ref-move.test.ts
hub/test/session-host-routing.test.ts
hub/test/host-ref-watch-compat.test.ts
hub/test/adapter-generation.test.ts
hub/test/claude-code-accounts.test.ts
hub/test/host-prepared.test.ts
hub/test/claude-code-remote-files.test.ts
hub/test/host-agent-boundary.test.ts
hub/test/host-command-environment.test.ts
hub/test/host-agent-restart.test.ts
hub/test/host-supervisor.test.ts
hub/test/host-flush.test.ts
hub/test/host-survival-native.test.ts
hub/test/init.test.ts
hub/test/claude-capture-concurrency.test.ts
hub/test/mod-bridge.test.ts
hub/test/init-settings.test.ts
hub/test/host-attach.test.ts
hub/test/host-relaunch-retry.test.ts
hub/test/adapter-native-boundary.test.ts
hub/test/host-runtime-join.test.ts
hub/test/host-revoke.test.ts
hub/test/host-agent-client.test.ts
hub/test/host-agent.test.ts
hub/test/host-clone-integration.test.ts
hub/test/host-relaunch.test.ts
hub/test/fake-harness-capabilities.test.ts
hub/test/adapter-generation-forward.test.ts
hub/test/opencode-remote.test.ts
hub/test/human-hold.test.ts
hub/test/codex-remote-agent.test.ts
hub/test/host-relaunch-native.test.ts
hub/test/host-agent-files.test.ts
hub/test/claude-stop-owner-component.test.ts
hub/test/host-ref-watch-recovery.test.ts
hub/test/host-boot-source.test.ts
hub/test/remote-discovery-host.test.ts
hub/test/claude-code-environment.test.ts
hub/test/host-launch-layout.test.ts
hub/test/host-revoke-native.test.ts
hub/test/claude-code-host.test.ts
hub/test/secrets-environment.test.ts
hub/test/host-settlement.test.ts
hub/test/claude-code-schedule.test.ts
```
