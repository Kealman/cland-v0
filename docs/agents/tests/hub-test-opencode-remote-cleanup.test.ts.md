# hub/test/opencode-remote-cleanup.test.ts

`hub/test/opencode-remote-cleanup.test.ts` is T2. Recording Host operations and a scripted HTTP handshake prove the durable in-memory recovery path without a native child. Rollback observes the synthetic native completion before the settlement callback. Two concurrent callback calls share one held unforward; neither settles until its positive release receipt.

This covers the callback captured in the running hub. Post-restart adapter-specific forward settlement belongs to T-1671; the in-memory callback is not reconstructed by this item.

The poll, shutdown-event and explicit-stop controls hold both a snapshot and the subscription's close receipt. No cancellation starts before both are released. Natural terminal paths inject one cancellation failure, retain supervision and withhold exited, then retry under the fake clock and require a positive cancellation before publishing exited. A real Unix HTTP server holds an HTTP response and SSE stream; client.close aborts both, joins request close receipts, refuses new work and leaves no server peer.
