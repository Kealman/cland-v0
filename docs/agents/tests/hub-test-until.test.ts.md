# hub/test/until.test.ts

T1 deadline policy and public condition waits. Fake clocks prove setup scaling,
exact injected-clock and named behaviour bounds, including the diagnostic's
deadline value and timer disposal. Pure cases cover local/droplet defaults,
load plus workers, overrides and finite-positive deadline refusal. Environment
controls are restored in finally. No wall-clock sleep, socket or native child
is used. The suite-runner propagation regression is T3 and needs the exclusive
preservation slot; it remains separate from these unit cases.

The async-check regressions hold a promise past its deadline, then release a
late value, and separately advance fake time inside a check before the timer
callback can run. Both must reject at the named bound. The cadence regression
observes attempts at fake times0/50/100 and returns a zero receipt unchanged.
