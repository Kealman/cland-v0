# hub/test/login-provision-bind.test.ts

T2: projectHub with an injected create checkpoint, directory-only fake provider,
recording Host and FakeClock. No native process, network, browser or real login.
Run with supported Node 24 and inherited CLAND variables stripped.

`cold launch attaches while connecting and reuses the mounted login after ready`
proves C1 from provider attachment inventory, pending metadata, one mount and the
native fake adapter spawn receipt. `two waiting harnesses attach before cloning
finishes` proves C4 for Codex and Claude Code. `login preparation adds no
hub-clock time to simulated cloning` compares manual creation and demand creation:
a 500 ms simulated attachment overlaps 1000 ms of cloning; both ready receipts
are at 1000 ms. This is fake-clock component evidence, not native boot timing.

The generated `boot failure before/after attachment preserves the ready disk`
cases prove C3, keeping the original volume id and observing detached inventory.
`unknown rollback retains pending binding without retrying detach` checks the
pending fence and one detach attempt. `host ready and native admission wait for
the mount receipt` holds the native mount response, checks connecting and no
spawn, then observes settled binding and spawn after release.

Setup uses testWaitMs/eventually. Fixture tempProject registers root ownership
immediately; teardown releases the create gates and joins the hub before root
removal. Mount-hold tests release their observer gate during teardown. Provider
and account environments come from fixtureEnvironment after all overlays.
Stage QA runs these component cases on dev alongside native host-create-ready
and host-destroy-native preservation. Linux mode-free verification supplies the
T1/T2 receipt; full T3 belongs to the merge batch and T4 to stage/epic occasions.

Review regressions retain the exact waiting admission at list, attachment and
mount boundaries. Generated cancellation cases hold inventory, an attached disk
or an in-flight mount; role removal holds inventory and a changed role account
holds the old mount. All require the old disk free/detached or zero attachment,
and the account-change case observes a native spawn with the current account.
Missing-login, selected-account-limit and unknown-attachment cases preserve a
healthy ready host, clear the refused wait, and retain an unknown pending fence.
Failure and abort cases hold inventory and require zero post-failure attaches,
then wait for the durable destroyed checkpoint after the injected failure.

The delay owner is registered before its override, cancels its FakeClock timer,
rejects future calls and joins every admitted attachment before hub shutdown.
`forced setup failure drains a late scheduled attachment before hub and root
cleanup` forces the timer to be scheduled after simulated cloning has completed,
catches a setup failure, and requires the positive hub shutdown receipt. Its
bounded diagnostic fallback advances the fake timer only if shutdown misses its
bound, then joins the producer and still fails the test. The late-call case
checks owner closure before invocation. These controls need no wall-clock sleeps.
