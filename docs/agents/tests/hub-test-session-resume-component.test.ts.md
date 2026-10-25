# hub/test/session-resume-component.test.ts

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
