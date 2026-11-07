# hub/test/transport-forwards.test.ts

`node --test hub/test/transport-forwards.test.ts` runs fake SSH masters against
an in-process authenticated agent and Unix echo targets. No real SSH/network is
used. The C1 native census uses `lsof`, with a planted loopback listener proving
detection before forward creation; the control is the sole intentional TCP bind.
C2 asserts native cancellation argv, absent nodes and failed connections. C3
waits for both answering forwarded targets after master SIGKILL (10 s bound),
and excludes cancelled sessions. A separate exhaustion case proves three failed
restore attempts, one terminal session log and no retry on another replacement.
Whole-test duration includes setup and the case’s reconnects;
it is not recovery latency. Carrier stop joins all fake SSH children; the agent,
peers and echo servers close before storage and socket aliases are removed.

Injected session unlink failures cover acknowledged cancellation retry/stop,
exhausted-restore terminal logging without reinstall, and failed initial install
cleanup. The TCP positive control is joined before checking both worker and master.

Pending-removal failure receipts capture the exact socket, errno and replacement
master token at the rejection boundary; the collector is armed before SIGKILL.

The fixture injects 10ms reconnect delays and a 10/10ms forward retry schedule.
Production defaults stay 1–30s with jitter and 100/200ms, respectively. These
cases prove native closure, answering recovery and retry counts; production
backoff timing remains covered by the unchanged carrier/policy tests.

C1's planted listener exercises the same zero-listener assertion as the final
census. Its expected failure must identify the PID, all census sources, full
command, parent PID and native birth identity (`darwin:` or `linux:`). The final
census retains both the worker and every native control-socket holder; a PID
selected by both retains both reasons. Every offending PID is reported together
with its raw listener rows. A process that exits during diagnosis is explicitly
unavailable, never silently omitted. `lsof` and `ps` probes have 3-second caps.
The native birth reader and cross-platform process-table parser are the shipped
shared modules, rather than a second platform parser in this test.

QA can locate C1 with `--test-name-pattern='C1 Unix'`. Linux container diagnosis
requires `docker run --init`, `lsof`, `ps` and a supported Node 24 runtime. Record
the source head/diff, each repetition's native exit, host one-minute load and
whether the run was isolated or in a parallel worker mix. Container receipts are
supplemental and do not establish a Linux droplet receipt. The item topic owns
preservation-slot scheduling; hold its lock for heavy native targeted commands.
No browser, provider credentials or real DigitalOcean API is involved.

Native birth observations bracket both the TCP census and the `ps` snapshot.
Only a nonmissing birth that agrees across all three observations permits command
and parent attribution. If it changes or becomes unreadable, the failure retains
the PID, census sources and raw listener rows with explicit unavailable metadata;
it never labels the old rows with a replacement process's command. The pure
`hub/test/tcp-listener-census.test.ts` cases inject replacement at each observation
boundary and missing native births; the native planted listener still proves the
real stable path. The helper reads metadata only and grants no signal authority.
