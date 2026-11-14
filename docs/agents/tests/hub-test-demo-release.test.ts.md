# hub/test/demo-release.test.ts

T3 process-machine proofs: the detached watchdog confirms provider absence after
the served hub stops, and demo.stop confirms deletion of an archived droplet.
Use disposable fake DigitalOcean and SSH machines only.

The watchdog case delays only the image-marker SSH probe by 2300 ms. This forces
setup beyond the former fixed 2000 ms override; inherit remote-fixture's
remoteWaitMs(10_000) readiness budget (testWaitMs plus runnable load per CPU).
Acquisition and snapshot persistence precede this readiness deadline. The fake
does not intercept or replace the product's marker probe: it runs that command
after the injected delay. Delivery and deletion receive no injected delay.

Keep the exact 8000 ms watchdog receipt bound and single-DELETE assertion: these
prove the identity recheck completes without the ordinary 10000 ms retry.
Run the named watchdog case five times alone, then alongside
hub/test/demo-release-component.test.ts. A dated E-880 allowance covers 16 seconds:
the five macOS lone greens peaked at 10.373260 seconds with an adjacent verify;
16 seconds projects 1.5x headroom. Linux remains unexecuted. The budget stays in
report mode; the exact watchdog behaviour bound does not change.

startDemo (hub/test/demo-start.ts) observes a fresh active, delivered, ready lease
before checking its reply. Failure-only diagnostics report bounded stage/state
facts from that durable lease and sampled observation times; they never dump its
command plan or credentials. A released lease alone does not prove readiness.
