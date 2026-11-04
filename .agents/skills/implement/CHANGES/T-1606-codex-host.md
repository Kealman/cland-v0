# T-1606 Codex sessions on a host

Remote Codex uses Host.forward for launch/resume/reconnect RPC, retains the
host socket in harnessId and releases forwards on stop/close/failed launch.
Remote role policy roots are relative to Host.realpath(cwd); absolute roots
refuse. Host canonicalization never falls back to hub paths. Local policy bytes
remain unchanged. Details: docs/hub/adapters-and-sessions.md (Codex), with test
commands in docs/agents/tests/hub-test-codex-remote.test.ts.md.

Shared edits: codex.ts, focused Sessions policy helper and its launch/resume
calls, tier manifest, generated test-doc index. codex-host scratch paths are
shortened for the remote socket prerequisite; behavioral assertions retained.
C4 preservation files unchanged. No wire/Host shape or dependency changes.

Source-review repair: shared launch-settlement.ts / launch-files.ts add bounded,
single-flight async settlement while preserving void callback ordering. Sessions
captures the admitted Host in failed-handshake recovery, waits for cancellation
before row/role release and joins recovery at shutdown. Unknown/revoked Host
cleanup stays pending with a named incomplete diagnostic. Codex terminal exit
and deferred recovery retain/retry forward cleanup; stop joins reconnect work.
Consumer migration: Sessions observers and FailedLaunches await optional results;
Codex-host's two direct settled callbacks now await. OpenCode's synchronous
callbacks and its tests stay unchanged. No persisted record or wire shape change.
New tests: codex-remote-cleanup (T2), launch-settlement (T2); preserved unedited
local launch-recovery (T3) and OpenCode Host controls prove existing cleanup.

Second source review repair (A-16379): the remote cleanup fixture now owns all
held gates and releases them in beforeDirectories before joining Sessions and
closing storage. Directory guards preserve either root without both receipts.
Forced assertion-failure controls retain positive producer-written file receipts
for held subscription and settlement, then assert storage close/root removal order.

Failed verification 8701e07c/A-16385 found missing exact temp-path inventory
registrations. Coordinator b490dba8 also required remote missing-runDirectory
refusal before any path resolution, removing every runDirectory-based remote
fallback to hub temp/Git/run paths. Host /tmp is canonicalized (including a real
symlink fixture); only local uses tmpdir. Register exact conditional nodes with
allowed/rejected siblings in state-paths-lint; ADR0008 records the boundary.

Failed T2 verification 43345e45/A-16402: policy construction now skips Host
realpath entirely when the role/harness has no sandbox (OpenCode's existing
nonlocal refusal case passes unchanged). Real sandbox policies still fail by
host name on realpath rejection, proven in the remote frame. Local cleanup
throws the original native error without the remote incomplete prefix;
name-reservation tests stay unedited. Forced fixture edits: session-host-placement's
three Codex/Implementer Host doubles and host-secret-admission's held-spawn
Claude/Implementer double explicitly delegate only realpath to a sealed scratch
local Host. Their sandbox policies genuinely need that capability. No admission,
placement or refusal assertions changed; default test-host.ts remains untouched.
