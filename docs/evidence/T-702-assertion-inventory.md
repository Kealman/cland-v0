# T-702 assertion audit

Base: `9bd3425cf503b7cc80cc29a94dea45e8d1251f60`. Scope: all five source files and every split destination. Transport assertions about successful daemon CLI shutdown become the awaited projectHub stop barrier; the native hub-down SIGKILL cases keep their daemon CLI assertions. No production source changes.

## Declaration map

| Original declaration | Destination | Assertions before → destination |
| --- | --- | --- |
| hub/test/subscription-hygiene.test.ts:21 — 'launched, died and launched within sixty seconds preserve every transition' | hub/test/subscription-hygiene.test.ts:18 — 'launched, died and launched within sixty seconds preserve every transition' | 4 → 4 |
| hub/test/subscription-hygiene.test.ts:76 — 'coalescing and the event cap freeze per recipient across restart and partial delivery' | hub/test/subscription-hygiene.test.ts:51 — 'coalescing and the event cap freeze per recipient across restart and partial delivery' | 13 → 12 |
| hub/test/subscription-hygiene.test.ts:123 — 'topic and artifact events match item subtrees, and a closed topic sends its final event' | hub/test/subscription-hygiene.test.ts:98 — 'topic and artifact events match item subtrees, and a closed topic sends its final event' | 12 → 12 |
| hub/test/subscription-hygiene.test.ts:157 — 'events have their own durable limit, preserve final events, and consume no message allowance' | hub/test/subscription-hygiene.test.ts:132 — 'events have their own durable limit, preserve final events, and consume no message allowance' | 10 → 9 |
| hub/test/subscription-hygiene.test.ts:189 — `${harness}: digest now steers through the existing queue or waits for the next turn` | hub/test/subscription-hygiene.test.ts:163 — 'digest now uses steering capabilities or waits for the next turn across flavours' | 18 → 16 |
| hub/test/subscription-hygiene.test.ts:259 — 'usage thresholds name cost or tokens, deduplicate overlapping subjects and survive restart' | hub/test/subscription-hygiene.test.ts:232 — 'usage thresholds name cost or tokens, deduplicate overlapping subjects and survive restart' | 14 → 12 |
| hub/test/subscription-hygiene.test.ts:318 — 'the default coalescing window includes 59999 ms and excludes 60000 ms' | hub/test/subscription-hygiene.test.ts:292 — 'the default coalescing window includes 59999 ms and excludes 60000 ms' | 4 → 4 |
| hub/test/subscription-hygiene.test.ts:346 — 'equal events outside the configured coalescing window remain separate' | hub/test/subscription-hygiene.test.ts:320 — 'equal events outside the configured coalescing window remain separate' | 2 → 2 |
| hub/test/subscription-hygiene.test.ts:360 — 'the cap retains final subject events and leaves mixed progress uncapped' | hub/test/subscription-hygiene.test.ts:334 — 'the cap retains final subject events and leaves mixed progress uncapped' | 7 → 7 |
| hub/test/subscription-hygiene.test.ts:378 — 'subtree subjects include sessions working on descendant items and survive their death' | hub/test/subscription-hygiene.test.ts:352 — 'subtree subjects include sessions working on descendant items and survive their death' | 6 → 6 |
| hub/test/subscription-hygiene.test.ts:410 — 'deleting a subscribed topic records its final fact and ends only that exact subject' | hub/test/subscription-hygiene.test.ts:383 — 'deleting a subscribed topic records its final fact and ends only that exact subject' | 4 → 4 |
| hub/test/subscription-hygiene.test.ts:427 — 'removed and reparented descendants notify former ancestor subtrees without ending them' | hub/test/subscription-hygiene.test.ts:400 — 'removed and reparented descendants notify former ancestor subtrees without ending them' | 6 → 6 |
| hub/test/subscription-hygiene.test.ts:449 — 'restart reconciles a committed stop once and retains role and ancestor subtree subscriptions' | hub/test/subscription-hygiene.test.ts:422 — 'restart reconciles a committed stop once and retains role and ancestor subtree subscriptions' | 13 → 11 |
| hub/test/default-subscriptions.test.ts:10 — 'default item subscriptions follow claims and explicit subscriptions widen them' | hub/test/default-subscriptions.test.ts:9 — 'default item subscriptions follow claims and explicit subscriptions widen them' | 14 → 13 |
| hub/test/default-subscriptions.test.ts:50 — 'an Aide lead owns its subtree defaults without receiving crew broadcasts' | hub/test/default-subscriptions.test.ts:49 — 'an Aide lead owns its subtree defaults without receiving crew broadcasts' | 6 → 6 |
| hub/test/default-subscriptions.test.ts:82 — 'a coalesced explicit event keeps later default lead provenance after an Aide transition' | hub/test/default-subscriptions.test.ts:81 — 'a coalesced explicit event keeps later default lead provenance after an Aide transition' | 8 → 8 |
| hub/test/default-subscriptions.test.ts:112 — 'a stopped pooled Reviewer reaches its item lead; a killed lead reaches the Coordinator with warning events' | hub/test/default-subscriptions.test.ts:217 — 'default warning routing follows holds and cancels idle notifications on busy' | 19 → 19 |
| hub/test/default-subscriptions.test.ts:184 — 'a claim before hello already belongs to its lead and adopts that lead identity once' | hub/test/default-subscriptions.test.ts:111 — 'a claim before hello already belongs to its lead and adopts that lead identity once' | 8 → 8 |
| hub/test/default-subscriptions.test.ts:210 — 'a lead death while the hub is down reaches the offline Coordinator once after restart' | hub/test/default-subscriptions-lifecycle.test.ts:59 — 'a lead death while the hub is down reaches the offline Coordinator once after restart' | 6 → 6 |
| hub/test/default-subscriptions.test.ts:244 — 'removing a claimed item sends its final default event to the previous lead' | hub/test/default-subscriptions.test.ts:137 — 'removing a claimed item sends its final default event to the previous lead' | 3 → 3 |
| hub/test/default-subscriptions.test.ts:266 — `terminal recovery routes an older pooled Reviewer death past its ${pendingReceipt ? 'verified-stopped lead with pending cleanup' : 'already-dead lead'}` | hub/test/default-subscriptions-lifecycle.test.ts:94 — `terminal recovery routes an older pooled Reviewer death past its ${pendingReceipt ? 'verified-stopped lead with pending cleanup' : 'already-dead lead'}` | 7 → 7 |
| hub/test/default-subscriptions.test.ts:322 — 'unclaimed descendants inherit their nearest claimed ancestor lead' | hub/test/default-subscriptions.test.ts:159 — 'unclaimed descendants inherit their nearest claimed ancestor lead' | 9 → 9 |
| hub/test/default-subscriptions.test.ts:360 — 'anonymous hellos cannot give another name the claimant default identity' | hub/test/default-subscriptions.test.ts:197 — 'anonymous hellos cannot give another name the claimant default identity' | 3 → 3 |
| hub/test/default-subscriptions.test.ts:380 — `the item lead runs not-clear, re-review and QA; only ready starts the Coordinator (${restart ? 'after restart' : 'connected'})` | hub/test/default-subscriptions-workflow.test.ts:11 — `the item lead runs not-clear, re-review and QA; only ready starts the Coordinator (${restart ? 'after restart' : 'connected'})` | 15 → 14 |
| hub/test/subscriptions.test.ts:12 — 'caller-owned subscriptions hold task status events in the ordinary next-turn digest' | hub/test/subscriptions.test.ts:15 — 'caller-owned subscriptions hold task status events in the ordinary next-turn digest' | 18 → 18 |
| hub/test/subscriptions.test.ts:62 — 'CLI and MCP share durable subscriptions; unsubscribing leaves the queued event for its next turn' | hub/test/subscriptions.test.ts:65 — 'CLI and MCP share durable subscriptions; unsubscribing leaves the queued event for its next turn' | 10 → 9 |
| hub/test/subscriptions.test.ts:106 — 'an unchanged cached item emits its first committed status change after restart' | hub/test/subscriptions.test.ts:109 — 'an unchanged cached item emits its first committed status change after restart' | 4 → 3 |
| hub/test/subscriptions.test.ts:133 — 'adopting a provisional claim at hello does not announce another claim' | hub/test/subscriptions.test.ts:136 — 'adopting a provisional claim at hello does not announce another claim' | 4 → 4 |
| hub/test/subscriptions.test.ts:158 — 'resume --relaunch announces each transition into running once for the same session id' | hub/test/subscriptions.test.ts:161 — 'resume --relaunch announces each transition into running once for the same session id' | 7 → 7 |
| hub/test/subscriptions.test.ts:192 — 'session state and lifecycle events include death, held until the Coordinator next turns' | hub/test/subscriptions.test.ts:192 — 'session state and lifecycle events include death, held until the Coordinator next turns' | 11 → 11 |
| hub/test/subscriptions.test.ts:235 — 'task events report claims, verdicts and closes once; ordinary comments do not become events' | hub/test/subscriptions.test.ts:235 — 'task events report claims, verdicts and closes once; ordinary comments do not become events' | 7 → 7 |
| hub/test/subscriptions.test.ts:272 — `${harness}: events and progress use one ordered next-turn digest, before and after restart` | hub/test/subscriptions.test.ts:271 — 'events and progress keep one ordered digest across flavour restarts' | 15 → 13 |
| hub/test/subscriptions.test.ts:353 — 'fan-out preserves independent recipient digests when one subscriber disconnects' | hub/test/subscriptions.test.ts:351 — 'fan-out preserves independent recipient digests when one subscriber disconnects' | 6 → 6 |
| hub/test/subscriptions.test.ts:388 — 'subscribe and unsubscribe racing an awaited task write take effect before its event is recorded' | hub/test/subscriptions.test.ts:386 — 'subscribe and unsubscribe racing an awaited task write take effect before its event is recorded' | 3 → 3 |
| hub/test/subscriptions.test.ts:415 — 'renames preserve subscription ownership and each converging subject id' | hub/test/subscriptions.test.ts:413 — 'renames preserve subscription ownership and each converging subject id' | 4 → 4 |
| hub/test/subscriptions.test.ts:431 — 'invalid subjects and events are refused at the frame and MCP boundaries; CLI identities stay hub-held' | hub/test/subscriptions.test.ts:429 — 'invalid subjects and events are refused at the frame and MCP boundaries; CLI identities stay hub-held' | 6 → 6 |
| hub/test/subscriptions.test.ts:453 — 'a terminal session role update preserves a subscription created for its next launch' | hub/test/subscriptions.test.ts:451 — 'a terminal session role update preserves a subscription created for its next launch' | 6 → 6 |
| hub/test/session-archive.test.ts:15 — 'a real task merge starts the stopped Implementer item window' | hub/test/session-archive-merge.test.ts:16 — 'a real task merge starts the stopped Implementer item window' | 7 → 7 |
| hub/test/session-archive.test.ts:43 — 'item windows follow launch items and the latest verifier work even after holds release; reopening cancels the item clock' | hub/test/session-archive.test.ts:16 — 'item windows follow launch items and the latest verifier work even after holds release; reopening cancels the item clock' | 14 → 14 |
| hub/test/session-archive.test.ts:86 — 'configured stop window archives crew at startup and on the timer, never Aides' | hub/test/session-archive.test.ts:68 — 'configured stop window archives crew at startup and on the timer, never Aides' | 7 → 7 |
| hub/test/session-archive.test.ts:120 — 'prune CLI and Coordinator tool delete only old archived records and retain the journal' | hub/test/session-archive.test.ts:100 — 'prune CLI and Coordinator tool delete only old archived records and retain the journal' | 23 → 23 |
| hub/test/session-archive.test.ts:179 — 'prune compares stop age even for recently archived rows, keeps young and unarchived rows, and rejects invalid durations' | hub/test/session-archive.test.ts:154 — 'prune compares stop age even for recently archived rows, keeps young and unarchived rows, and rejects invalid durations' | 7 → 7 |
| hub/test/session-archive.test.ts:203 — 'archive refuses live and unlaunched rows, hides stopped rows, retains their journal, and resume restores them' | hub/test/session-archive.test.ts:179 — 'archive refuses live and unlaunched rows, hides stopped rows, retains their journal, and resume restores them' | 40 → 41 |
| hub/test/session-archive.test.ts:278 — 'migration retains old stopped rows without reading the journal, and name reuse clears archive metadata' | hub/test/session-archive.test.ts:253 — 'migration retains old stopped rows without reading the journal, and name reuse clears archive metadata' | 5 → 5 |
| hub/test/session-archive.test.ts:297 — `fresh resume clears a durable ${by} archive after a refused native resume` | hub/test/session-archive.test.ts:272 — `fresh resume clears a durable ${by} archive after a refused native resume` | 12 → 12 |
| hub/test/agents-journal.test.ts:65 — 'agent-to-agent messages are recorded in Agents with sender, role and time, General shows nothing of them, and a reply in Agents addresses the sender' | hub/test/agents-journal.test.ts:64 — 'agent-to-agent messages are recorded in Agents with sender, role and time, General shows nothing of them, and a reply in Agents addresses the sender' | 22 → 22 |
| hub/test/agents-journal.test.ts:122 — 'lifecycle events land in Agents as notices with kinds — role assignment and revocation, a claim and its release, a session start and stop — and no tool-level noise does' | hub/test/agents-journal.test.ts:121 — 'lifecycle events land in Agents as notices with kinds — role assignment and revocation, a claim and its release, a session start and stop — and no tool-level noise does' | 15 → 15 |
| hub/test/agents-journal.test.ts:181 — 'a looping pair trips the breaker at the configured threshold: both get the typed refusal, Agents shows the mute, it survives a restart until `cland hub unmute`; a changed threshold applies at the next start; the journal only grows' | hub/test/agents-journal.test.ts:179 — 'a looping pair trips the breaker at the configured threshold: both get the typed refusal, Agents shows the mute, it survives a restart until `cland hub unmute`; a changed threshold applies at the next start; the journal only grows' | 32 → 32 |
| hub/test/agents-journal.test.ts:267 — 'hygiene refusals are typed: the size cap and the rate limit refuse the send itself, with code, rule and reason' | hub/test/agents-journal.test.ts:265 — 'hygiene refusals are typed: the size cap and the rate limit refuse the send itself, with code, rule and reason' | 6 → 6 |
| hub/test/agents-journal.test.ts:287 — 'an agent-to-agent message in another topic is referenced in Agents (sender, addressees, topic, message id), its text not repeated' | hub/test/agents-journal.test.ts:286 — 'an agent-to-agent message in another topic is referenced in Agents (sender, addressees, topic, message id), its text not repeated' | 7 → 7 |
| hub/test/agents-journal.test.ts:313 — 'a lifecycle event journalled but not yet recorded in Agents when the hub died is recorded at the next start, once' | hub/test/agents-checkpoint.test.ts:68 — 'a journalled claim lost before projection recovers in order exactly once' | 6 → 4 |
| hub/test/agents-journal.test.ts:340 — 'lifecycle notices retention removed are not brought back by the journal: no replay after every notice was pruned' | hub/test/agents-checkpoint.test.ts:90 — 'retention pruning every lifecycle notice preserves the no-replay checkpoint' | 5 → 5 |
| hub/test/agents-journal.test.ts:363 — 'a journal whose last line was cut off mid-write gets a newline before the next record: every later record parses' | hub/test/agents-journal.test.ts:312 — 'a journal whose last line was cut off mid-write gets a newline before the next record: every later record parses' | 2 → 2 |
| hub/test/agents-journal.test.ts:19 — helper ok | hub/test/agents-journal.test.ts:19 — helper ok | 1 → 1 |
| hub/test/agents-journal.test.ts:41 — helper journalLines | hub/test/agents-journal.test.ts:41 — helper journalLines | 1 → 1 |
| hub/test/agents-journal.test.ts:56 — helper restart | hub/test/agents-journal.test.ts:56 — helper restart | 1 → 0 |

## Assertion inventory

Each original assertion, including helper assertions, is listed below. Exact matches name the retained statement. Rewritten assertions name their destination declaration and are explained in the seam notes. Repeated assertions inside flavour/restart tables are one declaration, exercised for every row.

### hub/test/subscription-hygiene.test.ts:21 'launched, died and launched within sixty seconds preserve every transition'

Destination: hub/test/subscription-hygiene.test.ts:18.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscription-hygiene.test.ts:22 (retained)
2. `assert.equal(relaunched.ok, true, relaunched.error)` → hub/test/subscription-hygiene.test.ts:29 (retained)
3. `assert.deepEqual(digest.params.content.match(/event · session.state · impl (launched|died)/g), [ 'event · session.state · impl launched', 'event · session.state · impl died', 'event · session.state · impl launched', ])` → hub/test/subscription-hygiene.test.ts:32 (retained)
4. `assert.doesNotMatch(digest.params.content, /×/)` → hub/test/subscription-hygiene.test.ts:35 (retained)

### hub/test/subscription-hygiene.test.ts:76 'coalescing and the event cap freeze per recipient across restart and partial delivery'

Destination: hub/test/subscription-hygiene.test.ts:51.

1. `assert.equal((await coord.call<{ ok: boolean }>('task.claim', { id: item })).ok, true)` → hub/test/subscription-hygiene.test.ts:58 (retained)
2. `assert.match(first.params.content, /claimed by coord \(×3\)/)` → hub/test/subscription-hygiene.test.ts:64 (retained)
3. `assert.equal((await coord.call<{ ok: boolean }>('artifact.create', { kind: 'prompt', title: \`overflow-${i}\`, topic, content: 'material', status: 'draft' })).ok, true)` → hub/test/subscription-hygiene.test.ts:69 (retained)
4. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/subscription-hygiene.test.ts:51 (rewritten; seam notes)
5. `assert.match(second.params.content, /claimed by coord \(×4\)/)` → hub/test/subscription-hygiene.test.ts:82 (retained)
6. `assert.match(second.params.content, /and 3 more/)` → hub/test/subscription-hygiene.test.ts:83 (retained)
7. `assert.equal(second.params.content.match(/event · (task|artifact) ·/g)?.length, 10)` → hub/test/subscription-hygiene.test.ts:84 (retained)
8. `assert.equal(second.params.content.match(/overflow-\d+/g)?.length, 9)` → hub/test/subscription-hygiene.test.ts:85 (retained)
9. `assert.equal(first.params.content.match(/claimed by coord \(×3\)/g)?.length, 1)` → hub/test/subscription-hygiene.test.ts:86 (retained)
10. `assert.match(third.params.content, /claimed by coord \(×2\)/)` → hub/test/subscription-hygiene.test.ts:90 (retained)
11. `assert.match(third.params.content, /and 3 more/)` → hub/test/subscription-hygiene.test.ts:91 (retained)
12. `assert.match(fourth.params.content, /claimed by coord/)` → hub/test/subscription-hygiene.test.ts:94 (retained)
13. `assert.doesNotMatch(fourth.params.content, /overflow|×/)` → hub/test/subscription-hygiene.test.ts:95 (retained)

### hub/test/subscription-hygiene.test.ts:123 'topic and artifact events match item subtrees, and a closed topic sends its final event'

Destination: hub/test/subscription-hygiene.test.ts:98.

1. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [], 'even artifact-only topic subscriptions end with a final topic event')` → hub/test/subscription-hygiene.test.ts:111 (retained)
2. `assert.equal(listing.code, 0, listing.stderr)` → hub/test/subscription-hygiene.test.ts:113 (retained)
3. `assert.equal(rows.length, 1)` → hub/test/subscription-hygiene.test.ts:115 (retained)
4. `assert.equal(rows[0].subscriber, 'rev')` → hub/test/subscription-hygiene.test.ts:116 (retained)
5. `assert.equal(denied.code, 1)` → hub/test/subscription-hygiene.test.ts:118 (retained)
6. `assert.match(denied.stderr, /forbidden/)` → hub/test/subscription-hygiene.test.ts:119 (retained)
7. `assert.match(delivered.params.content, /created · Shared evidence/)` → hub/test/subscription-hygiene.test.ts:122 (retained)
8. `assert.match(delivered.params.content, /shared · Shared evidence/)` → hub/test/subscription-hygiene.test.ts:123 (retained)
9. `assert.match(delivered.params.content, /waiting for human/)` → hub/test/subscription-hygiene.test.ts:124 (retained)
10. `assert.match(delivered.params.content, /event · topic · .* closed/)` → hub/test/subscription-hygiene.test.ts:125 (retained)
11. `assert.doesNotMatch(delivered.params.content, /Outside evidence/)` → hub/test/subscription-hygiene.test.ts:126 (retained)
12. `assert.match(final.params.content, /event · topic · .* closed/)` → hub/test/subscription-hygiene.test.ts:129 (retained)

### hub/test/subscription-hygiene.test.ts:157 'events have their own durable limit, preserve final events, and consume no message allowance'

Destination: hub/test/subscription-hygiene.test.ts:132.

1. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/subscription-hygiene.test.ts:132 (rewritten; seam notes)
2. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [])` → hub/test/subscription-hygiene.test.ts:147 (retained)
3. `assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev'], text })).ok, true)` → hub/test/subscription-hygiene.test.ts:148 (retained)
4. `assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev'], text: 'too many' })).ok, false)` → hub/test/subscription-hygiene.test.ts:149 (retained)
5. `assert.equal(delivered.params.content.match(/event · task ·/g)?.length, 3)` → hub/test/subscription-hygiene.test.ts:152 (retained)
6. `assert.match(delivered.params.content, /closed/)` → hub/test/subscription-hygiene.test.ts:153 (retained)
7. `assert.doesNotMatch(delivered.params.content, /review → planned|review → done/)` → hub/test/subscription-hygiene.test.ts:154 (retained)
8. `assert.equal(journal.filter(e => e.event === 'event-limited').length, 3)` → hub/test/subscription-hygiene.test.ts:157 (retained)
9. `assert.ok(journal.filter(e => e.event === 'event-delivery').every(e => e.count === 1 && e.text === undefined))` → hub/test/subscription-hygiene.test.ts:158 (retained)
10. `assert.doesNotMatch(JSON.stringify(inbox.value), /event ·|subscription/)` → hub/test/subscription-hygiene.test.ts:160 (retained)

### hub/test/subscription-hygiene.test.ts:189 `${harness}: digest now steers through the existing queue or waits for the next turn`

Destination: hub/test/subscription-hygiene.test.ts:163.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscription-hygiene.test.ts:171 (retained)
2. `assert.equal(subscribed.code, 0, subscribed.stderr)` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
3. `assert.equal(JSON.parse(subscribed.stdout).subscription.digest, 'now')` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
4. `assert.equal(held.code, 0, held.stderr)` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
5. `assert.equal((await ui.request({ type: 'artifact.create', kind: 'prompt', title: \`held-${i}\`, topic, content: 'material', status: 'draft' })).ok, true)` → hub/test/subscription-hygiene.test.ts:192 (retained)
6. `assert.equal((await ui.request({ type: 'task.edit', item, status: 'planned' })).ok, true)` → hub/test/subscription-hygiene.test.ts:194 (retained)
7. `assert.equal((await inputLog()).includes(\`event · task · ${item}\`), false)` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
8. `assert.match(log, new RegExp(\`event · task · ${item}\`))` → hub/test/subscription-hygiene.test.ts:205 (retained)
9. `assert.match(log, /turn\/steer .*event · task/s)` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
10. `assert.match(log, /steer/)` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
11. `assert.equal(log.match(/event · (artifact|task) ·/g)?.length, 10, 'the immediate event itself occupies one of the ten event slots')` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
12. `assert.match(log, /and 3 more/)` → hub/test/subscription-hygiene.test.ts:208 (retained)
13. `assert.equal(events.length, 13)` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
14. `assert.ok(events.every(m => m.stage === 'injected'), 'summarized members settle with the admitted immediate batch')` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
15. `assert.equal((await ui.request({ type: 'session.stop', session: 'coord' })).ok, true)` → hub/test/subscription-hygiene.test.ts:219 (retained)
16. `assert.equal(rows.length, 1)` → hub/test/subscription-hygiene.test.ts:221 (retained)
17. `assert.deepEqual(rows[0].subject, { role: 'coordinator' })` → hub/test/subscription-hygiene.test.ts:163 (rewritten; seam notes)
18. `assert.equal(final.params.content.match(/event · session.state · coord stopped/g)?.length, 1)` → hub/test/subscription-hygiene.test.ts:225 (retained)

### hub/test/subscription-hygiene.test.ts:259 'usage thresholds name cost or tokens, deduplicate overlapping subjects and survive restart'

Destination: hub/test/subscription-hygiene.test.ts:232.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscription-hygiene.test.ts:242 (retained)
2. `assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'worker' }, events: ['usage'], threshold })).ok, false)` → hub/test/subscription-hygiene.test.ts:250 (retained)
3. `assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'coord' }, subject: { session: 'worker' }, events: ['usage'], threshold })).ok, false)` → hub/test/subscription-hygiene.test.ts:251 (retained)
4. `assert.equal(result.ok, true)` → hub/test/subscription-hygiene.test.ts:255 (retained)
5. `assert.equal(token.code, 0, token.stderr)` → hub/test/subscription-hygiene.test.ts:258 (retained)
6. `assert.equal((await ui.request({ type: 'session.signal', session: 'worker', launch: p.sessionId, event: 'mod-turn-complete', payload: { usage }, at: Date.now() })).ok, true)` → hub/test/subscription-hygiene.test.ts:232 (rewritten; seam notes)
7. `assert.equal((await usageEvents()).length, 0, 'unknown cost cannot cross a cost threshold')` → hub/test/subscription-hygiene.test.ts:270 (retained)
8. `assert.equal((await usageEvents()).length, 2, 'one crossing per token/cost threshold despite overlapping subjects')` → hub/test/subscription-hygiene.test.ts:272 (retained)
9. `assert.equal((await usageEvents()).length, 2, 'updates above the threshold do not repeat the event')` → hub/test/subscription-hygiene.test.ts:274 (retained)
10. `assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0)` → hub/test/subscription-hygiene.test.ts:232 (rewritten; seam notes)
11. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), subscriptions)` → hub/test/subscription-hygiene.test.ts:282 (retained)
12. `assert.equal((await usageEvents()).length, 2, 'restart remembers the already crossed thresholds')` → hub/test/subscription-hygiene.test.ts:284 (retained)
13. `assert.equal(delivered.params.content.match(/event · usage ·/g)?.length, 2)` → hub/test/subscription-hygiene.test.ts:287 (retained)
14. `assert.doesNotMatch(delivered.params.content, /×2/)` → hub/test/subscription-hygiene.test.ts:288 (retained)

### hub/test/subscription-hygiene.test.ts:318 'the default coalescing window includes 59999 ms and excludes 60000 ms'

Destination: hub/test/subscription-hygiene.test.ts:292.

1. `assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true)` → hub/test/subscription-hygiene.test.ts:300 (retained)
2. `assert.equal(delivered.params.content.match(/claimed by coord/g)?.length, 2)` → hub/test/subscription-hygiene.test.ts:315 (retained)
3. `assert.equal(delivered.params.content.match(/claimed by coord \(×2\)/g)?.length, 1)` → hub/test/subscription-hygiene.test.ts:316 (retained)
4. `assert.match(delivered.params.content, /claimed by coord \(×2\)[\s\S]*claimed by coord/)` → hub/test/subscription-hygiene.test.ts:317 (retained)

### hub/test/subscription-hygiene.test.ts:346 'equal events outside the configured coalescing window remain separate'

Destination: hub/test/subscription-hygiene.test.ts:320.

1. `assert.equal(delivered.params.content.match(/claimed by coord/g)?.length, 2)` → hub/test/subscription-hygiene.test.ts:330 (retained)
2. `assert.doesNotMatch(delivered.params.content, /×/)` → hub/test/subscription-hygiene.test.ts:331 (retained)

### hub/test/subscription-hygiene.test.ts:360 'the cap retains final subject events and leaves mixed progress uncapped'

Destination: hub/test/subscription-hygiene.test.ts:334.

1. `assert.equal((await coord.call<{ ok: boolean }>('artifact.create', { kind: 'prompt', title: \`bounded-${i}\`, topic, content: 'material', status: 'draft' })).ok, true)` → hub/test/subscription-hygiene.test.ts:339 (retained)
2. `assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev'], text: \`progress-${i}\`, kind: 'progress' })).ok, true)` → hub/test/subscription-hygiene.test.ts:340 (retained)
3. `assert.deepEqual((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [])` → hub/test/subscription-hygiene.test.ts:343 (retained)
4. `assert.equal(delivered.params.content.match(/event · (artifact|topic) ·/g)?.length, 10)` → hub/test/subscription-hygiene.test.ts:346 (retained)
5. `assert.match(delivered.params.content, /event · topic · .* closed/)` → hub/test/subscription-hygiene.test.ts:347 (retained)
6. `assert.match(delivered.params.content, /and 3 more/)` → hub/test/subscription-hygiene.test.ts:348 (retained)
7. `assert.ok(delivered.params.content.includes(\`progress-${i}\n\`))` → hub/test/subscription-hygiene.test.ts:349 (retained)

### hub/test/subscription-hygiene.test.ts:378 'subtree subjects include sessions working on descendant items and survive their death'

Destination: hub/test/subscription-hygiene.test.ts:352.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscription-hygiene.test.ts:366 (retained)
2. `assert.equal((await ui.request({ type: 'session.stop', session: 'worker' })).ok, true)` → hub/test/subscription-hygiene.test.ts:373 (retained)
3. `assert.equal((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length, 1)` → hub/test/subscription-hygiene.test.ts:374 (retained)
4. `assert.match(delivered.params.content, new RegExp(\`worker launched · ${child}\`))` → hub/test/subscription-hygiene.test.ts:377 (retained)
5. `assert.match(delivered.params.content, /worker waiting for approval/)` → hub/test/subscription-hygiene.test.ts:378 (retained)
6. `assert.match(delivered.params.content, new RegExp(\`worker stopped · ${child}\`))` → hub/test/subscription-hygiene.test.ts:379 (retained)

### hub/test/subscription-hygiene.test.ts:410 'deleting a subscribed topic records its final fact and ends only that exact subject'

Destination: hub/test/subscription-hygiene.test.ts:383.

1. `assert.equal((await ui.request({ type: 'topic.delete', topic })).ok, true)` → hub/test/subscription-hygiene.test.ts:390 (retained)
2. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [])` → hub/test/subscription-hygiene.test.ts:391 (retained)
3. `assert.equal((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length, 1)` → hub/test/subscription-hygiene.test.ts:392 (retained)
4. `assert.match(delivered.params.content, new RegExp(\`event · topic · ${topic} deleted\`))` → hub/test/subscription-hygiene.test.ts:396 (retained)

### hub/test/subscription-hygiene.test.ts:427 'removed and reparented descendants notify former ancestor subtrees without ending them'

Destination: hub/test/subscription-hygiene.test.ts:400.

1. `assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: moved, parent: elsewhere })).ok, true)` → hub/test/subscription-hygiene.test.ts:408 (retained)
2. `assert.equal((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default).length, 1)` → hub/test/subscription-hygiene.test.ts:411 (retained)
3. `assert.match(tree.params.content, new RegExp(\`event · task · ${moved} left subtree\`))` → hub/test/subscription-hygiene.test.ts:414 (retained)
4. `assert.match(tree.params.content, new RegExp(\`event · task · ${removed.id} removed\`))` → hub/test/subscription-hygiene.test.ts:415 (retained)
5. `assert.match(exact.params.content, new RegExp(\`event · task · ${removed.id} removed\`))` → hub/test/subscription-hygiene.test.ts:418 (retained)
6. `assert.doesNotMatch(exact.params.content, /left subtree/)` → hub/test/subscription-hygiene.test.ts:419 (retained)

### hub/test/subscription-hygiene.test.ts:449 'restart reconciles a committed stop once and retains role and ancestor subtree subscriptions'

Destination: hub/test/subscription-hygiene.test.ts:422.

1. `assert.equal((await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer', item: child })).ok, true)` → hub/test/subscription-hygiene.test.ts:422 (rewritten; seam notes)
2. `assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true)` → hub/test/subscription-hygiene.test.ts:436 (retained)
3. `assert.equal(watcherLaunch.ok, true, watcherLaunch.error)` → hub/test/subscription-hygiene.test.ts:438 (retained)
4. `assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'now-watcher' }, subject: { session: 'worker' }, events: ['session.state'], digest: 'now' })).ok, true)` → hub/test/subscription-hygiene.test.ts:441 (retained)
5. `assert.equal((await ui.request({ type: 'event.subscribe', as: { name: 'worker' }, subject: { topic: 'general' }, events: ['artifact'] })).ok, true)` → hub/test/subscription-hygiene.test.ts:445 (retained)
6. `assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0)` → hub/test/subscription-hygiene.test.ts:422 (rewritten; seam notes)
7. `assert.equal(listing.code, 0, listing.stderr)` → hub/test/subscription-hygiene.test.ts:455 (retained)
8. `assert.deepEqual(JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default).map((s: Subscription) => s.subject), [{ role: 'implementer' }, { subtree: parent }])` → hub/test/subscription-hygiene.test.ts:456 (retained)
9. `assert.equal(final.length, 2, 'one turn group and one now group, without replay on the second restart')` → hub/test/subscription-hygiene.test.ts:459 (retained)
10. `assert.deepEqual(final.find(m => m.detail?.digest === 'turn')?.to, ['coord', 'rev'])` → hub/test/subscription-hygiene.test.ts:460 (retained)
11. `assert.equal(immediate?.detail?.digest, 'now', 'startup knows which running harness can steer before reconciling terminal rows')` → hub/test/subscription-hygiene.test.ts:462 (retained)
12. `assert.equal((await readInputs()).length, 1, 'ordinary queue retry/restart does not inject the now fact twice')` → hub/test/subscription-hygiene.test.ts:422 (rewritten; seam notes)
13. `assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0)` → hub/test/subscription-hygiene.test.ts:422 (rewritten; seam notes)

### hub/test/default-subscriptions.test.ts:10 'default item subscriptions follow claims and explicit subscriptions widen them'

Destination: hub/test/default-subscriptions.test.ts:9.

1. `assert.deepEqual(await subjects(coord), [{ item: item.id }])` → hub/test/default-subscriptions.test.ts:19 (retained)
2. `assert.deepEqual(await subjects(impl), [])` → hub/test/default-subscriptions.test.ts:20 (retained)
3. `assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true)` → hub/test/default-subscriptions.test.ts:21 (retained)
4. `assert.deepEqual(await subjects(coord), [])` → hub/test/default-subscriptions.test.ts:22 (retained)
5. `assert.deepEqual(await subjects(impl), [{ item: item.id }])` → hub/test/default-subscriptions.test.ts:23 (retained)
6. `assert.deepEqual((human.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.subscriber, s.subject]), [['impl', { item: item.id }]])` → hub/test/default-subscriptions.test.ts:25 (retained)
7. `assert.match((await impl.waitForEvent(e => e.params.content.includes('lead next turn'))).params.content, /status changed in progress → review/)` → hub/test/default-subscriptions.test.ts:28 (retained)
8. `assert.doesNotMatch((await coord.waitForEvent(e => e.params.content.includes('root next turn'))).params.content, /status changed in progress → review/)` → hub/test/default-subscriptions.test.ts:30 (retained)
9. `assert.match((await coord.waitForEvent(e => e.params.content.includes('explicit next turn'))).params.content, /status changed review → qa/)` → hub/test/default-subscriptions.test.ts:34 (retained)
10. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/default-subscriptions.test.ts:9 (rewritten; seam notes)
11. `assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions, beforeRestart)` → hub/test/default-subscriptions.test.ts:41 (retained)
12. `assert.deepEqual(await subjects(impl), [])` → hub/test/default-subscriptions.test.ts:20 (retained)
13. `assert.equal((await subjects(coord)).length, 2)` → hub/test/default-subscriptions.test.ts:44 (retained)
14. `assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.text === \`event · task · ${item.id} status changed review → qa\`).length, 1, 'overlapping defaults and explicit subscriptions share one fan-out')` → hub/test/default-subscriptions.test.ts:46 (retained)

### hub/test/default-subscriptions.test.ts:50 'an Aide lead owns its subtree defaults without receiving crew broadcasts'

Destination: hub/test/default-subscriptions.test.ts:49.

1. `assert.deepEqual((listed.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.subscriber, s.subject, s.default]), [ ['aide-1', { item: parent.id }, true], ['aide-1', { item: child.id }, true], ])` → hub/test/default-subscriptions.test.ts:62 (retained)
2. `assert.match((await aide.waitForEvent(e => e.params.content.includes('Aide default turn'))).params.content, /status changed backlog → review/)` → hub/test/default-subscriptions.test.ts:67 (retained)
3. `assert.match((await aide.waitForEvent(e => e.params.content.includes('Aide verdict turn'))).params.content, /verdict posted review not clear · full · aide-default/)` → hub/test/default-subscriptions.test.ts:70 (retained)
4. `assert.doesNotMatch(direct.params.content, /crew broadcast only/)` → hub/test/default-subscriptions.test.ts:74 (retained)
5. `assert.equal(aide.events.some(e => e.params.content.includes('crew broadcast only')), false)` → hub/test/default-subscriptions.test.ts:75 (retained)
6. `assert.deepEqual(events.filter(m => m.text === \`event · task · ${child.id} status changed backlog → review\` || m.text === \`event · task · ${child.id} verdict posted review not clear · full · aide-default\`).map(m => m.to), [['aide-1'], ['aide-1']])` → hub/test/default-subscriptions.test.ts:78 (retained)

### hub/test/default-subscriptions.test.ts:82 'a coalesced explicit event keeps later default lead provenance after an Aide transition'

Destination: hub/test/default-subscriptions.test.ts:81.

1. `assert.equal((await rev.call<{ ok: boolean }>('task.comment', verdict)).ok, true)` → hub/test/default-subscriptions.test.ts:94 (retained)
2. `assert.ok(original)` → hub/test/default-subscriptions.test.ts:98 (retained)
3. `assert.ok(original.to.includes('lead-1'))` → hub/test/default-subscriptions.test.ts:99 (retained)
4. `assert.equal((await lead.call<{ ok: boolean }>('task.claim', { id: parent.id })).ok, true)` → hub/test/default-subscriptions.test.ts:100 (retained)
5. `assert.equal((await rev.call<{ ok: boolean }>('task.comment', verdict)).ok, true)` → hub/test/default-subscriptions.test.ts:94 (retained)
6. `assert.deepEqual((repeated.value as { messages: Message[] }).messages.filter(m => m.text === text).map(m => m.id), [original.id])` → hub/test/default-subscriptions.test.ts:103 (retained)
7. `assert.equal((await ui.request({ type: 'role.set', session: 'lead-1', role: 'aide' })).ok, true)` → hub/test/default-subscriptions.test.ts:104 (retained)
8. `assert.ok(delivered.params.content.includes(\`${text} (×2)\`), delivered.params.content)` → hub/test/default-subscriptions.test.ts:108 (retained)

### hub/test/default-subscriptions.test.ts:112 'a stopped pooled Reviewer reaches its item lead; a killed lead reaches the Coordinator with warning events'

Destination: hub/test/default-subscriptions.test.ts:217.

1. `assert.equal(implLaunch.ok, true, implLaunch.error)` → hub/test/default-subscriptions.test.ts:228 (retained)
2. `assert.equal(revLaunch.ok, true, revLaunch.error)` → hub/test/default-subscriptions.test.ts:233 (retained)
3. `assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true)` → hub/test/default-subscriptions.test.ts:236 (retained)
4. `assert.equal(result.ok, true, result.error)` → hub/test/default-subscriptions.test.ts:239 (retained)
5. `assert.deepEqual((approval.message as Message).to, ['impl'])` → hub/test/default-subscriptions.test.ts:244 (retained)
6. `assert.equal(ui.frames.some(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · rev idle 1 min'), false, 'returning to busy cancels the idle timer')` → hub/test/default-subscriptions.test.ts:249 (retained)
7. `assert.deepEqual((idle.message as Message).to, ['impl'])` → hub/test/default-subscriptions.test.ts:253 (retained)
8. `assert.equal(ui.frames.some(f => f.type === 'message' && (f.message as Message).kind === 'event' && ['event · session.state · rev idle', 'event · session.state · rev busy', 'event · session.state · rev launched'].includes((f.message as Message).text)), false)` → hub/test/default-subscriptions.test.ts:254 (retained)
9. `assert.deepEqual((leadIdle.message as Message).to, ['coord'])` → hub/test/default-subscriptions.test.ts:259 (retained)
10. `assert.equal((await ui.request({ type: 'session.stop', session: 'rev' })).ok, true)` → hub/test/default-subscriptions.test.ts:260 (retained)
11. `assert.deepEqual((stopped.message as Message).to, ['impl'])` → hub/test/default-subscriptions.test.ts:262 (retained)
12. `assert.equal((stopped.message as Message & { stage: string }).stage, 'queued')` → hub/test/default-subscriptions.test.ts:263 (retained)
13. `assert.match(log, /rev stopped[\s\S]*release reviewer event/)` → hub/test/default-subscriptions.test.ts:269 (retained)
14. `assert.deepEqual((died.message as Message).to, ['coord'])` → hub/test/default-subscriptions.test.ts:273 (retained)
15. `assert.equal((died.message as Message & { stage: string }).stage, 'queued')` → hub/test/default-subscriptions.test.ts:274 (retained)
16. `assert.match((await coord.waitForEvent(e => e.params.content.includes('release death event'))).params.content, /impl died/)` → hub/test/default-subscriptions.test.ts:276 (retained)
17. `assert.equal('notifications' in (inbox.value as object), false)` → hub/test/default-subscriptions.test.ts:278 (retained)
18. `assert.ok(events.rows.some(r => r.text.includes('impl died') && r.warning))` → hub/test/default-subscriptions.test.ts:280 (retained)
19. `assert.equal((inbox.value as { needsYou: number }).needsYou, 0)` → hub/test/default-subscriptions.test.ts:281 (retained)

### hub/test/default-subscriptions.test.ts:184 'a claim before hello already belongs to its lead and adopts that lead identity once'

Destination: hub/test/default-subscriptions.test.ts:111.

1. `assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true)` → hub/test/default-subscriptions.test.ts:118 (retained)
2. `assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true)` → hub/test/default-subscriptions.test.ts:120 (retained)
3. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions, [])` → hub/test/default-subscriptions.test.ts:121 (retained)
4. `assert.deepEqual((listing.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.subscriber, s.subject]), [['impl', { item: item.id }]])` → hub/test/default-subscriptions.test.ts:123 (retained)
5. `assert.equal(digest.match(/status changed backlog → in progress/g)?.length, 1)` → hub/test/default-subscriptions.test.ts:129 (retained)
6. `assert.doesNotMatch(digest, /claimed by impl/)` → hub/test/default-subscriptions.test.ts:130 (retained)
7. `assert.match((await impl.waitForEvent(e => e.params.content.includes('closed lead next turn'))).params.content, /T-1 closed/)` → hub/test/default-subscriptions.test.ts:133 (retained)
8. `assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions, [])` → hub/test/default-subscriptions.test.ts:134 (retained)

### hub/test/default-subscriptions.test.ts:210 'a lead death while the hub is down reaches the offline Coordinator once after restart'

Destination: hub/test/default-subscriptions-lifecycle.test.ts:59.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/default-subscriptions-lifecycle.test.ts:69 (retained)
2. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/default-subscriptions-lifecycle.test.ts:75 (retained)
3. `assert.equal(deaths.length, 1)` → hub/test/default-subscriptions-lifecycle.test.ts:86 (retained)
4. `assert.deepEqual(deaths[0]?.to, ['coord'])` → hub/test/default-subscriptions-lifecycle.test.ts:87 (retained)
5. `assert.equal(deaths[0]?.stage, 'queued')` → hub/test/default-subscriptions-lifecycle.test.ts:88 (retained)
6. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/default-subscriptions-lifecycle.test.ts:75 (retained)

### hub/test/default-subscriptions.test.ts:244 'removing a claimed item sends its final default event to the previous lead'

Destination: hub/test/default-subscriptions.test.ts:137.

1. `assert.match((await impl.waitForEvent(e => e.params.content.includes('removed default next turn'))).params.content, /T-1 removed/)` → hub/test/default-subscriptions.test.ts:152 (retained)
2. `assert.equal(removed.length, 1)` → hub/test/default-subscriptions.test.ts:155 (retained)
3. `assert.deepEqual(removed[0]?.to, ['impl'])` → hub/test/default-subscriptions.test.ts:156 (retained)

### hub/test/default-subscriptions.test.ts:266 `terminal recovery routes an older pooled Reviewer death past its ${pendingReceipt ? 'verified-stopped lead with pending cleanup' : 'already-dead lead'}`

Destination: hub/test/default-subscriptions-lifecycle.test.ts:94.

1. `assert.equal(reviewer.ok, true, reviewer.error)` → hub/test/default-subscriptions-lifecycle.test.ts:105 (retained)
2. `assert.equal(implementer.ok, true, implementer.error)` → hub/test/default-subscriptions-lifecycle.test.ts:110 (retained)
3. `assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true)` → hub/test/default-subscriptions-lifecycle.test.ts:114 (retained)
4. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/default-subscriptions-lifecycle.test.ts:117 (retained)
5. `assert.ok(process)` → hub/test/default-subscriptions-lifecycle.test.ts:133 (retained)
6. `assert.deepEqual(deaths.map(m => [m.text, m.to]), [ [\`event · session.state · rev died · ${item.id}\`, ['coord']], ...(!pendingReceipt ? [[\`event · session.state · impl died · ${item.id}\`, ['coord']]] : []), ])` → hub/test/default-subscriptions-lifecycle.test.ts:142 (retained)
7. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/default-subscriptions-lifecycle.test.ts:117 (retained)

### hub/test/default-subscriptions.test.ts:322 'unclaimed descendants inherit their nearest claimed ancestor lead'

Destination: hub/test/default-subscriptions.test.ts:159.

1. `assert.equal(parent.ok, true, parent.error)` → hub/test/default-subscriptions.test.ts:169 (retained)
2. `assert.equal(child.ok, true, child.error)` → hub/test/default-subscriptions.test.ts:172 (retained)
3. `assert.equal(grandchild.ok, true, grandchild.error)` → hub/test/default-subscriptions.test.ts:175 (retained)
4. `assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: parentId })).ok, true)` → hub/test/default-subscriptions.test.ts:177 (retained)
5. `assert.deepEqual(status?.to, ['impl'])` → hub/test/default-subscriptions.test.ts:181 (retained)
6. `assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.map(s => s.subject), [{ item: parentId }, { item: childId }, { item: grandchildId }])` → hub/test/default-subscriptions.test.ts:182 (retained)
7. `assert.equal(launched.ok, true, launched.error)` → hub/test/default-subscriptions.test.ts:184 (retained)
8. `assert.deepEqual((inherited.message as Message).to, ['child-lead'])` → hub/test/default-subscriptions.test.ts:190 (retained)
9. `assert.deepEqual((death.message as Message).to, ['impl'], 'a gone child lead routes to the nearest ancestor lead')` → hub/test/default-subscriptions.test.ts:194 (retained)

### hub/test/default-subscriptions.test.ts:360 'anonymous hellos cannot give another name the claimant default identity'

Destination: hub/test/default-subscriptions.test.ts:197.

1. `assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true)` → hub/test/default-subscriptions.test.ts:207 (retained)
2. `assert.deepEqual(status?.to, ['impl'])` → hub/test/default-subscriptions.test.ts:211 (retained)
3. `assert.deepEqual((listing.value as { subscriptions: Array<Subscription & { subscriber: string }> }).subscriptions.map(s => [s.id, s.subscriber]), [[\`default:name:impl:${item.id}\`, 'impl']])` → hub/test/default-subscriptions.test.ts:213 (retained)

### hub/test/default-subscriptions.test.ts:380 `the item lead runs not-clear, re-review and QA; only ready starts the Coordinator (${restart ? 'after restart' : 'connected'})`

Destination: hub/test/default-subscriptions-workflow.test.ts:11.

1. `assert.equal(plannedEvent.detail?.digest, 'turn', 'planning waits for the Coordinator next turn')` → hub/test/default-subscriptions-workflow.test.ts:32 (retained)
2. `assert.equal(claimed.ok, true)` → hub/test/default-subscriptions-workflow.test.ts:34 (retained)
3. `assert.equal(sent.ok, true)` → hub/test/default-subscriptions-workflow.test.ts:41 (retained)
4. `assert.match(finding.params.content, /verdict posted review not clear/)` → hub/test/default-subscriptions-workflow.test.ts:50 (retained)
5. `assert.equal(coord.events.some(e => e.params.content.includes(\`event · task · ${item.id}\`)), false)` → hub/test/default-subscriptions-workflow.test.ts:51 (retained)
6. `assert.notEqual(before.item.status, 'ready')` → hub/test/default-subscriptions-workflow.test.ts:63 (retained)
7. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/default-subscriptions-workflow.test.ts:11 (rewritten; seam notes)
8. `assert.equal(ready.params.meta?.kind, 'event', 'ready itself starts a turn without a relay message')` → hub/test/default-subscriptions-workflow.test.ts:81 (retained)
9. `assert.equal(deliveries.length, 1, JSON.stringify(deliveries))` → hub/test/default-subscriptions-workflow.test.ts:83 (retained)
10. `assert.equal(deliveries[0]?.detail?.digest, 'now')` → hub/test/default-subscriptions-workflow.test.ts:84 (retained)
11. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/default-subscriptions-workflow.test.ts:85 (retained)
12. `assert.equal(journal.filter(e => e.event === 'event-delivery' && e.id === plannedEvent.id && e.to?.includes('coord') && e.digest === 'turn').length, 1, 'the setup planned event is accounted for separately')` → hub/test/default-subscriptions-workflow.test.ts:87 (retained)
13. `assert.equal(journal.filter(e => e.event === 'event-delivery' && e.subject?.item === item.id && e.to?.includes('coord') && e.id !== plannedEvent.id).length, 1)` → hub/test/default-subscriptions-workflow.test.ts:88 (retained)
14. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/default-subscriptions-workflow.test.ts:85 (retained)
15. `assert.equal(settled.filter(e => e.event === 'event-delivery' && e.subject?.item === item.id && e.to?.includes('coord') && e.id !== plannedEvent.id).length, 1, 'still one ready delivery after settling')` → hub/test/default-subscriptions-workflow.test.ts:96 (retained)

### hub/test/subscriptions.test.ts:12 'caller-owned subscriptions hold task status events in the ordinary next-turn digest'

Destination: hub/test/subscriptions.test.ts:15.

1. `assert.equal(subscribed.ok, true, JSON.stringify(subscribed))` → hub/test/subscriptions.test.ts:27 (retained)
2. `assert.deepEqual(subscribed.subscription.subject, { item: item.id })` → hub/test/subscriptions.test.ts:28 (retained)
3. `assert.equal(subscribed.subscription.digest, 'turn')` → hub/test/subscriptions.test.ts:29 (retained)
4. `assert.deepEqual((await impl.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [])` → hub/test/subscriptions.test.ts:30 (retained)
5. `assert.equal(duplicate.subscription.id, subscribed.subscription.id)` → hub/test/subscriptions.test.ts:32 (retained)
6. `assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, status: 'planned' })).ok, true)` → hub/test/subscriptions.test.ts:34 (retained)
7. `assert.equal((queued.message as Message).text, \`event · task · ${item.id} status changed in progress → planned\`)` → hub/test/subscriptions.test.ts:36 (retained)
8. `assert.equal((queued.message as Message & { stage: string }).stage, 'queued')` → hub/test/subscriptions.test.ts:37 (retained)
9. `assert.equal(coord.events.length, mark, 'an event cannot start a turn')` → hub/test/subscriptions.test.ts:39 (retained)
10. `assert.equal((await impl.call<{ ok: boolean }>('send', { to: ['coord'], text: 'forged event', kind: 'event' })).ok, false)` → hub/test/subscriptions.test.ts:40 (retained)
11. `assert.equal((await socket.next()).type, 'welcome')` → hub/test/subscriptions.test.ts:44 (retained)
12. `assert.equal(refused.type, 'result')` → hub/test/subscriptions.test.ts:47 (retained)
13. `assert.equal(refused.ok, false, 'the hub itself refuses session-originated kind event')` → hub/test/subscriptions.test.ts:48 (retained)
14. `assert.match(delivery.params.content, /event · task · T-\d+ status changed in progress → planned[\s\S]*next turn/)` → hub/test/subscriptions.test.ts:53 (retained)
15. `assert.equal(removedByOther.removed, false)` → hub/test/subscriptions.test.ts:55 (retained)
16. `assert.equal((await coord.call<{ removed: boolean }>('unsubscribe', { subscription: subscribed.subscription.id })).removed, true)` → hub/test/subscriptions.test.ts:56 (retained)
17. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [])` → hub/test/subscriptions.test.ts:57 (retained)
18. `assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).kind === 'event' && (f.message as Message).to.includes('coord')).length, count)` → hub/test/subscriptions.test.ts:62 (retained)

### hub/test/subscriptions.test.ts:62 'CLI and MCP share durable subscriptions; unsubscribing leaves the queued event for its next turn'

Destination: hub/test/subscriptions.test.ts:65.

1. `assert.equal(created.code, 0, created.stderr)` → hub/test/subscriptions.test.ts:77 (retained)
2. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/subscriptions.test.ts:65 (rewritten; seam notes)
3. `assert.equal(listing.code, 0, listing.stderr)` → hub/test/subscriptions.test.ts:87 (retained)
4. `assert.deepEqual(JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default), [subscription])` → hub/test/subscriptions.test.ts:88 (retained)
5. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [subscription])` → hub/test/subscriptions.test.ts:89 (retained)
6. `assert.equal(removed.code, 0, removed.stderr)` → hub/test/subscriptions.test.ts:91 (retained)
7. `assert.equal(JSON.parse(removed.stdout).removed, true)` → hub/test/subscriptions.test.ts:92 (retained)
8. `assert.match(received.params.content, /status changed in progress → planned/)` → hub/test/subscriptions.test.ts:96 (retained)
9. `assert.doesNotMatch(received.params.content, /status changed planned → review/)` → hub/test/subscriptions.test.ts:97 (retained)
10. `assert.equal(events.length, 1)` → hub/test/subscriptions.test.ts:100 (retained)

### hub/test/subscriptions.test.ts:106 'an unchanged cached item emits its first committed status change after restart'

Destination: hub/test/subscriptions.test.ts:109.

1. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/subscriptions.test.ts:109 (rewritten; seam notes)
2. `assert.deepEqual((before.value as { messages: Message[] }).messages.filter(m => m.kind === 'event'), [], 'restart itself emits no task transition')` → hub/test/subscriptions.test.ts:125 (retained)
3. `assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, status: 'planned' })).ok, true)` → hub/test/subscriptions.test.ts:126 (retained)
4. `assert.match(received.params.content, /status changed backlog → planned/)` → hub/test/subscriptions.test.ts:133 (retained)

### hub/test/subscriptions.test.ts:133 'adopting a provisional claim at hello does not announce another claim'

Destination: hub/test/subscriptions.test.ts:136.

1. `assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true)` → hub/test/subscriptions.test.ts:143 (retained)
2. `assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true)` → hub/test/subscriptions.test.ts:146 (retained)
3. `assert.equal(received.params.content.match(/claimed by impl/g)?.length, 1)` → hub/test/subscriptions.test.ts:156 (retained)
4. `assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text === \`event · task · ${item.id} claimed by impl\`).length, 1)` → hub/test/subscriptions.test.ts:158 (retained)

### hub/test/subscriptions.test.ts:158 'resume --relaunch announces each transition into running once for the same session id'

Destination: hub/test/subscriptions.test.ts:161.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscriptions.test.ts:170 (retained)
2. `assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true)` → hub/test/subscriptions.test.ts:173 (retained)
3. `assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true)` → hub/test/subscriptions.test.ts:173 (retained)
4. `assert.equal(result.code, 0, result.stderr)` → hub/test/subscriptions.test.ts:178 (retained)
5. `assert.equal(process.sessionId, first.sessionId, 'relaunch retains the stable session identity')` → hub/test/subscriptions.test.ts:180 (retained)
6. `assert.equal((await ui.request({ type: 'session.resume', session: 'impl' })).ok, true)` → hub/test/subscriptions.test.ts:187 (retained)
7. `assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.text === 'event · session.state · impl launched').length, 3, 'a live resume does not announce a launch')` → hub/test/subscriptions.test.ts:189 (retained)

### hub/test/subscriptions.test.ts:192 'session state and lifecycle events include death, held until the Coordinator next turns'

Destination: hub/test/subscriptions.test.ts:192.

1. `assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'impl' }, events: ['session.state'] })).ok, true)` → hub/test/subscriptions.test.ts:200 (retained)
2. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscriptions.test.ts:202 (retained)
3. `assert.equal(result.ok, true, result.error)` → hub/test/subscriptions.test.ts:210 (retained)
4. `assert.equal((death.message as Message & { stage: string }).stage, 'queued')` → hub/test/subscriptions.test.ts:216 (retained)
5. `assert.equal(coord.events.some(e => e.params.content.includes('event · session.state')), false)` → hub/test/subscriptions.test.ts:217 (retained)
6. `assert.match(received.params.content, /impl died[\s\S]*Coordinator next turn/)` → hub/test/subscriptions.test.ts:223 (retained)
7. `assert.equal(relaunch.ok, true, relaunch.error)` → hub/test/subscriptions.test.ts:226 (retained)
8. `assert.equal((relaunch.value as { process: { sessionId: string } }).process.sessionId, p.sessionId)` → hub/test/subscriptions.test.ts:227 (retained)
9. `assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl launched').length, 2, 'resuming an exited process emits launched')` → hub/test/subscriptions.test.ts:228 (retained)
10. `assert.equal(stopped.ok, true, stopped.error)` → hub/test/subscriptions.test.ts:230 (retained)
11. `assert.equal(ui.frames.filter(f => f.type === 'message' && (f.message as Message).text === 'event · session.state · impl died').length, 1, 'an intentional stop does not report another death')` → hub/test/subscriptions.test.ts:232 (retained)

### hub/test/subscriptions.test.ts:235 'task events report claims, verdicts and closes once; ordinary comments do not become events'

Destination: hub/test/subscriptions.test.ts:235.

1. `assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true)` → hub/test/subscriptions.test.ts:247 (retained)
2. `assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'subscription-review' })).ok, true)` → hub/test/subscriptions.test.ts:249 (retained)
3. `assert.match(received.params.content, /claimed by impl/)` → hub/test/subscriptions.test.ts:254 (retained)
4. `assert.match(received.params.content, /verdict posted review not clear · full · subscription-review/)` → hub/test/subscriptions.test.ts:255 (retained)
5. `assert.match(received.params.content, /status changed review → in progress/)` → hub/test/subscriptions.test.ts:256 (retained)
6. `assert.match(received.params.content, /closed/)` → hub/test/subscriptions.test.ts:257 (retained)
7. `assert.deepEqual(messages, [ \`event · task · ${item.id} status changed backlog → in progress\`, \`event · task · ${item.id} claimed by impl\`, \`event · task · ${item.id} status changed in progress → review\`, \`event · task · ${item.id} status changed review → in progress\`, \`event · task · ${item.id} verdict posted review not clear · full · subscription-review\`, \`event · task · ${item.id} status changed in progress → done\`, \`event · task · ${item.id} closed\`, ])` → hub/test/subscriptions.test.ts:260 (retained)

### hub/test/subscriptions.test.ts:272 `${harness}: events and progress use one ordered next-turn digest, before and after restart`

Destination: hub/test/subscriptions.test.ts:271.

1. `assert.equal(launched.ok, true, launched.error)` → hub/test/subscriptions.test.ts:278 (retained)
2. `assert.equal(subscribed.code, 0, subscribed.stderr)` → hub/test/subscriptions.test.ts:271 (rewritten; seam notes)
3. `assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: restart ? 'review' : 'planned' })).ok, true)` → hub/test/subscriptions.test.ts:301 (retained)
4. `assert.equal((await inputLog()).includes(eventText), false)` → hub/test/subscriptions.test.ts:306 (retained)
5. `assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0)` → hub/test/subscriptions.test.ts:271 (rewritten; seam notes)
6. `assert.equal(listing.code, 0, listing.stderr)` → hub/test/subscriptions.test.ts:318 (retained)
7. `assert.deepEqual(JSON.parse(listing.stdout).subscriptions.filter((s: Subscription) => !s.default), [JSON.parse(subscribed.stdout).subscription])` → hub/test/subscriptions.test.ts:271 (rewritten; seam notes)
8. `assert.equal((await inputLog()).includes(eventText), false, 'restart role clauses leave events held')` → hub/test/subscriptions.test.ts:320 (retained)
9. `assert.ok(before < event && event < after && after < end)` → hub/test/subscriptions.test.ts:330 (retained)
10. `assert.equal((await inputLog()).split('Turn digest (3 entries, oldest first):').length - 1, restart ? 2 : 1)` → hub/test/subscriptions.test.ts:339 (retained)
11. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/subscriptions.test.ts:340 (retained)
12. `assert.ok(journal.some(entry => entry.event === 'event-delivery' && entry.id === id))` → hub/test/subscriptions.test.ts:342 (retained)
13. `assert.ok(journal.some(entry => entry.event === 'injected' && entry.id === id))` → hub/test/subscriptions.test.ts:343 (retained)
14. `assert.ok(journal.filter(entry => entry.event === 'event-delivery').every(entry => entry.text === undefined))` → hub/test/subscriptions.test.ts:344 (retained)
15. `assert.equal(JSON.stringify(journal).includes(eventText), false, 'event journal records metadata, never the event body')` → hub/test/subscriptions.test.ts:345 (retained)

### hub/test/subscriptions.test.ts:353 'fan-out preserves independent recipient digests when one subscriber disconnects'

Destination: hub/test/subscriptions.test.ts:351.

1. `assert.equal((await cland(root, 'unsubscribe', subscription.id, '--as', 'qa-1', '--json')).code, 0)` → hub/test/subscriptions.test.ts:367 (retained)
2. `assert.match(first.params.content, /before event[\s\S]*backlog → planned[\s\S]*after event[\s\S]*planned → review[\s\S]*shared trigger/)` → hub/test/subscriptions.test.ts:372 (retained)
3. `assert.equal((queued.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.text === 'shared trigger')?.stage, 'queued')` → hub/test/subscriptions.test.ts:374 (retained)
4. `assert.match(second.params.content, /before event[\s\S]*backlog → planned[\s\S]*after event[\s\S]*shared trigger/)` → hub/test/subscriptions.test.ts:377 (retained)
5. `assert.doesNotMatch(second.params.content, /planned → review/)` → hub/test/subscriptions.test.ts:378 (retained)
6. `assert.equal(rev.events.filter(e => e.params.meta?.from === 'coord' && e.params.content.includes('shared trigger')).length, 1)` → hub/test/subscriptions.test.ts:383 (retained)

### hub/test/subscriptions.test.ts:388 'subscribe and unsubscribe racing an awaited task write take effect before its event is recorded'

Destination: hub/test/subscriptions.test.ts:386.

1. `assert.equal((await rev.call<{ removed: boolean }>('unsubscribe', { subscription: subscriptions[0]!.id })).removed, true)` → hub/test/subscriptions.test.ts:404 (retained)
2. `assert.equal((await editing).ok, true)` → hub/test/subscriptions.test.ts:407 (retained)
3. `assert.deepEqual((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.to.includes('rev')).map(m => m.text), [\`event · task · ${item.id} status changed backlog → planned\`])` → hub/test/subscriptions.test.ts:410 (retained)

### hub/test/subscriptions.test.ts:415 'renames preserve subscription ownership and each converging subject id'

Destination: hub/test/subscriptions.test.ts:413.

1. `assert.equal((await coord.call<{ ok: boolean }>('rename', { name: 'renamed' })).ok, true)` → hub/test/subscriptions.test.ts:423 (retained)
2. `assert.deepEqual((await rev.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), subscriptions.map(s => ({ ...s, subject: { session: 'renamed' } })))` → hub/test/subscriptions.test.ts:424 (retained)
3. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [own])` → hub/test/subscriptions.test.ts:425 (retained)
4. `assert.equal((await rev.call<{ removed: boolean }>('unsubscribe', { subscription: id })).removed, true)` → hub/test/subscriptions.test.ts:426 (retained)

### hub/test/subscriptions.test.ts:431 'invalid subjects and events are refused at the frame and MCP boundaries; CLI identities stay hub-held'

Destination: hub/test/subscriptions.test.ts:429.

1. `assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject, events })).ok, false)` → hub/test/subscriptions.test.ts:441 (retained)
2. `assert.equal((await ui.request({ type: 'event.subscribe', subject, events, as: { name: 'coord' } })).ok, false)` → hub/test/subscriptions.test.ts:442 (retained)
3. `assert.equal((await cland(root, 'subscriptions', '--json')).code, 1, 'human must select a known session')` → hub/test/subscriptions.test.ts:444 (retained)
4. `assert.equal(impostor.code, 1)` → hub/test/subscriptions.test.ts:446 (retained)
5. `assert.match(impostor.stderr, /forbidden/)` → hub/test/subscriptions.test.ts:447 (retained)
6. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [])` → hub/test/subscriptions.test.ts:448 (retained)

### hub/test/subscriptions.test.ts:453 'a terminal session role update preserves a subscription created for its next launch'

Destination: hub/test/subscriptions.test.ts:451.

1. `assert.equal((await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'claude-code' })).ok, true)` → hub/test/subscriptions.test.ts:459 (retained)
2. `assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true)` → hub/test/subscriptions.test.ts:462 (retained)
3. `assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'qa' })).ok, true)` → hub/test/subscriptions.test.ts:465 (retained)
4. `assert.deepEqual((await coord.call<{ subscriptions: Subscription[] }>('subscriptions')).subscriptions.filter((s: Subscription) => !s.default), [subscribed.subscription], 'a metadata update is not another terminal occurrence')` → hub/test/subscriptions.test.ts:466 (retained)
5. `assert.equal((await ui.request({ type: 'session.resume', session: 'impl', relaunch: true })).ok, true)` → hub/test/subscriptions.test.ts:467 (retained)
6. `assert.deepEqual(events.map(m => m.text), ['event · session.state · impl launched', 'event · session.state · impl idle'], 'the prior terminal fact must not replay into a new subscription')` → hub/test/subscriptions.test.ts:475 (retained)

### hub/test/session-archive.test.ts:15 'a real task merge starts the stopped Implementer item window'

Destination: hub/test/session-archive-merge.test.ts:16.

1. `assert.equal(pushed.code, 0, pushed.stderr)` → hub/test/session-archive-merge.test.ts:25 (retained)
2. `assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Archive after landing' })).ok, true)` → hub/test/session-archive-merge.test.ts:26 (retained)
3. `assert.equal(launch.ok, true, launch.error)` → hub/test/session-archive-merge.test.ts:28 (retained)
4. `assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true)` → hub/test/session-archive-merge.test.ts:33 (retained)
5. `assert.equal(merged.code, 0, merged.stderr)` → hub/test/session-archive-merge.test.ts:35 (retained)
6. `assert.equal((JSON.parse(merged.stdout) as { item: string }).item, 'T-1')` → hub/test/session-archive-merge.test.ts:36 (retained)
7. `assert.equal(archived.archivedBy, 'rule')` → hub/test/session-archive-merge.test.ts:42 (retained)

### hub/test/session-archive.test.ts:43 'item windows follow launch items and the latest verifier work even after holds release; reopening cancels the item clock'

Destination: hub/test/session-archive.test.ts:16.

1. `assert.equal((await ui.request({ type: 'subscribe' })).ok, true)` → hub/test/session-archive.test.ts:22 (retained)
2. `assert.equal((await ui.request({ size: 'M', type: 'task.create', title })).ok, true)` → hub/test/session-archive.test.ts:23 (retained)
3. `assert.equal(launch.ok, true, launch.error)` → hub/test/session-archive.test.ts:27 (retained)
4. `assert.equal((await spoke.call<{ ok: boolean }>('task.hold', { id })).ok, true)` → hub/test/session-archive.test.ts:36 (retained)
5. `assert.equal((await spoke.call<{ ok: boolean }>('task.hold', { id: 'T-3', release: true })).ok, true)` → hub/test/session-archive.test.ts:38 (retained)
6. `assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true)` → hub/test/session-archive.test.ts:41 (retained)
7. `assert.equal(closed.ok, true, closed.error)` → hub/test/session-archive.test.ts:45 (retained)
8. `assert.equal((await ui.request({ type: 'task.edit', item: 'T-4', state: 'open' })).ok, true)` → hub/test/session-archive.test.ts:47 (retained)
9. `assert.equal((await ui.request({ type: 'task.comment', item: 'T-3', text: 'Post-close note' })).ok, true)` → hub/test/session-archive.test.ts:50 (retained)
10. `assert.deepEqual(archive.processes.map(p => p.name).sort(), ['impl', 'rev', 'tester'])` → hub/test/session-archive.test.ts:59 (retained)
11. `assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['reopened'])` → hub/test/session-archive.test.ts:60 (retained)
12. `assert.deepEqual(closed.item.holds, [], 'stop releases verifier holds')` → hub/test/session-archive.test.ts:62 (retained)
13. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/session-archive.test.ts:63 (retained)
14. `assert.deepEqual(records.filter(r => r.event === 'session-archived').map(r => [r.session, r.by, r.rule]).sort(), [['impl', 'rule', 'item'], ['rev', 'rule', 'item'], ['tester', 'rule', 'item']])` → hub/test/session-archive.test.ts:65 (retained)

### hub/test/session-archive.test.ts:86 'configured stop window archives crew at startup and on the timer, never Aides'

Destination: hub/test/session-archive.test.ts:68.

1. `assert.equal(initial.archived, 1, 'startup archives due rows')` → hub/test/session-archive.test.ts:82 (retained)
2. `assert.ok(initial.processes.find(p => p.name === 'legacy')?.stoppedAt, 'first sweep dates a legacy stop without journal reads')` → hub/test/session-archive.test.ts:83 (retained)
3. `assert.equal((await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' }, 30000)).ok, true)` → hub/test/session-archive.test.ts:85 (retained)
4. `assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true)` → hub/test/session-archive.test.ts:87 (retained)
5. `assert.deepEqual(archived.processes.map(p => p.name).sort(), ['crew', 'fallback', 'legacy'])` → hub/test/session-archive.test.ts:94 (retained)
6. `assert.ok(archived.processes.every(p => p.archivedBy === 'rule'))` → hub/test/session-archive.test.ts:95 (retained)
7. `assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name).sort(), ['human-aide', 'stopped-aide'])` → hub/test/session-archive.test.ts:97 (retained)

### hub/test/session-archive.test.ts:120 'prune CLI and Coordinator tool delete only old archived records and retain the journal'

Destination: hub/test/session-archive.test.ts:100.

1. `assert.equal((await ui.request({ type: 'subscribe' })).ok, true)` → hub/test/session-archive.test.ts:104 (retained)
2. `assert.ok((await coord.client.listTools()).tools.some(tool => tool.name === 'session.prune'))` → hub/test/session-archive.test.ts:108 (retained)
3. `assert.deepEqual([forbidden.ok, forbidden.code], [false, 'forbidden'])` → hub/test/session-archive.test.ts:113 (retained)
4. `assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Retained item after prune', assignee: 'old' })).ok, true)` → hub/test/session-archive.test.ts:114 (retained)
5. `assert.equal(launch.ok, true, launch.error)` → hub/test/session-archive.test.ts:117 (retained)
6. `assert.equal(claim.ok, true, claim.error)` → hub/test/session-archive.test.ts:124 (retained)
7. `assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true)` → hub/test/session-archive.test.ts:128 (retained)
8. `assert.equal((await ui.request({ type: 'session.archive', session: 'old' })).ok, true)` → hub/test/session-archive.test.ts:130 (retained)
9. `assert.equal(dry.code, 0, dry.stderr)` → hub/test/session-archive.test.ts:133 (retained)
10. `assert.deepEqual(JSON.parse(dry.stdout), { names: ['old'], dryRun: true })` → hub/test/session-archive.test.ts:134 (retained)
11. `assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 1)` → hub/test/session-archive.test.ts:135 (retained)
12. `assert.equal(pruned.ok, true)` → hub/test/session-archive.test.ts:137 (retained)
13. `assert.deepEqual(pruned.names, ['old'])` → hub/test/session-archive.test.ts:138 (retained)
14. `assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 0)` → hub/test/session-archive.test.ts:139 (retained)
15. `assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['keep'])` → hub/test/session-archive.test.ts:140 (retained)
16. `assert.equal(item.item.title, 'Retained item after prune')` → hub/test/session-archive.test.ts:142 (retained)
17. `assert.equal(item.item.claim, null, 'prune removes the session claim without deleting the item')` → hub/test/session-archive.test.ts:143 (retained)
18. `assert.equal((await ui.request({ type: 'session.resume', session: 'old' })).ok, false)` → hub/test/session-archive.test.ts:144 (retained)
19. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/session-archive.test.ts:145 (retained)
20. `assert.equal(journal.code, 0, journal.stderr)` → hub/test/session-archive.test.ts:147 (retained)
21. `assert.match(journal.stdout, /session-launched/)` → hub/test/session-archive.test.ts:148 (retained)
22. `assert.match(journal.stdout, /old/)` → hub/test/session-archive.test.ts:149 (retained)
23. `assert.deepEqual(records.filter(r => r.event === 'sessions-pruned').map(r => r.names), [['old']])` → hub/test/session-archive.test.ts:151 (retained)

### hub/test/session-archive.test.ts:179 'prune compares stop age even for recently archived rows, keeps young and unarchived rows, and rejects invalid durations'

Destination: hub/test/session-archive.test.ts:154.

1. `assert.equal((await ui.request({ type: 'session.prune', olderThan })).ok, false, olderThan)` → hub/test/session-archive.test.ts:167 (retained)
2. `assert.equal(dry.code, 0, dry.stderr)` → hub/test/session-archive.test.ts:170 (retained)
3. `assert.deepEqual(JSON.parse(dry.stdout), { names: ['old'], dryRun: true })` → hub/test/session-archive.test.ts:171 (retained)
4. `assert.equal(prune.code, 0, prune.stderr)` → hub/test/session-archive.test.ts:173 (retained)
5. `assert.deepEqual(JSON.parse(prune.stdout), { names: ['old'], dryRun: false })` → hub/test/session-archive.test.ts:174 (retained)
6. `assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes.map(p => p.name), ['young'])` → hub/test/session-archive.test.ts:175 (retained)
7. `assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['unarchived'])` → hub/test/session-archive.test.ts:176 (retained)

### hub/test/session-archive.test.ts:203 'archive refuses live and unlaunched rows, hides stopped rows, retains their journal, and resume restores them'

Destination: hub/test/session-archive.test.ts:179.

1. `assert.equal((await ui.request({ type: 'subscribe' })).ok, true)` → hub/test/session-archive.test.ts:183 (retained)
2. `assert.ok((await coord.client.listTools()).tools.some(tool => tool.name === 'session.archive'))` → hub/test/session-archive.test.ts:187 (retained)
3. `assert.equal(forbidden.ok, false)` → hub/test/session-archive.test.ts:192 (retained)
4. `assert.equal(forbidden.code, 'forbidden')` → hub/test/session-archive.test.ts:193 (retained)
5. `assert.equal(unlaunched.ok, false)` → hub/test/session-archive.test.ts:195 (retained)
6. `assert.match(unlaunched.error!, /no session.*was launched/)` → hub/test/session-archive.test.ts:196 (retained)
7. `assert.equal(launched.ok, true, launched.error)` → hub/test/session-archive.test.ts:198 (retained)
8. `assert.equal(live.ok, false)` → hub/test/session-archive.test.ts:202 (retained)
9. `assert.match(live.error!, /stop it first/)` → hub/test/session-archive.test.ts:203 (retained)
10. `assert.equal(stopped.ok, true, stopped.error)` → hub/test/session-archive.test.ts:205 (retained)
11. `assert.ok((stopped.value as { process: HarnessProcessView }).process.stoppedAt)` → hub/test/session-archive.test.ts:206 (retained)
12. `assert.equal((await ui.request({ type: 'visibility.set', surface: 'sessions', target: 'old', mode: 'pin' })).ok, true)` → hub/test/session-archive.test.ts:208 (retained)
13. `assert.equal(archived.ok, true, archived.error)` → hub/test/session-archive.test.ts:210 (retained)
14. `assert.equal(archived.process.archived, true)` → hub/test/session-archive.test.ts:211 (retained)
15. `assert.equal(archived.process.layer, 'archive')` → hub/test/session-archive.test.ts:212 (retained)
16. `assert.equal(archived.process.archivedBy, 'hand')` → hub/test/session-archive.test.ts:213 (retained)
17. `assert.equal((event.process as HarnessProcessView).name, 'old')` → hub/test/session-archive.test.ts:215 (retained)
18. `assert.deepEqual(list.processes, [])` → hub/test/session-archive.test.ts:217 (retained)
19. `assert.equal(list.archived, 1)` → hub/test/session-archive.test.ts:218 (retained)
20. `assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes.map(p => p.name), ['old'])` → hub/test/session-archive.test.ts:219 (retained)
21. `assert.equal(result.code, 0, result.stderr)` → hub/test/session-archive.test.ts:222 (retained)
22. `assert.equal(rows.archived, 1)` → hub/test/session-archive.test.ts:224 (retained)
23. `assert.deepEqual(rows.processes.map(p => p.name), archived ? ['old'] : [])` → hub/test/session-archive.test.ts:225 (retained)
24. `assert.equal(text.code, 0, text.stderr)` → hub/test/session-archive.test.ts:228 (retained)
25. `assert.match(text.stdout, /old \[Aide\]/)` → hub/test/session-archive.test.ts:229 (retained)
26. `assert.equal(repeat.code, 0, repeat.stderr)` → hub/test/session-archive.test.ts:232 (retained)
27. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/session-archive.test.ts:233 (retained)
28. `assert.ok(journal.some(e => e.event === event && e.session === 'old'), event)` → hub/test/session-archive.test.ts:235 (retained)
29. `assert.equal(mark.length, 1)` → hub/test/session-archive.test.ts:237 (retained)
30. `assert.deepEqual([mark[0]!.sessionId, mark[0]!.by, mark[0]!.actor], [before.sessionId, 'hand', 'coord'])` → hub/test/session-archive.test.ts:238 (retained)
31. `assert.equal(resumed.ok, true, resumed.error)` → hub/test/session-archive.test.ts:240 (retained)
32. `assert.equal(after.found, true)` → hub/test/session-archive.test.ts:242 (retained)
33. `assert.equal(after.process.archived, false)` → hub/test/session-archive.test.ts:243 (retained)
34. `assert.equal(after.process.archivedAt, null)` → hub/test/session-archive.test.ts:244 (retained)
35. `assert.equal(after.process.stoppedAt, null)` → hub/test/session-archive.test.ts:245 (retained)
36. `assert.equal(after.process.sessionId, before.sessionId)` → hub/test/session-archive.test.ts:246 (retained)
37. `assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['old'])` → hub/test/session-archive.test.ts:247 (retained)
38. `assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes, [])` → hub/test/session-archive.test.ts:248 (retained)
39. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/session-archive.test.ts:233 (retained)
40. `assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"session-unarchived"/)` → hub/test/session-archive.test.ts:250 (retained)

### hub/test/session-archive.test.ts:278 'migration retains old stopped rows without reading the journal, and name reuse clears archive metadata'

Destination: hub/test/session-archive.test.ts:253.

1. `assert.equal(row.sessionId, 'old-id')` → hub/test/session-archive.test.ts:263 (retained)
2. `assert.equal(row.stoppedAt, null)` → hub/test/session-archive.test.ts:264 (retained)
3. `assert.equal(table.get('old')!.archivedBy, 'rule')` → hub/test/session-archive.test.ts:266 (retained)
4. `assert.equal(table.get('old')!.archivedAt, null)` → hub/test/session-archive.test.ts:268 (retained)
5. `assert.equal(table.get('old')!.archivedBy, null)` → hub/test/session-archive.test.ts:269 (retained)

### hub/test/session-archive.test.ts:297 `fresh resume clears a durable ${by} archive after a refused native resume`

Destination: hub/test/session-archive.test.ts:272.

1. `assert.equal(before.processes[0]!.archivedBy, by, 'restart retains the archive metadata')` → hub/test/session-archive.test.ts:281 (retained)
2. `assert.equal(failed.ok, true, failed.error)` → hub/test/session-archive.test.ts:284 (retained)
3. `assert.equal(offer.found, false)` → hub/test/session-archive.test.ts:286 (retained)
4. `assert.equal(offer.process.archived, true, 'a failed resume retains the mark')` → hub/test/session-archive.test.ts:287 (retained)
5. `assert.equal(offer.fresh.brief, 'Continue this archived work.')` → hub/test/session-archive.test.ts:288 (retained)
6. `assert.equal(fresh.code, 0, fresh.stderr)` → hub/test/session-archive.test.ts:290 (retained)
7. `assert.equal(after.found, true)` → hub/test/session-archive.test.ts:292 (retained)
8. `assert.equal(after.process.archived, false)` → hub/test/session-archive.test.ts:293 (retained)
9. `assert.equal(after.process.sessionId, 'old-id')` → hub/test/session-archive.test.ts:294 (retained)
10. `assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes, [])` → hub/test/session-archive.test.ts:295 (retained)
11. `assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true)` → hub/test/session-archive.test.ts:296 (retained)
12. `assert.equal(unarchived?.by, by)` → hub/test/session-archive.test.ts:299 (retained)

### hub/test/agents-journal.test.ts:65 'agent-to-agent messages are recorded in Agents with sender, role and time, General shows nothing of them, and a reply in Agents addresses the sender'

Destination: hub/test/agents-journal.test.ts:64.

1. `assert.equal(sent.outcomes?.[0]?.outcome, 'delivered', JSON.stringify(sent))` → hub/test/agents-journal.test.ts:74 (retained)
2. `assert.equal((event.topic as { id: string }).id, 'agents')` → hub/test/agents-journal.test.ts:76 (retained)
3. `assert.equal(first.from, 'alpha')` → hub/test/agents-journal.test.ts:78 (retained)
4. `assert.equal(first.fromRole, 'implementer')` → hub/test/agents-journal.test.ts:79 (retained)
5. `assert.ok(!Number.isNaN(Date.parse(first.ts)), first.ts)` → hub/test/agents-journal.test.ts:80 (retained)
6. `assert.deepEqual(first.to, ['beta'])` → hub/test/agents-journal.test.ts:81 (retained)
7. `assert.equal((await beta.call<Send>('send', { to: ['alpha'], text: 'on it', reply_to: first.id })).ok, true)` → hub/test/agents-journal.test.ts:82 (retained)
8. `assert.deepEqual( exchanged.map((m) => [m.from, m.fromRole, m.to.join(','), m.text]), [ ['alpha', 'implementer', 'beta', 'T-1 is ready for review'], ['beta', 'reviewer', 'alpha', 'on it'], ], )` → hub/test/agents-journal.test.ts:89 (retained)
9. `assert.deepEqual(await history(ui, 'general'), [])` → hub/test/agents-journal.test.ts:97 (retained)
10. `assert.equal((f.topic as { id: string }).id, 'agents', JSON.stringify(f))` → hub/test/agents-journal.test.ts:98 (retained)
11. `assert.equal(plain.ok, false)` → hub/test/agents-journal.test.ts:102 (retained)
12. `assert.match(plain.error ?? '', /read-only/)` → hub/test/agents-journal.test.ts:103 (retained)
13. `assert.deepEqual(reply.message.to, ['alpha'])` → hub/test/agents-journal.test.ts:105 (retained)
14. `assert.equal(reply.message.replyTo, first.id)` → hub/test/agents-journal.test.ts:106 (retained)
15. `assert.equal(reply.message.topic, 'agents')` → hub/test/agents-journal.test.ts:107 (retained)
16. `assert.deepEqual(reply.outcomes.map((o) => \`${o.to}:${o.outcome}\`), ['alpha:delivered'])` → hub/test/agents-journal.test.ts:108 (retained)
17. `assert.equal(got.params.meta?.from, 'human')` → hub/test/agents-journal.test.ts:110 (retained)
18. `assert.equal(got.params.meta?.topic, 'agents')` → hub/test/agents-journal.test.ts:111 (retained)
19. `assert.equal(beta.events.some((e) => e.params.content === 'keep it small, please'), false, 'only the sender is addressed')` → hub/test/agents-journal.test.ts:112 (retained)
20. `assert.ok(notice, 'the role assignments are recorded as notices')` → hub/test/agents-journal.test.ts:115 (retained)
21. `assert.equal(toNotice.ok, false)` → hub/test/agents-journal.test.ts:117 (retained)
22. `assert.match(toNotice.error ?? '', /no sender to answer/)` → hub/test/agents-journal.test.ts:118 (retained)

### hub/test/agents-journal.test.ts:122 'lifecycle events land in Agents as notices with kinds — role assignment and revocation, a claim and its release, a session start and stop — and no tool-level noise does'

Destination: hub/test/agents-journal.test.ts:121.

1. `assert.equal((await clandWithEnv(root, fake.env, 'task', 'create', '--size', 'M', 'Journal the hub')).code, 0)` → hub/test/agents-journal.test.ts:131 (retained)
2. `assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1' })).ok, true)` → hub/test/agents-journal.test.ts:132 (retained)
3. `assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1', release: true })).ok, true)` → hub/test/agents-journal.test.ts:133 (retained)
4. `assert.equal(launched.ok, true, launched.error)` → hub/test/agents-journal.test.ts:137 (retained)
5. `assert.equal((await ui.request({ type: 'session.stop', session: 'coord-1' }, 15_000)).ok, true)` → hub/test/agents-journal.test.ts:139 (retained)
6. `assert.ok(kinds.includes(kind), \`${kind} in ${kinds.join(', ')}\`)` → hub/test/agents-journal.test.ts:146 (retained)
7. `assert.ok(notices.some((m) => m.kind === kind && match.test(m.text)), \`${kind} ~ ${match}: ${JSON.stringify(notices.map((m) => [m.kind, m.text]))}\`)` → hub/test/agents-journal.test.ts:147 (retained)
8. `assert.equal(notices.filter(m => m.kind === 'role-assign' && /^coord-1 took Coordinator at launch/.test(m.text)).length, 1)` → hub/test/agents-journal.test.ts:155 (retained)
9. `assert.ok(m.kind !== undefined && LIFECYCLE.has(m.kind), \`not a lifecycle kind: ${JSON.stringify(m)}\`)` → hub/test/agents-journal.test.ts:158 (retained)
10. `assert.ok(notices.every((m) => m.to.length === 0), 'a lifecycle notice is for reading: it addresses nobody')` → hub/test/agents-journal.test.ts:159 (retained)
11. `assert.ok(ui.frames.some((f) => f.type === 'message' && (f.message as Message).kind === 'claim'))` → hub/test/agents-journal.test.ts:161 (retained)
12. `assert.ok(audits.every((l) => l.outcome === 'ok' || l.outcome === 'forbidden' || l.outcome === 'error'), JSON.stringify(audits))` → hub/test/agents-journal.test.ts:167 (retained)
13. `assert.equal(launchGrants.length, 1)` → hub/test/agents-journal.test.ts:172 (retained)
14. `assert.equal((await journalLines(root)).filter(l => l.event === 'role-taken-at-launch' && l.session === 'coord-1').length, 1, 'still one launch grant after settling')` → hub/test/agents-journal.test.ts:175 (retained)
15. `assert.equal(launchGrants[0]?.agentsNotice, notices.find(m => m.kind === 'role-assign' && /^coord-1 took Coordinator at launch/.test(m.text))?.id)` → hub/test/agents-journal.test.ts:176 (retained)

### hub/test/agents-journal.test.ts:181 'a looping pair trips the breaker at the configured threshold: both get the typed refusal, Agents shows the mute, it survives a restart until `cland hub unmute`; a changed threshold applies at the next start; the journal only grows'

Destination: hub/test/agents-journal.test.ts:179.

1. `assert.equal(firstLines[0]?.event, 'hub-started')` → hub/test/agents-journal.test.ts:190 (retained)
2. `assert.equal(r.outcomes?.[0]?.outcome, 'delivered', \`message ${i}: ${JSON.stringify(r)}\`)` → hub/test/agents-journal.test.ts:195 (retained)
3. `assert.equal(refusal?.outcome, 'refused', JSON.stringify(tripped))` → hub/test/agents-journal.test.ts:199 (retained)
4. `assert.match(refusal?.reason ?? '', /^loop breaker: beta ↔ alpha exchanged more than 3 messages in 5 min/)` → hub/test/agents-journal.test.ts:200 (retained)
5. `assert.equal(refusal?.refusal?.code, 'hygiene')` → hub/test/agents-journal.test.ts:201 (retained)
6. `assert.equal(refusal?.refusal?.rule, 'loop')` → hub/test/agents-journal.test.ts:202 (retained)
7. `assert.ok(Date.parse(until) > Date.now() + 9 * 60_000, until)` → hub/test/agents-journal.test.ts:179 (rewritten; seam notes)
8. `assert.deepEqual({ code: detail.code, rule: detail.rule, until: detail.until, pair: detail.pair }, { code: 'hygiene', rule: 'loop', until, pair: ['alpha', 'beta'] })` → hub/test/agents-journal.test.ts:209 (retained)
9. `assert.ok(mute, 'the mute is in Agents')` → hub/test/agents-journal.test.ts:213 (retained)
10. `assert.match(mute.text, /^alpha \[Implementer\] ↔ beta \[Reviewer\] muted: .*cland hub unmute alpha beta/)` → hub/test/agents-journal.test.ts:214 (retained)
11. `assert.equal((await say(alpha, 'beta', 'one more')).outcomes?.[0]?.outcome, 'refused', 'both directions')` → hub/test/agents-journal.test.ts:215 (retained)
12. `assert.equal(afterRestart.outcomes?.[0]?.outcome, 'refused', JSON.stringify(afterRestart))` → hub/test/agents-journal.test.ts:221 (retained)
13. `assert.equal(afterRestart.outcomes?.[0]?.refusal?.until, until, 'the same mute, not a new one')` → hub/test/agents-journal.test.ts:222 (retained)
14. `assert.equal(lifted.code, 0, lifted.stderr)` → hub/test/agents-journal.test.ts:226 (retained)
15. `assert.match(lifted.stdout, /^unmuted alpha ↔ beta/)` → hub/test/agents-journal.test.ts:227 (retained)
16. `assert.equal((await say(alpha, 'beta', 'back to work')).outcomes?.[0]?.outcome, 'delivered')` → hub/test/agents-journal.test.ts:228 (retained)
17. `assert.equal(again.lifted, false, 'nothing left to lift')` → hub/test/agents-journal.test.ts:231 (retained)
18. `assert.equal((await say(beta, 'alpha', 'before the restart')).outcomes?.[0]?.outcome, 'delivered', 'the running hub keeps the threshold it started with')` → hub/test/agents-journal.test.ts:236 (retained)
19. `assert.equal(second.outcomes?.[0]?.outcome, 'refused', JSON.stringify(second))` → hub/test/agents-journal.test.ts:240 (retained)
20. `assert.match(second.outcomes?.[0]?.reason ?? '', /more than 1 messages in 5 min/)` → hub/test/agents-journal.test.ts:241 (retained)
21. `assert.ok(lines.length > firstLines.length)` → hub/test/agents-journal.test.ts:246 (retained)
22. `assert.deepEqual(lines.slice(0, firstLines.length), firstLines, 'the earlier lines survive as they were')` → hub/test/agents-journal.test.ts:247 (retained)
23. `assert.equal(lines.filter((l) => l.event === 'hub-started').length, 3)` → hub/test/agents-journal.test.ts:248 (retained)
24. `assert.equal(lines.filter((l) => l.event === 'hub-stopped').length, 2)` → hub/test/agents-journal.test.ts:249 (retained)
25. `assert.ok(lines.some((l) => l.event === event), \`${event} journalled\`)` → hub/test/agents-journal.test.ts:250 (retained)
26. `assert.ok(sends.every((l) => typeof l.id === 'string' && typeof l.bytes === 'number' && Array.isArray(l.to) && !('text' in l)), 'messages are journalled as metadata, never their text')` → hub/test/agents-journal.test.ts:252 (retained)
27. `assert.ok(!lines.some((l) => JSON.stringify(l).includes('back to work')))` → hub/test/agents-journal.test.ts:253 (retained)
28. `assert.ok(!Number.isNaN(Date.parse(l.ts)), JSON.stringify(l))` → hub/test/agents-journal.test.ts:254 (retained)
29. `assert.equal(read.code, 0, read.stderr)` → hub/test/agents-journal.test.ts:257 (retained)
30. `assert.ok(filtered.length >= 3 && filtered.every((r) => r.event === 'loop-breaker' || r.event === 'unmuted'), read.stdout)` → hub/test/agents-journal.test.ts:259 (retained)
31. `assert.equal(human.stdout.trim().split('\n').length, 3, human.stdout)` → hub/test/agents-journal.test.ts:261 (retained)
32. `assert.match(human.stdout, /^\S+ {2}hub-started {2}pid=\d+/)` → hub/test/agents-journal.test.ts:262 (retained)

### hub/test/agents-journal.test.ts:267 'hygiene refusals are typed: the size cap and the rate limit refuse the send itself, with code, rule and reason'

Destination: hub/test/agents-journal.test.ts:265.

1. `assert.equal(big.ok, false)` → hub/test/agents-journal.test.ts:275 (retained)
2. `assert.deepEqual(big.refusal, { code: 'hygiene', rule: 'size' })` → hub/test/agents-journal.test.ts:276 (retained)
3. `assert.equal((await alpha.call<Send>('send', { to: ['beta'], text: 'one' })).ok, true)` → hub/test/agents-journal.test.ts:277 (retained)
4. `assert.equal(chatty.ok, false)` → hub/test/agents-journal.test.ts:279 (retained)
5. `assert.match(chatty.error ?? '', /^rate limit: 1 messages in 1 min/)` → hub/test/agents-journal.test.ts:280 (retained)
6. `assert.deepEqual(chatty.refusal, { code: 'hygiene', rule: 'rate' })` → hub/test/agents-journal.test.ts:281 (retained)

### hub/test/agents-journal.test.ts:287 'an agent-to-agent message in another topic is referenced in Agents (sender, addressees, topic, message id), its text not repeated'

Destination: hub/test/agents-journal.test.ts:286.

1. `assert.equal(sent.ok, true, JSON.stringify(sent))` → hub/test/agents-journal.test.ts:298 (retained)
2. `assert.ok(inTopic, 'the message itself is in its topic')` → hub/test/agents-journal.test.ts:300 (retained)
3. `assert.deepEqual(ref.detail, { from: 'alpha', to: ['beta'], topic: topic.id, message: inTopic.id })` → hub/test/agents-journal.test.ts:302 (retained)
4. `assert.match(ref.text, new RegExp(\`^alpha \\[Implementer\\] → beta in "Review of T-1" \\(${topic.id}\\): message ${inTopic.id}$\`))` → hub/test/agents-journal.test.ts:303 (retained)
5. `assert.ok(!ref.text.includes(text), 'the text is not duplicated')` → hub/test/agents-journal.test.ts:304 (retained)
6. `assert.deepEqual(ref.to, [], 'a reference addresses nobody')` → hub/test/agents-journal.test.ts:305 (retained)
7. `assert.equal((await history(ui, 'agents')).filter((m) => m.kind === 'agent-message').length, 1)` → hub/test/agents-journal.test.ts:309 (retained)

### hub/test/agents-journal.test.ts:313 'a lifecycle event journalled but not yet recorded in Agents when the hub died is recorded at the next start, once'

Destination: hub/test/agents-checkpoint.test.ts:68.

1. `assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Recorded')).code, 0)` → hub/test/agents-checkpoint.test.ts:68 (rewritten; seam notes)
2. `assert.equal((await cland(root, 'task', 'claim', 'T-1', '--as', 'alpha')).code, 0)` → hub/test/agents-checkpoint.test.ts:68 (rewritten; seam notes)
3. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/agents-checkpoint.test.ts:68 (rewritten; seam notes)
4. `assert.ok(claimed && typeof claimed.agentsNotice === 'string', \`the journalled event names its notice: ${JSON.stringify(claimed)}\`)` → hub/test/agents-checkpoint.test.ts:68 (rewritten; seam notes)
5. `assert.equal(claimed.agentsNotice, recorded.id)` → hub/test/agents-checkpoint.test.ts:68 (rewritten; seam notes)
6. `assert.deepEqual(claims.map((m) => m.text), ['alpha claimed T-1', 'beta claimed T-2'])` → hub/test/agents-checkpoint.test.ts:68 (rewritten; seam notes)

### hub/test/agents-journal.test.ts:340 'lifecycle notices retention removed are not brought back by the journal: no replay after every notice was pruned'

Destination: hub/test/agents-checkpoint.test.ts:90.

1. `assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Recorded')).code, 0)` → hub/test/agents-checkpoint.test.ts:90 (rewritten; seam notes)
2. `assert.equal((await cland(root, 'task', 'claim', 'T-1', '--as', 'alpha')).code, 0)` → hub/test/agents-checkpoint.test.ts:90 (rewritten; seam notes)
3. `assert.equal((await cland(root, 'hub', 'stop')).code, 0)` → hub/test/agents-checkpoint.test.ts:90 (rewritten; seam notes)
4. `assert.deepEqual(agents.filter((m) => m.kind === 'claim' || m.kind === 'role-assign'), [], JSON.stringify(agents))` → hub/test/agents-checkpoint.test.ts:90 (rewritten; seam notes)
5. `assert.ok(!(await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).includes('"event":"agents-record-replayed"'))` → hub/test/agents-checkpoint.test.ts:90 (rewritten; seam notes)

### hub/test/agents-journal.test.ts:363 'a journal whose last line was cut off mid-write gets a newline before the next record: every later record parses'

Destination: hub/test/agents-journal.test.ts:312.

1. `assert.equal(lines[1], '{"ts":"2026-10-01T00:00:01.000Z","event":"se', 'the cut line is left as it was, alone on its line')` → hub/test/agents-journal.test.ts:320 (retained)
2. `assert.equal(later[0]?.event, 'hub-started', "this start's record is a whole line of its own")` → hub/test/agents-journal.test.ts:322 (retained)

### hub/test/agents-journal.test.ts:19 helper ok

Destination: hub/test/agents-journal.test.ts:19.

1. `assert.equal(r.ok, true, \`${frame.type}: ${r.error}\`)` → hub/test/agents-journal.test.ts:21 (retained)

### hub/test/agents-journal.test.ts:41 helper journalLines

Destination: hub/test/agents-journal.test.ts:41.

1. `assert.ok(text.endsWith('\n'), 'every record is a whole line')` → hub/test/agents-journal.test.ts:43 (retained)

### hub/test/agents-journal.test.ts:56 helper restart

Destination: hub/test/agents-journal.test.ts:56.

1. `assert.equal(stopped.code, 0, stopped.stderr)` → hub/test/agents-journal.test.ts:56 (rewritten; seam notes)
