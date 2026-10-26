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

## Remote and speech settings

T2 uses `projectHub` and the existing sealed CLI/frame clients. Configure a
`gatewayMessenger(via, token, settings)` factory returning `testMessenger` from
`hub/test/fakes/messenger.ts`; secret values enter a private scratch file or
stdin, never a frame or argv. Platform clients are absent from this seam.

`config set and hub reload start and stop configured messengers only with a
token` proves enabled-without-token inactivity, CLI enable/disable and explicit
reload for both platforms, the welcome and successful hub.status request receipts,
unchanged-reload retention, and completed stop before the reload result.
`shutdown joins a messenger start held during config reload before removing its
store` registers `heldRemoteBoundary` before fixture creation, arms its bounded
setup observer before reload, releases during shutdown, and joins owned reload
and stop receipts before the fake's final stopped assertion. Missing-receipt and
aborted-setup controls drive the fake deadline or abort, call the registered
disposer and retain the messenger stop, hub stopped and empty-timer receipts.

`a remote secrets reload refusal retains valid role admission and the last-good
pair` checks the exact secrets refusal, retained config provenance, absence of a
false roles-unreadable event, remote-configuration attribution and the fake
harness's subsequent launch/model receipt under the valid role policy.
The two held-preparation source-edit controls freeze only interval refresh,
change config.toml or roles.toml after setup entered, then retain the exact
changed-during-reload refusal and unchanged config/roles publication. Their
registered hold owner drains before hub and directory disposal.

The [T1 config guide](hub-test-init-config.test.ts.md) covers defaults,
migration and writer validation. Existing frame requests and replies retain their
previous wire shape; reload's applied list gains names.
Run `hub/test/cli-imports.test.ts` (T3) when changing daemon secret loading;
the lightweight CLI must not import secret resolution.
