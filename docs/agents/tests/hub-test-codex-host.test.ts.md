# hub/test/codex-host.test.ts

T2 recording Host seam for the production Codex adapter with ScriptedCodex RPC.
No native child, provider, account or remote connection is started. Resume uses
a fresh scripted connection, matching the real connection ownership boundary. The fixture
uses a disposable project/environment and closes the adapter before root removal.

The restored-subscription regression first refuses input with no app-server
connection, holds the actual resume subscription, and requires no reconnection
callback before that receipt. Releasing the subscription must announce recovery
even with an idle snapshot, and the callback retries the exact input through
the production adapter. It failed before the resume callback fix; no native
process or longer survival-test wait is needed to prove this boundary.

Cwd refusals must reach the caller before any command. Successful launches record
one Host run and one spawn, preserving cwd, argv, account environment, launch token
and log destination while stripping executor credentials after overlays. Native
birth identity returned by the Host remains on every liveness/stop request.
Resume without a thread, poll death and stop exercise the same selected Host;
a second launch proves version checks are per launch rather than cached. A held
liveness reply for an old process row cannot retire its replacement: wait for
the old request, replace the row, release the old result, then require a live
check and a separate death receipt for the replacement.

Preservation evidence runs these existing files without edits:
`codex-adapter.test.ts` (T3), `codex-delivery.test.ts` (T2),
`codex-native.test.ts` (T2), and `codex-workspace-git.test.ts` (T4).
The native/workspace contracts retain their own availability requirements.

Source-review lifetime regressions hold Host version, log preparation, accepted
spawn and identity separately for launch and relaunch. Observe each entered
boundary before closing, then release it and require both terminal receipts:
no new native turn, no running result, and any accepted PID stopped before close.
Live resume separately holds liveness and connection acquisition; late clients
close without a thread subscription. Failed late cleanup rejects close and
retains the exact durable PID/birth/undo receipt for its later recovery owner.

Success and rejection probes share one in-flight call through multiple timer
ticks. Close joins the producer, suppresses both log and exit callbacks, and
leaves no later polling. The selected-Host test uses a distinct name and a
row-sensitive process resolver; a hardwired resolver would mask missing ownership.

A held reconnect connection acquisition must not delay completed liveness
probes: reconnect is tracked and joined independently of the probe. Preserve
both the per-row overlap control and this timer-cadence regression.

Shutdown ordering is asserted inside close's own fulfillment/rejection callback,
including producer completion, accepted-child cleanup and late-connection release.
Keep the shared held-launch driver's early-close control: it starts real closure
but deliberately exposes an immediate receipt, and must fail that same ordering
assertion while the real work continues. Eventual cleanup alone cannot pass.
Setup and completion have separate real-clock bounds through `until`/`testWaitMs`;
the promise-receipt wrapper records fulfillment or rejection before polling that
exact receipt. Teardown releases every gate before bounded drainage. Keep the
post-join assertions as well as assertions at the close receipt.

Successful local launch and relaunch retain the captured child-exit receipt after
LaunchFiles commits. The held-receipt stop controls use a recording Host with
immediate socket removal so asynchronous filesystem cleanup cannot mask early
settlement. Host stop reports the synthetic server dead while native reap stays
held. Stop must remain pending; fake native timers advance the five-second
settlement deadline and require cleanup-incomplete. Negative liveness cannot
publish exit until the held receipt arrives; a late receipt permits stop retry.
Recovered local rows have no captured receipt and retain Host stop confirmation.
No native process is launched by these T2 controls.
Register release plus adapter drain with beforeDirectories before spawning, so
setup or assertion failure cannot remove the fixture while work is held.
