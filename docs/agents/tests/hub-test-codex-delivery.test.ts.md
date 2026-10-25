# hub/test/codex-delivery.test.ts

Use `scriptedCodex` for the T2 production Codex adapter, `projectHub`, fake clock
and in-process app-server connection. Refuse connections and observe the flushed
`harness-reconnect-failed` and exact-message `inject-unconfirmed` log receipts
before advancing policy time. Restore the app-server at startup plus 90 seconds
and wait for that message's injected delivery receipt; no alarm may remain after
the 120-second startup grace. Retain the negative boundary at one minute.
The fixture blocks its fake clock for 50 seconds during adapter initialization,
before the hub's serving receipt. Each test's startup origin is that serving
receipt, so process/session-manager construction cannot consume the grace.

The unconfirmed cases start at startup plus 30 and 130 seconds: their exact
alarms arrive at plus 120 and 190 seconds respectively, with no earlier notice
and only one notice per episode. This proves a fixed hub-start deadline rather
than a fresh grace per failure, and preserves the ordinary post-startup timeout.
Keep the old message detail shape and assert the actual unconfirmed duration in
the notice. No wall-clock sleep or harness process is needed.

Provider-capacity tests use the same scripted native connection and fake clock.
Observe `turn-capacity-retry-scheduled` before advancing 30, 60 and 120 seconds;
retain the negative boundary one millisecond before each deadline, the exact
native `turn/start` input and the posted `redelivered` notice. Record native input
items explicitly: a tool output, or native launch text without a hub delivery id.
Complete the last retry before its submission reply and repeat its completion:
there must be only three retries and one terminal Coordinator delivery.
Delay earlier `turn/started` events until after admission replies: they must
retain the same bounded retry count. A claimant's terminal report escalates to
the Coordinator instead of waking that claimant into another failure episode.

Cancellation cases stop/archive the session, change its role and change it back,
send replacement work, or complete newer native work. Hold `thread/read` and
change ownership before releasing its response to prove the final submission
fence. Also start newer native work while readback is held and keep it busy:
observe `turn-capacity-retry-cancelled` after releasing the response, retaining
the no-submission and no-terminal-failure assertions. Native supersession is
checked before the idle authorization guard. Bound readback setup separately.
Missing input and `RpcNoAnswer` at replay
admission each produce one terminal report and no further attempt. Ordinary
endpoint/authentication/usage failures keep the previous failure-notice shape
and never enter this retry policy. These are T2 policy proofs; they use no real
provider, harness process or browser.
