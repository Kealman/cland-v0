# hub/test/executor-safety-load.test.ts

`hub/test/executor-safety-load.test.ts` is T4. It runs the shared T2 foreign-lease
case in two concurrent lanes of five, alongside one sealed CPU worker. Each case
asserts that the short-lived hub retained the foreign live resource, then
observes the exact run report and released lease before fixture teardown. The
guard requires all ten completed cases and CPU progress during each one; its
terminal diagnostic names 10/10, two workers, platform and executor. It uses no
browser, SSH, worker subprocess or real provider.

Run it only through `cland verify`, which holds the package runner's exclusive
machine lease. Do not invoke the file directly: the tier and runner provide
admission, and this test does not detect or acquire leases. T-1259's criterion requires the receipt from
macOS, so its mode-free verification uses `--executor local`; a Linux receipt
alone cannot establish that criterion. The `loadGuards` mappings in `tiers.json`
select it when the shared case, component file, clock driver or remote fixture
changes. Changed T4 files also run once in ordinary task verification. T4 load
repetitions are not repeated again by the identity load gate.
