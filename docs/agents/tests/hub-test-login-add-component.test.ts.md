# hub/test/login-add-component.test.ts

T2 `projectHub`, with FakeClock and both fake lock process facts. The injected
sign-in runner keeps native provider and terminal processes outside this seam.

- `login add disconnect settles only its admitted connection`
- `login add failure settles only its admitted connection`
- `login add success settles only its admitted connection`
- `login add preparation failure reaches CLI without a terminal plan`
- `dispatcher shutdown joins every login closer and still closes the suite owner after failure`

The tests retain a creating row while admitted, refuse completion from a second
connection, and wait for the persisted terminal state. A failed or disconnected
attempt retains disk identity and no bindings. Run with supported Node 24 and
inherited `CLAND_*` stripped. Native disk receipts are covered by login-add and
login-disk T3, not inferred from these injected cases.

The shutdown control injects two distinct cleanup failures, holds the second
owner, and requires both errors plus the suite owner's close receipt after
drainage. The direct in-process dispatcher keeps this test below native tiers.

The seven `renewal terminal <outcome> distinguishes native close receipt from owner loss`
cases use the real mounted renewal owner with injected provider/Host boundaries.
Disconnect and graceful hub stop retain bindings and the exact-machine fence;
an interrupted pending entry rejects a late same-connection frame. Every case
rejects another connection's completion. Success, failure and null native-close
reports follow their normal settlement paths. A held snapshot after an accepted
close receipt remains owned across disconnect and publishes its positive result.
Native SSH-close timing remains the unchanged login-terminal T3 evidence; this
file proves dispatcher routing and durable metadata, not a native process exit.

New-login recovery cases (`new login terminal <outcome> retains disk until owner close or exact machine deletion`) use real projectHub socket ownership and fake Host/provider boundaries. Disconnect, hub stop and indexed admission recovery record interruption with the captured host and only `mount`; replacement machine deletion cannot settle the fence. A destroyed provision without a deletion receipt stays fenced; its persisted exact-machine receipt permits a fresh sign-in. The stale terminal frame after recovery refuses before any disk effect. Pinned-connection zero, nonzero and null completions preserve normal cleanup. A different connection cannot settle the add. No terminal process runs in these T2 cases.

The `held/rejected new-login preparation records interruption after <peer close/hub stop>` matrix holds attach before a pending plan exists. It waits for the connection/shutdown abort receipt before releasing the held provider result, then asserts interruption and no disk cleanup. Setup and durable outcome waits have separate bounds.
