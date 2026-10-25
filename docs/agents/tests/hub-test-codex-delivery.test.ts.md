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
