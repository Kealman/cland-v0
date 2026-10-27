# hub/test/telegram-approvals.test.ts

T2 uses sealed `tempProject`, `projectHub`, real frames, production Telegram
HTTP/polling/cards and the loopback fake Bot API. No real account, token, native
harness process or browser runs. `pacingOwner` owns the hub, adapter, fake HTTP
server and SQLite store before acquisition and drains them before root removal.
The authenticated web-frame owner is registered before the hub owner.

Run this file alone: `node --test hub/test/telegram-approvals.test.ts`.

- `Telegram Codex approval clips a 5000-character command and offers three
  coloured choice rows` checks the accepted text, entities, opaque keys and
  durable approval map, with exact labels/styles/row counts (C1).
- `Telegram Approve once runs the scripted Codex command and commits before
  callback acknowledgement` uses the production Codex adapter and scripted
  native RPC. The fake command writes a scratch file only on native acceptance;
  its completion record and exact `accept` response are asserted. Hold callback
  HTTP and read the durable outcome and unconfirmed offset before release;
  retain the exact accepted outcome edit and empty keyboard (C2).
- `Telegram Deny stops the scripted OpenCode command and a web answer edits its
  own card` uses the production OpenCode adapter with scripted HTTP/SSE. Assert
  native `reject`, the explicit denied completion, absent command effect, stored
  Telegram source and empty keyboard. A separate approval answered through an
  authenticated web WebSocket edits its own card to `via web`; that approval's
  successful command supplies the positive control for the fake execution (C3).
- The flood-hold test observes a durable never-left attempt, closes its approval
  and retains the dropped job plus no accepted card. The shared outbox still
  fences unknown deliveries; an uncertain send is never relabelled safe-to-drop.
- The cross-kind substitution test presses an approval key on a real mapped ask
  card and an ask key on the approval card. Both callbacks are answered and
  confirmed while the ask, approval and native adapter remain unchanged.
- The lost-result component restart test drops the actual successful
  `approval.answer` result after commit, stops/drains the first hub and recreates
  the adapter/hub over the same SQLite and fake queue. Replay gets `Already
  answered`, confirms the offset and preserves one native command execution.
  This does not claim an OS crash or an atomic transaction with an external
  harness: the existing approval gate owns native delivery and its durable result.
- Harness withdrawal and harness-answer cases map two native copies, then assert
  the same bounded outcome and no buttons on both, including non-BMP commands.
- The long-denial-note test retains actor/source/time while clipping the preview
  with `full note in the workbench`, below 4096 code points.

C4 is the rendered-client seam in `web/test/remote-via.test.ts` and
`nvim/test/remote-via.test.ts`: both approved Codex and denied OpenCode outcomes
show `via Telegram`. The former uses an isolated Chrome Headless Shell and real
hub frames with a test messenger; the latter uses committed protocol frames in
headless Neovim. They do not claim native Telegram phone rendering.

Negative controls disabled approval dispatch while retaining all native fixture
setup: Codex failed on the missing command completion and OpenCode on the missing
denied outcome. Restoring dispatch passed. The original missing-card C1 and
closed-source flood test failed before their implementation.

Before source review run all Telegram, outbox, gateway, asks and inbox files
serially, plus typechecking. The native OpenCode endpoint regression is in
`opencode-adapter.test.ts` (T3); preserve its production launch/process evidence.

Source-review M1 keeps initial poll setup inside `pacingOwner.start`'s own
one-second startup receipt, separately from each case's behaviour bound. Arm
its abortable native observer before starting the hub; the same owner cancels
and joins it on disposal. The omitted and aborted initial-poll cases use that
same fixture/disposer. They withhold publication after a real initial poll,
then hold native-close ownership after its actual server close: setup rejection
must still be unjoined, SQLite readable and the root present. Release that
receipt and retain stopped hub, closed server with zero connections/handlers,
joined initial observer and closed SQLite. Replacing the initial-poll startup
receipt with an already-resolved promise makes both controls fail; restoring
the owned receipt passes. Native approval/command assertions are unchanged.
