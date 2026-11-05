# hub/test/adapter-generation-forward.test.ts

T3 legacy forward compatibility through sshHostFixture's fake SSH mux and real
Unix socket listeners. The fixture owns the Host, transport and agent, joins their
writers, then removes its disposable root. Its environment uses fixtureEnvironment.
No provider credentials or human browser are used.

Acquire a raw legacy session forward and a namespaced generation forward to the
same host-local endpoint. Assert both exact socket paths exist. Cancel the legacy
id through the unchanged Host API, require its socket's ENOENT receipt and require
the generation socket still exists. Cancel the remaining id and retain its final
absence assertion. The whole-test deadline derives from testWaitMs; setup uses
the shared fixture's authenticated-ready receipt.

Run serially under the stage preservation lock:
`node --test --test-concurrency=1 hub/test/adapter-generation-forward.test.ts`.
Load evidence must name platform, Node, exact head and 5/5 completed receipts;
allowances use the worst loaded sample, owner C-216, expiry 2026-11-11.

The Sessions inventory regression records a positive native SSH argv capture before
local release, requires no new command across two idempotent release calls, and
checks the dropped socket absence while the replacement remains. It kills only
the fixture-owned fake master through its authenticated control path, then waits
for a changed master token plus exact replacement echo. Captured forward argv
must contain the replacement installation and exclude the dropped local socket.

After the reconnect assertions, stop the carrier and release captured ids again.
The positive owner-bound stopped receipt must let Sessions finish after registry
unregistration. A separate T2 control unregisters without a cleanup receipt, then
registers a replacement; both attempts must refuse without touching the new owner.
