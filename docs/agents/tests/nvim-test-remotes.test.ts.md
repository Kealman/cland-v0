# nvim/test/remotes.test.ts

T3 uses a real isolated headless Neovim binary, sealed native launcher, projectHub,
production Telegram and loopback fake Bot API. No real platform/account/browser
or GUI is used. Run the whole file alone. Neovim runs in a child test scope, so
its native teardown precedes the shared hub/fake/store/root cleanup.

Seed only pairing/mute setup in the disposable database, then observe the actual
Sessions row and cland.panels extmarks. Arm the rendered offline row observer
before releasing the failed held poll, with a one-second native bound separate
from setup. The behavior clock stays frozen until the retry: retain red cause
text and plain recovered facts/marks. This is rendered outage evidence, not a
latency benchmark or General's delayed notice test.

Discord uses discord-workbench-fixture with the production factory, sealed roots and exchange ownership. Pre-arm the one-second red-row receipt before native close 4000; advance one injected millisecond for resume only after offline renders, then require ACK and final healthy colour. Native text, off-provider voice (original recording), approval button and /cland pair feed the actual thread/archive/inbox. No real account or GUI participates; stop the hub and drain exchanges before Store/root cleanup.

The users-mode pairing chooser case opens the actual pairing card, presses `1`
and chooses Bob with `2<CR>` in native `vim.ui.select`. Its final receipt is the
stored `user_remote_pairings.user_id` and `messenger_user_id`, read after the
chosen approval commits. Keep the scratch hub and headless Neovim ownership;
older pairing rows omit `users` and approve through the unchanged direct path.

The native Discord workbench case opens the pairing row's actual card with
normal-mode search and Enter before asserting its complete code. The narrow
Inbox rail may clip that code beside a wide Sessions pane; rail visibility is
not the full-code receipt. Close the card before the archive action, keeping
both the exact code and native approval outcome assertions.
