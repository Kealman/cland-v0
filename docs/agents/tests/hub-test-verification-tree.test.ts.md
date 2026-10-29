# hub/test/verification-tree.test.ts

T-1422 uses sealed disposable native Git to distinguish tracker-only commits,
source edits, edit/revert history and rulebook changes. Endpoint equality does
not erase intervening edits. Missing or rewritten ancestry remains unknown.
No real platform, credentials, browser or hub process is used.
