# hub/test/discord-users.test.ts

T2. Run alone with Node 24: `node --test hub/test/discord-users.test.ts`.
Uses the sealed Discord exchange fixture, its fake clock, loopback REST/gateway,
and projectHub. No browser, provider keys or real Discord.

Both generated cases exercise one channel and two channels through production
frames. Assert General channel membership/count, native message → durable hub
mapping → exact project user, foreign card refusal with no hub answer, exact
ask outcome userId/by, and named folds on every native copy. An accepted FIFO
message bounds ignored stranger text. A fresh Identify after downtime recovers
both users' native messages from channel-specific durable cursors. The fixture
activates the invited second user's row before pairing it. Native send/reaction
pacing is disabled for this identity test; existing unchanged Discord files own
pacing, replay, lost receipts and single-mode compatibility.

The two frozen-history Resume cases interrupt a production fresh-Identify catch-up
only after both pending native identities appear in durable channel batches and
a topic.send is held. Resumable stop persists its native session; the test never
clears it. After restart, require a native Resume, every exact native-to-hub
mapping once with its original project user, cleared batches, and no additional
Identify. Before the startup-reader fix both cases failed at "frozen history
durable receipts after Resume: not within 1500 ms". This covers the retained
checkpoint reader as well as fresh READY recovery.

The three permission-loss cases target a native403 by channel path and, for
warning/card sends, by content marker, so history mirroring cannot consume the
fault accidentally. After restart require healthy-channel history, replacement
card, durable live input, General and a new card, then assert adapter enabled.
Gap denial keeps its checkpoint and missed sources; a later permission-restored
restart must observe the original source reported and checkpoint cleared.
The fake fault selectors are optional; older method-only fixtures keep their
existing matching semantics.
