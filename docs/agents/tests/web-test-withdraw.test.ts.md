# web/test/withdraw.test.ts

`web/test/withdraw.test.ts` owns the authenticated thread → `topic.withdraw`
seam with a sealed `webFixture`, fake clock, in-process spoke and busy fake
adapter. Hold the successful receipt to assert shared pending state across topic
navigation, no duplicate writes and no early restoration; then retain the exact
restored text before newer typing, reload persistence and the fake's next injected
message with zero withdrawn inputs. A controlled busy→idle step proves the
injected stage removes Withdraw. For refusal, hold the outgoing withdrawal while
the fake takes the input, withhold its injected browser delta, then release the
real request: assert the hub's actual injected-stage refusal tooltip, unchanged
draft/message and later delta application. That race strips optional eligibility
to exercise an older hub. A two-recipient broadcast retains aggregate queued but
loses Withdraw after one recipient submits; history/reload retain false eligibility.
A visibility refresh held before submission is applied after its delivery delta;
the new layer must render without restoring Withdraw. A fresh refresh includes
current eligibility. Visibility replacements retain newer delivery/ask patches.
A single batched fixture covers older A withdrawn while newer B is pending and C
is typed: refusal and uncertain reload recover A/B/C, success keeps A/C, and edits
before/after the pending boundary retain order. No live hub or native harness is used.
