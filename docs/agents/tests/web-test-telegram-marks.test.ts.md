# web/test/telegram-marks.test.ts

Web tier, using the shared `hub/test/telegram-marks-fixture.ts`: production
Telegram and speech clients, loopback Bot API and speech fakes, sealed scratch
hub and isolated pinned Chrome Headless Shell. No external service or real
credential is used. Build with `npm run build` before running this file alone.

The fixture waits for each exact media identity's durable completion, native text
history and the button approval's archived outcome. Fake time drives outbox
pacing; the clock starts on today's date so archive filtering agrees with clients.
Assertions read actual per-message headers, Markdown bodies, audio artifact
names and the exact approval archive row. Successful, empty and quota transcripts
exercise all three marks. This is native fake-platform evidence, not phone QA.
Stop the hub and close speech before fake/root disposal; the shared owner is
registered before acquiring native resources.

Native photo/document captions beginning with 🎤 remain literal body text;
recording inference uses the artifact extension/generated audio/video-note name.
The typed marker without an attachment stays literal too. Setup is pre-owned
through pacingOwner/startHub before workbench acquisition; omitted/aborted
receipt drainage controls live in hub/test/telegram-marks-setup.test.ts.

The native two-audio album includes a first filename beginning `not transcribed: `
and a second-member quota failure. Independent literal body assertions keep both
filename headings in place; the standalone success/empty/quota and typed-caption
controls remain. The fixture waits for durable admission before advancing the
injected two-second album quiet window, then for every member's completion.

A second native album has one sentinel-named audio and a declared 21 MiB peer.
The fake allocates no oversized buffer. Observe both durable completions and the
native refusal, assert no extra speech call, and retain the surviving heading in
the actual body. Filename-heading matching precedes standalone failure parsing;
attachment count alone does not identify an album after filtering.
