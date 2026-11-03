# hub/test/codex-sandbox-host.test.ts

T2 public threadPolicy/Host and ScriptedCodex seams. Disposable files and sealed
environments only; no native harness, browser or remote provider.

The local JSON fixture was captured before T-1548 changed production. Compare
serialized thread policy and override bytes for a writable root, relative linked
worktree gitdir, symlinked root and local network; normalize only canonical
scratch root and temp directory prefixes. Do not regenerate to bless a change.
The mapped Host has no corresponding local tree: it supplies directory facts,
linked Git bytes and all realpaths. Assert exact sandbox output and Host inputs.
Spawn and relaunch must both serialize the captured Host's profile into argv.
This proves serialization, not OS sandbox enforcement.

Preservation files remain unedited: codex-adapter.test.ts (T3),
codex-delivery.test.ts and codex-native.test.ts (T2),
codex-workspace-git.test.ts (T4; macOS Seatbelt availability applies).

The mapped network-local launch case gives runtime a symlink path independent of
its discovery directory. At the native launch boundary it asserts the actual
socket path and that its canonical parent is denied in the serialized profile.
Legacy discovery-only callers and the local policy byte fixture remain unchanged.
