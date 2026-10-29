# hub/test/telegram-graceful-restart.test.ts

T2 production frame/fake Bot API seam through the sealed voice fixture. Run alone
with `node --test hub/test/telegram-graceful-restart.test.ts`.

Both 30-second and four-minute injected stops require a persisted recovery
boundary, unique late input, connected local status without a failure reason,
and no offline/recovered failure notices. The short stop keeps one card; the long
stop replaces it and retires its original native copy. The unchanged legacy
network-outage cases in telegram-cards.test.ts keep the older persisted shape.
No real platform, credential, browser or daemon is used.

The optional `planned` tag is internal persisted state, not a new frame field.
Telegram clears it after catch-up and promotes it to a failure on actual native
error. Remotes status omits its failure timestamp/reason. Doctor consumes the
unchanged status contract; web and Neovim consume the unchanged remote.state.

Two additional controls use the integrated `remotes-fixture.ts` startup boundary.
An omitted serving receipt and a pre-aborted receipt must reject within the
owner's setup bound, then join both native fake servers, stop hub writers, close
storage and leave zero native work/observations/timers. These controls add one
in-process hub for the omitted case and none for pre-aborted setup.
