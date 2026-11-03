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
