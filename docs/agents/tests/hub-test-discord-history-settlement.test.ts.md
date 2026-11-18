# hub/test/discord-history-settlement.test.ts

Pure T1 controls for the full-scale Discord history observation helper. Fake time
proves that both forwarded-input count and sent-overflow receipt are required,
that completion after ten seconds remains observable, and that missing receipts
expire at the bounded observation budget. The helper uses `testWaitMs` with
100 ms per expected input as its fallback, then `until` applies the shared load
factor for a real clock. An injected clock keeps exact fault boundaries; the
configured wait override has its own control. No native module, process, socket,
or real delay is needed. These controls do not supply full-scale timing or loaded
run evidence; that belongs to `telegram-polling-restart.test.ts`.
