# T-702 subscription, digest and archive migration

The five rule files now run at T2 with in-process spokes/adapters and a complete FakeClock. Replay and retention use the T1 checkpoint seam. Four named T3 files preserve the native boundaries: real PID death/recovery, committed Git review/QA provenance, task merge, and one Claude digest frame. No production source changes.

The base is `9bd3425c`. The scope includes every destination, including the entire pre-existing agents-checkpoint file. The accompanying [assertion inventory](T-702-assertion-inventory.md) maps 53 original test declarations and three assertion-bearing helpers (525 assertion sites). Its retained entries give exact destination statements; its rewritten entries use the seam notes below.

## Timings and verification

| File | Tests | Whole-file passes | Median test seconds | Median wall seconds | Max recorded load |
| --- | ---: | ---: | ---: | ---: | ---: |
| `hub/test/agents-checkpoint.test.ts` | 6 | 5/5 | 0.070 | 0.352 | 9.980 |
| `hub/test/agents-journal.test.ts` | 6 | 5/5 | 1.210 | 1.790 | 9.857 |
| `hub/test/default-subscriptions.test.ts` | 8 | 5/5 | 1.876 | 2.798 | 11.338 |
| `hub/test/subscriptions.test.ts` | 13 | 5/5 | 4.690 | 5.680 | 14.985 |
| `hub/test/subscription-hygiene.test.ts` | 13 | 5/5 | 2.959 | 3.838 | 9.188 |
| `hub/test/session-archive.test.ts` | 8 | 5/5 | 1.978 | 2.828 | 8.626 |
| `hub/test/default-subscriptions-lifecycle.test.ts` | 4 | 5/5 | 17.527 | 18.175 | 13.112 |
| `hub/test/default-subscriptions-workflow.test.ts` | 2 | 5/5 | 4.830 | 5.339 | 13.349 |
| `hub/test/session-archive-merge.test.ts` | 1 | 5/5 | 4.330 | 5.114 | 11.685 |
| `hub/test/subscription-frame.test.ts` | 1 | 5/5 | 2.111 | 2.822 | 10.497 |
| **All destinations** | **62** | **50/50** | **41.581** | **48.736** | **14.985** |

Compared with the task reference of 245.8 test-seconds, the conservative all-destination total is 41.581 s (83.1% lower), below the 130 s limit. Original-five-only median total: 12.713 s. Initial receipts sample load at file boundaries; final replacement batches sample every 250 ms throughout execution.

C1 uses the sum of scoped Mac five-run medians, including all splits and native tests. The Coordinator confirmed this interpretation in topic-465, decision efacfb05-a1ab-420e-a252-fc35bb10f7d3. Timing baselines remain unchanged for the integrated stage-close refresh; this preserves task-head new-identity load gates. Only moved native identities observed above five seconds receive seven-day allowances, owned by E-677.

The Mac receipts run whole files serially. The final hygiene and archive repetitions include the CLI digest parsing frame and requested workaround comment. The final native repetitions replace the earlier load-over-15 receipt. The raw evidence retains that excluded pass and one failed admission attempt: the real project hub did not answer the read-only cover-quiet request within three seconds, before any fixture/test executed. A successful verify-queue response preceded retry; no admission bypass was used.

T0: `npm run typecheck`, `npm run test:tiers`, and `npm run test:lint` pass. The direct test lint has zero findings in all ten touched test files: checkpoint qualifies T1, the five migrated files qualify T2, and the four native splits qualify T3. Reachable-resource diagnostics remain conservative diagnostic-only paths through the generic harness and production code; each T2 fixture injects fake infrastructure probes and adapters. Droplet verification follows the source verdict at the exact reviewed commit.

## Resource census

| Resource | Task reference | Current, all destination files |
| --- | ---: | ---: |
| Fake-binary helper call sites | 22 | 4 |
| startDaemon sites | 37 | 4 |
| Numeric sleeps | 8 | 0 |
| Spawned-spoke calls | 68 at task base | 9 |

The current four daemon calls belong only to the real-PID hub-down recovery cases. Literal startDaemon calls at the current task base count 26 (the task reference predates earlier migrations); both measures finish below the required six. All original five files now have zero daemon starts, binary helper calls, spawned spokes and sleeps. The four retained fake-Claude calls are three native lifecycle fixtures and the single Claude frame proof. The archive merge uses the in-process fake adapter even though Git itself is real.

## Rewritten assertion seams

- Every successful daemon-stop assertion in migrated persistence tests becomes an awaited `stopComponentHub(root)` or `served.stop()` barrier, followed by serving the same root and the original durable-state assertions. Native hub-down tests retain their CLI stop assertions. `agents-journal`'s restart helper uses that same stop/serve barrier.
- Digest ordering, mixed progress/event order, injected settlement, journal metadata-only records, one digest per release, and held state after restart remain in the flavour table in `subscriptions`. The log oracle is `envelope(injection.message, injection.topic)`, which includes the real digest field, rather than a fake binary's input file. CLI subscription creation/list/removal parity remains in the durable-subscription case; one native Claude frame proves actual ordered input consumption in `subscription-frame`.
- Digest-now's `subscribed.code`/JSON assertions become one CLI `--digest now` parse/response check for Claude plus the common `subscribed.subscription.digest` assertion. Other flavours call production MCP handlers. The held-topic CLI result becomes `held.ok`; the resulting 12 artifact facts plus the immediate task event still prove the cap admits ten and settles all thirteen, with three summarized. The table filters prior fact ids because it reuses its fixture across flavours. Removing `rows[0]`'s nullable type uncertainty changes no ownership assertion.
- The Claude no-steer negative inspects the fake adapter's injection receipts after advancing 350 ms of fake time while busy; only the explicit next-turn trigger releases it. Codex/OpenCode must inject while still busy, settle the delivery and cap the mixed batch. Their old `/turn\/steer/` and `/steer/` log assertions are adapter transport claims: the retained `codex-adapter.test.ts` native turn/steer assertion (around line 267) and `opencode-adapter.test.ts` test “a message sent while the session works steers the running turn; one sent while idle is queued” prove those native transports. The hub-owned subscription behaviour stays in the T2 flavour table.
- Usage snapshots come from `feedUsage`, then 1000 ms of fake debounce time and a positive session.usage receipt. Totals are cumulative: 400000 unknown-cost tokens, 1000000 tokens/$3, then totals above those crossings. Invalid thresholds, overlapping subjects, one event per crossing and durable crossed flags are unchanged. Native `mod-turn-complete` parsing remains in `claude-code-adapter.test.ts`'s binary contract usage assertions (around lines 154–168).
- Committed-stop recovery still records one turn group and one immediate group across two starts, cleans owned subscriptions and keeps role/subtree subjects. Native consumed-input counting becomes one fake-adapter injection on the first recovery, zero on the next, while durable history retains exactly two events. This is stronger than counting one entry in a cumulative log twice.
- Default pooled-verifier approval routing, ordinary-state suppression, busy cancelling idle notification, delayed Reviewer/lead idle destinations, and warning/inbox behaviour are retained in `default-subscriptions`' FakeClock test. Real stop/death frame destinations, queued stages, injected stop receipt, warning flag and zero human needs remain in the T3 lifecycle test. The old sleeps become fake-clock advances or positive acknowledgement/flush barriers. The real SIGKILL cases retain their process behaviour; hub-down kills observe process cleanup before restart.
- Archive windows advance fake time. Consecutive verifier holds advance 1 ms so “latest” retains the distinct-time semantics of the original real-time test. The source comment names the separately filed equal-heldAt archive-affinity bug. The post-close comment occurs 1000 ms after close; archive at the original close deadline proves it does not reset the window. Reopening cancellation, startup/legacy dating, Aide exclusions, stop-age prune rules, archive permissions, idempotent journal entries, durable marks, failed native resume and fresh-resume clearing all retain their assertions. The real-merge trigger stays in `session-archive-merge` with fake archive time.
- Replay setup no longer launches a daemon and CLI merely to obtain a claim journal line. `agentsRecord().tap` generates the actual journal notice id, matched to the projected claim. A new HubCore over the same Store replays a later missing notice exactly once, preserves order and keeps the original texts. Native task creation/claim CLI parity is still exercised by `agents-journal`'s lifecycle case. Retention uses actual Store.prune on role/claim notices, checks an empty record, then verifies replay returns zero, the record stays empty and no agents-record-replayed log is emitted. Closing the first core replaces the former successful daemon-stop setup assertion.

## Audit boundaries

The native workflow and merge files remain T3 because real Git worktree/commit provenance is the subject. They add no fake harness binaries. Their routing and archive-window permutations live at T2. The original API envelopes, delivery stages, frozen recipient counts/caps, subtree final facts, default ownership and warning destinations are retained; only the resource that supplies or observes them changes.
