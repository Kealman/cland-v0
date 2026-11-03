# SSH transport

`hub/src/transport/transport.ts` defines the stable carrier interface:
`kind`, `host`, `start()`, `stop()`, `wake()` and `status()`. `TransportKind`
is the existing `ssh` type; providers supply machines independently. A project
registry admits one carrier per host and feeds `hub.status.hosts`. The installer
supplies the host record, T-1590 secret store, absolute installed supervisor path,
agent command, host run directory and local hub/spoke endpoints. Code delivery
belongs to its own owner; constructing a carrier neither installs code nor creates
a provider machine. Registered hosts without a carrier report `down`, unknown
`since`, no probe and zero reconnect attempts. Status reads perform no network I/O.

`SshTransport.start()` admits its background loop. Each attempt first sends
`ssh -O exit`, then probes the exact control path with a bounded native Unix
connect. Only ENOENT or ECONNREFUSED authorizes unlinking that exact path (an
already missing path is success). A reachable endpoint, timeout or any other
error keeps the path and ownership fenced, with the ordinary retry backoff and
a short path-free status reason. Exit acknowledgement alone does not settle
cleanup. Masters captured by this carrier are also joined through native child
closure before retry. The project/host registry admits a single loop, including
concurrent starts, across this check/unlink/start sequence. Once absence is
proved, bootstrap is streamed on stdin. The script creates the host-owned run directory at 0700 and calls
`supervisor.sh --check RUN_DIR`, sharing the supervisor's PID/native-birth check.
A live supervisor makes bootstrap return before writing secrets or starting any
background process. Otherwise the per-host secret is written at 0600 and exported
for a `setsid nohup` supervisor. Neither script nor secret appears in SSH argv.
An incomplete or stale supervisor lock still refuses a duplicate supervisor;
this transport never removes that lock or signals a PID read from it.

The master is detached, `-N -M -a -x -F /dev/null`, with `BatchMode=yes`,
`IdentitiesOnly=yes`, `ExitOnForwardFailure=yes`, `ServerAliveInterval=15`,
`ServerAliveCountMax=4` and `StrictHostKeyChecking=yes` against that host's private
known_hosts file and client key path. The config value quotes and escapes the
private path independently of shell quoting, including spaces. Global host-key
files are disabled with `GlobalKnownHostsFile=/dev/null`; `KnownHostsCommand=none`,
`VerifyHostKeyDNS=no` and `UpdateHostKeys=no` keep the private pin exclusive. See
the [OpenSSH configuration reference](https://man.openbsd.org/ssh_config#GlobalKnownHostsFile)
for trust-source and path-quoting semantics. Three reverse Unix forwards carry hub,
spoke and git; the local Unix agent forward carries authenticated agent calls.
All listening endpoints are Unix paths. `-O check` plus an authenticated hello
through the agent forward must succeed before state becomes `up`.

Reconnect delays are 1, 2, 4, 8, 16 and 30 seconds with ±20% jitter and a hard
30-second cap. Thirty seconds of continuous uptime resets the failure count.
The injected clock supplies policy timestamps and timers; native I/O deadlines
stay real. `wake()` interrupts a pending delay; a one-second clock observer detects
backward jumps or gaps over five seconds. Each stable master is probed through
agent.sock every 30 seconds. A failed probe closes the owned master and retries.
`stop()` wakes pending timers, joins native commands/master closure and releases
the project registry slot. Host-side supervisors and harnesses survive tunnel stop.

`hub.status` adds optional `hosts`: `{name,state,since,lastProbe,reconnects}`.
State is `up`, `connecting` or `down`; since is an ISO timestamp or null;
lastProbe is `{at,ok}` or null; optional `reason` is a short failure fact with no
paths or key material. The CLI prints all these facts; it tolerates older
hubs omitting hosts. Web and Neovim retain their existing selected-field readers.
Binary overrides require both fake-host environment controls, as defined by
`sshBinaries`; normal operation uses system SSH. Connection failures log only
host identity and a fixed diagnostic, never pinned key bytes or native stderr.
