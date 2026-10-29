# hub/test/discord-inbound-media.test.ts

T2 uses sealed tempProject/projectHub, production frames, fake Discord REST/ws/CDN,
fake Telegram and fake speech. Run this file alone, subject to cover-quiet. No
real platform, key, browser or native speech process is used.

The photo case observes the durable input cursor, checks one human General
message with caption and original artifact bytes, then waits for Telegram's
native file receipt and checks exactly one `you (Discord)` caption. Duplicate
Discord dispatches must not download or upload again. CDN captures record only
file id and Authorization presence, never credential values or signed URLs.

Voice retains original filename, MIME (audio/ogg fallback) and bytes in both the
artifact and provider request. Wait for the echo's sent outbox settlement, then
check the reply reference with fail_if_not_exists:false, empty allowed_mentions,
duration, download/transcription timings and provider. These timings describe
this fake loopback run, not provider performance.

The duration case observes the terminal cursor before checking zero CDN/provider
requests. A second note at the inclusive duration boundary replies to a mapped
ask and commits its text outcome with no recording artifact. Download cases
exercise expired-URL refresh through authenticated GET message, a refused
redirect, a same-origin path outside the fake CDN and a declared oversized file.
They retain final artifact bytes or empty General assertions after the cursor.

Stop and join hubs, speech and fake servers before fixture root removal. Existing
Discord message/cards/history regressions retain legacy text and outbox shapes.

Review regressions retain three mapped-answer cases: free text, an options-only
number with punctuation and an options-only case-insensitive label. All successful
answers commit the ask outcome and retain no audio. Held native CDN and speech
cases arm request/close observers before dispatch/stop, assert no pre-stop
publication and no input/cursor confirmation, check READY-only persisted sequence,
then resume and assert one original-byte recovered upload/transcript.

The offline history case expires the resumable session, pages across 101 foreign
messages to attachment-only photo and voice inputs, and refreshes an expired
photo URL. It checks final cursor, cleared history checkpoint, exact artifacts,
late metadata, native maps and one provider request. Native REST pages preserve
original URLs separately from redacted fake captures. Existing text history
regressions stay unchanged.

Captioned photo RESUME retains the literal caption and exactly one late note;
text replay remains owned by DiscordRemote and media replay by DiscordInbound.
The held-I/O cases pre-register the shared pacing startup owner with the exchange
before acquisition. Speech request polling exits on its owner's abort. Omitted
and aborted serving-receipt controls exercise that same startup owner, hold its
drain boundary, assert the Store/root remain available, then release drainage and
observe stopped hub, closed fake server, zero pending observations and root removal.
The emergency hold releaser is registered before acquisition as well.
