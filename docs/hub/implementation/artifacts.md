# Artifacts implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Artifact inline content is limited to 65536 UTF-8 bytes. Publish larger material
with `path`. After a lost reply, reuse the same `retryKey` and identical arguments
(`cland artifact new --retry-key <key>`); a new key requests a new artifact.
