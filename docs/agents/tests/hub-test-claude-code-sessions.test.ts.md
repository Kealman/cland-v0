# hub/test/claude-code-sessions.test.ts

T-1764 exercises production Claude interpretation through session.signal with a
fake harness and hub clock. C1 preserves the exact terminal notice across six
parent turn boundaries, checks the fake Telegram/Discord approval receipts and
one journalled subscription announcement. C2 distinguishes a new tool identity
and the same identity after matching completion. C3 checks the 30-minute
boundary, unchanged card content and original id, no second reminder after two
hours, and cancellation after resolution. Clock blocking skips unrelated
periodic work; advancing across the deadline fires the production timer.
No external messenger, credential, browser or native harness is used.

The review regressions deliver a metadata hook at t2 before an accepted permission
at t1, then prove both parent-boundary retention and rejection of an older changed
permission. Sessions supplies the same state-order decision to interpretation
and its state writer. Replacement controls at 10 and 31 minutes prove a new
prompt starts its own age and deadline; the earlier prompt's deadline cannot
send its replacement's reminder.

T-1471 uses production dispatcher frames to cover missing/wrong/current launch
fields on hooks and bridges and missing/wrong/current launchId on joined and
credential-bound anonymous spokes. Legacy rows retain absent-field controls.
Rotation closes the old admitted connection before new traffic, rejects its tool
attempt, queues input for exactly one new-generation delivery, and preserves
late-old-disconnect safety.

Held native inspections use captured generation, job, PID, row status and hook
revision. Unavailable/failed queries cannot adopt a conversation; newer hooks,
stop and relaunch supersede results, including earlier-launch diagnostics.
Close joins the held inspection before Store disposal. `/clear` needs positive
same-job proof. Tests observe inspection completion/Agents notice receipts before
negative assertions. Native process/CLI proof stays in the lifecycle split.


The adapter-owned relaunch control throws before a positive native stop receipt
through actual session.resume frames. Preserve the running row, stable/native job
identity, Coordinator role, claim and single spawn count. The pre-fix red reported
exited instead of running. This tests the controller boundary in addition to the
native adapter's own failed/held-stop controls.

The uncertain-stop component uses the same pre-registered
`claudeComponentOwner` as the schedule upgrade control. Its setup bound includes
hub startup, dispatcher welcome and subscription; native spoke acquisition is
owned before invocation and joined on disposal. The removal barrier keeps the
root until all admitted observations settle. See the
[omitted/aborted setup controls](hub-test-claude-component-fixture.test.ts.md).
