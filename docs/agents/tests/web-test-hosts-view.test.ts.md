# web/test/hosts-view.test.ts

Web tier, disposable projectHub and lockfile-pinned Chrome Headless Shell with
its own user-data-dir. Run on supported Node with inherited `CLAND_*` variables
removed: `node --test web/test/hosts-view.test.ts`. The before hook builds missing
or stale web output. No real provider, SSH, credential or harness login is used.

`Hosts Stop preserves cancellation and reports native deletion outcome: confirmed true`
and `confirmed false` drive the real authenticated web `host.stop` handler, using
the directory-only fake provider, test Hosts and the in-process Codex adapter.
It reads the named host and session count in confirmation, observes ready
inventory after Cancel and folding, then observes durable destroyed inventory
before advancing the hub FakeClock for the coalesced push. It keeps final
assertions for the detached host row and the exited process in `session.list`.
The incomplete control returns a native provider refusal to confirm deletion,
retains destroying inventory, and checks its native state/reason on that host row.
Both lock process dependencies are fake. Fixture owners join the hub and browser
before directory disposal; the fake machine directory has an explicit owner.

`Hosts login binding swap with equal pool totals renders from the durable mutation
within one second` captures the hub-owned HostRecords at the registry factory.
It swaps the bound login without changing the pool summary, retaining a literal
deep-equal check of those totals. The observer precedes mutation and the exact
one-second bound includes production coalescing, the socket replacement,
login.list refresh and DOM rendering. No carrier frame is injected. The final
rows must read ready/unbound and in-use/bound respectively. This control failed
before the producer's login invalidation fix.

`Hosts view lists login metadata and refreshes pushed changes (desktop)` and
`(phone)` seed two disk logins and compare the rendered metadata with the local
human `login.list` response. A fake socket carrier supplies two hosts and
`hosts.state` pushes; login reads still go through the real authenticated handler.
These cases prove push-to-render within one exact second for bound, released and
signed-out metadata, rather than measuring producer coalescing. They check the
warning token, a refused Stop on the affected host line, and no `host.status`
request. The phone case checks document and view width at 320px.

Existing `web/test/hosts.test.ts` retains production projection/coalescing,
uptime, counts, outage recovery, folding and previous-hub snapshot coverage.
No wire, native lifecycle, authority or keyboard contract changes. Native T3
receipts remain with the merge occasion; T4 and real stage QA run on dev under
the epic brief. Mode-free Linux verification after source review supplies
T1/selected T2/Web evidence; local targeted macOS results are partial evidence.
