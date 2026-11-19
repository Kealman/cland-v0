# Remote implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Request validators distinguish known-invalid fields (`invalid_argument`) from
unknown types. Pairing codes share the CLI/protocol format module; preserve
error-only older-hub replies when changing request diagnostics. See
[remote commands](../../../docs/hub/remote-commands.md).

For provider credential work, read docs/hub/provider-credential-migration.md for
the human's startup-export migration, store command and shell evidence limits.

## Users-mode remote publications

Use `remotePublications` and `RemoteStore.publicationPairings()` for outbound
General and card copies, independently of the current native input context.
Keep native admission pinned to the captured project owner through awaits.
Telegram chat availability and gap state are per destination in users mode;
single-mode keys and labels remain compatible. See
[remote commands](../../../docs/hub/remote-commands.md#telegram-publications-in-users-mode).
