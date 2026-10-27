# web/test/remotes.test.ts

Web tier: build the candidate bundle, then run this file alone. The sealed Web
fixture owns an in-process hub and isolated Chrome Headless Shell. Production
Telegram talks only to the loopback fake Bot API through the fixture's environment
overlay; `projectHub` seals that overlay before startup. Seed pairing/mute in the
scratch database and close the seed handle before serving. No real platform,
account, token, GUI or browser profile participates.

Desktop and 320px phone cases use the same native outage as
`nvim/test/remotes.test.ts`: arm the rendered red-row observer, fault the held
`getUpdates`, and release it. The one-second wall bound has no load multiplier
and includes fault/release I/O and browser rendering; setup has its own bounds.
Wait for the native retry receipt before advancing fake time to recovery. Retain
the final computed-colour and fact assertions, native fatal-401 stopped state,
configuration-disable disappearance, and snapshot readback after page reload.
Long unbroken paired names must fit inside the phone row as well as the page.

The browser-owned second socket uses its cookie and a literal protocol-2 hello:
safe `remote.state` arrives while `remote.status` returns `cli-neovim-only`.
Capture only browser frames, which must exclude the fabricated secret. Fixture
cleanup joins the hub, browser exit and empty browser process-group census before
root removal. These are fake-platform component/rendered receipts, not a live
messenger run or a latency benchmark.

The cheaper client compatibility regression lives in
`hub/test/web-area-state.test.ts`: `connectHub`'s callback receives a snapshot,
a complete replacement containing changed mute/depth/pairing and both messenger
rows, then the previous snapshot shape without `remotes`. It must clear stale
facts, retain Sessions and send no management read.
