# hub/test/fixture-store.test.ts

T2 resource-owner controls for withFixtureStore, used by host-relaunch setup.
Disposable SQLite roots, no child/socket/browser/provider. Successful and rejected
setup callbacks are held while cleanup starts, then released. Ordered producer
settlement and close receipts, unreadable closed storage, and one idempotent close
prove drainage precedes storage release. No elapsed-time assertion is used.

Run `node --test hub/test/fixture-store.test.ts` with supported Node24 and inherited
CLAND variables removed. The parent owner also drains on a failed assertion.

The shared process-cleanup directory/resource owner makes T2 the lowest admitted
tier; the test itself launches no native process or socket.
