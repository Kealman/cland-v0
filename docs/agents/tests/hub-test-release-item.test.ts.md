# hub/test/release-item.test.ts

The package-version refusal case awaits a prepared native fixture separately
from the release CLI's completion. Its former 5,000 ms whole-test deadline
included fixture construction and native Git work, so load could cancel setup
before the refusal ran. The setup receipt has a separate shared load-scaled
`waitTimeoutMs(testWaitMs())` failure bound; the existing CLI helper waits for native completion with its own
30-second bound. These are failure bounds, not timing assertions.

The case deliberately holds the prepared fixture behind a promise, observes
the preparation receipt, checks that acquisition remains held, then releases
and joins it. The shared fixture-work owner adopts and disposes that hub.
The finally path releases and joins late setup before fixture cleanup can
remove its root. Refusal status/text, all three repositories' refs, the item,
package bytes and clean Git state remain final assertions.
