# hub/test/login-write-back.test.ts

T3: `rotated disk reaches the next host and release closes only disk writers`
proves C2 and C4 with two native agent sockets, the directory provider and fake
Codex binary. No real credential, cloud API, browser, sudo or mount is involved.
Run `node --test hub/test/login-write-back.test.ts` on supported Node 24 in the
release's preservation slot, with local CLAND variables stripped. Do not supply
HOME, TMPDIR or cache overrides to the runner. The fixture seals its own children
with fixtureEnvironment and owns every directory immediately upon allocation.

Host A signs in and completes two turns. The persisted login has generation 2.
A separate agent-owned process opens that file and publishes a readiness file;
another process stays outside the disk. The shared destroy boundary must close
the writer, with its native completion receipt, while the unrelated process is
still alive. Host B binds the same volume and completes generation 3. The file's
three host/generation entries and unchanged volume id prove retained write-back.

Agent/client closure and independently registered process joins precede directory
removal. Capture TMPDIR name sets before and after the run; expect no newly retained
`lwb-` roots (0 → 0 when the prefix has no historical roots).
Stage QA runs on integrated dev; this file supplies fake-only native evidence.

The same case mounts a second disk and launches its native writer. Both hub
unmount requests must be issued and outstanding through the real sshHost before
any detach. A held native signal boundary keeps the first request outstanding;
this proves hub concurrency, while agent stream and helper execution remain
serial. Both exact writer births are closed; the outside process stays alive.
