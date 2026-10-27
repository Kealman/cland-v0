# hub/test/telegram-liveness.test.ts

T2 uses sealed `tempProject`/`projectHub`, the production Telegram factory,
Unix-socket frames and the loopback fake Bot API. The CLI status case uses the
shared sealed `cland` launcher. A single `FakeClock` drives all behavior;
one-second native bounds detect missing receipts and do not simulate outages.
No platform, real token, browser binary or GUI is used. Run the file alone.

`telegram-liveness-fixture.ts` registers its disposer before starting the hub.
Readiness is armed before `projectHub`, with a separate real-clock one-second
bound (or an independently injected setup clock). Disposal aborts the observer,
closes the fake and joins its native connections/handlers, joins the retained
startup promise and stops a late hub before directory cleanup. The missing
startup receipt and aborted held `getMe` controls call this exact disposer and
retain native closed/zero-writer, joined-startup, completed-stop and zero-timer
facts. The transport's frozen behavior clock never supplies their cleanup.

`Telegram restarts stalled 40-second and offline zero-timeout polls exactly 15
seconds after their timeout` retains actual held native polls at 54,999 and
14,999 ms, their close receipts at 55,000 and 15,000 ms, scheduled retries,
the actual zero-timeout request and stale-traffic disconnected status. Preserve
the transport's >=30-second HTTP budget: the poll loop owns the earlier
offline liveness cancellation independently.

`Telegram rides out 409 for 60 seconds then reports another consumer without
replacing its lease` queues 61 fake refusals, waits for each scheduled retry,
checks no disabled state or notice before 60 seconds, then retains the exact
General notice, disabled frame and CLI reason, native connection close and
unchanged durable lease owner. It never signals or stops a competing process.
The first 409 deliberately carries `retry_after=300`; it cannot extend the
60-second conflict budget.
Doctor reads that stopped remote through local frames, retaining
`stopCause: other-consumer` and the exact cause/fix also recorded in General.
The transient-409 case proves a successful zero-timeout exchange resumes the
40-second poll without a fatal notice.

The generated `Telegram 401 stops only the remote and reports its fix while hub
and web serve` and `Telegram 403 stops only the remote and reports its fix while
hub and web serve` cases arm the General and native-close observers before
releasing the active poll into a forced refusal. Retain one fixed cause/fix
notice, the disabled reason, no platform retries after fake time advances and
no fabricated token in frame/log sinks. The fake sends a description longer
than the diagnostic cap: fixed cause/fix
must survive before optional provider detail in both status and actual CLI.
The doctor JSON check retains a warn line and the same fixed cause/fix as
General, from the persisted `token` or `blocked` cause. Successful reload clears
both the old reason and the structured cause.
Redeem a scratch web link and keep an
authenticated WebSocket `hub.status` reply after failure. Close that native
socket before stopping the hub or removing the root. This is web protocol
service evidence, not browser-rendering evidence.

The generated `Telegram rich send 401 stops before plain fallback and retains
its cause` and 403 cases pair the production remote and post General through
the frame boundary. Retain exactly one failed `sendRichMessage`, no plain send
or accepted fake message, the fixed cause/fix, the active poll's native close,
one General diagnostic and a successful hub-status reply. Ordinary rich
rendering refusals still fall back under the rendering file's existing controls.

`Telegram unblocked after 403 resumes on unchanged reload while
configuration-disabled stays stopped` consumes a fake 403, then reloads the
identical config/secrets. The actual new poll, connected status and cleared
reason prove recovery. Disable Telegram by configuration, observe native close,
reload again and retain identical platform traffic. Keep the membership replay
and blocked-bot durable confirmation controls in the pairing test guidance.

`Telegram membership unblock and queued paired start survive unchanged reload
without replaying the kick` uses the production membership and pairing handlers.
After the terminal kick's notice and close, queue an unblock and a paired `/start`,
then reload unchanged settings. Retain the next native poll's offset past both
updates, the exact paired-project reply, connected status, one durable blocked
notice and final native close. A replayed kick cannot satisfy those receipts.
