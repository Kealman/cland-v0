# hub/test/host-ref-watch-recovery.test.ts

T2 uses private disposable watch checkpoints and a scripted native ownership
interface, Git results and metadata observations. No process or socket is started.
Explicit scans keep the tests independent of polling timers.

Thirteen generated cases prove held A/B captured-head and lease bindings, restart
admission/current-head decisions, unknown child and stale path isolation,
unchanged refused-head dedup despite metadata churn, substituted-proxy no-launch,
dirty-removal watch retention, and accepted-checkout ownership after connection
reacquisition or watch-registration failure. These are component ownership/control receipts;
the native SIGKILL/socket/CAS boundary is in host-push-on-ref-move.test.ts.

Additional controls keep the second-crash recovering phase, admitted removal
identity across post-success checkpoint loss, recovered native binding before
stop, unknown-ledger versus complete producer result, and publication fence
clearance only after a successful later leased head. These scripted receipts do
not stand in for native SIGKILL or producer-secret-scan evidence.

The direct status and checkpoint-event projection share one implementation. An
inaccessible peer remains fenced when a healthy watch admits and settles a push.
A recovered peer is reobserved before its cached same-signature notice clears;
that observation does not replay its already-attempted head.

Scoped publication flush requires a positive successful native result. A settled
failed lease refuses without retrying its unchanged head; a successful publication
and a missing-watch refusal keep the previous global flush contract intact.
