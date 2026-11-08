# Detached host watchdog

A provisioned pool host arms a detached Node process after the provider returns
its machine identity, before transport setup. The lease stores its PID, UTC start
and native birth identity. The worker inherits the hub environment; argv contains
only code and a private input-file path. It resolves the provider through
`HostProviderRegistry` and never opens `hub.db`.

The worker reads the atomic per-host lease mirror every second. Renewal extends
only the published deadline; failed publication retains the previous deadline.
A missing or invalid mirror grants no extension. At expiry the worker retries
provider release until confirming reads prove both machine and SSH-key absence.
It publishes a private receipt before settling the machine-local `hosts` ledger.
The first absence timestamp wins across concurrent hub and watchdog cleanup.

Explicit destroy and failed-create rollback stop the identity-verified watchdog
only after confirmed provider deletion, before releasing the lease. Shutdown of
the hub alone leaves the watchdog running. Re-arming after restart belongs to
T-1752. A provider acquire whose outcome is unknown remains an acquisition fence;
this worker requires the returned machine identity.

DigitalOcean host acquisition remains subject to its existing admission refusal;
this item proves the lifecycle using the sealed fake provider only. No real
provider deployment or network is covered.

Retained absence receipts bind root, host id, provider and every captured machine
identity field, and require nonempty confirming reads for both machine and key.
The shared parser checks startup and create-only publication conflicts; older
unbound, malformed or mismatched evidence fences settlement and is retained.
Retirement requires positive native absence or a readable replacement birth.
An unreadable birth on a live PID keeps the input, lease and recorded identity.
