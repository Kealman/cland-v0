# T-1750 pool failures

Pool retry policy and unknown acquire ownership are documented in
`docs/hub/pool-failures.md`. Use fake providers, a hub clock and the fake-host
fence for shortened boot gates. Preserve an unknown acquisition slot through the
five-minute failure notice and late-identity settlement. Test guidance lives in
`docs/agents/tests/hub-test-pool-failures.test.ts.md`.

Review fixes keep provider not-before independent of boot streak resets. Scoped
provider status reads and droplet GET accept optional cancellation/deadline; old
callers remain valid. The shortening knob is capped at the fixed gate.

Configured-run regression: creator nonterminal results retain their owner;
cleanup resolution failures persist a typed retained record, keep its occupied
slot and observe rejected work. Ready siblings and other slots remain usable.

Cleanup continuations revalidate captured acquisition identity, preserve newer
terminal/ready checkpoints and retain the consecutive retry count.
