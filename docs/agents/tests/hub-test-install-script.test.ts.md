# hub/test/install-script.test.ts

T3 native installer contract. Run `node --test hub/test/install-script.test.ts`.
The agreed seam is `/bin/sh install.sh` plus its installed `cland` command:
Node rejection before writes, stable-tag install with a built web client,
rerun update, preservation after a failed build, and rollback at the exact
old-install-moved publication boundary (a fixture mv signals its installer parent). A faulted rollback retains the
backup and reports its recovery path; the test runs the preserved old CLI.

Admission runs before fixture setup and respects cover-quiet. Every installer,
Git boundary and npm process uses a sealed scratch HOME, XDG paths, Git config
and writable prefix (including spaces). The curl/Git stubs accept only explicit
local release fixtures; npm runs offline with an empty scratch cache. A local
build-only dependency proves build-before-prune, and the deliberately failing
prepare hook proves lifecycle scripts stay disabled. A build-time lockfile receipt
checks that prune preserves the source mtime so doctor can accept the web bundle. No test uses sudo, a live
repo, real network, the human's home, or /usr/local. Every command runs in its own registered process group. The deadline kills the
owned group without shell EXIT traps, then observes close and drains descendants
through shared ownership cleanup before fixture deletion. Separate command
deadlines bound setup and behaviour; installed-version assertions remain final.

These fake releases prove the installer contract, not the actual product on a
clean OS. Cold Ubuntu/Fedora install, doctor, dependency/download timings and size
are post-landing evidence under E-778 C2. Site publication is separate.
