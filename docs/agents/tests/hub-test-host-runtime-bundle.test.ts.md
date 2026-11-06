# hub/test/host-runtime-bundle.test.ts


`hub/test/host-runtime-bundle.test.ts` is T1, source-only. Its case
`runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests`
checks required paths, unique membership, source hashes and decoded bytes.
Run `node --test hub/test/host-runtime-bundle.test.ts`. It starts no children,
services, browsers or network clients.

The callback-only `upload abort reclaims joined input` and
`upload abort retains input identity on incomplete cleanup` cases abort after a
successful awaited copy. They check exact uploaded-input cleanup and the explicit
`RuntimeDeliveryIncomplete.remoteInput` outcome on unconfirmed cleanup. Neither
callback launches a process or uses the network.
