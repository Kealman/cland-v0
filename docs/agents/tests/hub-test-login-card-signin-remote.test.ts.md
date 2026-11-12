# hub/test/login-card-signin-remote.test.ts

T2: projectHub, fake native messenger, real authenticated Gateway/Dispatcher,
and a separate memory-only runner injection. No browser or native harness.
`node --test hub/test/login-card-signin-remote.test.ts` uses supported Node 24;
strip inherited `CLAND_*` and obey cover-quiet admission.

Generated cases:

- `secret card native replay retains message identity with deletion`
- `secret card native replay retains message identity with one fallback notice`
- `test messenger signs a disk in again through the shared injected preparation entry`
- `test messenger signs a disk in again through the default Host.signIn operation`
- `test messenger preserves only the stored sign-in link and masks other URLs and registered bytes`
- `Telegram secret prompt checkpoint retains native ingress and drops code text and hash`
- `acknowledged secret cleanup survives component reopen without another native update`
- `card fixture setup failure and failed gateway close keep storage owned until all safe joins settle`

The replay cases send an unregistered sentinel on first delivery. Trusted stored
card classification suppresses text/reason before serialization; every frame still
passes through redactFrame, while only a stored secret hub card reads the raw receive
argument. A same-message replay runs the handler once; the same text on a new
native message is a separate answer. A changed native actor cannot reuse the
captured ingress after cleanup. Ordinary handlers receive redacted text.
Captured cleanup ingress is checked at the successful-reply boundary. The
platform operation follows that durable obligation; component reopen recovers it
without update replay. Deletion happens once;
an adapter without deletion receives one fallback line. Receipt checks reject
both plaintext and its SHA-256 hash. Telegram's prompt checkpoint contains only
chat/message identity and drops transient input after dispatch.
Fixtures prearm staged Gateway, hub, Store and root ownership and provide both
hub-lock and droplet/spend-lock fake process facts with a shared clock. A failed
upper-phase close retains storage/root ownership; every safe peer join is attempted.

The renewal variants check an injected runner and the default captured Host
operation, while injecting disk preparation. They check that the shared preparation entry receives
`signin: true`, receives the exact parsed sign-in URL, retains the same volume and
folds its code card. The link-control case observes the exact message receipt and
inbox card. Other URLs in that card, nonallowlisted origins, registered secret
bytes, unrelated card kinds and URL-prefix mismatches stay masked. The real
preparation/native writer/snapshot boundary needs the native integration case.
The existing hub-cards retention probe scans database, journal, logs, history
and mirrored outcomes, with the handler returning its input to exercise masking.
The Telegram/Discord API files each include a `deletes the exact native message`
case against their loopback fake API, including Discord's absent-message replay.
