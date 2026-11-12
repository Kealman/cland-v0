# hub/test/host-tunnel-outage-native.test.ts

T3 uses the host-create fixture, then stops its embedded hub and starts the
scratch hub through the CLI before host creation. The ready receipt therefore
belongs to the daemon whose tunnel is dropped. Native fake SSH, agent and
watchdog are required; no real provider, credentials, browser or built web/dist.

Run alone with supported Node 24, stripping inherited CLAND variables, under
the epic preservation slot. Inventory the exact hc-, ct- and cland-h- name sets
in /private/tmp and TMPDIR before/after; leave pre-existing roots untouched.

`native tunnel outage pushes host alert and CLI scratch control restores it`
subscribes to pushed frames and waits for the named ready host before arming a
3000 ms outage observer and launching the documented down command. It asserts
outage kind and exact host, and independently asserts provider status ready.
After arming a separate recovery observer it runs up and asserts alert null.
It also rejects foreign owner receipts, non-fake pools and unowned hosts.
See the exact QA commands in
[host-provider-fake.test.ts](hub-test-host-provider-fake.test.ts.md#scratch-hub-tunnel-outage-control).

The fixture joins daemon, transport, agent, watchdog and asynchronous writers
before directory removal. A launch acknowledgement alone proves no outage or
recovery. Source-head changes require this native file to run again at that head.
