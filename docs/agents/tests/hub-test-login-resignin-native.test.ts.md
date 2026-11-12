# hub/test/login-resignin-native.test.ts

T3, fake provider and fake SSH/harness binaries only. Acquire the release's
native preservation slot, run this file alone, then release after native close.
Use the supported Node version and strip inherited CLAND variables. Every child
uses fixtureEnvironment with explicit fake root and membership overlays.

- `native sign-in of unbound Claude, Codex and OpenCode disks reuses and detaches each volume`
  drives the actual CLI and SSH terminal through each harness. It proves ready,
  last sign-in, snapshot, unchanged volume id/count and confirmed detach.
- `native opencode sign-in renews the mounted writer with relaunch false` and
  `native opencode sign-in renews the mounted writer with relaunch true`
  sends a native dead-login turn, renews through the actual CLI, then observes a
  new turn receipt in that same volume's rotating file. With false it keeps its original native PID; with true it receives a new PID
  while preserving cland session, conversation, cwd and binding. No real browser or harness is used.
- `native bound Codex renews its own dead credential home without replacing the disk`
  proves the Codex-specific in-place dead-home rule on the mounted original disk,
  its renewed login file, unchanged file-store config and retained binding.


Setup uses testWaitMs/eventually; the exact renewal receipt is a persisted turn
on the original native session. CLI completion is observed through native close.
Fixture cleanup joins writers and their resource owners before deleting roots.
The explicit CLAND_FAKE_HOST_ROOT overlay is required when resolving loginFilePath;
fixtureEnvironment removes that variable from the base environment.

C2's exact freeze/snapshot/thaw ordering and retained bindings are also proven in
the T1 `renewing a mounted login snapshots under freeze and keeps the writer mounted`
case in login-signin.test.ts. C5's clock boundaries live in login-signed-out.test.ts;
login-list.test.ts proves the recovered card, Agents line and CLI text all carry
the same hint, and preserves the older wire shape regression.

T-1813 adds `native codex sign-in renews the mounted writer with relaunch false`
and `native claude-code sign-in renews the mounted writer with relaunch false`.
Each starts the real native fake process, sends DEAD-LOGIN, observes its exact
signed-out episode, signs in through the CLI (Claude receives a sentinel pasted
code), reads the renewed mounted login through loginFilePath, and sends another
turn. The persisted turn names the original native conversation on the original
volume; the cland session, PID, cwd and bindings remain unchanged. OpenCode alone
also exercises the opt-in relaunch path. No additional relaunch behavior ships.
The shared login-native-fixture supplies explicit fake adapter binaries. See the
dead-login file guide for short Codex run paths and Claude admission decoration.
