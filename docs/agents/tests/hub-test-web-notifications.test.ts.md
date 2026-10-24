# hub/test/web-notifications.test.ts

`hub/test/web-notifications.test.ts` owns the T1 pure notification eligibility,
text and target seam, including all Inbox row kinds and pre-transition task layers.
Its VM-loaded production worker tests notificationclick/waitUntil through fake
client boundaries, retaining no-fetch, focus+message and encoded openWindow targets.
`web/test/notifications.test.ts` uses sealed `webFixture` and fake sender frames
with `Notification`, visibility and focus stubs: hidden ask text/tag/click,
including an active secondary pane and open palette with exact ask-id row focus
while browser animation time is paused (mount is observed separately from focus),
visible+focused/off/watch suppression, snapshot no-replay, finished task/card
(including a split and open palette), shared per-browser Profile switches in
Accounts (Finished off after reload and cross-tab updates), palette action absence,
first-enabling permission and denied/revoked tooltips. Observe the exact Inbox
row, item card or completed-item count before absence/duplicate assertions;
watch-layer rows retain their exact browser socket receipt. No actual browser
notification, service worker, live hub or human browser is used. Build first;
run area-slots, key-contexts, palette, accounts and inbox as targeted neighbors before the
mode-free task verification. New passing Web identities reaching four seconds on
any platform need the dated, reasoned E-417 allowance at roughly 1.5 times the
worst sample; batch independent serial setup first.
