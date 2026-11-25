# Artifacts implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Artifact inline content is limited to 65536 UTF-8 bytes. Publish larger material
with `path`. After a lost reply, reuse the same `retryKey` and identical arguments
(`cland artifact new --retry-key <key>`); a new key requests a new artifact.

Closing and reopening a topic moves retained artifacts between archived and
shared and publishes their updated chips. These retention moves preserve history
and do not publish new artifact creation or sharing subscription events.
