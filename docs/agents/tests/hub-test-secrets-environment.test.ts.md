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
positive readiness file, cancels, then holds the native SIGTERM handler. While
root removal is waiting on the owner's same barrier, it proves the exact signal
receipt, missing close/result and retained root. Explicit stdin release permits
native exit; only then does removal complete, with the native exit/signal and
ABORT_ERR outcome asserted. This exercises cancellation without relying on the
ordinary body await or the execFile timeout as cleanup.
