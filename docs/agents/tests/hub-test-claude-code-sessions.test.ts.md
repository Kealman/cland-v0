# hub/test/claude-code-sessions.test.ts

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
