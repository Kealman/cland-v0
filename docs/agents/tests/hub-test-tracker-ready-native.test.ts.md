# hub/test/tracker-ready-native.test.ts

The stop-recorded crash case keeps its native hub-death bound, durable stopped
row, claim/status and direct-hold recovery assertions. Observe the session.stop
result before waiting for the crash: an actual refusal returns a diagnostic
receipt that fails the crash assertion, rather than hiding its reason behind a
15-second timeout. A disconnected request after the intentional crash remains
expected. No timeout, cleanup, hold or merge-gate assertion is relaxed.
