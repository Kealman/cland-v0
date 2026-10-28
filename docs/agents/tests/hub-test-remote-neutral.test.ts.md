# hub/test/remote-neutral.test.ts

T1 covers the shared remote helper boundaries named in T-1397. Pure mirror,
phone model and inbox publication checks use literal expected authors, labels
and combined row order. Gap and mute checks use disposable SQLite storage and
injected time, with no sockets, child processes, credentials or real platforms.

The Discord matcher must count split General sources once and leave Telegram's
missed jobs and saved gap alone. The mute receipt check retains both an already
saved Telegram receipt and the compatibility wrapper; neither may reapply an
effect. Telegram's transport behavior stays covered by the existing unchanged
`telegram-*.test.ts` files, particularly gap, commands, mute and messenger.
