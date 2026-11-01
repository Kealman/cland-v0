# hub/test/host-contract-coverage.test.ts

T1 source inventory at the Host contract seam. Compare interface members with
Host accesses in the reusable suite. An injected uncovered member proves the
guard fails closed for additions; no processes, provider or filesystem fixture
are started. This inventory does not prove assertions are adequate.
