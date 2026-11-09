# hub/test/hub-cards.test.ts

`hub/test/hub-cards.test.ts` is T2. Run it with `node --test hub/test/hub-cards.test.ts` under a supported Node, through targeted admission. It uses disposable projectHub roots, FakeClock, fake process facts and sealed Telegram/Discord APIs; no real login, host, credential or GUI browser is used. The web case authenticates a WebSocket client over the scratch hub's HTTP edge.

- `hub card answers call their registered handler once and never target a session` checks inbox identity/options, payload/answer delivery, empty recipients and the second-answer refusal.
- `pending hub cards survive restart; missing handlers keep them open and withdrawal records its reason` restarts the in-process hub on the same scratch database and registers the retained card handler at startup, then proves the missing-handler refusal on a different card.
- `secret hub answers reach the handler verbatim and remote replay stores a digest` replays one native message identity and scans history, captured frames/logs and the closed database, journal and process log for the sentinel. The handler deliberately returns the secret to test outcome suppression.
- `hub card handler failures roll back and a decline carries no consent` checks rollback discards its after-commit callback and a later decline retains its decision class.
- `ordinary ask remote replay preserves its existing answer and deduplicates delivery` keeps the previous Coordinator ask shape and proves one retained answer addressed to its session.
- `hub cards publish and fold both native copies after web`, `neovim`, `telegram`, `discord`, `withdraw`, and `secret` each wait for both durable native mappings before the action, then for both native message bodies to contain the outcome and have no buttons. Setup and outcome observers are armed before their producer, bounded separately and joined in teardown.

The companion T1 file `hub/test/hub-cards-authority.test.ts` checks every existing gateway authority entry and its conditional reply rules. The optional InboxAsk.secret marker is emitted only for marked hub cards; previous and ordinary wire shapes omit it and recorded Neovim frames remain compatible. Stage QA can use these generated case names and the native message assertions as its evidence boundaries. No T3 lifecycle file changes in this item; Linux task verification supplies T1/T2/Web, full T3 is deferred to the merge/stage occasions, and T4 to stage/epic occasions.


Native-path regressions added after source review:

- `native secret telegram retention probe` enters through the actual fake Bot API typed-reply path, checks the retained input receipt and closed database, restarts the hub, then replays the same native message and waits for its persisted polling offset. The handler runs once.
- `native secret discord retention probe` submits a native decline modal and inspects the completed type-7 callback, independently of the hub's closure edit.
- `deferred native Discord answer keeps handler outcome after all updates settle` holds dispatch, observes a native type-6 defer, waits for the interaction's own sent outbox edit, joins hub shutdown and asserts the final native content. A transient matching closure is insufficient.
- `users-mode hub option outcome retains stable user id`, `free`, and `decline` check both stored outcome and inbox archive, prune the retained answer message after shutdown, and check the independent departure still identifies the admitted user.

The first three native cases and all three attribution cases were red before the revision, then green. Ordinary Coordinator preservation is covered by the complete existing Telegram and Discord card files, rather than only the gateway fake.
