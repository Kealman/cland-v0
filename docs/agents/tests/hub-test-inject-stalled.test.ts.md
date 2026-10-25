# hub/test/inject-stalled.test.ts

Use projectHub, fake harnesses and FakeClock for failed-delivery alarms. Wait for
the exact `inject-unconfirmed` receipt before advancing policy time. Coordinator
alarms occur five minutes after the first failure, reach General and named Aide
holders, and produce a `delivery-stalled` event; other roles retain their
one-minute Agents notice to the Coordinator. Check the pre-deadline boundary,
reconnect without postponement, one notice per episode, a new episode after
confirmation, and cancellation by confirmation before the deadline. No wall-clock
wait or harness process is needed.
