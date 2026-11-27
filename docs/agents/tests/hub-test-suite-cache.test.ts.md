# hub/test/suite-cache.test.ts

Executor/platform admission cases use `suiteCase` from setup through teardown,
including its positive native-launch guard. Seed incompatible durable receipts
in the disposable Store, then observe fresh local completions and compatible
cache results. Worker counts prove reuse without elapsed-time assertions.
Local receipt OS uses the runner host OS so the same cases run on Linux and macOS.
Pass `localPlatform: process.platform` to `suiteUnit` for host-cache obligations;
its default remains Darwin for intentional macOS stage simulations. The ordinary
unconstrained legacy control has no platform field and still reuses across executors.

The droplet cache control starts one scripted remote worker, then reuses its
green evidence without acquiring another lease or creating a new native result
receipt. Preserve exact cached outcome and no missing-result diagnosis; this is
a T1 semantic executor proof, not a provider/native lifecycle measurement.
