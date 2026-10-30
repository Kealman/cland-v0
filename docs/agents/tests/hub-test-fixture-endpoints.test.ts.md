# hub/test/fixture-endpoints.test.ts

`node --test hub/test/fixture-endpoints.test.ts` runs T2 environment, production-factory construction and native speech refusal
checks. Frame cases use sealed projectHub roots; no browser or child runs. Speech
targets loopback port zero. A fetch observer prevents external I/O even when
regressing the guard; assert the native call count and fixed disabled reason.
The missing/base-only root cases prove constructor refusal for Discord and
Telegram, and sanitized local transcription failure for ElevenLabs. Explicit external,
empty, credential-bearing and ambiguous roots fail in the builder. Explicit
numeric-loopback extras remain usable; re-sealed children retain refusal.
Non-fixture factory defaults and public frames are unchanged. Existing remote
messenger and setup component tests cover functioning loopback roots through
production frames. No new role permission or CLI option is introduced.

Speech pre-arms a fetch guard that records only origins, refuses any target other
than loopback port zero, and retains the fixed transport-error assertion. Each
attempt has a one-second abort signal and is awaited before restoring the guard.
The missing-sentinel mutation must fail on the recorded production origin
without sending it. Frame fixtures use the established pacingOwner before root
allocation, retain roots behind successful disposal, and track frame setup and
requests. Omitted/aborted readiness controls retain the actual serving hub, join
its stopped receipt, assert empty observations/timers, then remove the root
through the same disposal barrier. projectHub's resource check proves native
resources and listeners drained at final cleanup.

## Date observation root guard

The Date drain timeout case uses a separate fake deadline clock and an actual
scratch root. Its removal attempt must fail while the writer is held and leave
the root present; release and a completed drain then permit removal. A planted
missing guard fails with Missing expected rejection. `clockControl` registers
gate release/join before launch and supplies independent setup/effect bounds.
