# hub/test/executor-deletion-watchdog.test.ts

`hub/test/executor-deletion-watchdog.test.ts` (T3) uses a scratch project,
projectHub setup, fake DigitalOcean HTTP server and native detached watchdog.
The project hub is stopped before the test lease is acquired. Expiry is published
only after acquisition, then the test waits with a bound for `watchdog.json`.
A key-read observer is armed before expiry and asserts no receipt while the key
exists. Final assertions require absent resources, repeated DELETEs and final
GETs by both ids. Fixture cleanup stops process writers before removing roots.
No cloud credential or real resource is used. This is not suite timing evidence.
The watchdog control also discovers extra droplet/key ids once, omits them from
later lists, and requires final GETs and absence for every id. Its own atomic
`watchdog-cleanup.json` retains discovered ids and accepted deletion times across
attempts/restart; hub release merges this record without a watchdog lease rewrite.
