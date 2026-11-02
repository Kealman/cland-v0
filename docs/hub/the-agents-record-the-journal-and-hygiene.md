## The Agents record, the journal and hygiene

At startup, `readStartupJournal` reads the journal's frozen file-size prefix in
64 KiB chunks and decodes complete lines, preserving plan events, subagent
launches and Agents checkpoints in file order. Concurrent calls for the same
absolute path share one in-flight scan; completion or failure releases it, so a
later startup sees new appends. The input working set depends on the longest
line, plus the selected decoded replay records, rather than unrelated retained
history. There is no new line-size limit or persistent cache. Malformed lines
are skipped and a final unterminated JSON record remains eligible, as before.
The synchronous `hub journal`/doctor reader and wire records are unchanged.


**Agents** (spec 4.5, decision #7) is the project's record of what agents do with each other. Every message a session sends to other sessions lands there; one that names another topic is written there and referenced in Agents by an `agent-message` notice (below), its text not repeated. So does every lifecycle event, as a hub notice: a message `from` `hub`, `fromKind` `hub`, addressing nobody, with a `kind` and its facts in `detail`.

| `kind` | When |
| --- | --- |
| `redelivered` | A Codex turn ended without a message it had accepted, and the adapter delivered it again as a new turn or into a newer running turn (`harness-redelivered`). The notice says which destination accepted the recovery. |
| `spoke-joined` | Another spoke of a connected session said hello (`replaced` in the journal): nothing is lost, each spoke is answered. |
| `session-start` | A session was launched (`session-launched`), or re-found after a hub restart (`session-resumed`). |
| `session-stop`, `session-death` | It was stopped through cland; its harness process died (`harness-exited`). |
| `role-assign`, `role-revoke` | The human assigned a role (`(was …)` when it replaced another), a launch granted one at the first hello; the human revoked it, or its session stopped or died. A handover (`role.handover`, #31) is its own `handover` notice (with the note) followed by a `role-assign` for the new holder. |
| `claim`, `release` | A session claimed an item (`taken over from …` when forced); a claim was released, by its holder, by another, or because the item closed. |
| `handover` | A role was handed over (#31): who moved it, to whom, and the note. |
| `mute`, `unmute` | The loop breaker muted a pair; a person lifted the mute. These two are delivered to both sessions of the pair as well. |
| `refusal` | A tool call refused by the permission table (#30). |
| `agent-message` | A session's message to other sessions written into another topic: `alpha [Implementer] → beta in "Review of T-1" (topic-3): message <id>`, `detail` `{from, to, topic, message}`. |

`src/hub/agents-topic.ts` maps the domain events to the notices, as they are logged; the mute, the unmute, #30's refusals and #31's handover call `HubCore.noticeInTopic(topic, { kind, text, to?, detail? })`, the one path into the record. Tool-level noise never enters: commands, outputs, hook signals, state changes, acks and injections are journalled, not recorded in Agents. A lifecycle notice is recorded just after its event's own write; the event's journal line carries the notice's id (`agentsNotice`), and at start the daemon records, under that id, every journalled notice after the newest one recorded: the checkpoint `hub.db` keeps apart from the messages (`meta`, written with each journalled notice, never pruned), else the newest one Agents still holds. A notice whose journal append completed before the hub died is recovered once; notices retention removed never come back. If the stored checkpoint is absent from the surviving journal, recovery skips that entire older prefix: ordered appends prove its records precede the unflushed checkpoint, rather than treating the store as a legacy store with no checkpoint. Recovery persists the final surviving notice id as the new boundary (or clears the checkpoint for an empty prefix), so newer completed records from subsequent runs can still recover after an Agents recording failure. Events still in the async journal queue at a crash may be lost, as described below. (A `hub.db` from before the checkpoint whose notices were all pruned replays its journal once.)

**The journal** (spec 4.2, decision #13) is `.cland/journal.jsonl`: one JSON object per line, `{"ts":"<ISO>","event":"<event>",…}`, the hub log's own shape. It is a filter over the log closure every part of the hub logs through, so an event is journalled by being logged. It holds the domain events: `hub-started` and `hub-stopped` (written by the daemon at each start and clean stop), `config-loaded`; messages as metadata (`send`, `send-refused`, `human-send`: id, topic, sender, addressees, `bytes`, `replyTo`, outcomes; never the text); deliveries (`acked`, `injected`, `dropped`, `role-queue-claimed`); sessions (`hello`, `bye`, `rename`, `replaced`, `kick`, `refused-role`, `session-launched`, `session-model`, `subagent-launched`, `session-stopped`, `session-resumed`, `harness-exited`, `session-state`); roles (`role-assigned`, `role-cleared`, `role-clause`, `role-revoked`, `role-handover`, `coordinator-vacant`, `coordinator-filled`); topics (`topic-created`, `topic-status`); asks and the inbox (`ask`, `ask-answered`, `ask-withdrawn`, `ask-cancelled`, `notification`, #33); the tracker (`task-written`, `task-claimed`, `task-released`, `task-conflict`, `task-removed`); hygiene (`loop-breaker`, `unmuted`, `rate-limited`); and the audit records (`audit`, #30). The file is opened for appending: a restart adds a `hub-started` line after the last one and never truncates. A last line cut off mid-write (a crash) is ended with a newline before anything else is written, so it stays one unreadable line and every later record parses; a short write is continued until the whole record is out. `Journal.write(record)` enqueues a record that is not a log line. The process log, everything the hub says, stays in `.cland/log/hub.log`, through a separate ordered async append queue. The CLI and every transport use this same sink for ordinary events once serving. Startup, listener and orphan-sweep diagnostics and fatal logging errors retain stderr: a stdio parent can see why listeners failed to bind. Node writes file-backed stdio synchronously, so request-time audit and refusal events never use that sink.

**Session usage.** Each changed `session.usage` publication writes a `session-usage`
line with `session`, `sessionId`, the current store `role`, the session's launch
`item` (null without one), `harness`, `model`, `total` (`UsageCounts`, including
USD `cost` when reported), optional `rateLimits` (Codex's reported account share),
and `final: false`. Changing a claim or verifier hold does not change its charge
item. Claude Code's mod turn completions, Codex's token and rate-limit updates,
and OpenCode's steps use the same path. Every report is also written to the
launch's process row (`harness_processes.usage`) as it arrives, before the
coalesced publication, so a hub stop inside that window, a stop and an archive
keep the last totals for `session.list --json`, `session.list --archived --json`
and the workbench rows. A row written before that column existed reads as no
usage, and absent totals are never zero. Publications remain coalesced to at most
one per second per session; equal totals and rate limits write nothing, even if
the latest turn or raw token report differs. Comparison keeps one snapshot per
session in memory and reads neither tracker items nor journal history. The first
publication after a hub restart writes again.

A successful stop, harness exit or relaunch's stop writes one `final: true` line
with the latest reported usage, including an update still waiting for publication.
A session that reported no totals or rate limits writes no final line. Repeating
stop on an already stopped session writes no second final line. Tokens or cost
absent from a report are unknown, rather than zero. Read the records and sum the
latest final totals for each cland session per role and launch item:

```sh
cland hub journal --kind session-usage --json | jq -s '
  map(select(.final)) | group_by(.sessionId) | map(last)
  | group_by([.role, .item])
  | map({role: .[0].role, item: .[0].item,
      totalTokens: ([.[].total.totalTokens] | if any(. == null) then null else add end),
      cost: ([.[].total.cost] | if any(. == null) then null else add end)})'
```

Taking the latest final per session avoids counting retained conversation totals
twice after a relaunch. Sessions still running have no final record yet. The cost
sum stays null if any contributing session did not report cost; Codex's rate-limit
shares remain on the records and are not summed as monetary costs.

Launch models are recorded without reading the tracker:

- `session-launched` names the launch's `session`, `sessionId`, `harness`, `role`, launch `item` when present, and `model` (null when not yet reported). Codex's `thread/start` response and OpenCode's selected model populate the record even without an explicit model. Every successful resume or relaunch writes its own launch record with the reported model.
- `session-model` carries `session`, `sessionId`, `harness`, `role`, `item` (null without a launch item), `model` and `source: "harness"`. When Claude Code's `SessionStart` hook or the mod's turn completion first reports a model absent at launch, one line records it. Every later changed model writes another line; equal reports write nothing. The process row retains the latest reported model across restarts. A fresh resume uses the model retained on its new launch; a model learned afterwards follows the same rule.
- `subagent-launched` carries the parent `session`, `sessionId`, `harness`, `role` and launch `item` (nullable), optional `agentId` and `agentType`, and `model`, or `"unreported"` when the start reports none. Claude Code reports `SubagentStart` (`agent_id`, `agent_type`, optional `model`); both start and stop hooks are installed asynchronously, and stop does not create a launch record. [Claude's hook reference](https://code.claude.com/docs/en/hooks#subagentstart) documents the start's identity fields; the reported `model` takes precedence, with a fallback to `tool_input.model` only when that same payload supplies it. Requested-model discovery across records is not performed. Codex app-server's `subAgentActivity` item with `kind: "started"` reports `agentThreadId` and the resolved `model`; start/completion notifications of that same activity create one record. Older servers report a completed `collabAgentToolCall` with `tool: "spawnAgent"` and `receiverThreadIds`; at turn end, that signal records its reported model (unreported if absent) only for children with no resolved-model activity. OpenCode v2 reports child `session.created` events with `parentID`, `sessionID`, optional `agent` and `model`; only children of the watched parent qualify. OpenCode's `session.step.started` also reports parent model changes. These are native signals, with no model inferred from a parent or configuration and no record when the harness sends no start signal.

`cland task view T-n` lists that item's recorded sub-agent models under usage; `--json` exposes them as `item.usage.subagents`, with parent session, launch identity, harness, timestamp and optional child id/type. The list is projected from the journal, including earlier hub lifetimes, and excludes other items.

**Append and durability (T-75).** The journal uses one ordered async append queue, to keep disk latency off the shared request path. Serialization and timestamping happen when a record is accepted; producers, including concurrent requests, keep their call order, even across short writes. A tool result acknowledges the action, not journal durability. SIGKILL or a crash may lose records still queued or partially appended; a completed append is in the OS cache, with no `fsync` guarantee against power loss. Clean stop first closes request edges and finishes shutdown logging, queues `hub-stopped`, then drains and closes both log queues before releasing the project lock or resolving `stopped`. Synchronous work after each async append, repair, open, close or error is measured in a resumed request scope; the enqueue captures the originating request identity. Background roles refresh publication and error logging have their own `roles.refresh` scopes. Waiting for I/O is excluded. A disk error reports `journal-failed` directly to the process log, stops further appends to avoid joining later JSON onto a broken tail, and rejects the drain. Shutdown still releases the lock and reports the failure; a restart ends any partial line before appending new records. Queue contents are in memory and grow while storage is slow; no crash replay of those unflushed records is promised. `hub.status` with `flushLogs: true` drains records accepted before the barrier in both queues without closing them; it never replays a cached status. The barrier fails after 5000 ms if storage does not complete, leaving ordinary status calls responsive. It acknowledges append completion, not `fsync` durability; later producers may still be queued.

If SQLite fails while constructing the tracker during hub startup, the hub drains and closes the journal and process log before releasing the project lock and rejecting startup. A subsequent start can acquire that lock immediately; cleanup does not depend on FileHandle garbage collection.

**Request-path guard.** `test/session-async-processes.test.ts` instruments the native filesystem and process boundaries for the shared permission gate, allowed/refused dispatch and audit logging, alongside T-70's session process paths. The default daemon logger writes the actual process log asynchronously; a production CLI test with file-backed stderr also rejects audit writes through its synchronous sink. It rejects `statSync`, `readFileSync`, `writeSync`, `spawnSync`, `execFileSync` and `execSync` on those exercised paths. T-77 extends this coverage in `test/tracker-native-boundary.test.ts` to tracker mutations (including import), `task.view`, serving-time scans and fallback polling, and the shared session launch layer with a fake adapter. That guard rejects every exported synchronous filesystem function and synchronous process calls, including calls whose errors were swallowed. T-78 adds worktree claim/list/prune, merge refusal/landing/recovery, and release preview/publication/sync, with planted synchronous-call probes for each request path. Startup reads, native adapters' spawn paths (T-79), and the CLI journal reader are outside that filesystem coverage; T-70's production adapter process guard remains in force. `test/agents-checkpoint.test.ts` holds a checkpoint append during simulated crash recovery and proves old pruned notices stay pruned. `test/roles-snapshot.test.ts` verifies bounded refresh, last-good snapshots, deferred permission checks and replay invalidation. `test/journal-async.test.ts` verifies order, failures, the crash-loss window, drain on stop, and the request timer: a held async append allows another request to answer within the blocking budget without a `slow-request`, while a 400 ms deferred failure logger counts exactly once as resumed work.

**Hygiene** (BCAS's, decision #13): a message's size cap, a per-session rate limit and the loop breaker, which mutes a pair of sessions that exchanged more than the threshold within the window with no human message to either in between (a human message to a session starts its pairs' counts afresh). The thresholds are read from `.cland/config.toml` at hub start, so a change applies at the next `cland hub stop` and `start`; a missing or unreadable file means the defaults:

```toml
[hygiene]
rate_limit_max = 30               # messages one session may send to other sessions within the window
rate_limit_window_minutes = 10
loop_breaker_max = 20             # messages between one pair within the window before the pair is muted
loop_breaker_window_minutes = 5
loop_breaker_mute_minutes = 10    # the hard cool-down
max_text_bytes = 8192
event_limit_max = 120             # hub event deliveries one recipient may receive within the window, separate from messages (see Events below)
event_limit_window_minutes = 10
```

A refusal is typed, `{"code":"hygiene","rule":"size"|"rate"|"loop","until"?:"<ISO>"}`: the size cap and the rate limit refuse the `send` itself (the result's `error` and `refusal`; the spoke's tool answer carries both), the loop breaker refuses the outcome for the muted addressee (`outcome` `refused`, `reason`, `refusal` with `until`). When the breaker trips, both sessions get the `mute` notice (its `detail` is the refusal and the `pair`; a spoke shows `kind` and `detail` in the channel event's meta) and Agents shows it. Rate windows, pair counts and mutes persist in the `hygiene` table of `hub.db`, keyed by session id: a restart keeps a mute running. `cland hub unmute <a> <b>`, or the UI's `hygiene.unmute`, lifts a mute early and clears the pair's count.

