# hub/test/codex-adapter.test.ts

T-692 (dee14dc583) retained a real-binary missing-result classification proof;
its C5 required no behavior claim dropped during tier migration. The old title
was `a missing native turn-start result becomes uncertain after its accepted turn replies`.
T-1926 changes that contract to
`a missing native turn-start result stays uncertain unless its exact recipient replies`.
One native fixture covers both branches: the authenticated reply must name the
exact input and keeps that root injected; a second missing-result input using
`lose the answer without replying` receives no pong and must become uncertain.
Its durable uncertainty receipt and a later accepted native input barrier the
final no-replay assertions. The earlier exact reply must still be injected;
the unanswered root stays delivered, and each native input occurs once.
The obsolete duration-manifest key is removed; Git and prior suite receipts keep
its historical timing. No old timing is assigned to the renamed case.

T3 is the native Codex adapter contract against a sealed fake executable.
T-1222's initial Implementer launch expects the custom workspace profile with
the eight narrow Git/territory/artifact roots and full network. Keep Reviewer
read-only, QA full access, and the later explicit T-48 profile and relaunch
assertions. Both QA and Implementer relaunches assert the complete native
`thread/resume` parameter object, including `excludeTurns: true` (T-1265);
keep the previous-client direct resume calls and exact lower-tier legacy retry
control. This proves app-server input serialization, not OS enforcement;
the macOS T4 synthetic Seatbelt file proves the scratch Git write needs.
This is the T3 Codex real-binary adapter contract. It runs the fake Codex app-server with the production spoke against a scratch project, proving native delivery, approvals, usage, attach and process lifecycle behavior. Keep parsing and reconciliation tables at the lower-tier scripted native seam in `codex-native.test.ts`; this file proves the binary boundary.

The digest regression injects a `hub_event` tool output through `AppServerClient` on the launched session's existing thread. Its three controls are a leading hub event in Agents followed by an older agent delivery and the human's General delivery; a human delivery followed by an agent delivery and a trailing hub event; and an event-only digest. The fake must answer the last human or agent delivery, taking body, topic and `msg_id` from that same envelope, and must send nothing for the event-only input.

The first native text input also answers its sessionless launch brief: the first
hub report in Agents after the initial role clause or no-role introduction.
This exception never applies to later inputs or tool-output digests. The pure
selector controls live in `codex-fake-envelope.test.ts`; keep the native digest
controls here to prove the actual spoke sends and completion boundary.

Arm the native `turn/completed` observer before submitting any digest. Bound setup separately through the existing launch, presence and connection helpers. After each `turn/start`, wait with `eventually` for completion of that exact returned turn id; admission or an idle snapshot alone is insufficient. The fake awaits its MCP sends before publishing completion. Read persisted topic history from both Agents and General after that receipt and retain the final comparison of every reply's text, topic and `replyTo`. These rows prove the sends were accepted and that events received no replies. Existing single-delivery routing and approval assertions remain in the same file; the native scripted review/QA round trip in `review-qa.test.ts` checks the fake's verdict behavior.

Use the existing `tempProject`, `fakeCodex` and native `projectHub` ownership paths. HOME, XDG, account paths and Git configuration are sealed by the shared fixture builders; the native client closes in teardown, the fixture hub stops its writers, and fake-server cleanup observes process exit before its owned directory is removed. Do not add a second thread, use live accounts or replace these cleanup receipts with a timer. Run local targeted files one at a time; configured task verification runs the changed T3 contract once alongside its selected tiers.
