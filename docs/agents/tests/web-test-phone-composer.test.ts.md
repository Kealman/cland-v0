# web/test/phone-composer.test.ts

`web/test/phone-composer.test.ts` uses the sealed phone `webFixture` at 390×844,
touch/mobile Headless Shell and public frames with a fake Coordinator and busy
session. Keep the two rows of 44 px controls docked above the bar, default
Coordinator and session-chip routing, 44 px addressee clearing with implicit
hub routing and reload persistence, physical Return/Shift/Command newlines
with zero sends until Send, exact multiline/kind history receipts, and matching
palette keys without phone send/attach actions. The checked kind sheet remains
inline, reduces history by its occupied height and leaves history reachable
without a modal or scrim. Withdrawal waits for the held successful receipt
before restoring text ahead of newer typing; a test-controlled idle transition
removes Withdraw at submission. Per-topic text and kinds survive navigation and
reload without sending. Build first; run phone*, composer, withdraw, topics and
key-contexts targeted before mode-free verification. New passing Web identities
reaching four seconds need dated, reasoned E-880 allowances before verification,
at roughly 1.5 times the worst observed passing sample and citing its run.
