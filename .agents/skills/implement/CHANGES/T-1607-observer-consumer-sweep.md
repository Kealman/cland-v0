# T-1607 Claude launch observer consumer sweep

Coordinator b5ae44b1 requires this sweep before another verify. Run56380484 at
eb812bfd2 passed T0/T1, failed both mapped-Claude host-launch-layout umasks in
T2 with "Claude launch cleanup incomplete: failed generation remains supervised".
The unchanged file reproduced14/16 locally. T3/T4/Web were unexecuted; Linux
c-8 lifetime783s, cost$0.0544 (A-16486). This failed run is not later-tier proof.

Searches covered all hub/test TS, including fakes/scenarios: ClaudeCodeAdapter,
claude-code.ts, localHost, testHost, HostCommand, hosts arrays, hostForLaunch,
hostForProcess, run/spawn wrappers/assignments, record/observer commands and
launchClaude. Direct import hits were read alongside the Host hits, not used
alone. The classifications below name why no further migration is needed.

## Claude launch/row consumers to run targeted

| File (hub/test/) | Classification |
| --- | --- |
| host-launch-layout.test.ts | Forced migration now: mapped-Claude-only launchClaude recorder, typed non-admission after capture and hostForProcess. Existing golden, transforms and deep equality stay; add explicit private folder0700/files0600. Local/Codex/OpenCode unchanged. |
| host-ssh-contract.test.ts | Earlier forced migration: Claude recorder uses typed non-admission after joined replacement command and row Host routing. Unsafe unshimmed config refusal remains; Codex assertions unchanged. |
| claude-code-host.test.ts | Local recording Hosts retain name local and optional members absent. Nonlocal processHost/testHost fixture models successful launch/discovery and legacy row proof, never ambiguous recorder errors; no migration. Both launch/row selectors supplied. |
| claude-code-remote-files.test.ts | Explicit success/adopt/release doubles, held outcomes and typed/untyped fault controls; both selectors supplied. Legacy successful run-only file control intentionally keeps optional members absent. No observer pretending generic failure means non-admission. |
| claude-code-remote.test.ts | Real fake-host agent capability/adopt path, scripted Claude and deliberate lost-result/receipt controls; no recorder stub. |
| project-hub.test.ts | Injected Host.run stays local, returns successful background/discovery/stop facts; no new remote settlement. |
| session-host-routing.test.ts | Claude tests seed existing rows and exercise stop/resume/poll/identity, not a rejected launch; remote testHost lacks optional adoption intentionally. Initial recording launch fixture is OpenCode. |
| session-host.test.ts | fakeHarness launches and legacy Sessions process/stop receipts; no production Claude --bg observer. |
| host-secret-admission.test.ts | fakeHarness owns launch; Host double provides directory/identity admission only. Production native-ID dispatch regression unaffected. |
| remote-discovery-host.test.ts | Forwarded transport/discovery with fakeHarness rows and credentials, no production Claude launch recorder. |
| host-contract-coverage.test.ts | Contract inventory explicitly checks optional members and unchanged local absence; no Claude launch. |
| adapter-native-boundary.test.ts | Production adapter uses local default Host and replaced native/exec edges; no named remote recorder. Other adapters unchanged. |
| claude-code-environment.test.ts | Local execFile/synthetic process seams only, no remote Host selector. |
| claude-code-schedule.test.ts | Local memory AdapterHost + execFile/FakeClock seams; no remote observer. C5 unedited. |
| claude-code-sessions.test.ts | fakeHarness launches; production Claude interpreter only, no native methods. C5 unedited. |
| claude-code-adapter.test.ts | Scripted local Claude lifecycle; no remote Host double. C5 unedited. |
| claude-code-accounts.test.ts | Scripted local account lifecycle/attach; no remote Host double. |
| secrets-environment.test.ts | Scripted local Claude and production local adapter, no remote observer. |
| lead-permissions-component.test.ts | Claude fakeHarness authority; recording native Host case is Codex, not Claude. |
| session-host-placement.test.ts | Generic/fake adapter and Codex native placement observers, no production Claude recorder. |
| mod-bridge.test.ts | ComponentClaude delegates lifecycle to fakeHarness; Bun bridge run/spawn stubs are plugin edges, not Host launch. |
| human-hold.test.ts | fakeHarness lifecycle and production bridge interpretation only, no native launch. |
| fake-harness-capabilities.test.ts | Capability constants/fakeHarness only, no Host native operation. |

## Other Host search hits

These do not handle a Claude launch and need no migration: artifact-host
(artifact files), codex-host/codex-remote/codex-remote-agent/codex-remote-cleanup/
codex-sandbox-host (Codex only), opencode-host (OpenCode only), host-agent-files
(agent file/command port contract), host-local-contract/host-local-liveness
(generic Host process contract), host-records/host-registry (records/registration
and fakeHarness rows), launch-files (file journal/testHost refusal),
name-reservation/lifecycle-serialization (test adapter), transport-status
(status only), territory-task-branch/worktree-host (Git/worktree adapter).
host-contract.ts and ssh-host-fixture.ts are shared generic helpers consumed by
the selected contract/native files; fake-host/fake-ssh are carrier/agent owners,
not native Claude recorders. fakes/harness.ts is the in-memory simulation.

Other direct Claude import hits are nonlaunch consumers: host-boundary source
scan, state-paths-inventory registration, init/init-settings/init-process hook
installation. No new optional-member consumer is hidden there. Shipped docs,
fixtures and QA brief inventory remains A-16352/A-16466; this sweep adds the
runtime test observer correction. No production change in this delta.

The current forced edit keeps every host-launch-claude golden literal and path
transform unchanged: it already names the generation-private layout. Production
generic/untyped failures still retain supervision; only a typed non-admission
recorder can roll back without adoption. Fresh source review follows the full
targeted consumer set and check, before mode-free verification.
