# web/test/pairing.test.ts

Web tier. Build the candidate bundle with `npm run build --workspace web`, then
run `node --test web/test/pairing.test.ts`. The sealed `webFixture` owns the
in-process hub and isolated Chrome Headless Shell. Trusted test messengers issue
both platforms' codes without a token or platform connection. The integration
also owns pinned headless Neovim through the native client helper: C2 needs the
actual card key on Neovim's own connection against the same hub as the browser.
Neovim belongs to a nested test context: its startup failures and process disposal
settle before the parent Web fixture closes the shared hub. Register the native
PID reaping check before creating Web, and retain the parent cleanup census for
native hub processes naming that fixture root. Any unexpected hub is captured
and reaped before directory removal, but still fails the test as a leak. The
normal receipt is zero hubs before emergency cleanup and zero after. This prevents
a live Neovim from autostarting a replacement hub during Web teardown, including
the ten fresh-process Web repetitions. Drain both clients before root removal.

The desktop/phone cases inspect the exact pairing rows, selectable read-only
approval commands and absence of approval controls. Real key presses on rows
and nested text controls must produce no answer/grant frame; shell digits may
navigate away, so explicitly return to Inbox before each independent key.

The cross-client case checks both full texts and the section count, presses
Enter then `1` in the real card, observes the persisted numeric grant through
`remote.status`, then drives inbox publication and retains both rendered-row
assertions, including another waiting Telegram code cleared by the same grant.
The key stays inert on the pairing row and empty header, and stays text in the
General composer; closing the card grants nothing. An injected clock crosses
Discord expiry, removes both inbox rows and a selected Web split detail,
and leaves an already-open card unable to grant access. Keep its hub refusal.
Pairing entries must leave active visit caches; other Inbox departures keep
their existing visit outcomes. No real messenger, browser profile, harness or
credential participates; this is headless fake-platform evidence only.

The previous-hub case removes `pairings` from actual received frames and checks
that existing message rows still render and select without a pairing section row.

Dated E-1313 allowances in `hub/test/durations.json` retain Linux samples from
A-12630: desktop 6.076820519 s, phone 5.462975472 s and cross-client 3.106363024 s.
The 9.2/8.2/4.7 s caps round up roughly 1.5x those passing assertion samples;
the underlying suite remained red on unallowed durations and leaked native hubs.
They are not a green-suite baseline or an excuse to omit teardown assertions.
