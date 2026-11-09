# hub/test/hub-cards-voice.test.ts

T2, sealed Telegram/Discord APIs and speech provider in projectHub with FakeClock, fake process facts and disposable HOME/Git state. Run `node --test hub/test/hub-cards-voice.test.ts` under supported Node through targeted admission. No real audio, login, host, account, credential, browser or provider network is used.

Generated cases are `telegram hub card voice refuses secret input before acquisition`, `discord hub card voice refuses secret input before acquisition`, and each messenger's `hub card voice keeps non-secret answering` control. The secret cases were red before the guard (the handler received the fake spoken code and no refusal appeared); both controls already passed.

Observers are armed before card publication and native voice dispatch. The secret cases observe the fixed refusal, join hub shutdown, and assert no Bot API download, CDN request, speech request, transcript row, saved voice target, artifact or voice echo. They keep the ask open and scan the closed database for the fake transcript. Controls prove the sealed speech provider is exercised and non-secret answers still reach the handler with an echo.

The optional `InboxAsk.secret: true` is present only on marked hub cards; ordinary and previous rows omit it. Telegram freezes this metadata in its card/prompt target; Discord uses the hub-owned mapped card model. Neither messenger derives the marker from a button or inbound actor field. Unknown optional fields remain compatible with previous Neovim/browser card renderers. The existing Telegram voice-answer and Discord inbound-media files cover ordinary cards and General.
