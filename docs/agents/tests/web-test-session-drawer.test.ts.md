# web/test/session-drawer.test.ts

`web/test/session-drawer.test.ts` owns the selected session → thread/card/composer
seam through sealed `webFixture`, fake Codex harnesses and public hub frames.
Keep both directions of cross-topic history, exclusive numeric page boundaries,
the exact older rows and live messages after a held history reply, and the reading
anchor. The reusable `SessionRecentThread` feeds the shared `Thread`; the existing
Inbox same-session/new-approval held-read regression must still pass. Session
selection refresh failures retry the recent page even after older history is
complete; retain the actual retry request and its held successful reply. Approval
drawers in Inbox forward the same thread controls: physical j/k focus exact recent
message ids and Escape returns to the selected approval row. Approval
answers retain the fake native receipt and folded human outcome; drive the fake's
post-answer state explicitly before asserting Waiting departure. TUI-only cards
have no controls. Composer routing is proven by the fake adapter's injected
message and topic, both for an item's topic and General. Arm focus observers
before physical Enter or Open thread and observe the exact log/row; no elapsed
frame wait proves focus. Shared composer/key routing changes also run composer,
topics, thread-runs and shell alongside area-slots, key-contexts, palette, inbox
and the Sessions files. Build first. New passing Web identities reaching four
seconds on any platform require a dated, reasoned E-418 allowance near 1.5 times
the worst passing sample, without relaxing assertions or request/DOM bounds.
