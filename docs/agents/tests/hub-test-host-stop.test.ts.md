# hub/test/host-stop.test.ts

Lease creation, renewal and the destroy owner's lease release use the fake
lock process table. The positively controlled launch guard spans setup and
cleanup in all stop cases. CLI-only help coverage is separate. This stays T2.

T2, in-process projectHub, fake clock, provided Hosts and scripted fake provider
release receipts. The settled disk uses an allocated/attached directory-provider
volume and a recording loginDisk Host, so stop proves unmount and detach before
its scripted machine/key deletion receipts. Run `node --test hub/test/host-stop.test.ts` under supported
Node after targeted admission. No native host or provider network.

- `C3 stop joins lease renewal and requires confirmed destroy: true`: live codex
  on z-host, confirmed machine/key absence, durable destroyed row, exited session
  and removed lease. The fake adapter supplies its captured generation receipt.
- `C3 stop joins lease renewal and requires confirmed destroy: false`: deletion
  remains incomplete, destroying row stays fenced and advancing the fake clock
  does not renew its lease.
- `C5 host help lists status and stop`: actual CLI help.
- `C4 manual create refuses occupied max_hosts before publishing another row`:
  injected creator uses production admission; the second request names max_hosts.

Authority preservation also runs host-secret-admission.test.ts (sessions and
host-forwarded clients) and web-authority.test.ts (authenticated web). The existing
T3 host-destroy-native.test.ts supplies real transport deletion preservation;
these T2 tests do not claim native or DigitalOcean coverage.
