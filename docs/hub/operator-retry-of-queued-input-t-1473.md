## Operator retry of queued input (T-1473)

`cland session retry <name> [message id]` can force a never-attempted human
message queued for more than 60 seconds through the busy hold. Without a message
id it selects the oldest eligible queued or uncertain delivery. Only the selected
message bypasses busy, through transport acceptance and its first native injection;
other queued input stays held. A live transport is required. The queued record
still advances to delivered only after acknowledgement, and to injected only
after native confirmation. The log records `inject-retry` with `stage: queued`.
Refusals retain the legacy `no uncertain delivery` phrase and identify the
selected message's recipient stage and age in milliseconds
since queue admission; a missing delivery has unknown stage and age.

Attempted-unconfirmed delivered input cannot use this path. Its existing
busy-to-idle/reconnect recovery and backoff remain in force. Uncertain deliveries
keep the existing explicit operator replay path and never replay automatically.
The message-id request and `{retried:true}` reply remain compatible with older
hubs; omission of the id requires a hub with queued-input retry support.


### Parallel-edit source lists

CLI help lives in `hub/src/cli/usage/<command>.ts`, behind the existing `usage.ts` exports. Palette help expectations live in `web/test/palette-help/<area>.json`. Test guides live in `docs/agents/tests/`; regenerate their index with `node hub/test/generate-test-docs-index.ts --write`, including after a merge of new guides. The static check reports derived-index drift without changing exit status. Skill provenance uses one `CHANGES/<item>-<topic>.md` entry per change; recursive init/update copying and whole-skill hashes include those files.

### Bridge and flush process-log diagnostics (T-1475)

`bridge-connected` and `bridge-closed` in `.cland/log/hub.log` carry the
connecting process row's `harnessId` (native job id) and `pid`, including null
when unknown. A disconnect for a replaced bridge logs `bridge-stale-closed`;
the adapter disconnect receipt also treats generation-invalidated or unwatched
bridges as stale. It uses the native owner, without a second logging registry.
Identity is captured on connect,
so a later process-table update cannot attribute the old close to a newer job.
Generation changes and adapter shutdown retire native bridge ownership while
storage is live. Disconnect uses that captured native ownership only, without
reading storage; late socket cleanup is safe after the Store closes.

`flushed` keeps legacy `count` (pending delivery candidates) and adds `sent`,
`held` and `heldReasons` (counts keyed by reason). Sent means the spoke transport
accepted the frame; only `acked` and `injected` prove later delivery boundaries.
Held reasons are `human-busy`, `heartbeat-not-idle`, `digest`,
`stale-connection` and `transport-rejected`. Counts cover the ordered flush,
including carried notices; digest-only notes filtered out by pendingFor are
outside that flush. Older rows without these fields have unknown sent/held
counts. These diagnostics remain process-log-only; they do not add journal
lifecycle events or change delivery policy.

### Portable fixture socket recovery

Explicit test listeners use `shared/fixture-sockets.ts` (the test-support path
remains a compatibility export). This Node-only module is imported directly by
hub recovery and Nvim, outside shared wire/browser barrels. Socket nodes live in
private `.fixture-sockets` directories inside disposable roots; short `/tmp`
symlink aliases keep the UTF-8 path plus NUL below 104 bytes on macOS. Reciprocal
root-owned alias records precede alias creation. After native writer drainage,
fixture owners and suite-lock recovery stream only the owned disposable tree,
verify reciprocal targets, unlink aliases and remove the ordinary root. They do
not sweep global prefixes or recursively remove external targets. Incomplete
drainage retains a live writer's root and records through its removal guard. Hub
teardown attempts every resource and directory even after earlier failures, then
reports all errors; unrelated errors do not retain drained roots. This changes no command, setting, role
permission or production hub socket placement.

