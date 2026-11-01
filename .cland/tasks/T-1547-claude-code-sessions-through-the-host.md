---
id: T-1547
kind: task
title: Claude Code sessions through the Host
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1296
branch: t/T-1547-claude-code-sessions-through-the-host
created: 2026-10-31T23:47:41.550Z
updated: 2026-11-01T07:19:34.398Z
---

## Summary

Claude Code's `claude --bg` launch, its `claude agents --json` and `claude stop` commands, the read of the worktree's `.claude` settings, its pid and identity checks and its stop go through the session's Host. The schedule of `agents --json` stays as it is; ticket 15 changes it for rows on another host.

Hot files: `hub/src/adapters/claude-code.ts`

## Acceptance criteria

- [ ] C1. `claude --bg`, `claude agents --json` and `claude stop` run through the Host's run with the same arguments, environment and working directory as today (test).
- [ ] C2. The session cwd's `.claude` settings files are read through the Host's readFile (test).
- [ ] C3. Pid checks, birth identities, resume liveness and stop of a Claude Code row use the Host's identity, alive and stop, and the adapter's own `process.kill` probe is gone.
- [ ] C4. A test with a recording Host shows every command, liveness check and stop of a Claude Code row reaching that Host (test).
- [ ] C5. The claude-code-adapter, claude-code-sessions, claude-code-schedule, claude-code-accounts and claude-code-environment test files pass with no test edited.

## Comments

### impl-1547 · 2026-11-01T07:11:29.254Z

Consumer inventory before changes: ClaudeCodeAdapter is constructed by daemon.ts plus adapter fixtures in hub/test (claude-code-adapter, sessions, schedule, accounts, environment, permissions, ownership and native-lifecycle); AdapterHost optional hostForProcess/hostForLaunch already ships from Sessions. Legacy processStarted/processIdentity/pidAlive option consumers are standalone schedule fixtures and daemon adapter options. Host.run/alive/identity/stop contracts remain unchanged. LaunchFiles and generated private launch files stay hub-local per A-15078. Poll schedule stays unchanged; T-1555 owns per-Host discovery. New recording-Host tests will cover commands, cwd settings, resume/poll identity and stop.

### impl-1547 · 2026-11-01T07:19:34.398Z

Expanded contract consumers for Host.stop callback addition / absent-process shared fix: production endProcess users are adapters/{claude-code,codex,opencode,launch-files}, host/local, executor/local, fixture-processes, orphans, suite-command, termination-owner; test/fixture fakes are fixture-orphans, system-processes, system-process-probe, memory-producer, suite-timeouts, mod-bridge, session-async-processes and claude-code-sessions-lifecycle. docs/agents/tests/hub-test-measure-memory also describes termination. Search included field/function names across hub/src, hub/test, nvim/test, web/test, qa, skills and agent docs; no nvim/web/QA wire consumers. Callback payload is additive plain data; existing no-argument callbacks remain accepted, including fixture fakes invoking callbacks without payload. Only localHost opts into new payload forwarding; logger default is preserved. Shared contract includes declined-authority no-signal, parent/descendant captured births, absent-process idempotence and reused-birth refusal.
