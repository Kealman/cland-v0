# hub/test/scenarios/integrated-v04.test.ts

T3 scenario `integrated-v04` runs one disposable project, directory-backed fake
pool hosts, native fake SSH/agent/Claude processes and the Telegram test
messenger. It uses projectHub for the initial hub and restart. DigitalOcean's
fake API supplies the declared nonzero price for the final admission attempt.
No real provider endpoint, account credential, droplet, browser or live hub DB
is used. Web and Neovim evidence is their protocol projection, without rendered
DOM or a headless Neovim claim.

Generated case: `v0.4 integrated: remote login, live renewal, two users, busy restart and host sub-cap`.

1. Pool placement waits for a Claude login. Telegram answers its create card
   and the following secret code card;
   the native fake sign-in completes and a running process is persisted on a
   fake host. The inbox wait disappears and the outbound card is answered.
2. The bound login is marked signed out. An authenticated web frame starts the
   Hosts view's login.signin action. Renewal retains its binding, PID and native
   alive receipt; web and local login.list projections agree.
3. Users mode has two active users. Bob answers via paired Telegram ingress.
   Alice's web transport reads the answer and Bob's identity in history; the
   outbound Telegram card folds.
4. A second login/host holds the Reviewer. Both native births, session identities
   and host identities survive hub restart. Two queued messages to both sessions
   are seeded through Store.record while stopped. Each of the four deliveries
   must produce one native reply after restart. Observers start before restart
   and join before storage closes. An open ask stays in history and inbox and
   accepts its answer.
5. A new priced fake host reaches production spend admission with a zero host
   daily cap. It refuses before creation; both existing leases and native
   processes remain unchanged.

`INTEGRATED_FAULT=login|signin|users|restart|cap` selects one scoped negative
control. Respectively these withhold the remote card action, stop the captured
native worker at renewal, drop attribution at Alice's projection transport,
remove the Reviewer's persisted process row while the hub is stopped, or make
only the new provider admission free. That final provider's acquire returns an
immediate synthetic failure to observe admission without booting a third carrier.
Setup probes remain unchanged. Each run
must fail at the named path; reaching a different failure is incomplete evidence.
Ordinary suite runs leave this setting absent.

On macOS obtain the release preservation slot, load below 20, one file at a
time, at most fifteen minutes per slot. Record full-name sets for /private/tmp,
the per-user TMPDIR and suite roots before and after every run. Keep any root
whose cleanup is incomplete. The host-create fixture drains hub retries,
watchdogs by captured identity, native writers and carriers before directories.
Use Node matching package.json and sealed runner environments. Read the shared
procedures in tests.md. Linux mode-free task verification runs changed T3 once;
full T3 and other release phases are separate receipts.

The additive host-create fixture `setup` callback runs before projectHub starts
and receives its owner's cancellation signal. Its owner is registered before
initialization and fences new starts during cleanup. It joins setup/startup
continuations, stops late hubs, then permits handle and root closure. The optional
second `start` argument is a test readiness receipt owned by the same continuation.
Remote result receipts use scenario-reply-owner; a thrown upload cancels and joins
the pre-armed waiter, and teardown attempts every pending receipt. The held
setup/restart and thrown-upload controls are in host-fixture-cleanup.test.ts.
Existing
callers retain their default setup, adapters, card configuration and return
fields. This file is the opt-in consumer. No shared wire contract changes.
