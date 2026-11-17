# hub/test/executor-launch-boundary.test.ts

T2 recording-Host cases drive actual Claude, Codex and OpenCode adapter launch
orchestration for new roles and restored rows, on local and remote Hosts. Account
overlays (and OpenCode's new-launch secret overlay) plant both executor transport
controls. Assertions inspect the final command/spawn frames, retain a permitted
overlay value and require the actual launch frame. Fake identities, stops,
forwards, clients and command callbacks avoid native harnesses and network.

`fakeOnlyFixture` enrolls cleanup before scratch allocation, joins the complete
body and adapter close before root removal, and retains a positively controlled
guard for callback/custom exec/execFile, sync launchers and native spawn. An
unexpected delegation fails rather than using a real binary. The companion
executor-contract tests cover bootstrap and marker controls under the same owner.
The fake provider publishes its transport marker synchronously. Its original
optional directory owner and beforeRemove guard are preserved, with no new
TestContext enrollment or lifetime contract. A scripted-provider case checks
marker publication with and without an existing directory owner. Broader
explicit-context fixture hardening is tracked separately in T-1941.

Run the file with `node --test hub/test/executor-launch-boundary.test.ts`.
