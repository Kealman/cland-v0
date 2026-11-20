# hub/test/suite-stage-cover.test.ts

T-1892: the native fake-machine compatibility case closes and advances on the
sharded Linux cover despite an older Mac full cover at another tree. A later
local full cover stays independent; it does not reopen the completed stage.

The final droplet cache hit must retain the original green result and stage
cover without inventing a new native-result obligation. Its text excludes the
missing-result/lost-collection diagnosis. Run the complete T3 file using the
repository source cwd (fixture fake binaries resolve relative to it), isolated
fixture environments and an exclusive native slot. The fixture supplies both
platform observations; this is not a native macOS/Linux platform comparison.

Process mode uses real time; the fixture's returned FakeClock does not drive
its hub or SSH children. Keep production readiness and lifetime limits unchanged.
The historical failure at 986afe46's run.ts:66 was the expired-delivery-lease
guard, distinct from boot readiness in prepare.ts. The deterministic expiry
case in executor-prepare-component keeps the `machine readiness deadline reached`
diagnostic and asserts no command starts. The typed error's phase is the machine
receipt; any phase appended to its message is only for human readers.
