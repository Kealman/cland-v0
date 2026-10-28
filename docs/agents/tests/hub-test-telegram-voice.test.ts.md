# hub/test/telegram-voice.test.ts

T2 uses sealed tempProject/projectHub, the production messenger factory, public
frames, fake Telegram and loopback fake ElevenLabs. No real credential, provider,
platform or browser is used. Run this file alone subject to cover-quiet.

The exact-audio case waits for durable media completion, then checks one human
Telegram-sourced General transcript and one OGG artifact with literal original
bytes. Read the fake provider's multipart bytes, MIME and filename. Retain one
native reply to message 1 containing duration, both timings and provider name;
its census excludes a second General mirror. Timings use FakeClock and are not
provider latency measurements.

Generated missing/off/quota/empty cases retain audio and the exact General text,
one native line and zero provider requests for missing/off. The native command reload proof lives at T3 in
[telegram-voice-command](hub-test-telegram-voice-command.test.ts.md).

The owner stops hubs and drains native I/O before deleting the disposable root.
Explicitly close the speech fake before the projectHub resource check. Sink scans
retain token/URL positive controls, frames, hub log, journal and artifact bytes.
The generic credential redactor recognises `key: cland` as a credential context;
the enable hint uses `key. Run cland secret set ...` to keep the command readable.

Review regressions retain a long literal transcript and reconstruct its complete
body and timing footer from numbered native replies, each at most 4096 code
points. Stable outbox keys identify each part. Media completion and sent echo
outcome are independent durable receipts; wait for both before native census.

The unknown-echo case holds an accepted native send response after General
commits, then proves later input commits while the receipt is held. Stop/join
the first hub and retain the exact held connection's close id. Reopen the same
store, observe the explicit incomplete echo outcome and post-restart General text,
then assert one provider request, one original voice upload, one accepted echo
and both later messages. This is in-process restart evidence, not SIGKILL.
Ready echo intents resume independently from the FIFO; unknown sends retain
their outbox fence and never trigger another provider or General upload.
