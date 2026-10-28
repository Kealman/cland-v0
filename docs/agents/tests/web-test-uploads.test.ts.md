# web/test/uploads.test.ts

Use webFixture's sealed projectHub and isolated Headless Shell. Build web/dist
before a standalone run. Open the native file chooser through its button and
supply synthetic PNG bytes. Arm the POST response before real Enter, observe
its stored message row, then read frame history for one human message and its
PNG, exact caption and no standalone artifact post. Choose a file one byte over
the configured 1 MiB cap and assert its Refused chip, tooltip and disabled Send;
literal s, tilde and @ remain textarea characters. Remove it, choose an existing
artifact through the palette, then add another file and send both at phone width.
Assert exact attachments in history and no horizontal composer overflow. The
existing composer.test.ts retains keyboard routing and text-only compatibility.

A synthetic HTTP 503 after Send must restore the caption and chosen file chip.
The browser never retries that uncertain mutation automatically.

The phone file picker uses a compact plus button in the addressing row; Send
stays beside the textarea. Preserve the unchanged two-row/44 px assertions in
phone-composer.test.ts. Its layout regression reproduced at field y=677 versus
Send y=731 before the button moved. The upload case's E-1311 allowance names the
actual Linux sample/run and expires within seven days; refresh only from measured
passing samples, without relaxing DOM assertions or request bounds.
