# hub/test/suite-runner-contract.test.ts

The UTC/legacy holder cases subscribe the buffering UI client before launching
the hand runner. The scheduler publishes queue changes once and suppresses an
unchanged signature; subscribing after the holder starts can miss its only
publication. Keep the final exact-PID `verification.queue` frame assertion and
all queue, CLI, ownership-token and post-release completion assertions. The
native marker bounds setup independently; the later bounded frame wait can
consume the durable matching frame already buffered by the early subscription.
