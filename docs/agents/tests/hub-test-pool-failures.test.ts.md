# hub/test/pool-failures.test.ts

T2, fake provider and hub clock, no native transport or provider network.
Run `node --test hub/test/pool-failures.test.ts` with inherited CLAND variables
removed. Fixtures use the shared sealed environment and disposable roots.

- `C1/C2 neverBoot fails at five minutes and deletion is confirmed` and its
  `pinned-key` variant check the exact 299999/300000 ms boundary and native absence.
- `waiting launch survives neverBoot with one failure notice and bounded retry`,
  its `pinned-key` and `refuseUntil` variants prove durable inventory, retained
  waiting launches, no harness spawn, one Agents line and the next acquire.
- `C3 provider retry time holds capacity creation without a cascade` checks the
  retry-time boundary.
- `C4 retries double to thirty minutes and ready resets the failure streak`
  exercises every delay through the cap and the reset.
- `only a changed pool configuration resets its backoff, including no-argument configure`
  checks both changed and unaffected pools.
- `C5 boot shortening is fenced to fake hosts` checks absent fence and invalid knobs.
- `boot failure lifecycle notice names the host and addresses only Coordinator`
  checks notice routing independently from the socket regression.

Native acquire timing is covered by `hub/test/host-provision-gate.test.ts`:
`pending acquire checkpoints unknown at five minutes and destroys a late identity`.
Run that file serially in the preservation slot after source review. It holds
acquire through the deadline, checks the persisted unknown and occupied slot,
then releases the identity and checks confirmed deletion. The existing native
never-boot test verifies the production create path's fixed five-minute bound.

Review regressions retain provider not-before after configure/ready resets, cap the
fake knob at five minutes, and join cancelled identified probes at the exact
deadline. `digitalocean-pacing.test.ts` also aborts a scoped droplet GET against
the scripted fake. The native provision-gate file covers identified status and
SSH holds through the production cancellation and release owner.

`cleanup refusal retains its record while a ready sibling places waiting launches`
checks unavailable-provider cleanup without losing native ownership, the typed
retained record, one notice per failure, ready-host placement and additional
creation below max_hosts. It explicitly joins hub shutdown with retry ownership.
`waiting-launch-restart.test.ts` preserves the capacity-commit assertions with a
matching directory-only FakeHostProvider and a nonterminal cloning result. Its
whole-file completion is a required regression receipt, not just case completion.

`consecutive retained cleanup failures preserve the exponential backoff streak`
checks the first minute and the next two-minute boundary without ready/config
resets. `rejected cleanup preserves a newer ... checkpoint` holds cleanup while
publishing a destroyed, released, replacement or ready checkpoint, then checks
the exact persisted record after the rejected flight settles and no stale notice.
