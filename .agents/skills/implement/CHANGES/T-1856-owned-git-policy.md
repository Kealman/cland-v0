# T-1856 owned Git cancellation and command classes

Implementation guidance lives in `docs/hub/cland-init-and-cland-update.md`, with
host packaging and test-specific guidance at their existing indexed references.
Coordinator decisions distinguish direct read-only native ownership from durable
writer ownership and retain the existing recovery and cancellation fences.
The shared implement workflow and upstream skill metadata are unchanged.
