# hub/test/dev-t3-search.test.ts

T-1232 injects a failing search report followed by a throwing blocked notice at
the T1 durable controller seam. Assert the tick resolves, the original error
remains in the store and the secondary failure is logged. Release the report
fault, advance FakeClock and join the tick; assert the persisted reported receipt.
The shared suiteUnit fixture seals its environment and owns teardown.
