# hub/test/host-unreachable.test.ts

T2; FakeClock, synthetic carrier transition events, directory-only fake provider,
in-memory harnesses and injected lock/watchdog births. No real SSH, provider API,
droplet or browser is required. Run `node --test hub/test/host-unreachable.test.ts`
with a supported Node and inherited CLAND variables removed, subject to targeted
admission. The normal mode-free task verification also selects the file.

- `three minutes down publishes one unreachable line and recovery preserves the host`:
  C1/C2; exact 179999/180000 ms boundary, list state, occupied count, recovery,
  duplicate-down suppression and an up-only negative control with no timers/API.
- `lost host invokes the confirmed deletion owner: provider gone=false/true`:
  exact 899999/900000 ms deadline and immediate positive provider absence.
- `shortened health clocks require the fake-host fence: false/true`: C6; both
  timeout knobs, ignored outside the fence and effective inside it.
- `lost deadline joins renewal and publishes now before deletion ownership`:
  authoritative and mirror deadline observation.
- `a restored unreachable host already up clears its retained outage state`:
  restart recovery without a new notice or provider read.
- `registry replays the continuous outage start: later loss=false/true`:
  C5; delay restore by a minute, then observe the warning at startup + 3 minutes;
  synthetic up and unsubscribe exercise the real registry hook.
- `outage settles sessions and roles: recovered/lost/gone/mirror-failure`:
  C3/C4; real Sessions/ProcessTable/confirmed destroy owner, mirrored deadline
  before deletion, durable machine read, exited row, vacant role, absent lease
  and joined injected watchdog. Recovery keeps the running row and its role.
- `provider replies are fenced by the outage and flapping checks are rate bounded`:
  old positive absence cannot destroy the new outage; a new admitted check can.

These cases are component evidence. They do not claim real-provider network or
native SSH reconnect behavior. Existing native transport and host tests preserve
those seams and run serially under the preservation lock for this item.

`loss waits for ledger-blocked renewal before publishing the watchdog deadline`
adds a real ledger-lock contention boundary with injected process births. Loss
keeps the old deadline while renewal is held, then joins it before publishing the
expired deadline; advancing an hour afterwards cannot renew it again.


The `idle stop and outage grace retain a 30s lease` cases cover min_hosts=1 with a 30-second lease, one idle host and
an optional reverse-lexical spare. At 3m30 the lease still renews, no minimum
replacement is created and placement refuses the held host. They run the real PoolRuntime idle-stop
lifecycle with idle_stop=30s and an observed destroy admission counter: neither the ready
pre-warning phase nor unreachable phase may admit idle destruction. Recovery at 10m
clears the state without another notice; the loss variant uses the production
loseHost seam at 15m. Each renewal waits for its durable deadline before the
next fake-clock step. Mirror-failure destruction logs one typed failure and still
settles the session/role with a confirmed deletion read. The separate failed
shortening case proves the owned next-second publication retry and shutdown drain.

CLI form C1 is additionally covered in host-create-entry.test.ts: both list forms
return the same JSON including unreachable, and --yaml refuses. Frozen CLI usage
and CLI help regressions accompany that argument change.


Compatibility regression coverage also includes the exact existing cases in
session-pool-placement.test.ts (`a moved current row leaves unknown retained
native capacity on its source through restart`) and waiting-launch-restart.test.ts
(`restart preserves typed memory evidence until a fresh host memory report` and
`different-name idle reuse consumes the admitted wait at publication and never
replays`). Supplied Hosts have no registry carrier; replay must emit no fabricated
down state, so positive retained-generation cleanup and restored waiting launches
remain usable. All three assertions reproduced red before the missing-carrier
replay guard and passed together after it, with no assertion changes.

Consumer selection must follow the shared suite import graph through helpers
and re-exports, union explicit contract consumers and retain unknown paths
conservatively. A direct-import-only selection omits these harness-mediated
restart cases. The initial extra five-file run passed before the outage hold was
introduced; later direct-only selections did not rerun the two indirect files.
This was a selection gap, not platform timing or skipped tests. Final configured
T2 coverage must include these files and the graph-selected or unknown consumers.
