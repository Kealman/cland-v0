# hub/test/host-contract-coverage.test.ts

T1 source inventory at the Host contract seam. Compare interface members with
Host accesses in the reusable suite. An injected uncovered member proves the
guard fails closed for additions; no processes, provider or filesystem fixture
are started. This inventory does not prove assertions are adequate.

The optional capacity case calls `optionalCapacityHostContract` on the local
Host (absence) and a controlled publisher (exact report bytes, then unsubscribe).
A fresh subscriber receives a second distinct report before the test checks
that the removed subscriber's count stayed fixed. Dropped delivery and a leaky
unsubscribe are positive controls that must fail the reusable contract. The
existing exhaustive inventory and planted uncovered member assertions remain
unchanged. Real fake-SSH delivery uses the same helper in host-agent.test.ts.
