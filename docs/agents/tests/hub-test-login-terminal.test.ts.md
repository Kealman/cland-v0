# hub/test/login-terminal.test.ts

T3: `terminal sign-in joins native SSH after hub disconnect` and
`terminal sign-in joins native SSH after CLI cancellation` run a real CLI
against a Unix stub hub and a scratch SSH executable. The executable opens a
scratch file, publishes its PID/parent receipt and waits for termination.
The test captures its native birth before interruption, observes CLI close,
then retains the final positive ESRCH check for the exact SSH PID. Cancellation
must report null exit only after native exit. No installed SSH, harness,
provider, credential, browser or external network is used.

`setup terminal runner captures hub-assigned login with success` and its
`held completion cleanup` variant
uses the production setupMachine.addLogin default with the same terminal owner.
The stub hub assigns codex-7 (setup sends no name); the scratch SSH executable
atomically publishes a PID receipt and exits. The hub's completion observation
and final assertion require that exact PID gone. The supplied fixture environment
chooses its own discovery while ambient CLAND_HUB_FILE points at an absent
scratch sentinel. The held result case explicitly disposes owners: disconnect
sockets first, join terminal work, then close the server and remove the root.
This covers the native default
and admission callback, while setup-hosts supplies the durable ready-row/Aide
component evidence. Its stdout routing exercises JSON-safe stderr output.

Run with supported Node 24 and inherited `CLAND_*` stripped, in the release
preservation slot. The owner stack registers each root immediately, joins
the CLI group and sockets, then closes the server and removes the root.
Setup uses `until`/`testWaitMs`; the native exit bound is separately named.
The outer envelope adds shared load-scaled setup, native join and cleanup
allocations, including the identity probe and owned cleanup budgets. The final
native-exit assertion remains exactly two seconds with loadFactor 1; its budget
is not widened by the outer watchdog.
