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
