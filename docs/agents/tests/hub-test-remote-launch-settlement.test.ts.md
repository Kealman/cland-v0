# hub/test/remote-launch-settlement.test.ts

T2 component cases use recording Hosts, scripted Codex/OpenCode clients and the
shared positively controlled native launch guard. A failed handshake produces
the receipt, copied through JSON into a fresh adapter. Native rollback precedes
forward cancellation; held cancellation must keep settlement pending. A missing
generation receipt must refuse with cleanup-incomplete.

The overlapping-generation variants leave two failed launch scopes under the
same name/session, with different forward namespaces. Recovery must cancel only
the earlier saved identity, without allocating a native scope or changing the
newer selector. Rejected/pending producers survive an early acknowledgement;
after the positive receipt, durable acknowledgement clears the actual recovery
cache and fences captured aliases. The in-memory census observes cache size and
native generation ownership separately. Adapter close joins admitted cancellation.
An explicit synthetic model avoids the unrelated free-model catalogue wait.

Run `node --test hub/test/remote-launch-settlement.test.ts` after cover quiet ends.
