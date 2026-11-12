# cland stores login metadata and human-entered keys, leaving disk contents to the harness

Accepted 2026-11-11, recording [v0.4 §3.7](../spec/v0.4.md#37-logins-disk-and-key-capacity-sign-in-signed-out-and-operations)
and [§3.12](../spec/v0.4.md#312-security-and-secrets).
A [Login](../../GLOSSARY.md#hosts) belongs to one harness and account. cland
stores its metadata: name, harness, account, state, last sign-in, bindings and,
for a [Login disk](../../GLOSSARY.md#hosts), provider, region, volume and snapshot
identities, exclusivity and storage accounting. The provider retains the disk;
the harness owns the sign-in files and their rotation. cland mounts, unmounts,
detaches and snapshots it without reading its contents, extracting or keeping
harness session tokens, or copying the human's Mac login onto a host. The local
account registry remains names and paths only.

This is the project's terms boundary for Claude.ai and ChatGPT subscription
credentials: cland does not act as their credential store or token intermediary.
Sign-in uses the harness's own flow on the destination host, with a fresh Codex
home and file credential store and no Claude setup-token. It never runs a logout
to release a login. A new Codex sign-in may invalidate the account's other
sign-ins, including the Mac; adding another is the human's deliberate choice.
Exclusive disks default to one host, and account limits remain per account with
no automatic rotation or failover. A non-exclusive subscription login remains
the human's responsibility.

A [Key login](../../GLOSSARY.md#hosts) is the explicit exception to the local
registry's names-and-paths rule: the human supplies a static key through stdin
or a hidden prompt, and cland stores it AES-256-GCM encrypted in
`.cland/auth/<name>.key`, under `[auth] key` in `.cland/secrets.toml`. The 0.4.0
cut supports OpenCode keys only. The hub decrypts and registers the value with
its redactor, then gives it to the selected harness only in its native spawn
environment over the authenticated agent connection. No key value goes in
argv, a persisted process row, `hub.db`, host files, logs, the journal or
artifacts. This permits concurrent key use without treating a subscription
login as a portable key. The store key and provider credentials stay on the hub
machine. See [the implementation notes](../hub/logins.md#storage-boundary).
