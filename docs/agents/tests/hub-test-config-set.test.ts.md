# hub/test/config-set.test.ts

T2 config CLI tests use the shared sealed `tempProject`/`projectHub` fixture,
scratch HOME/Git environment and real CLI subprocesses. Run this file alone with
`node --test hub/test/config-set.test.ts`, subject to cover-quiet admission.

`config set saves web settings for the next hub start and keeps pending edits
out of the loaded config` waits for CLI completion and asserts the successful
`web.origin` save returns `applies: "restart"`. A parser readback confirms the
origin was persisted. A later reloadable remote-budget save must return
`saved; not applied` with `web changed: restart required`; a final hub status
read must retain the budget observed before either save. Keep all three receipts:
saved bytes, restart/refusal text and unchanged loaded budget.

The [reload component guide](hub-test-config-reload-component.test.ts.md)
describes the shared atomic config/roles guard and the equivalent parsed values
control. These tests exercise configuration commands, with no browser or hub
process lifecycle assertion.
