# web/test/phone-disconnected.test.ts

`web/test/phone-disconnected.test.ts` uses the sealed 390×844 touch/mobile
`webFixture`, public frames and fake sessions. Stop and observe the scratch
hub’s closed socket before testing the phone strip, stable dropped-at and
last-applied times, countdown, immediate Retry and reset backoff. Observe each
failed real socket close before advancing its next timer; use
`reconnectUntilLive` for paused-clock reconnects. Wait for `data-phone` after
resizing before checking the desktop boundary. Keep the retained Inbox rows,
stale time, all disabled answer/reply controls and unsent reply label. A forced
offline submit sends no frame; after restart, compare the resume cursor, new
snapshot epoch, exact raised ask row and durable topic history, retaining the
draft and document identity. Never stop the live hub. Build first; run phone*,
connection, inbox, asks, composer and withdraw targeted before mode-free task
verification. New passing Web identities reaching 4 s need dated, reasoned
E-880 allowances at about 1.5× the worst sample, citing its run.
