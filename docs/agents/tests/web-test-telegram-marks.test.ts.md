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
