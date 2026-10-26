# hub/test/pairing-codes.test.ts

T2 uses `projectHub`, a fake clock, sealed projects and
`hub/test/fakes/messenger.ts`; no token, platform, native harness or browser.
`testMessenger.pair(identity)` invokes the trusted callback supplied at startup
and observes the one private reply or `null` silence. The local frame protocol
observes the exact durable code's inbox row; the CLI case checks its text output.

Keep the read-before-mutation/read-immediately-after control, the original expiry
on repeated requests, both platform lifetimes and the three-code/two-reply limits
across restart. The two messengers must not receive another sender's code through
reads or model frames. Retain the explicit forbidden answer attempts using the
pairing id, remote needs-you counts and old Inbox/hello compatibility.

Arm the inbox observer before issuance and subscribe the local old-shape client
first. Advance fake time to publish, then retain the final correlated inbox
assertions on both sides of the exact expiry. A replacement sender's full-lifetime
row proves freed capacity. Drain the hub before fixture removal.

The secret-registration merge control injects a fabricated opaque secret through
`syntheticRemoteSecrets`, includes it in a pairing display name and reads the
correlated local inbox. The name is masked before persistence, numeric ids stay
unchanged, and the pairing callback and gateway frame port both remain usable.
