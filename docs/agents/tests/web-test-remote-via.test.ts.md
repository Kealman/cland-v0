# web/test/remote-via.test.ts

Web tier. `webFixture` injects a test messenger into the real in-process gateway
and starts an isolated Chrome Headless Shell. No platform client or credential
is involved. Build candidate web assets with `npm run build` before running
`node --test web/test/remote-via.test.ts` locally.

Wait for the exact open ask and fake Codex approval rows before answering
through the messenger. Read their folded outcomes and archive rows during the
same Inbox visit, then open General and check the remote message and persisted
ask after reload. A second messenger proves Discord message labels. An
intercepted previous-wire outcome omits `via` in both archive and history, and
the client still renders its answerer and answer. Each source assertion targets the rendered row, not only a
protocol value. The fixture observes browser descendants exit and hub stop
before removing its scratch root. This is fake-platform, headless evidence;
it makes no claim about Telegram or Discord on a real phone.

T-1357 retains separate visible Codex approved-once and OpenCode denied outcomes
and archive rows, each naming `via Telegram`. The messenger is a frame double;
production Telegram press/native approval behaviour is covered separately by
`hub/test/telegram-approvals.test.ts`.
