# hub/test/telegram-pairing.test.ts

T2 uses sealed `tempProject`/`projectHub`, the production messenger factory,
the Unix frame client and the real CLI against the loopback fake Bot API.
Only the fake's fabricated credential is stored. One `FakeClock` owns timers;
live one-second deadlines bound missing receipts. Run this file alone with
`node --test hub/test/telegram-pairing.test.ts`, subject to cover-quiet.

`Telegram private starts respect stranger limits and CLI approval names the
paired project` checks the exact private code/id/approve text, reuse of the
live code and silence after two replies. It approves the human through
`cland remote approve telegram <code>`, reads the stored numeric pairing through
CLI status, and retains the paired project's `/start` reply. Each next-poll
offset proves completed handling, including the silent third start.

The two `Telegram stops and reports a blocked bot from … while status keeps its
bot link` cases use the paired bot's membership update and an actual HTTP 403
on `sendMessage`. A stranger's membership update first proves the identity
gate. Arm the subscribed General notice and native poll-close observers before
the block; retain the fixed cause/fix, disabled CLI status, successful traffic
times and `t.me` link. Explicit frame and CLI test requests must make no further
platform requests or sends, while `hub.status` still succeeds. The 403 echoes a
fabricated token; actual frame/history/CLI sinks must mask it.

The membership case also restarts the in-process hub on the same scratch store
and fake. A queued paired `/start` must complete after the saved kick cursor,
with exactly one persisted blocked notice. This is durable update replay proof,
not a native process crash test or unchanged-reload recovery proof. T-1349 owns
unchanged reload recovery after the human unblocks the bot. Join the last poll's
native close and hub stop before fixture removal; all fake-clock timers drain.

Keep `telegram-polling.test.ts`'s explicit first-match handlers usable and
`remote-cli.test.ts`'s previous-hub reply shapes unchanged. There are no new wire
fields, permissions, browser calls or real platform calls.
