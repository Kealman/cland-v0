# hub/test/users-docs-invite.test.ts

T2: `node --test hub/test/users-docs-invite.test.ts`. The case
“published users commands switch a single project and renew the second user invite privately”
executes every `sh users-invite` line from the Users and sign-in modes page in
order. `inviteSteps` is shared with the source vocabulary guard. The fixture
starts single, seeds managed config and a fake Git user outside the published
steps, and uses `tempProject` (immediate disposal registration) and `projectHub`
with the real loopback web edge and a Date.now-relative `FakeClock`. CLI children use the harness's sealed environment.
There is no external network, real credential, browser or native hub lifecycle.

The observed receipts are the persisted users mode, CLI list containing both
admins and the second invited user, a fresh loopback invite, and web details
rejecting the replaced invite while accepting the newest one. No passkey or
password is registered; browser behavior is not claimed. The injected clock owns
hub scheduling and invite expiry; native socket timers remain real. The case
does not advance time or assert elapsed-time behavior.
Hub stop joins writers before fixture disposal, including failure cleanup via
the harness. No preservation slot is required for this T2 file.

Invite bytes stay in memory. Captures replace URLs before storing text; raw
results never become assertion values. `captureStep` withholds private thrown
diagnostics. Before scanning capture and hub logs against each actual invite,
the scanner must reject a planted one-use-link positive control. Do not print
URLs, secrets, fixture HOME or environment files into QA evidence. QA may run
this file serially and record only its public title, counters and exit status.
Take sorted /private/tmp hc-*, ct-* and cland-h-* inventories before and after;
require no attributed delta and retain historical residue under T-1806.
