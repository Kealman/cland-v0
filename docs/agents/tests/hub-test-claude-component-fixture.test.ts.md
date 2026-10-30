# hub/test/claude-component-fixture.test.ts

Run `node --test hub/test/claude-component-fixture.test.ts`. This T2 file uses
disposable roots, a fake harness, production projectHub/dispatcher and separate
fake setup/behavior clocks. No native Claude or browser runs.

`claudeComponentOwner` composes the shared `pacingOwner` before hub acquisition.
Its setup receipt follows hub startup, dispatcher welcome and subscription.
Client/spoke acquisition and frame observations remain owned through disposal;
the directory guard also applies when removal is requested outside after hooks.

The omitted and aborted setup cases withhold readiness after actual acquisition.
They observe hub stop while a separately admitted observation still awaits its
completion, then enter the real removal guard. Keep the retained-root assertion,
the positive observation completion, the before-remove completion assertion and
the final removed-root/no-observations/no-timers assertions. Setup interruption
and observation drainage have separate bounds. A missing drain receipt retains
the root; it cannot count as successful cleanup.

The deliberately held observation registers its emergency abort/release/join
with shared `onCleanup` before the component owner and before observation
admission. It handles an already-aborted signal. An assertion before the local
try/finally still releases the hold before component disposal tries to join it.
Setup-verdict and removal promises have immediate rejection handlers. The test
still awaits the original promises, preserving their final assertions.
