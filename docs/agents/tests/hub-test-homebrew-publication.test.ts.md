# hub/test/homebrew-publication.test.ts

T3 native Git receipt contract. Run `node --test hub/test/homebrew-publication.test.ts`.
Uses disposable product, territory and bare tap repositories with fixtureEnvironment
applied after every overlay; HOME/XDG, identities and Git config are scratch-owned.
There are no daemon or harness processes. Only the archive-hash boundary and the
tap remote address are substituted: all Git object/lease/ref operations are real.
It proves the complete planned destination before writes, product publication
before tap download, preserved SHA after lost tap reply, idempotent retry despite
later dev/config changes, unrelated tap file preservation and concurrent push
refusal. The final assertions read durable remote blobs and refs.

The companion installer test executes the shared build on sealed local tarballs,
including updates and rollback. Neither suite proves actual Homebrew installation;
clean-macOS install/version/doctor/upgrade/uninstall remain E-778's launch demo
evidence, now that the formula is published in `Kealman/homebrew-tap`.
