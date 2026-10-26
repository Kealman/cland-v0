# hub/test/secrets-environment.test.ts

T3 native environment contracts, using made-up values only. A generic Node
command stands in for the speech launcher required by E-1311: after synthetic
credential overlays it calls the production `withoutExecutorCredentials` filter,
retains the two speech metadata names, and emits environment names only. Its
native close and callback/output receipts gate assertions and cleanup through
`secrets-fixture.ts`. `secretProject` registers the root's pre-directory stop/drain
and before-remove barriers before any launch. The owner uses a bounded native
stop/close/output join, retains the root on missing drainage and records an
explicit incomplete native outcome. Capture redaction's 500-character line limit
is retained; the command emits only the six relevant environment names. HOME/XDG/Git/accounts come from the
shared disposable fixture builder before the deliberate synthetic policy input.

The real ClaudeCodeAdapter launches the repository's fake Claude binary through
`session.launch` on `projectHub`. Synthetic credentials enter the adapter's
options after fixture sealing so the fixture cannot hide a production leak.
The fake writes a durable environment-name receipt after constructing its actual
session environment; it contains launch names and session names, never values.
The test awaits that exact receipt, asserts all four names absent, then stops the
session and hub. Existing fixture ownership stops/drains descendants before root
removal even on assertion failure. No GUI, platform or account credential is used.

The speech implementation must use this same final filter and verify its own
launcher seam in E-1311. This file does not claim to exercise a speech provider.

`cancelled command with a missing close receipt retains its root until native
close and output drain` arms filesystem observers before launch, waits for a
complete readiness-file content, cancels, then holds the native SIGTERM handler. While
root removal is waiting on the owner's same barrier, it proves the exact signal
receipt, missing close/result and retained root. Explicit stdin release permits
native exit; only then does removal complete, with the native exit/signal and
ABORT_ERR outcome asserted. This exercises cancellation without relying on the
ordinary body await or the execFile timeout as cleanup.

The cancellation fixture deliberately creates `stopping` empty and publishes
`stopping-incomplete` only after that write finishes. The parent observes that
receipt, asserts the file is empty and the cancellation receipt still pending,
then creates `complete-stopping`. The child's prearmed filesystem observer writes
`signal handled`; only those exact bytes resolve the cancellation observer. This
handshake exposes the create-before-content race without sleeps or CPU load.
Readiness and cancellation have separate bounded waits, and the final content
assertions remain. Repeat the named case sequentially when checking this race;
an existence-only observer must fail at the pending-receipt assertion.
Before stdin releases the held child, the parent closes its filesystem observer
and awaits its native `close` event with a separate bound, then asserts that
receipt. This happens in `finally` even on assertion failure, so the observer's
content reads cannot race the explicit root removal. The child release and
removal join still run if the observer-close check fails.
