# hub/test/discord-artifacts.test.ts

T2: run `node --test hub/test/discord-artifacts.test.ts` alone. Uses production
hub frames and factory, sealed projectHub roots, loopback Discord REST/ws and
synthetic tokens. No browser or real platform is involved.

The cases prove mixed image/PDF grouping and later sent-above references, twelve
files totalling 30 MiB split within ten files/25 MiB per request, a 21 MiB path
fallback, a real Telegram gateway artifact.upload publication fed to the Discord
adapter, timeout reconciliation of an accepted multipart request, and contiguous
started publications ahead of cards, and independent ten-file grouping.
A repeated single-artifact case proves the new short caption precedes exactly
one sent-above reference, with one native upload across both messages. It targets
`hub/src/remote/discord-outbox.ts` through production General frames.
A partial read-failure case restores the unread file and repeats its attachment;
only actual native attachment receipts may say sent above. Fallback settlements
retain the once fence but say not uploaded. Native upload receipts include byte counts
and SHA256; queue settlements are observed before assertions. Multipart fake
validation counts complete request bytes including overhead. The timeout case
holds a stored response and uses a 50 ms native deadline, preserving the nonce.

The exchange owner registers disposal before acquisition, cancels and joins hub,
native requests and observations before closing Store and removing roots.
Default production factory storage shares the hub transaction handle; a second
Store is for fixture preparation and receipt reads, never a substituted writer
inside artifact creation. API-only recovery uses it after the hub stops.

Existing JSON message tests remain the compatibility control. Files use the shared
artifactBody no-follow descriptor reader, bounded by twenty MiB; do not reopen
checked paths. Queue payloads keep ids and captions, not bytes or absolute paths.

The Telegram-origin case pre-registers the shared pacingOwner with the exchange
before acquiring its second hub. That owner bounds acquisition, stops any late
hub and joins the bounded result waiter before Store/root cleanup. Omitted and
aborted setup controls assert the exact stopped receipt and zero observations;
the omitted photo-result cancellation control joins the raw bounded waiter.

Accepted-unknown recovery snapshots the exact sending boundary while the fake
holds a stored multipart response, then aborts/joins that writer before reopening
the snapshot. With the file removed, same-nonce reconciliation still attributes
the original native attachment through retained attempted artifact/name facts.
Restoring and repeating the file must reference the original, with one upload.
