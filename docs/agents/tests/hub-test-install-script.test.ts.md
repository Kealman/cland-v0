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

T-779: local source archives include `packaging/build-install.sh`, shared with
the Homebrew formula. These tests execute that script through the installer with
native Node/npm offline, proving build-before-prune and lockfile mtime preservation.
Formula rendering and tap publication have separate Homebrew test files.

Old-layout archives deliberately omit the shared helper: the installer uses its
legacy locked build/prune path. Their regression keeps install and update version
receipts, built Web output, prune and lockfile-mtime checks, and the previous
command after a failed update. The old-install-moved interruption case also uses
old-layout archives and retains its rollback receipt and working-command check.

T-1234 adds tag-specific prebuilt archive/checksum mappings. A valid checksum and
source stamp install the known Web payload even with a deliberately failing
source-build command; runtime-only npm omits the build dependency. Missing or bad
checksums and a validly checksummed bundle for different sources each fall back
to the locked source build, retaining prune and lockfile-mtime assertions.
All downloads remain local mappings; custom source URLs require an explicit asset
directory and never implicitly contact GitHub. No browser is involved.
