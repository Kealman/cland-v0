# hub/test/session-resume-component.test.ts

Synthetic PIDs in the in-process harness carry explicit pidStarted and pidIdentity
facts. Public-frame recovery/liveness checks must not invoke a native birth probe
for these simulated processes. The fake adapter owns its stop receipts.
Equal-PID relaunch and legacy upgrade cases use the injected native observation
boundary in [name reservation](hub-test-name-reservation.test.ts.md).

The empty Web fixture hub counter intercepts both asynchronous ps and synchronous
Perl positive controls before measuring actual projectHub startup and shutdown.
It asserts no process-identity spawns for the empty in-process fixture; restore
both builtin exports before cleanup. This is an operation count, not Linux Web
wall-time evidence, and opens no browser.
`hub/test/session-resume-component.test.ts` uses a sealed disposable project,
`projectHub`, fake time and in-process adapters and spokes. No harness process
or browser is needed.

The native-resume rename matrix holds the adapter after role reservation and
credential persistence. Its early spoke uses the actual relaunched credential
with `assignRole: false`, so fixture setup cannot change the role under test.
Rename through the Coordinator's public tool, then release success, a missing
conversation, a native exception or a permission refusal. Bound native entry
and settlement independently; always release and drain the held operation
before fixture teardown.

Read the fixture's durable `Store.reservations()` before rename, after rename
and after the completed resume reply. Keep the positive original-key assertions,
the final empty reservation list, renamed identity and role rollback assertions.
The shared orchestration owns this behavior for every native adapter; the Codex
fake supplies the native boundary without a real provider.
