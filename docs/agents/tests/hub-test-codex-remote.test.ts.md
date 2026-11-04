# hub/test/codex-remote.test.ts

Run `node --test hub/test/codex-remote.test.ts` for T2 frame launch,
delivery, persisted idle state, relative host policy and absolute-root refusal.
The recording Host has no native processes. RPC connects only to the returned
per-session forward; the launch policy scan rejects the planted hub root.

Run `node --test hub/test/codex-remote-agent.test.ts` for T3 fake-SSH
version/spawn/stop ownership. The fake executable records startup; the scripted
Codex connection exercises the adapter without real Codex or network. The SSH
fixture records native writers and joins carrier/agent/process cleanup with an
empty census before deleting its disposable root. All socket paths include the
terminator in the 104-byte budget.

Preservation files are codex-adapter, codex-native and codex-workspace-git;
run each unchanged, one at a time. codex-host uses short scratch roots because
nonlocal run paths cannot use the hub's long-path fallback.
