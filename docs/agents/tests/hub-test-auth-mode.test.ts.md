# hub/test/auth-mode.test.ts

`hub/test/auth-mode.test.ts` is T2: a sealed disposable `projectHub`, real CLI,
fake harnesses and loopback HTTP. Set a fixture-local verification lock before
startup to preserve the managed config marker. Supply synthetic Git user.name
through the hub's Git seam; CLI children use the shared scratch environment.
Observe CLI/frame results and parsed config, browser session lists and refused
link redemption. Restart the in-process hub on the same durable fixture to prove
first-user stability and the startup refusal/recovery text. No browser opens.

The held-writer cases register uploadOwner and the native socket-close observer
before triggering reset. Stop receipt precedes the assertion that the writer
still holds reset; release and join the writer, socket close and control reply.
Block the injected clock past cookie lifetime without running liveness timers
for the expired-owner case; prune the session listing before reset. Link minting
and redemption must remain refused during drainage. Cleanup releases the writer
and joins every request before fixture removal.

For both transition directions, invalidate roles.toml before the command. The
saved transition must fail its reload with admission still fenced; restore the
roles file, reload successfully, then redeem a freshly minted link.

T-1560 adds a real CLI/Unix and cookie WebSocket regression: the first local user and a second persisted browser user produce distinct audit userId values, forged userId is ignored and web as is refused. Second-user setup seeds only a disposable database; no invite/auth provider is contacted.
