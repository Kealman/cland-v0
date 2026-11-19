# hub/test/host-launch-layout.test.ts

T2 records each adapter at its Host native launch boundary, rejecting before any
harness binary starts. Baselines were captured before the adapter migration;
root, installed mod directory, system temporary directory, generated UUID and
password are normalized. The local argv/environment and generated file bytes and
modes must match those literals. Mapped recording Hosts choose distinct runtime,
log, discovery, executable and mod paths. OpenCode's mapped control uses a nonlocal Host name. Password reads and rollback
restoration of bytes, permissions and append offsets have separate controls. The capture stops before the Host opens
native process logs or creates a socket; unchanged adapter lifecycle files prove
that later boundary using fake harnesses.

Each capture runs under explicit umask 022 and 002, restoring the caller's mask
before adapter teardown. Historical default-mode OpenCode files are 0644 and
0664 respectively; private passwords and Claude files remain 0600. Production
continues to inherit its process umask. Both outer caller masks must pass each
capture case; do not chmod production files to fit a snapshot.

The mapped Claude observer supplies the optional launchClaude command edge and
hostForProcess routing. It captures the private generation first, checks folder
0700 and both files 0600, then returns typed CLAND_AGENT_ADMISSION_REFUSED because
no native command was admitted. The existing local golden and all mapped byte
transforms remain unchanged. Generic untyped outcomes are still supervised by
production; claude-code-remote-files keeps that negative control. Local Claude,
Codex, OpenCode and the missing-mod precondition retain their original paths.

The deep-root Codex placeholder control uses `residueControl` before its first
acquisition. A counted full native guard precedes tempProject, setup and launch
observations have separate bounds, and adapter acquisition enrolls close inside
the original producer. Cleanup joins original work and positive adapter closure,
then observes root removal before restoring TMPDIR, opt-in state and the guard.
The existing golden capture callers are unchanged: short local Codex paths adapt
the legacy cland-run literal to the in-project endpoint, and mapped Hosts adapt
it to their runtime directory. The frozen literal still describes ordinary
non-fixture local fallback; it is not rewritten to a random fixture alias.
