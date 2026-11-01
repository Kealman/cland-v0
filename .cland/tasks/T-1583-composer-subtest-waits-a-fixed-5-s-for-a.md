---
id: T-1583
kind: task
title: Composer subtest waits a fixed 5 s for a channel event (third macOS stage-cover Web flake)
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-1304
branch: t/T-1583-composer-subtest-waits-a-fixed-5-s-for-a
created: 2026-11-01T15:26:21.036Z
updated: 2026-11-01T16:41:14.817Z
---

## Summary

`web/test/composer.test.ts` › "composer physical Enter, Shift+Enter and Meta+Enter send or break lines and Meta+K keeps the draft" failed on the macOS stage cover 501cca57 at dev f3d90cea (A-15306, local darwin arm64, 2 workers, peak load 5.46) with `no channel event matched within 5000ms` (harness.ts:245). It took 5.7 s. The Linux stage cover c4c01c90 at the same head passed (A-15302), and the file passed 5/5 alone on the same Mac.

This is the third different Web test today that fails only in full macOS stage covers: T-1577 (items), T-1578 (events), and this one. Each read raced a late render or event once the Web phase ran after T3 on a loaded Mac. This item fixes the composer case and records the pattern for one systemic decision: Web waits that count wall time rather than receipts, or the macOS Web phase's worker count and placement.

## Acceptance criteria

- [x] C1. The composer subtest waits on the receipt of the channel event it expects (or a deterministic hold proves the event's arrival), with assertions unchanged and no bigger fixed timeout.
  - done: impl-1583 · 2026-11-01T16:19:12.535Z
  - verified: rev-35 [reviewer] · run rev-35-1583-source-1 · 2026-11-01T16:20:58.566Z · commit 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8
  - verified: rev-35 [reviewer] · run rev-35-1583-final-1 · 2026-11-01T16:41:14.551Z · commit 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8
- [x] C2. A regression deterministically holds the race's cause, the first browser topic.send result after its channel receipt, so Send stays pending, and shows the fixed subtest still passes once the result arrives late; the hold reproduces the original failure before the fix.
  - done: impl-1583 · 2026-11-01T16:19:12.700Z
  - verified: rev-35 [reviewer] · run rev-35-1583-final-1 · 2026-11-01T16:41:14.551Z · commit 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8
- [x] C3. A comment in the item lists every Web test on the macOS stage-cover path that waits a fixed 3–5 s for a channel event or a render, as input for the systemic decision.
  - done: impl-1583 · 2026-11-01T15:31:00.008Z
  - verified: rev-35 [reviewer] · run rev-35-1583-source-1 · 2026-11-01T16:20:58.566Z · commit 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8
  - verified: rev-35 [reviewer] · run rev-35-1583-final-1 · 2026-11-01T16:41:14.551Z · commit 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8

## Comments

### impl-1583 · 2026-11-01T15:30:15.808Z

# T-1583 C3: macOS stage-cover Web wait inventory

Source inventory at base f3d90cea3 plus the T-1583 working composer control; not runtime coverage. All Web entries from hub/test/tiers.json are included below. The stage-cover Web path shares web/test/harness.ts: pageCase sets the native default to 3000 ms and waits via pageUntil for seven rail areas or five phone slots before the test body. Thus every browser case below has a fixed 3 s render setup bound, even when it has no direct wait call. Native locator actions also inherit 3 s unless locally overridden. This is a candidate inventory for a systemic decision, not a claim that bounded receipt polling is wrong or each test is flaky.

Channel waitForEvent defaults to 5000 ms in hub/test/harness.ts; pageUntil defaults to 3000 ms in web/test/harness.ts. Explicit bounds outside 3–5 s remain outside that category. Locator waits inherit the context timeout; entries with a local override are included conservatively. Browser filechooser waits are native events, not channel delivery. Helper call sites are listed separately so waits outside a test body are visible. No production contract changes or consumer migration.

## web/test/accounts.test.ts

- L15 'Accounts profile shows this browser sign-in, last use and fixed 30-day cookie expiry' — L20 profile.locator('time').nth(2).waitFor; L35 pageUntil.
- L42 'Accounts profile excludes a second browser context sign-in on the same hub' — L49 firstProfile.locator('time').nth(2).waitFor; L60 secondProfile.locator('time').nth(2).waitFor; L67 firstProfile.locator('time').nth(2).waitFor.
- L110 'Accounts lists the fake registry with every window, path, source and limited mark' — L114 page.locator('[data-account-id="claude-code/a-main"]').waitFor.
- L129 'entering Accounts polls once and ordinary account updates never repeat it' — L134 until; L138 until; L139 pageUntil; L148 until.
- L158 'Sessions account strip shows worst windows, limited reset, tooltips and a folding Accounts link' — L164 strip.locator('[data-account-cell="claude-code/a-main"]').waitFor; L182 ion-slot="accounts"]').getByRole('button', { name: 'Fold Accounts', exact: true }).waitFor; L186 page.locator('[data-area-module="Accounts"][data-area-surface="pane"]').waitFor.
- L197 'accounts without readings show dashes and a failed registry poll exposes no file values' — L208 cell.waitFor; L214 page.locator('[data-account-id="opencode/open"]').waitFor; L219 page.getByRole('alert').filter({ hasText: 'unknown key "token"' }).waitFor.
- L228 'Accounts profile shows the signed-in user display name in users mode' — L239 profile.getByText(users[0]!.displayName, { exact: true }).waitFor.

## web/test/area-slots.test.ts

- L12 'area modules keep their slots and live hub state across a restart' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L21 'Sessions, Accounts and Artifacts own pane, page and drawer slots' — L31 module.waitFor; L36 drawer.locator(`[data-area-module="${area}"][data-area-surface="drawer"]`).waitFor; L40 detail.waitFor; L43 viewer.waitFor; L50 other.waitFor; L60 page.getByRole('list', { name: `${area} objects`, exact: true }).waitFor; L63 pageUntil.
- L67 'pushed queue, account and artifact frames require no inventory rereads' — L71 pageUntil; L72 until; L75 until; L78 until; L82 page.getByRole('button', { name: /Pushed artifact/ }).waitFor; L91 page.locator(`[data-object-id="${id}"]`).waitFor; L95 page.locator(`[data-object-id="${folderId}"]`).waitFor; L99 page.locator('[data-object-id="slot-session"]').waitFor.
- L107 'a restarted hub replaces Sessions and Accounts without reloading the page' — L110 page.locator('[data-object-id="slot-session"]').waitFor; L112 page.locator('[data-object-id="codex/slot-account"]').waitFor; L118 pageUntil; L128 pageUntil; L129 page.locator('[data-object-id="codex/new-account"]').waitFor; L132 page.locator('[data-object-id="new-session"]').waitFor.

## web/test/artifacts.test.ts

- L12 'notes and prompts open rendered Markdown with literal HTML and a raw source toggle' — L27 on="${artifact.id}"]`).getByRole('heading', { name: 'Review notes', exact: true }).waitFor; L40 drawer.getByRole('heading', { name: 'Review notes', exact: true }).waitFor.
- L45 'This topic follows the last opened thread and s adds its artifact to the retained composer draft and sent history' — L63 page.locator('[data-artifact-section="mine"] [data-artifact-row]').first().waitFor; L70 section.locator(`[data-object-id="${artifacts[0]!.id}"]`).waitFor; L73 form.locator('[data-composer-artifact]').waitFor; L79 coordinator.waitForEvent; L82 form.locator('[data-pending-message]').waitFor; L88 page.getByRole('log', { name: 'Another topic thread', exact: true }).waitFor; L90 section.locator(`[data-object-id="${artifacts[1]!.id}"]`).waitFor; L93 section.locator(`[data-object-id="${artifacts[1]!.id}"]`).waitFor.
- L97 's refuses without a writable topic and for archived or other-topic artifacts without changing the draft' — L114 page.getByRole('alert').getByText(reason, { exact: true }).waitFor; L136 page.getByRole('log', { name: 'Agents thread', exact: true }).waitFor.
- L147 's in a split pane adds one shared composer chip while an open ask answer draft stays unchanged' — L171 secondary.locator('[data-composer-artifact]').waitFor.
- L184 'Artifacts groups human, Aide and crew records with remembered section folds' — L210 peer.waitForEvent; L219 list.getByRole('button', { name: 'Fold Mine', exact: true }).waitFor; L233 row.waitFor; L240 list.getByRole('button', { name: 'Fold Mine', exact: true }).waitFor; L243 ', { name: 'Archived', exact: true }).locator(`[data-object-id="${archived.id}"]`).waitFor.
- L247 'k keeps and unkeeps an agent artifact while the up arrow navigates' — L261 kept.waitFor; L272 kept.waitFor.
- L280 'd archives without deleting human bytes and Enter requests folder files' — L294 child.waitFor; L303 folder.waitFor; L308 archive.locator(`[data-object-id="${artifact.id}"]`).waitFor.
- L318 'More artifacts traverses bounded inventory pages without duplicate rows' — L330 mine.locator('[data-object-id]').first().waitFor; L334 pageUntil; L337 mine.locator(`[data-object-id="${oldest}"]`).waitFor.
- L346 'Enter opens a capability page full height and its script cannot read the workbench document or cookie' — L365 frame.waitFor; L375 result.getByText('SecurityError', { exact: false }).waitFor; L383 frame.waitFor; L387 splitFrame.waitFor.
- L395 'files and folder children open capability text or a named binary download and report missing bytes' — L424 plain.getByText('# Plain Markdown', { exact: false }).waitFor; L429 download.waitFor; L432 page.waitForEvent; L440 mine.locator(`[data-object-id="${folder.id}/read me.md"]`).waitFor; L441 plain.getByText('# Plain Markdown', { exact: false }).waitFor; L443 -pane="secondary"]').getByRole('link', { name: 'Download data.bin', exact: true }).waitFor; L447 drawer.getByRole('alert').getByText('Artifact file not found', { exact: true }).waitFor.
- L455 'diagram HTML, SVG and Mermaid use the sandboxed viewer with source one physical key away' — L483 rendered.locator('svg .node').first().waitFor; L490 rendered.locator('svg .node').first().waitFor; L492 drawer.frameLocator('iframe').getByText(label, { exact: true }).waitFor; L495 mine.locator(`[data-object-id="${folder.id}/drawing.html"]`).waitFor; L496 drawer.frameLocator('iframe').getByText('HTML diagram', { exact: true }).waitFor.
- L502 'Mermaid strict mode blocks source scripts and callbacks, and a parse failure retains its message and exact source' — L518 frame.locator('svg .node').first().waitFor; L518 frame.getByRole('alert').waitFor.
- L545 'PNG, JPEG, GIF and WebP artifacts and a folder image load inline with a download' — L578 image.waitFor; L580 pageUntil; L589 child.waitFor; L591 image.waitFor; L592 pageUntil.
- L600 'over-cap PNG retains its size and download while SVG stays sandboxed and broken images fall back' — L623 rawer.getByRole('link', { name: `Download ${basename(large.path)}`, exact: true }).waitFor; L627 drawer.frameLocator('iframe').getByText('Sandbox image', { exact: true }).waitFor; L631 drawer.getByText('Image could not be loaded.', { exact: true }).waitFor.

## web/test/asks.test.ts

- L36 'an ask shares its question and options in thread and Inbox and physical 2 delivers option 2' — L42 card.waitFor; L48 row.waitFor; L51 fixture.asker.waitForEvent; L55 row.locator('[data-ask-outcome]').waitFor; L58 folded.locator('[data-ask-outcome]').waitFor.
- L64 'Escape leaves an ask open and d requires a reason, allows Answer instead and delivers a decline' — L78 reason.waitFor; L89 fixture.asker.waitForEvent; L92 card.locator('[data-ask-outcome]').waitFor.
- L100 'an answer in one browser context folds a second context thread and Inbox to the hub outcome within one second' — L106 firstCard.waitFor; L121 second.locator('[data-pane="secondary"] [role="log"]').waitFor; L128 cards.locator('[data-ask-outcome]').nth(1).waitFor; L129 until; L133 until; L144 until.
- L159 'a refused competing answer recovers the winner and answering from Inbox marks the topic read through the ask' — L170 until; L171 card.getByRole('status').waitFor; L184 winningCard.locator('[data-ask-outcome]').waitFor; L190 until; L193 card.locator('[data-ask-outcome]').waitFor.
- L218 'a failed free answer keeps its draft, stays pending until receipt and can be retried' — L231 until; L232 card.getByRole('status').waitFor; L236 card.getByRole('alert').waitFor; L240 fixture.asker.waitForEvent; L243 card.locator('[data-ask-outcome]').waitFor.
- L260 'the thread ask links to its Inbox row and thread-row focus answers with physical keys' — L271 help.waitFor; L276 inbox.locator(`[data-ask-id="${id}"]`).waitFor; L284 fixture.asker.waitForEvent; L287 card.locator('[data-ask-outcome]').waitFor.
- L291 'offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft' — L301 pageUntil; L311 card.locator('[data-ask-outcome]').waitFor; L315 historyCard.locator('[data-ask-outcome]').waitFor.
- L323 'a refused answer recovers its durable outcome beyond the seven-day archive without replacing newer Inbox rows' — L337 until; L348 Inbox objects', exact: true }).locator(`[data-ask-id="${id}"] [data-ask-outcome]`).waitFor; L353 nextCard.waitFor; L359 until; L362 card.locator('[data-ask-outcome]').waitFor.
- L394 'In Inbox from a secondary thread opens and focuses that pane list while the primary thread keeps its ask' — L404 copy.waitFor; L408 until; L410 secondary.locator('[data-area-module="Inbox"][data-area-surface="pane"]').waitFor; L411 destination.waitFor; L415 fixture.asker.waitForEvent; L418 original.locator('[data-ask-outcome]').waitFor.

## web/test/board.test.ts

- L10 'the Board view and Items view switcher' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L31 'C2 release epics fold with hub totals including closed children and unfold into status sections' — L39 pageUntil; L46 closedEpic.waitFor; L52 board.locator('[data-object-id="T-900108"]').waitFor; L65 board.locator('[data-object-id="T-900301"]').waitFor; L71 board.locator('[data-object-id="T-900300"]').waitFor; L77 tree.locator('[data-object-id="T-900300"]').waitFor; L85 tree.locator('[data-object-id="T-900300"]').waitFor.
- L89 'C1 Tree to Board to Tree retains epic scope, filter and selected task' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L113 'C3 Board keys and mouse expose no rank or move action' — L130 help.waitFor; L135 pageUntil.

## web/test/composer.test.ts

Helper waits: L27 row.waitFor.

- L37 'an item composer addresses the Coordinator by default and @ selects another session from the palette' — L52 fixture.coordinator.waitForEvent; L55 form.locator('[data-pending-message]').waitFor; L64 peer.waitForEvent; L71 fixture.coordinator.waitForEvent.
- L77 'the composer sends Message, Decision and Question with their kinds in the thread and peer history' — L84 fixture.coordinator.waitForEvent; L88 row.waitFor; L96 pageUntil.
- L100 'composer physical Enter, Shift+Enter and Meta+Enter send or break lines and Meta+K keeps the draft' — L107 fixture.coordinator.waitForEvent; L112 until; L117 until; L137 page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor; L141 fixture.coordinator.waitForEvent; L145 pageUntil.
- L166 'tilde attaches an artifact chip and the received message carries the selected artifact' — L193 fixture.coordinator.waitForEvent; L200 form.locator('[data-composer-artifact]').waitFor.
- L205 'per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read' — L217 fixture.coordinator.waitForEvent; L223 pageUntil; L239 page.getByRole('form', { name: 'Composer', exact: true }).waitFor; L241 until; L261 pageUntil.
- L291 'a pending send survives topic navigation and a real refusal restores text and artifacts before the newer draft' — L310 until; L311 form.locator('[data-pending-message]').waitFor; L322 form.getByRole('alert').waitFor.
- L348 'a held successful receipt keeps newer typing and reload recovers uncertain text without sending it again' — L356 fixture.coordinator.waitForEvent; L359 until; L363 form.locator('[data-pending-message]').waitFor; L368 fixture.coordinator.waitForEvent; L371 until; L374 form.waitFor.
- L399 'the artifact picker loads older inventory pages before selecting an available topic artifact' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.

## web/test/connection.test.ts

- L11 'the printed web link connects the shell and reconnects with backoff after a hub restart' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L13 'printed link, secret confinement and reconnect backoff' — L17 pageUntil; L37 pageUntil; L43 page.waitForEvent; L46 until; L54 pageUntil.
- L108 'an older page reloads once when welcome names the current bundle build' — L110 pageUntil; L114 page.waitForEvent; L117 pageUntil; L122 pageUntil; L133 page.waitForEvent; L136 pageUntil.
- L142 'a protocol refusal displays Restart hub and stops retrying' — L145 pageUntil.

## web/test/events.test.ts

- L27 'Events groups newest 200 by local day and appends bounded older pages by button and physical A' — L37 events.locator('[data-event-id]').first().waitFor; L42 pageUntil; L46 pageUntil.
- L56 'Events filters the subscription and pages in the hub, preserves filters on reload and clears with physical F' — L64 events.locator('[data-event-id]').first().waitFor; L68 pageUntil; L74 pageUntil; L77 events.locator('[data-event-id]').first().waitFor; L81 pageUntil.
- L86 'phone Events tap filters select hub categories and survive reload at 390×844 with touch' — L98 page.locator('[data-event-id]').first().waitFor; L101 filters.waitFor; L103 until; L121 page.getByRole('dialog').waitFor.
- L127 'Events dims bookkeeping, shows hub coalescing, folds a local day with za and opens an item with Enter' — L146 row.waitFor; L158 row.waitFor; L160 page.getByRole('region', { name: 'Item card', exact: true }).waitFor.
- L165 'opening Events shares the last look, marks newer rows for the visit and clears the Inbox events line' — L172 footer.waitFor; L174 fixture.ui.waitFor; L180 boundary.waitFor; L182 page.locator('[data-event-id]').first().waitFor; L186 pageUntil.
- L191 'physical s selects an Events subject in the palette and Enter opens topic, session and artifact subjects' — L218 until; L226 until; L237 pageUntil; L241 pageUntil; L247 page.locator(`[data-event-subject="${subject}"]`).first().waitFor; L251 page.getByRole('main', { name: target, exact: true }).waitFor; L252 page.getByRole('log', { name: 'Events topic thread', exact: true }).waitFor; L253 page.locator(`[data-object-id="${subject}"]`).first().waitFor; L254 page.locator(`[data-artifact-viewer][data-artifact-selection="${subject}"]`).waitFor.
- L277 'live Events retain the 200-row cap, page without gaps and follow the selected coalescing identity' — L283 fixture.ui.waitFor; L289 page.locator('[data-event-id]').nth(199).waitFor; L291 page.locator(`[data-event-id="${first.id}"]`).waitFor; L296 pageUntil; L304 page.locator(`[data-event-id="${replacement.id}"]`).waitFor; L305 pageUntil.
- L313 'held Events pages preserve newer coalescing pushes and obsolete filter replies cannot replace the current filter' — L320 page.locator('[data-event-id]').nth(199).waitFor; L323 until; L328 page.locator(`[data-event-id="${group.id}"]`).waitFor; L331 page.locator('[data-events-loading]').waitFor; L337 until; L340 pageUntil; L345 page.locator('[data-event-id]').filter({ hasText: 'After stale filter' }).first().waitFor.
- L367 'an Inbox alongside filtered Events still counts new events outside that filter' — L371 page.locator('[data-event-id]').first().waitFor; L374 pageUntil; L379 secondary.locator('[data-inbox-events]').waitFor; L382 pageUntil.
- L389 'Events help keeps every key reachable by native scrolling in a small viewport' — L396 help.waitFor; L416 until; L431 pageUntil.
- L436 'Events refreshes its filtered feed after a hub restart without replaying the last-look write' — L441 page.locator('[data-event-id]').first().waitFor; L444 pageUntil; L448 pageUntil; L453 pageUntil; L454 page.locator('[data-event-id]').filter({ hasText: 'backlog → planned' }).waitFor.
- L465 'rail digits navigate while its other keys keep the active area and focused Events rows keep kind filters' — L473 launch.waitFor; L477 page.getByRole('main', { name: 'Items', exact: true }).waitFor; L481 pageUntil; L485 page.getByRole('main', { name: 'Artifacts', exact: true }).waitFor.

## web/test/folds.test.ts

- L7 'browser folds and the prose guard' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L9 'folds remember the chevron and physical keys without hub frames' — L12 pageUntil; L14 toggle.waitFor; L19 objects.waitFor; L23 toggle.waitFor; L25 pageUntil; L31 objects.waitFor; L35 objects.waitFor; L39 toggle.waitFor.
- L45 'the prose guard rejects explanatory header fixtures and accepts the shell' — L47 pageUntil; L75 page.getByRole('dialog', { name: 'Inbox keys', exact: true }).waitFor.
- L85 'folds share the client state between panes and preserve unrelated area preferences' — L91 second.waitFor; L97 page.getByRole('button', { name: 'Fold Items', exact: true }).waitFor.
- L102 'denied writes keep folds usable even with an existing preference record' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L119 'invalid stored folds fall back independently and unavailable storage still permits folding' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.

## web/test/graph.test.ts

- L11 'the Graph view in Items' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L26 'C1 release Graph shows closed epic progress and open epic work from hub counts' — L33 closed.waitFor; L52 pageUntil.
- L67 'C2 Graph round trip retains scope, filters and selection and node selection selects its tree row' — L79 pageUntil; L82 pageUntil; L84 pageUntil; L86 graph.locator('[data-object-id="T-900105"]').waitFor; L93 tree.locator('[data-object-id="T-900105"]').waitFor.
- L102 'C3 token-only source guard passes and SVG selection paints with the shared tokens' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.

## web/test/inbox.test.ts

- L29 'Inbox keeps four ordered sections, newest five rows, oldest wait, live ages and saved folds' — L38 inbox.waitFor; L43 more.waitFor; L54 fold.waitFor.
- L62 'selected request and message unfold, physical d declines to the sender or reads exactly that row' — L75 detail.getByRole('button', { name: 'd · Decline', exact: true }).waitFor; L76 fixture.sender.waitForEvent; L80 detail.locator('[data-inbox-outcome]').waitFor; L88 read.locator('..').locator('[data-inbox-outcome]').waitFor.
- L97 `own Inbox read outcome survives ${first}-first delivery` — L109 until; L111 until; L113 outcome.filter({ hasText: /read/ }).waitFor; L118 page.locator('[data-inbox-pending]').waitFor; L119 outcome.locator('time').waitFor.
- L149 'Enter opens an Inbox message at its anchored thread row and a waiting plan in Plan' — L174 followed.waitFor; L179 target.waitFor; L180 pageUntil; L188 view.getByRole('heading', { name: 'S1 · Build', exact: true }).waitFor.
- L193 'Inbox drawer follows the selected message and physical r replies to its fake sender' — L207 drawer.waitFor; L209 target.waitFor; L216 her selected topic thread', exact: true }).locator(`[data-message-id="${other}"]`).waitFor; L219 target.waitFor; L221 until; L234 e="secondary"] [data-area-module="Inbox"][data-area-surface="page"] [role="log"]').waitFor; L237 until; L243 fixture.sender.waitForEvent; L246 pageUntil; L248 row.locator('..').locator('[data-inbox-outcome]').waitFor; L253 until.
- L262 'answered Inbox asks fold until leaving, and a non-Inbox pane focus clears the visit and selection' — L276 fixture.ui.waitFor; L277 fixture.sender.waitForEvent; L281 inbox.locator(`[data-ask-id="${id}"] [data-ask-outcome]`).waitFor; L297 fixture.ui.waitFor; L298 fixture.sender.waitForEvent; L302 primary.locator(`[data-ask-id="${second}"] [data-ask-outcome]`).waitFor; L304 primary.locator(`[data-ask-id="${second}"]`).waitFor.
- L309 'A opens seven days of Inbox departures with outcomes and an archive line below empty sections' — L327 fixture.ui.waitFor; L328 fixture.sender.waitForEvent; L333 folded.locator('[data-ask-outcome]').waitFor; L337 archive.waitFor; L339 archived.waitFor; L349 archived.waitFor.
- L356 'the events footer survives four empty sections and follows shared last-look marks and warnings' — L371 footer.waitFor; L375 pageUntil; L377 page.getByRole('heading', { name: 'Events', exact: true }).waitFor.
- L381 'asks and approvals share newest-first rows and the selected approval answers with Neovim keys' — L404 detail.getByRole('button', { name: '1 · Approve once', exact: true }).waitFor; L408 detail.locator('[data-approval-outcome]').waitFor; L417 fresh.locator('..').locator('[data-approval-outcome]').waitFor; L421 fixture.sender.waitForEvent; L424 section.locator('[data-ask-outcome]').waitFor.
- L434 'Inbox answer keys remain visible through a complete native keyboard scroll in a small viewport' — L442 help.waitFor; L463 pageUntil; L464 until.
- L473 'In Inbox reveals an older-than-five ask through a saved fold and focuses its secondary-pane card' — L490 copy.waitFor; L494 destination.waitFor; L495 pageUntil; L498 fixture.sender.waitForEvent; L501 destination.locator('[data-ask-outcome]').waitFor.
- L513 'approval card shows the complete command and session facts, then folds to the human once outcome' — L524 card.getByRole('button', { name: '2 · Always for this command', exact: true }).waitFor; L525 card.getByRole('button', { name: 'd · Deny', exact: true }).waitFor; L528 outcome.waitFor; L542 help.locator('[data-key-action="approval-once"]').waitFor; L546 next.locator('..').locator('[data-approval-outcome]').waitFor.
- L551 'Escape cancels a denial without answering and Deny accepts an optional note' — L561 note.waitFor; L568 note.waitFor; L570 row.locator('..').locator('[data-approval-outcome]').waitFor; L584 detail.locator('[data-approval-outcome]').waitFor.
- L593 'approval cards retain the complete file change and TUI-only records have no answer buttons' — L612 tui.getByText('Answer in Neovim', { exact: true }).waitFor; L616 card.getByText('Answer in Neovim', { exact: true }).waitFor.
- L623 'selecting an approval shows the session recent thread in the drawer' — L632 recent.locator(`[data-message-id="${message.id}"]`).waitFor.
- L637 'an Inbox approval recent thread routes physical message navigation and returns to its selected row' — L651 last.waitFor; L653 until; L657 until; L661 until.
- L669 'selecting another approval from one session refreshes recent messages and fences a held prior read' — L676 until; L684 recent.locator(`[data-message-id="${message.id}"]`).waitFor; L686 until.
- L709 'approval delivery stays pending until its receipt and failure preserves the denial draft for a manual retry' — L719 card.getByRole('status').getByText('Sending answer', { exact: true }).waitFor; L724 ard.getByRole('alert').getByText('fake approval delivery failed', { exact: true }).waitFor; L727 pageUntil; L731 row.locator('..').locator('[data-approval-outcome]').waitFor.
- L740 'split approval detail follows revalidation and peer closure after leaving the Inbox visit' — L747 detail.getByRole('button', { name: '1 · Approve once', exact: true }).waitFor; L750 detail.getByText('Answer in Neovim', { exact: true }).waitFor; L755 detail.locator('[data-approval-outcome]').waitFor.
- L769 'a refused approval race recovers only its exact archived winner and preserves a newer Inbox row' — L780 until; L785 page.locator(`[data-object-id="${newer.ask}"]`).waitFor; L787 until; L788 until; L792 page.locator(`[data-object-id="${latest.ask}"]`).waitFor; L796 outcome.waitFor.
- L821 'a fresh epoch recovers an approval answered by a peer while this browser was offline' — L827 row.locator('..').getByRole('button', { name: '1 · Approve once', exact: true }).waitFor; L829 pageUntil; L834 outcome.waitFor.
- L843 'the events footer counts all unread pages including a warning older than the newest 200' — L860 until.
- L865 'held successful read and decline replies preserve newer pushed Inbox rows and counts' — L884 until; L885 page.locator('[data-inbox-pending]').waitFor; L887 page.locator(`[data-object-id="${newer}"]`).waitFor; L890 until; L892 page.locator('[data-inbox-pending]').waitFor; L894 ator(`[data-object-id="${target}"]`).locator('..').locator('[data-inbox-outcome]').waitFor.
- L912 'a held approval recovery cannot overwrite a newer same-id TUI authorization delta' — L922 until; L925 detail.getByText('Answer in Neovim', { exact: true }).waitFor; L929 detail.getByRole('status').waitFor.

## web/test/item-card.test.ts

- L8 'drawer cards use summary facts across ten rows without task.view' — L27 card.waitFor; L29 page.locator(`[aria-label="Item card"][data-item-id="T-${900000 + n}"]`).waitFor; L30 pageUntil.
- L41 'agents text loads once on expansion and survives folding and reselection' — L57 pageUntil.
- L72 'Enter enters the card and Escape or h returns to the same tree row' — L85 pageUntil; L98 pageUntil; L111 pageUntil; L116 page.getByRole('separator', { name: 'Pane divider' }).waitFor; L126 pageUntil.
- L139 'closed cards fetch by-id facts and refresh from item deltas' — L156 pageUntil; L161 pageUntil; L168 pageUntil.
- L173 'closed container retains its open verdict owner facts through deltas' — L188 pageUntil; L191 pageUntil.
- L203 'hidden closed siblings defer card ordinal until a complete order or parent page arrives' — L221 card.waitFor; L225 card.getByText('3 of 3 E-900010', { exact: true }).waitFor; L231 card.getByTitle('Full sibling order is not available yet', { exact: true }).waitFor; L237 card.getByText('2 of 2 E-900010', { exact: true }).waitFor.

## web/test/item-criteria.test.ts

Helper waits: L20 card.getByLabel('New criterion', { exact: true }).waitFor.

- L24 'criteria edits on the card' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L41 'C1 add edit and remove preserve other ids and never reuse an id' — L43 card.getByRole('textbox', { name: 'Criterion C4', exact: true }).waitFor; L53 pageUntil; L60 card.getByLabel('Criterion C4', { exact: true }).waitFor; L65 card.getByLabel('Criterion C5', { exact: true }).waitFor; L72 card.getByRole('alert').waitFor; L79 pageUntil; L88 legacyCard.locator('[data-criterion-id="C1"] input').first().waitFor; L97 legacyCard.getByLabel(`Criterion ${assigned}`, { exact: true }).waitFor; L106 legacyCard.locator(`[data-criterion-id="${assigned}"]`).getByRole('status').waitFor; L113 d.locator(`[data-criterion-id="${assigned}"]`).getByText('human', { exact: true }).waitFor; L120 legacyCard.locator(`[data-criterion-id="${assigned}"]`).waitFor.
- L129 'legacy criteria become editable after assigning ids on the card' — L136 legacy.first().waitFor; L143 pageUntil; L152 card.locator('[data-criterion-id="C6"]').getByRole('status').waitFor.
- L161 'C2 done is recorded as the human' — L163 pageUntil.
- L177 'C3 the card exposes only criterion fields for editing' — L180 card.getByLabel('Criterion C3', { exact: true }).waitFor; L186 pageUntil.

## web/test/items-actions.test.ts

Helper waits: L189 page.getByRole('main', { name: 'Sessions', exact: true }).waitFor; L200 page.getByText('0 results', { exact: true }).waitFor; L203 page.getByRole('option', { name: /T-900020.*Deferred link target/ }).waitFor.

- L15 'three selected items send one General message to the fake Coordinator' — L33 pageUntil; L53 pageUntil; L56 pageUntil; L60 : 'Item scope' }).locator('[aria-current="page"]').filter({ hasText: 'E-900001' }).waitFor; L63 pageUntil; L66 page.getByRole('main', { name: 'Sessions', exact: true }).waitFor.
- L71 'M creates a missing item topic and sends the quick message there' — L84 ui.waitFor; L99 ui.waitFor; L107 page.getByRole('main', { name: 'Topics', exact: true }).waitFor; L109 page.getByRole('main', { name: 'Items', exact: true }).waitFor; L110 pageUntil.
- L115 'scope breadcrumbs, back and item-id links reveal item ancestors' — L127 tree.locator('[data-object-id="R-900000"]').waitFor; L135 tree.locator('[data-object-id="R-900000"]').waitFor; L137 tree.locator('[data-object-id="R-900000"]').waitFor; L152 target.waitFor; L153 pageUntil.
- L230 'late item-link results preserve later area and row navigation' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L232 'late item links preserve later Board epic and All tabs' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L234 'Board selection and scope retain a non-first epic from Tree' — L248 pageUntil; L251 pageUntil; L253 board.locator('[data-object-id="T-900011"]').waitFor; L255 tree.locator('[data-object-id="E-900010"]').waitFor.
- L262 'Graph shares selection, messages and scope navigation with Tree' — L276 pageUntil; L281 ui.waitFor; L289 pageUntil; L293 pageUntil; L296 pageUntil.

## web/test/items-order.test.ts

- L12 'ordinary rank and parent changes invalidate earlier rank-event orders' — L27 tree.locator('[data-object-id="T-900102"]').waitFor; L34 pageUntil; L42 pageUntil; L44 ui.waitFor; L52 pageUntil; L59 pageUntil; L61 ui.waitFor.

## web/test/items.test.ts

- L40 'the Items tree reads the pinned tracker snapshot' — L58 tree.waitFor; L60 release.waitFor; L64 epic.waitFor; L73 tree.getByText('Live fixture stage', { exact: true }).waitFor; L74 tree.locator('[data-object-id="T-900401"]').waitFor; L81 scope.waitFor.
- L85 'CLI status deltas reorder a focused task and change its hub roll-up' — L94 until; L99 tree.locator(`[data-object-id="${id}"]`).waitFor; L104 tree.getByText('First stage', { exact: true }).waitFor; L113 task.locator('[title="Closed"]').waitFor; L114 epic.locator('[role="meter"][aria-valuenow="2"]').waitFor; L128 task.getByText('✓ review r3', { exact: true }).waitFor.
- L151 'claims and verifier holds arrive in the task and ancestor rows' — L171 row.getByText(label, { exact: true }).waitFor.
- L182 'category previews, physical keys, D and A persist per client' — L191 category.waitFor; L193 tree.locator(`[data-object-id="${id}"]`).waitFor; L201 tree.locator('[data-object-id="T-900064"]').waitFor; L209 tree.locator('[data-object-id="T-900065"]').waitFor; L210 tree.getByText('D hides 1 done', { exact: true }).waitFor; L213 category.waitFor; L217 tree.getByText('D hides 1 done', { exact: true }).waitFor; L219 tree.locator('[data-object-id="T-900065"]').waitFor; L225 tree.locator('[data-object-id="R-900090"]').waitFor; L227 tree.locator('[data-object-id="R-900090"]').waitFor.
- L245 'a delta rebuilds the 300-item browser tree within 15 ms' — L257 tree.locator('[data-object-id="T-300"]').waitFor; L259 tree.locator('[data-object-id="T-3"][data-status="in progress"]').waitFor; L260 pageUntil; L261 pageUntil.
- L295 'closed epic children arrive through bounded pages and remain current after close and reconnect' — L310 tree.locator('[data-object-id="T-108"]').waitFor; L315 tree.locator('[data-object-id="T-3"][data-status="done"]').waitFor; L318 tree.locator('[data-object-id="T-108"]').waitFor.
- L326 'hidden done rows retain hub stage and total counts without loading closed pages' — L348 stage.waitFor; L354 page.getByText('3 done hidden',{exact:true}).waitFor; L355 page.getByText('2 done hidden',{exact:true}).waitFor.
- L363 'closed container pages restore nested archives once and preserve unloaded release progress' — L379 release.waitFor; L386 last.waitFor; L392 tree.locator('[data-object-id="T-200"]').waitFor; L398 root.waitFor; L402 epic.waitFor; L405 tree.locator('[data-object-id="T-302"]').waitFor; L410 tree.locator('[data-object-id="T-302"]').waitFor.

## web/test/key-contexts.test.ts

- L7 'declared composer fields own their keys while ordinary fields retain native input' — L38 page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor.
- L46 'area modules keep selection and drawers and session launch actions appear in help and palette' — L55 accounts.waitFor; L57 page.getByRole('list', { name: `${area} objects`, exact: true }).waitFor; L71 drawer.waitFor; L74 Role('form', { name: key === 'l' ? 'Launch a session' : 'New Aide', exact: true }).waitFor; L81 help.waitFor; L91 pane="secondary"]').getByRole('heading', { name: 'context-session', exact: true }).waitFor.
- L96 'the palette lists and runs handled Items actions after restoring focus' — L108 action.waitFor; L112 hidden.waitFor.

## web/test/messages.test.ts

Helper waits: L15 thread.locator('[data-message-id]').first().waitFor.

- L19 'P12 headers show sender role addressees kinds time and delivery in a separate colour gutter' — L34 report.waitFor.
- L57 'agent clear reports retain target navigation in their one-row summary' — L67 message.waitFor; L74 page.locator('[aria-label="Item card"][data-item-id="T-900001"]').waitFor.
- L81 'whole item links navigate without wrapping and posted or attached files and folders stay chips' — L105 attached.locator('[data-artifact-id]').nth(1).waitFor; L118 page.locator('[aria-label="Item card"][data-item-id="T-900001"]').waitFor.
- L126 'message Markdown renders safe elements with message-local fences and literal HTML' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L170 'P12 bands and watch verdicts preserve durable criterion facts' — L204 green.waitFor.

## web/test/notifications.test.ts

Helper waits: L87 profile.getByRole('switch', { name, exact: true, checked }).waitFor.

- L52 'hidden now ask raises one named notification whose click focuses and opens its Inbox row' — L59 pageUntil; L66 until; L69 destination.waitFor; L75 row.waitFor.
- L91 'profile switches persist Finished off across reload and request permission only on first enable' — L98 needs.waitFor; L104 profile.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L111 profile.getByRole('switch', { name: 'Finished', checked: true }).waitFor; L114 profile.getByRole('switch', { name: 'Finished', checked: false }).waitFor; L116 profile.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L119 profile.getByRole('switch', { name: 'Needs you', checked: true }).waitFor.
- L124 'looking, disabled and watch-layer asks stay silent without later replay' — L130 , { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${visible}"]`).waitFor; L136  { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${disabled}"]`).waitFor; L144 until; L148 pageUntil.
- L159 'denied permission keeps both switches off with a browser-settings tooltip' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L173 'hidden now task reaching done notifies once and its click opens the item card' — L180 pageUntil; L188 card.waitFor.
- L196 'revoked browser permission disables saved switches on reload and explains why' — L200 needs.waitFor; L203 finished.waitFor.
- L209 'one browser shares switch changes between its open tabs' — L218 rofile', exact: true }).getByRole('switch', { name: 'Needs you', checked: false }).waitFor.
- L226 'a task moved out of Now by another item delta stays silent when it later finishes' — L233 until; L238 page.getByText('1 done hidden', { exact: true }).waitFor.

## web/test/pairing.test.ts

- L21 `pairing rows give local approval instructions without an approve control (${phone ? 'phone' : 'desktop'})` — L36 row.waitFor.
- L73 'Neovim pairing card grants the fake messenger and both inboxes remove approved and expired codes' — L102 until.
- L117 'native client is reaped before the shared hub closes' — L138 page.locator(`[data-object-id="${tg.id}"]`).waitFor; L139 page.locator(`[data-object-id="${dc.id}"]`).waitFor; L154 until; L159 until; L167 page.locator(`[data-object-id="${tg.id}"]`).waitFor; L178 splitDetail.waitFor; L183 until; L188 page.locator(`[data-object-id="${dc.id}"]`).waitFor; L189 splitDetail.waitFor.
- L203 'previous hub inbox without the optional pairings field keeps existing message rows usable' — L213 row.waitFor.

## web/test/palette.test.ts

- L27 'the palette and area keys help' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L29 'command K and Space p open a modal palette; Escape closes without a frame or selection' — L32 pageUntil; L36 dialog.waitFor; L41 dialog.waitFor.
- L47 'five prefixes narrow fixed-order groups, actions show mapped keys and matching characters are blue' — L59 pageUntil; L64 dialog.getByRole('option').filter({ hasText: title! }).waitFor; L69 item.waitFor.
- L74 'Enter opens the best result, command Enter opens in the other pane and Tab cycles kind' — L80 rawer', exact: true }).getByRole('heading', { name: 'Palette item', exact: true }).waitFor; L98 -pane="secondary"]').getByRole('heading', { name: 'palette-worker', exact: true }).waitFor; L105 page.getByRole('heading', { name: 'Accounts', exact: true }).waitFor.
- L115 'area help and every displayed shell chord work by physical code with Cyrillic key values' — L119 help.waitFor; L123 help.waitFor; L126 page.getByRole('heading', { name: area, exact: true }).waitFor; L129 localHelp.waitFor; L142 localHelp.waitFor; L145 page.locator('[data-pane="secondary"]').waitFor; L147 page.locator('[data-pane="secondary"]').waitFor; L152 ta-pane="secondary"]').getByRole('heading', { name: 'Palette item', exact: true }).waitFor; L155 page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor; L157 page.getByRole('dialog').waitFor; L163 page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor.
- L168 'the Space leader survives an ordinary hub update between the physical strokes' — L172 page.getByRole('heading', { name: 'Items', exact: true }).waitFor; L177 page.getByRole('treeitem', { name: /Between strokes/ }).waitFor; L179 page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor.
- L183 'a pending Space cannot consume p after focus moves to a field or a palette input' — L192 page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor.
- L203 'blue matches use original characters after emoji and expanding case normalization' — L215 result.waitFor.
- L223 'Items help contains all 33 rows within small viewports during complete keyboard scrolls' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L226 `${viewport.width}×${viewport.height}` — L229 page.getByRole('heading', { name: 'Items', exact: true }).waitFor; L232 help.waitFor; L264 until.

## web/test/phone-approvals.test.ts

- L23 'phone approval opens the complete subject in a touch sheet and folds to the frame outcome' — L31 dialog.waitFor; L43 dialog.waitFor; L45 outcome.waitFor; L58 sheet(page).waitFor; L59 next.locator('..').locator('[data-approval-outcome]').waitFor.
- L65 'phone TUI approvals mark the command and never open answer controls' — L74 target.waitFor.
- L86 'phone Deny shares the note label row and sends with or without a note' — L109 pageUntil; L112 dialog.waitFor; L114 outcome.waitFor.
- L127 'phone file approval preserves the complete change and a peer winner closes its sheet' — L139 dialog.waitFor; L141 outcome.waitFor; L145 until; L150 page.getByRole('list', { name: 'Topics objects', exact: true }).waitFor; L152 page.getByRole('list', { name: 'Inbox objects', exact: true }).waitFor.
- L162 'a losing phone answer recovers the native winner and closes the approval sheet' — L172 until; L176 until; L177 dialog.waitFor; L179 outcome.waitFor.
- L202 'phone approval Escape, close, scrim and swipe leave the native request pending' — L215 dialog.waitFor; L222 dialog.waitFor.

## web/test/phone-asks.test.ts

- L25 'phone ask row opens a numbered touch sheet with header facts and a free answer' — L30 dialog.waitFor.
- L49 'focused phone free answer follows a resized visual viewport with three-line question and 44 px options' — L60 pageUntil; L67 sheet(page).waitFor.
- L74 'phone Decline shares the label row, needs a reason and delivers the unchanged decline' — L100 fixture.asker.waitForEvent; L104 dialog.waitFor; L106 folded.locator('[data-ask-outcome]').waitFor.
- L118 'phone sheet Escape, close, scrim and a touch swipe never answer or decline an ask' — L130 dialog.waitFor; L139 dialog.waitFor.
- L159 'a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure' — L164 sheet(first).waitFor; L172 second.locator('nav[aria-label="Phone areas"]').waitFor; L176 sheet(first).waitFor; L177 folded.locator('[data-ask-outcome]').waitFor; L178 fixture.asker.waitForEvent; L187 until; L191 first.getByRole('list', { name: 'Topics objects', exact: true }).waitFor; L193 first.getByRole('list', { name: 'Inbox objects', exact: true }).waitFor; L196 : true }).getByText('Which change should we make on the phone?', { exact: false }).waitFor.
- L207 'phone thread asks offer Answer and open the same sheet for free answers' — L212 sheet(page).waitFor; L215 card.waitFor; L222 dialog.waitFor; L225 fixture.asker.waitForEvent; L228 dialog.waitFor; L229 card.locator('[data-ask-outcome]').waitFor.

## web/test/phone-composer.test.ts

Helper waits: L28 form.waitFor.

- L32 'phone composer docks two rows of 44 px controls above the bar with the default Coordinator' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L61 'phone addressee can be cleared in row one and stays implicit after reload' — L75 form.waitFor; L86 form.waitFor; L90 fixture.coordinator.waitForEvent; L93 form.locator('[data-pending-message]').waitFor.
- L102 'phone Return chords break the line and only Send delivers the multiline message' — L129 fixture.coordinator.waitForEvent.
- L139 'phone kind chip opens a checked inline sheet that lifts history and sends Question' — L149 sheet.waitFor; L160 sheet.waitFor; L168 fixture.coordinator.waitForEvent; L174 form.locator('[data-pending-message]').waitFor.
- L180 'phone queued messages show 44 px Withdraw below the text and restore only on receipt until the turn starts' — L198 fixture.ui.waitFor; L203 withdraw.waitFor; L210 form.locator('[data-pending-message]').waitFor; L211 fixture.ui.waitFor; L214 until; L219 pageUntil; L226 nextRow.getByRole('button', { name: 'Withdraw', exact: true }).waitFor; L227 fixture.ui.waitFor; L230 pageUntil.
- L244 'phone per-topic drafts survive navigation and reload with their chosen kind' — L265 form.waitFor.

## web/test/phone-disconnected.test.ts

- L10 'phone disconnect shows a counting backoff and immediate Retry resets it without reloading' — L13 pageUntil; L21 pageUntil; L32 until; L37 page.waitForEvent; L40 until; L45 pageUntil; L48 pageUntil.
- L57 'phone keeps the last Inbox time and disables every answer and reply while disconnected' — L75 rows.locator(`[data-object-id="${asked.ask}"]`).waitFor; L76 pageUntil; L81 pageUntil.
- L108 'phone reconnect keeps offline drafts unsent and refreshes a refused resume from the last sequence' — L116 composer.waitFor; L117 pageUntil; L121 pageUntil; L146 inbox.locator(`[data-object-id="${asked.ask}"]`).waitFor.

## web/test/phone-inbox.test.ts

- L12 'phone Inbox keeps four touch folds and changes its empty title for a live ask' — L20 inbox.waitFor; L21 pageUntil; L38 messages.waitFor; L43 inbox.locator(`[data-object-id="${asked.ask}"]`).waitFor.
- L50 'phone message and request replies unfold inline, share topic drafts and reach the sender' — L70 row.waitFor; L79 field.waitFor; L84 pageUntil; L95 requestField.waitFor; L99 sender.waitForEvent; L104 detail.locator('[data-inbox-outcome]').waitFor; L109 sender.waitForEvent; L113 requestDetail.locator('[data-inbox-outcome]').waitFor.
- L119 'phone waiting plans show their counts without Plan actions and touch footers close the list' — L131 plan.waitFor; L143 inbox.getByRole('list', { name: 'Inbox archive', exact: true }).waitFor; L147 page.getByRole('list', { name: 'Events objects', exact: true }).waitFor.

## web/test/phone-install.test.ts

- L12 'the installed start URL opens Inbox over a saved Sessions area and leaves a plain root URL' — L17 pageUntil; L19 pageUntil; L24 pageUntil; L28 pageUntil.
- L33 'web --qr signs a fresh phone into Inbox with a thirty-day cookie' — L41 pageUntil.
- L62 'the app badge follows needs-you counts and clears when the last ask is answered' — L70 pageUntil; L74 pageUntil; L78 pageUntil; L81 pageUntil; L84 pageUntil.
- L96 'phones without the Badging API keep live attention counts' — L105 pageUntil.

## web/test/phone-more.test.ts

Helper waits: L16 pageUntil.

- L20 'phone Items opens a reusable read-only full-screen card and returns by either back control' — L27 tree.waitFor; L33 card.waitFor; L40 card.getByText('Keep criterion', { exact: false }).waitFor; L48 row.waitFor; L50 card.waitFor; L52 row.waitFor.
- L61 'phone item action keys are inert and desktop keys still filter, compose and edit' — L94 row.waitFor; L96 page.getByRole('group', { name: 'Items view', exact: true }).waitFor; L103 page.getByRole('textbox', { name: 'Quick message', exact: true }).waitFor; L104 pageUntil; L107 pageUntil; L112 tton', { name: 'Mark C1 done', exact: true }).getByText('✓ Done', { exact: true }).waitFor; L115 page.getByRole('group', { name: 'Items view', exact: true }).waitFor.
- L120 'phone Artifacts opens the full-screen viewer without Keep, Archive or compose' — L134 viewer.getByRole('heading', { name: 'Phone artifact', exact: true }).waitFor; L145 row.waitFor; L147 viewer.waitFor; L149 row.waitFor.
- L158 'phone Accounts retains registry and window facts while notification switches stay desktop only' — L168 account.getByText('38%', { exact: true }).waitFor; L170 page.getByRole('region', { name: 'Profile', exact: true }).locator('time').nth(2).waitFor; L174 page.getByRole('switch', { name: 'Needs you', exact: true }).waitFor.
- L179 'phone Back wins over an earlier held item-link read' — L194 until; L197 tree.locator('[data-object-id="T-1"]').waitFor; L201 palette.getByText('0 results', { exact: true }).waitFor; L203 palette.getByRole('option', { name: /T-2.*Held phone target/ }).waitFor.

## web/test/phone-notifications.test.ts

- L29 'phone More subscribes on a tap with root worker scope and shared switches without Web Push' — L37 pageUntil; L47 more.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L52 more.getByRole('switch', { name: 'Needs you', checked: true }).waitFor.
- L57 'hidden phone ask goes once through the worker and its message opens the exact Inbox row' — L71 pageUntil; L76 page.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L78 pageUntil; L86 until; L90 row.waitFor; L95 until.
- L100 'phone subscription denial turns saved switches off and explains browser settings without registering' — L105 more.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L107 more.getByRole('switch', { name: 'Needs you', checked: false }).waitFor.
- L122 'waiting plan and TUI-bound Claude approval each notify through the phone worker' — L136 pageUntil; L141 page.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L143 pageUntil; L149 pageUntil; L157 page.locator(`[data-object-id="${approval.id}"]`).waitFor.
- L164 `held registration suppresses a notification after ${suppression} changes` — L171 pageUntil; L176 page.getByRole('switch', { name: 'Needs you', checked: true }).waitFor; L190 pageUntil; L199 page.getByRole('switch', { name: 'Needs you', checked: false }).waitFor.

## web/test/phone-sessions.test.ts

- L11 'phone Sessions shows counts, one account row and two-line sessions without row actions' — L31 page.locator('[data-object-id="idle"]').waitFor; L63 page.locator('[data-area-module="Accounts"] [data-account-id="codex/main"]').waitFor.
- L72 'phone waiting session page shows its command and both Back paths focus the same row' — L85 detail.getByRole('button', { name: 'Stop', exact: true }).waitFor; L98 row.waitFor; L99 pageUntil.
- L106 'phone Back restores focus when Stop moves the session into a folded group' — L121 detail.getByRole('button', { name: 'Resume', exact: true }).waitFor; L126 row.waitFor; L128 pageUntil.
- L134 'phone session page confirms 44 px Stop/Archive actions with scratch CLI receipts' — L149 detail.getByRole('button', { name: 'Stop', exact: true }).waitFor; L154 confirm.waitFor; L162 detail.getByRole('button', { name: 'Resume', exact: true }).waitFor; L170 archive.waitFor; L174 detail.getByRole('button', { name: 'Archive', exact: true }).waitFor.
- L183 'phone verify line opens the shared queue in a full-height sheet and Close restores the list' — L190 pageUntil; L193 sheet.getByRole('table', { name: 'Verification queue', exact: true }).waitFor; L206 sheet.waitFor.

## web/test/phone-thread.test.ts

- L10 'phone topic opens full screen with its facts and both Back paths return to Topics' — L23 log.getByText('Phone thread receipt', { exact: true }).waitFor; L25 page.getByRole('heading', { name: 'Phone discussion', exact: true }).waitFor; L37 row.waitFor.
- L43 'phone verdicts long ids and fenced code fit 390 px with horizontal scrolling inside code only' — L63 log.locator('pre').waitFor; L64 log.locator('[data-verdict="clear"]').waitFor.
- L83 'phone HTML chips open the sandboxed full-screen viewer and return to the same thread' — L101 chip.waitFor; L114 frame.contentFrame().getByRole('heading', { name: 'Phone artifact receipt' }).waitFor; L124 chip.waitFor; L129 pageUntil; L131 frame.waitFor.
- L136 'phone run has two factual lines and a tap keeps its anchor in place' — L157 button.waitFor; L169 pageUntil; L173 pageUntil; L176 pageUntil.
- L181 'phone topic item card is read-only and both Back paths retain the exact reading anchor' — L196 anchor.waitFor; L203 card.getByText('Thread card summary', { exact: true }).waitFor; L211 card.getByText('Read criterion', { exact: false }).waitFor; L216 anchor.waitFor; L221 page.getByRole('region', { name: 'Item card', exact: true }).waitFor; L224 pageUntil.
- L229 'phone card retains the last message through covered live traffic and both Back paths' — L240 log.locator('article').filter({ hasText: 'Initial message 9\n' }).waitFor; L248 page.getByRole('region', { name: 'Item card', exact: true }).waitFor; L250 page.waitForFunction; L256 anchor.waitFor.

## web/test/phone.test.ts

- L11 'the phone frame replaces the rail without losing desktop state' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L13 'five touch slots open the four areas and Inbox is home' — L23 pageUntil.
- L29 'More has no scrim, closes on Escape, selection and outside taps, and frame controls fit touch' — L36 sheet.waitFor; L46 sheet.waitFor; L51 sheet.waitFor; L57 sheet.waitFor; L59 page.getByRole('dialog').waitFor.
- L62 '640 px keeps the collapsed rail and 639 px swaps to the bar without reload' — L67 page.getByRole('navigation', { name: 'Areas', exact: true }).waitFor; L71 page.getByRole('navigation', { name: 'Phone areas', exact: true }).waitFor.
- L76 'phone selection and split chords leave the saved desktop split intact' — L83 other.waitFor; L86 other.getByRole('heading', { name: 'Accounts', exact: true }).waitFor; L88 other.waitFor; L94 card.waitFor; L103 page.getByRole('navigation', { name: 'Phone areas', exact: true }).waitFor; L106 other.getByRole('heading', { name: 'Accounts', exact: true }).waitFor.
- L114 'phone Inbox selection keeps asks in a sheet and replies inline without a drawer' — L133 page.locator(`[data-object-id="${asked.ask}"][aria-pressed="true"]`).waitFor; L135 card.locator('[data-ask-option="1"]').waitFor; L139 card.waitFor; L143 page.locator(`[data-object-id="${id}"][aria-pressed="true"]`).waitFor.
- L153 'phone badges share attention facts and count every event since the shared last look' — L177 pageUntil; L180 pageUntil; L181 e.locator('[data-area="Events"] [data-count]').filter({ hasText: String(events) }).waitFor; L186 pageUntil; L190 pageUntil.

## web/test/plan.test.ts

- L12 'the Plan view in Items' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L24 'C1 a approves a waiting plan as the human and the CLI reads the receipt' — L26 plan.getByRole('button', { name: 'a · Approve' }).waitFor; L27 pageUntil; L32 pageUntil; L39 pageUntil; L47 pageUntil; L57 page.getByRole('textbox', { name: 'Plan discussion' }).waitFor.
- L79 'C2 changes since the last look use watch colour and entry advances the shared mark' — L91 stage.waitFor; L98 until; L102 pageUntil; L106 stage.waitFor; L109 until; L113 page.getByRole('heading', { name: 'S1 · Changed stage', exact: true }).waitFor.
- L118 'C3 approval is absent and inert below desktop width and on a live resize' — L126 plan.getByRole('button', { name: 'a · Approve' }).waitFor; L128 plan.getByRole('button', { name: 'a · Approve' }).waitFor; L134 help.waitFor; L140 row.waitFor; L148 plan.getByRole('button', { name: 'a · Approve' }).waitFor.

## web/test/readme.test.ts

- L21 'the README fresh clone builds, starts its own hub and signs a Headless Shell context in' — L64 until; L125 until; L160 page.waitForEvent; L164 pageUntil.

## web/test/remote-via.test.ts

- L9 'remote messages, ask decisions and Codex approvals show their source in the thread and Inbox' — L25 page.locator(`[data-object-id="${asked.ask}"]`).waitFor; L26 page.locator(`[data-object-id="${approvalId}"]`).waitFor; L27 page.locator(`[data-object-id="${deniedId}"]`).waitFor; L37 ask.getByText('via Telegram', { exact: true }).waitFor; L42 approval.getByText(/via Telegram/).waitFor; L47 opencode.getByText(/via Telegram/).waitFor; L52 row.getByText(/via Telegram/).waitFor; L58 message.getByText('via Telegram', { exact: true }).waitFor; L61 discordMessage.getByText('via Discord', { exact: true }).waitFor; L66 history.getByText('via Telegram', { exact: true }).waitFor.
- L72 'client reads the previous ask outcome shape without via in history and the archive' — L83 row.getByText(/Legacy answer/).waitFor; L88 card.getByText('Legacy answer', { exact: true }).waitFor.

## web/test/remotes.test.ts

- L18 `Sessions Remotes renders native outage within one second and clears its error on recovery (${phone ? 'phone' : 'desktop'})` — L62 row.waitFor; L78 until; L93 until; L95 until; L107 pageUntil; L111 until; L116 until; L130 until; L137 section.waitFor; L160 pageUntil.
- L172 'native Discord outage, recovery, pairing, voice and approval render in Chromium' — L180 row.getByText(/connected/).waitFor; L182 until; L188 until; L190 until; L195 pair.waitFor; L200 outcome.getByText(/via Discord/).waitFor; L206 block.getByText('via Discord', { exact: true }).waitFor.

## web/test/session-actions.test.ts

- L11 'Stop confirms in place, Escape keeps the busy session, and Enter stops it' — L22 confirm.waitFor; L25 page.getByLabel('Confirm Stop stop-worker', { exact: true }).waitFor; L28 confirm.waitFor; L36 confirm.waitFor; L37 gion', { name: 'Stopped', exact: true }).locator('[data-object-id="stop-worker"]').waitFor; L43 page.getByLabel('Confirm Stop stop-worker', { exact: true }).waitFor.
- L48 'Offline session actions are disabled and do not replay after reconnect' — L58 pageUntil; L62 pageUntil; L68 pageUntil.
- L86 'A failed Stop shows the hub reason and a pending confirmation sends only once' — L100 actions.getByRole('alert').waitFor; L111 actions.getByRole('group').waitFor; L113 until; L117 on', { name: 'Stopped', exact: true }).locator('[data-object-id="failed-worker"]').waitFor.
- L125 'At narrow width a tap or Enter opens the session page' — L131 pageUntil; L136 detail.getByRole('button', { name: 'Stop', exact: true }).waitFor; L140 confirm.waitFor; L145 row.waitFor; L146 pageUntil; L154 detail.getByRole('table', { name: 'narrow-worker capabilities', exact: true }).waitFor; L157 row.waitFor; L160 row.waitFor; L163 archivedRow.waitFor; L165 detail.getByRole('table', { name: 'narrow-worker capabilities', exact: true }).waitFor; L167 archivedRow.waitFor; L168 pageUntil.
- L173 'The session page shows facts and capabilities and shares all four actions' — L184 detail.getByRole('table', { name: 'page-worker capabilities', exact: true }).waitFor; L189 detail.getByRole('table').waitFor; L192 stop.waitFor; L196 stop.waitFor; L197 detail.getByRole('button', { name: 'Resume', exact: true }).waitFor; L200 detail.getByRole('button', { name: 'Stop', exact: true }).waitFor; L204 stop.waitFor; L206 detail.getByRole('button', { name: 'Resume', exact: true }).waitFor; L209 archive.waitFor; L211 page.locator('[data-pane="primary"] [data-object-id="page-worker"]').waitFor.
- L218 'Unavailable resume shows its reason and offers a fresh launch with the same brief' — L232 actions.getByRole('alert').waitFor; L235 fresh.waitFor; L237 actions.getByRole('button', { name: 'Stop', exact: true }).waitFor.
- L247 'Capabilities shows the read-only adapter table or the missing adapter' — L259 table.waitFor; L269 page.getByText('No adapter for no-adapter', { exact: true }).waitFor.
- L274 'Archive confirms once and moves the stopped session into the archive' — L285 confirm.waitFor; L290 confirm.waitFor; L291 row.waitFor; L296 archived.waitFor.
- L304 'Resume relaunches the stopped session with its name, role and claim' — L312 spoke.waitForEvent; L319 ssion-detail="resume-worker"]').getByRole('button', { name: 'Stop', exact: true }).waitFor.

## web/test/session-drawer.test.ts

- L10 'the session drawer approves a fake Codex command and retains its folded outcome after Waiting' — L22 card.waitFor; L24 waiting.locator('[data-object-id="drawer-worker"]').waitFor; L26 drawer.locator('[data-approval-outcome]').waitFor; L27 until; L32 pageUntil.
- L36 'the session drawer pages both directions of cross-topic traffic by number and follows live messages' — L62 log.locator(`[data-message-id="${firstPage.messages.at(-1)!.id}"]`).waitFor; L68 log.getByText(text, { exact: true }).waitFor; L72 log.getByText('Live outgoing traffic', { exact: true }).waitFor; L76 log.getByText('Live incoming traffic', { exact: true }).waitFor.
- L87 'a held older session page preserves live traffic, numeric boundaries and the reading anchor' — L102 log.locator(`[data-message-id="${latest.messages.at(-1)!.id}"]`).waitFor; L103 until; L109 log.getByText('Live while older page is held', { exact: true }).waitFor; L112 log.getByText('Paged traffic 00', { exact: true }).waitFor; L114 until.
- L138 'a session drawer keeps TUI-only approvals read-only and prefers a new pending card over a closed one' — L148 drawer.locator('[data-approval-outcome]').waitFor; L149 drawer.getByText('Answer in Neovim', { exact: true }).waitFor.
- L160 'Retry after a failed session selection refresh reads recent traffic even when older history is complete' — L175 log.getByText('Complete short history', { exact: true }).waitFor; L180 retry.waitFor; L182 until; L186 until; L187 retry.waitFor.
- L209 'the drawer composer delivers to the selected fake Codex session in its item topic or General' — L232 form.locator('[data-composer-address]').waitFor; L242 until; L258 form.locator('[data-pending-message]').waitFor.
- L264 'desktop Enter and Open thread focus the selected session log with shared physical thread keys' — L276 log.locator(`[data-message-id="${message.id}"]`).waitFor; L278 pageUntil; L283 pageUntil; L287 pageUntil; L294 secondary.getByRole('log', { name: 'focus-worker recent thread', exact: true }).waitFor; L295 pageUntil.

## web/test/session-launch.test.ts

Helper waits: L40 pageUntil.

- L46 'New Aide uses role defaults and Enter launches under Yours in the project root without a directory frame' — L53 form.waitFor; L61 ole('region', { name: 'Yours', exact: true }).locator('[data-object-id="aide-1"]').waitFor; L64 form.waitFor.
- L84 'Role selection fills its launch defaults and a different harness clears model and effort' — L106 form.waitFor.
- L111 'Focusing Model fetches the selected harness and account catalog and ignores a late old visit' — L123 pageUntil; L130 pageUntil; L135 page.locator('[data-object-id="catalog-barrier"]').waitFor.
- L157 'A limited fake account shows the hub reset refusal under the retained form and launches nothing' — L170 form.waitFor; L177 alert.waitFor.
- L188 'Launch actions use physical keys and palette dispatch while form typing and Cancel stay native' — L195 launch.waitFor; L208 launch.waitFor; L214 page.getByRole('option').filter({ hasText: action }).waitFor; L216 form.waitFor; L220 form.waitFor; L222 page.getByRole('form', { name: 'New Aide', exact: true }).waitFor.
- L228 'An item and artifact brief launch once while the request is pending with no client directory' — L241 form.waitFor; L248 until; L253 page.locator('[data-object-id="item-worker"]').waitFor.
- L276 'Offline launch is disabled and reconnect never replays the draft' — L289 pageUntil; L294 pageUntil.
- L311 'Session page launch actions open the same form in the active pane' — L323 form.waitFor; L327 form.waitFor.
- L332 'Launch waits for role defaults when the initial sessions snapshot is delayed' — L337 pageUntil; L344 form.waitFor.
- L362 'a custom role is selectable with its own defaults and appears in the crew after launch' — L375 row.waitFor.

## web/test/sessions.test.ts

- L12 'Sessions groups count fake sessions and remember folds without hub requests' — L29 group.locator(`[data-object-id="${name}"]`).waitFor; L33 pageUntil; L40 page.getByRole('button', { name: 'Fold Idle', exact: true }).waitFor.
- L47 'Sessions rows render merged facts, holds, waiting detail and physical selection keys' — L73 row.waitFor; L85 detail.waitFor; L90 pageUntil; L98 pageUntil; L130 pageUntil.
- L141 'Sessions selected human wait names its topic and usage falls back to tokens' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L165 'Sessions caps stopped rows at the latest twenty and reads merged archives with A' — L180 stopped.locator('[data-object-id="stopped-21"]').waitFor; L188 help.waitFor; L192 page.locator('[data-object-id="stopped-00"]').waitFor; L198 gion', { name: 'Archived', exact: true }).locator('[data-object-id="stopped-01"]').waitFor.
- L207 'gs from an item reveals its claimed session inside a folded group' — L231 row.waitFor.
- L239 'Sessions renders deaf health and clears it after the next injection' — L256 page.locator('[data-object-id="held-worker"]').waitFor; L259 row.waitFor; L262 ui.waitFor; L263 page.locator('[data-state="idle"]:has([data-object-id="held-worker"])').waitFor.

## web/test/shell.test.ts

- L10 'the shell rail, top strip and physical-code navigation' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L13 'the rail shows attention rather than busy-session totals and the top strip follows the hub' — L24 pageUntil; L40 pageUntil.
- L46 'the rail collapses to stroke icons at 60 px and remembers the button choice' — L55 pageUntil.
- L67 'physical digit codes switch areas with Cyrillic key values and preserve field typing' — L71 page.locator('h1').filter({ hasText: area }).waitFor.
- L83 'the release pick uses one versioned shell key and survives a reload' — L90 page.locator('select[aria-label="Release"] option').filter({ hasText: 'Next' }).waitFor; L93 pageUntil.
- L100 'storage denial keeps the shell usable on reads, writes and storage-property access' — L108 page.locator('h1').filter({ hasText: 'Items' }).waitFor.
- L119 'the keyboard cursor has a blue 2 px ring on selection, hover only lightens, and ids stay whole' — L137 pageUntil.
- L148 'split panes start at 2:1, drag, swap and close while restoring the rail choice' — L154 right.waitFor; L161 right.getByRole('heading', { name: 'Topics', exact: true }).waitFor; L163 left.getByRole('heading', { name: 'Topics', exact: true }).waitFor; L171 pageUntil; L173 right.getByRole('heading', { name: 'Items', exact: true }).waitFor; L176 right.waitFor; L181 right.waitFor.
- L187 'selected hub rows open the drawer; close and Esc persist until selection moves; Split and command Enter open the other pane' — L196 first.waitFor; L200 drawer.getByRole('heading', { name: 'Drawer first', exact: true }).waitFor; L202 drawer.waitFor; L206 first.waitFor; L209 drawer.getByRole('heading', { name: 'Drawer second', exact: true }).waitFor; L212 drawer.waitFor; L215 drawer.getByRole('heading', { name: 'Drawer first', exact: true }).waitFor; L217 page.getByRole('heading', { name: 'Topics', exact: true }).waitFor; L223 other.getByRole('heading', { name: 'Drawer first', exact: true }).waitFor; L226 other.waitFor; L230 other.getByRole('heading', { name: 'Drawer second', exact: true }).waitFor; L233 ata-pane="primary"]').getByRole('heading', { name: 'Drawer second', exact: true }).waitFor; L235 other.waitFor.

## web/test/smoke.test.ts

- L9 'the web shell uses a one-time edge link, strict CSP and isolated browser fixtures' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L11 'the rail has seven areas and every request stays on the origin' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L21 'a fresh context keeps CSP enabled and rejects an inline script' — L32 pageUntil.
- L36 'two failing fixtures retain distinct traces named in their diagnostics' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L66 'fixture Date follows hub jumps while native browser timers keep running' — L72 pageUntil.
- L84 'aborted page work drains held Date updates before closing its context' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L114 'rejected Date update retains its error and still updates the other enrolled page' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L137 'Date drainage failure still disposes native browser and hub resources' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.

## web/test/telegram-marks.test.ts

- L6 'native Telegram voice marks, audio, text and approval outcome render in Chromium' — L13 outcome.getByText(/via Telegram/).waitFor; L19 row.getByText('via Telegram', { exact: true }).waitFor; L29 row.locator('header [data-voice-mark]').waitFor.

## web/test/thread-artifacts.test.ts

- L9 'HTML artifacts render their hub address inline at 240 px while files and folders stay chips' — L29 frame.waitFor; L37 frame.contentFrame().getByRole('heading', { name: 'Inline artifact content' }).waitFor; L41 chip.waitFor; L48 attached.locator('iframe').waitFor.
- L61 'moving a thread-opened page into a folder does not resurrect a top-level artifact' — L74  iframe').contentFrame().getByRole('heading', { name: 'Moving artifact content' }).waitFor; L78 row.waitFor; L79 row.waitFor; L88 child.waitFor.
- L94 'artifact scripts cannot read the workbench document or navigate its top window' — L113 frame.waitFor; L115 attempt.waitFor; L117 .getByText('{"read":"SecurityError","navigate":"SecurityError"}', { exact: true }).waitFor.
- L126 'an unservable HTML artifact remains a chip with the serving reason in its tooltip' — L137 chip.waitFor.
- L144 'Open full opens the artifact address in a new page and Open in a pane keeps the thread beside it' — L165 link.waitFor; L168 page.context().waitForEvent; L172 full.getByRole('heading', { name: 'Full artifact content' }).waitFor; L179 frame.contentFrame().getByRole('heading', { name: 'Full artifact content' }).waitFor; L185 data-pane="secondary"]').getByRole('log', { name: 'General thread', exact: true }).waitFor; L187 "] iframe').contentFrame().getByRole('heading', { name: 'Full artifact content' }).waitFor.

## web/test/thread-runs.test.ts

Helper waits: L18 log.locator('[data-run-anchor]').first().waitFor.

- L33 'hub fold lines open and close in place by click Enter and za' — L61 page.waitForFunction; L67 page.waitForFunction; L82 pageUntil; L86 page.locator('[aria-label="Item card"][data-item-id="T-900001"]').waitFor.
- L93 'a paged run keeps its full hub count and the first open message anchored on prepend' — L112 pageUntil; L115 page.waitForFunction.
- L126 'an open run keeps its anchor pinned while scrolling its messages' — L141 pageUntil; L142 page.waitForFunction; L158 pageUntil.
- L165 'protected messages stay unfolded and live growth replaces the hub fold line' — L175 ui.waitFor; L214 page.waitForFunction; L222 pageUntil; L223 log.locator('article').filter({ hasText: 'Fourth tail step' }).waitFor.
- L238 'expanding and collapsing reschedule visible read marks for the displayed run' — L257 pageUntil; L260 until; L263 pageUntil; L265 until.

## web/test/topics.test.ts

- L9 'a fresh snapshot replaces a pending initial history load and ignores its stale reply' — L22 until; L25 until; L26 until; L32 page.locator(`[role="log"] [data-message-id="${liveId}"]`).waitFor; L35 page.locator(`[role="log"] [data-message-id="${id}"]`).waitFor.
- L52 'a rejected earlier page retries with its old top message anchored' — L69 thread.locator('[data-message-id]').nth(99).waitFor; L76 until; L79 retry.waitFor; L81 thread.getByText('Retry guard receipt', { exact: true }).waitFor; L90 until; L92 thread.locator('[data-message-id]').nth(150).waitFor.
- L110 'Topics groups separate waiting, standing, item and closed topics and remember folds' — L132 list.waitFor; L134 module.waitFor; L145 pageUntil; L152 right.locator('[data-area-module="Topics"][data-area-surface="page"]').waitFor; L153 right.getByRole('log', { name: 'Agents thread', exact: true }).waitFor; L158 pageUntil.
- L163 'reading the top of a long thread marks only the last message on screen' — L180 thread.locator('[data-message-id]').filter({ hasText: 'Offscreen tail' }).waitFor; L190 thread.locator('[data-message-id]').filter({ hasText: 'New offscreen message' }).waitFor; L192 until; L197 ui.waitFor.
- L218 'held history pages retain live messages, newer ask state and the scrolling anchor' — L232 until; L233 ge.locator(`[role="log"] [data-ask-id="${asked.ask}"][data-ask-state="answered"]`).waitFor; L236 ('[role="log"] [data-message-id]').filter({ hasText: 'Live across initial page' }).waitFor; L239 ask.waitFor; L252 until; L254 hread.locator('[data-message-id]').filter({ hasText: 'Live across earlier page' }).waitFor; L256 thread.locator('[data-message-id]').nth(202).waitFor; L259 thread.locator('[data-message-id]').nth(208).waitFor.
- L278 'reconnect resumes missed thread deltas and only rereads history after a fresh snapshot' — L288 locator('[role="log"] [data-message-id]').filter({ hasText: 'Before disconnect' }).waitFor; L294 pageUntil; L297 locator('[role="log"] [data-message-id]').filter({ hasText: 'During disconnect' }).waitFor; L298 pageUntil; L304 pageUntil; L306 pageUntil.
- L320 'read marks wait one visible second and never include offscreen messages or a hidden page' — L334 message.waitFor; L339 until; L340 until; L349 tor('[role="log"] [data-message-id]').filter({ hasText: 'Hidden unread receipt' }).waitFor; L356 until.
- L361 'live messages and ask outcomes replace thread facts without another history or topic-list read' — L378 thread.waitFor; L379 pageUntil; L386 ask.waitFor; L389 ask.locator('[data-ask-id][data-ask-state="answered"]').waitFor; L397 queued.waitFor; L400 until; L401 queued.locator('[data-delivery-stage]').filter({ hasText: 'injected' }).waitFor.
- L414 '300 messages open at the end and page backwards without gaps, repeats or a moving anchor' — L428 thread.locator(`[data-message-id="${expected.at(-1)}"]`).waitFor; L440 thread.locator('[data-message-id]').nth(total - 1).waitFor.

## web/test/uploads.test.ts

- L10 'composer sends one PNG with its caption and refuses oversized files while retaining native keys and artifact chips' — L21 page.waitForEvent; L24 form.locator('[data-composer-file]').waitFor; L32 page.locator(`[data-message-id="${result.value.message.id}"]`).waitFor; L42 refused.waitFor; L54 form.locator('[data-composer-artifact]').waitFor; L57 form.locator('[data-composer-file]').waitFor; L63 page.getByText('Plain send', { exact: true }).first().waitFor; L69 form.locator('[data-composer-file]').waitFor; L73 form.getByRole('alert').waitFor.

## web/test/verification.test.ts

Helper waits: L14 until; L18 pageUntil.

- L27 'Sessions verification queue shows hand runs, ages receipts and remembers its fold' — L34 until.
- L42 'C1 hand holder and waiter open in place with Enter and executor status is read once per opening' — L48 pageUntil; L51 pageUntil; L55 pageUntil; L58 pageUntil; L61 line.waitFor; L63 pageUntil; L65 page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor; L74 pageUntil; L79 pageUntil; L80 until.
- L90 'C3 elapsed running and wait times advance without a frame and a replacement resets their receipt' — L96 page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor; L104 pageUntil.
- L115 'C4 queue open and closed preferences survive reload' — L121 page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor; L123 page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor; L128 line.waitFor.

## web/test/withdraw.test.ts

- L32 'Withdraw restores a queued message before newer typing only after its receipt' — L43 fixture.ui.waitFor; L48 form.locator('[data-pending-message]').waitFor; L50 fixture.ui.waitFor; L54 until; L65 pageUntil; L75 fixture.ui.waitFor; L78 form.waitFor.
- L98 'a queued message loses Withdraw when the fake session takes its next turn' — L106 row.getByRole('button', { name: 'Withdraw', exact: true }).waitFor; L108 fixture.ui.waitFor; L111 pageUntil.
- L118 'withdrawn text stays ahead of a newer pending send on receipt or reload' — shared browser render/action bounds where pageCase is used; no direct channel/render wait call.
- L120 outcome — L139 until; L142 pageUntil; L143 until; L155 until; L156 form.waitFor; L157 form.locator('[data-pending-message]').waitFor.
- L179 'a real withdrawal refusal retains the message with the hub reason in its tooltip' — L193 until; L194 fixture.ui.waitFor; L197 until; L200 failed.waitFor; L208 pageUntil.
- L239 'one injected recipient removes Withdraw while the broadcast remains queued' — L256 row.getByRole('button', { name: 'Withdraw', exact: true }).waitFor; L258 until; L259 fixture.ui.waitFor; L262 until; L265 until; L268 until; L270 until; L275 page.getByRole('form', { name: 'Composer', exact: true }).waitFor.

Total: 298 statically declared test/subtest entries; dynamic case names are represented by their source template, not counted as executed generated cases. This inventory does not constitute a pass.

### impl-1583 · 2026-11-01T16:19:13.252Z

C1/C2 diagnosis and local evidence: A-15306 original failure is “no channel event matched within 5000ms”, with Single line receipt present and multiline absent. Holding the first successful browser topic.send result after peer delivery deterministically reproduces that same error on the original sequence (exit 1, 2026-11-01, macOS darwin arm64, Node 24.21.0, local executor, isolated Chrome Headless Shell revision 1248 / 156.0.8078.4). This proves pending completion races the next send; it is not machine-load/stage-cover reproduction. Fixed test waits within 3000 ms for the positively rendered enabled Send button after typing the next draft. The 500 ms negative native click releases the hold; readiness stays pending while held. All existing assertions and 5000 ms channel bounds retained. Full touched composer file passes 8/8, 0 fail/cancelled/skipped/todo. First attempt failed setup because web/dist was absent; npm run build succeeded before causal red/green. Browser groups drained to zero. Checks ran on f3d90cea3 plus these changes; subsequent pre-review origin/dev fast-forward to 3187865aa changes tracker/config only, not tested source. No full tiers/stage cover claimed; mode-free same-reviewed-head verify will supply integrated evidence.

### rev-35 · 2026-11-01T16:20:58.566Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1583-source-1
commit: 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec no findings. Exact first browser result held after channel delivery; next-send readiness observes positively rendered enabled Send within existing3s bound, final assertion retained. Native500ms negative click releases held result, finally drains/joins readiness. All original keyboard/newline/focus/channel-content/count/draft/pane assertions and3s/5s bounds retained. C3 inventory compared to pinned tiers:49/49 Web files,no omissions, direct/helper waits listed;298static entries explicitly not execution coverage. A-15314 causal red/green inspected, setup failure/load-reproduction distinction correct; C2 awaits exact-head queued result. C1/C3 verified. No Reviewer execution; QA none.

Criteria: C1 verified, C3 verified.

### rev-35 · 2026-11-01T16:41:14.551Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1583-final-1
commit: 2de2ec0d18f3500d7766f9a2cc85e94caeba9be8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. Same-headA-15319/804471f4 exit0,4569pass,zero fail/cancel/skip/todo. All8 composer named outcomes pass, including physical Enter/newline/Meta-K held-result regression at24271. C2 causal macOS red/green A-15314 retained: original exact5000ms multiline miss, fixed8/8; setup failure excluded and no stage-load/latency claim. C1/C3 source marks carry forward;49-file static inventory is decision input,not executed coverage. T0/T1/all fallback T2/Web complete;T3/T4 unexecuted. Linux x64 droplet Node24.21.0,isolated Headless Shell1248/Chrome Testing156.0.8078.4; runner treefce2fe74,report-only advisories,no cache/skips. C1–C3 verified; QA none. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.
