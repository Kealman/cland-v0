# hub/test/pool-scale.test.ts

T2, `projectHub` with injected create and provided Hosts, no children. Cases:
`C1 startup maintains min_hosts without a launch`;
`C2/C4 booting counts toward max and two launches share one new host`;
`C3 raising max_hosts places a waiting launch without restart`;
`C5 overflow never exceeds max_hosts`;
`destroying host fences max_hosts and takes no placement`.

The create seam saves a durable booting record and holds completion until released
or hub shutdown aborts it. Assertions observe waiting reasons and adapter process
publication. Config-set runs through its real frame/parser/hot-apply path.

The native companion case lives in `hub/test/host-create-ready.test.ts`, named
`T-1746 waiting pool launch creates a leased watchdog host and is placed`.
It uses a prepared fake image, native fake SSH admission, clone, host agent and
detached watchdog; the session adapter is in-process fake Codex. No real provider
API or real harness authentication is used. Run that file serially under the
stage preservation lock; fixture cleanup joins creators, hubs and watchdogs.


Source-review corrections add last-slot manual/automatic races, invalid-item
refusal, cancellation during held image preparation, lowered limits and removed
pools at pre-row admission, and failed pending/incomplete ownership retained
through config application and a real in-process hub restart. Producers publish
a completion counter in `finally`; refusal assertions wait for that receipt.
Fixture resources release held preparation and boot gates before UI/hub teardown.


Generic demand cases refuse a Lead without an item and an invalid name for an
otherwise valid item, and retain no wait or create. Role-removal preparation is
held through reload and must leave no row. The memory-floor case preserves the
Coordinator's policy: a ready host with spare weight and a memory refusal keeps
its diagnostic wait and does not create another host, even below max_hosts.


T-1763 adds three T2 regressions using the hub clock and real lease database,
ledger and mirror with an injected fake-provider creator (no native acquisition):

- `T-1763 startup and demand hosts renew running sessions after scale-up`: min=1,
  max=2, w1 on H1=b, then w2 on H2=a. Reverse lexical ids reproduce QA row
  E1534S2-55. Each 7.5s clock tick awaits both persisted lease mirrors. Stopping
  w1 leaves newer busy H2 preferred over idle H1, whose expiry is observed.
<!-- cland-allow-closed-wording: literal test title, "until" describes the lease renewal, not the item -->
- `T-1763 manual host placement promise renews until failed launch releases it`:
  min=0 manual create, hold directory preparation before adapter spawn; renewal
  persists while held, then stops after the refused launch releases its promise.
- `T-1763 minimum keeps older idle startup host when manual host appears`:
  older H1=b keeps renewing while excess idle manual H2=a expires.

Expiry callbacks in these component cases record the renewal owner's terminal
boundary; provider deletion itself remains covered by `host-lease.test.ts` and
native `host-watchdog.test.ts`. Run the latter under the stage preservation lock.
All new successful cases are below 3s on macOS; no duration allowance is needed.
