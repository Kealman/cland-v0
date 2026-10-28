# hub/test/telegram-voice-answers.test.ts

T2 uses the sealed voice fixture, production messenger factory, public ask and
history frames, fake Telegram and fake ElevenLabs. No real platform or key.
Run this file alone under cover-quiet. Native media injection accepts an optional
reply_to_message so the production poller sees an actual voice reply.

Generated free/other/decline/option cases observe durable card mapping before
voice input, then wait for the independent echo settlement receipt. Assert the
stored answer and Telegram provenance, native outcome edit without buttons,
no General voice message and an empty artifact list. Other/decline first observe
an accepted ForceReply; their unthreaded voice note consumes that waiting prompt.
The options case uses “Second.” against the literal option “second”.

Failed/empty/unmatched cases retain the open card and buttons, one native line,
one General voice upload and no answer. Cleanup stops native writers and scans
public sinks through the existing voice fixture. Timings are fake-clock exercise
times, not speech latency measurements. No browser is used.

Review regressions exercise “2.” as a numeric option and an explicit card reply
admitted after a native poll outage, asserting that late voice retains audio
without answering. Two FIFO cases hold an earlier native getFile request,
observe the voice row's durable admission, then open another prompt before
releasing the held request. The original target or absence must survive; the
new prompt stays open with its wait intact. Timers are injected; the hold is
released explicitly and cleanup owns its native connection.
