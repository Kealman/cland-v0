# hub/test/remote-scripted.test.ts

Use the existing sealed remote fixture with an in-process fake provider,
scripted transport and shared FakeClock. The acquire/deliver/start/collect test
appends a local delivery attempt before the delivered receipt. Wait for the
durable suite report, then assert both the local attempt and the complete remote
test census in the log. This proves remote byte zero starts after local delivery
writes; the previous checkpoint skipped remote bytes and lost the census.
No SSH, provider network, worker process or browser runs in these cases.
