## Artifacts

Show a file with the spoke tool `artifact.create`:

```json
{"kind":"diagram","title":"Merge flow","content":"graph TD; A-->B","topic":"topic-3"}
```

Kinds are `prompt`, `note`, `page`, `diagram`, and `file`. Give exactly one of `content` or `path` (relative to the session's working directory). A path is copied, so deleting its source or worktree leaves the artifact readable. Text content defaults to `.md` for prompts/notes, `.html` for pages, `.mmd` for diagrams and `.txt` for files; copied files retain their extension. Files live under `.cland/artifacts/A-<n>-<slug>.<ext>`, with a durable hub index containing the id, title, kind, creator, time, topic, status and absolute path. Every create is a new id, initially `shared`; prompt creation can request `status: "draft"` to save without publishing a message.

Artifact creation keeps its index and human topic post in one transaction.
Admission or record-write refusal rolls back the artifact, post and id reservation.
Human-message publication, delivery and the `human-send` diagnostic run after
commit: a diagnostic logger failure leaves the successful response and committed
message intact and records `publication-failed` in the hub's operator log sink.
It does not request a resend or publish a duplicate. CLI, web, Neovim and native
remote send callers retain their existing result shapes and pre-commit refusals.
The [lifecycle fixture guide](../agents/tests/hub-test-artifact-lifecycle.test.ts.md)
separates write-refusal rollback from post-commit logging failure.

The result includes `artifact`, `id`, and `path`. The topic message carries a structured `artifact` field, and session deliveries name `artifact_id` and `artifact_path` in their envelope. Publication obeys the message size cap and the session's send rate limit; refusal leaves no file or index entry. The file content itself is not subject to the message text cap (wire frames retain their existing maximum size).

Creations sharing a hub index queue through file preparation, registration and failure cleanup, including automatic suite and shard logs. Concurrent requests receive distinct ids; a refused publication releases its prepared path before the next creation starts.

The Coordinator and Aides may share in any topic. Other roles may share in their claimed or assigned item's topic or a topic where a request was delivered to them; General and Agents are available to the Coordinator and Aides. Invalid kinds, missing files, unknown topics, invalid titles, and ambiguous sources return typed errors; forbidden topics return `forbidden`. The CLI enforces the same session identity and permissions as spoke calls.

```sh
cland artifact create --kind diagram --title "Merge flow" --content 'graph TD; A-->B' --topic topic-3 --json
cland artifact create --kind page --title Preview --path preview.html --topic topic-3
cland artifact create --kind note --title Findings --content-file - --topic topic-3 < findings.md
cland artifact list --topic topic-3 --json
```

`new` is the creation command; `create` remains an alias. The shell accepts directory sources, `--folder` for a new folder, and `--entry <relative-file>` to select its entry:

```sh
cland artifact new --kind note --title "v0.2 notes" --topic general --folder --content '# v0.2' --json
cland artifact new --kind note --title "Imported notes" --topic general --path ./notes --entry README.md
cland artifact open A-3
cland artifact keep A-3
cland artifact keep A-3 --release
cland artifact move A-4 A-3 --name details.md
cland artifact archive A-3
cland artifact promote A-3 docs/v0.2-notes
```

The Neovim workbench opens Markdown artifacts in a read-only rendered view using the thread’s projection, including laid-out tables and compact link tails. `␣v` (also in Keys and the palette) toggles the raw editable file; `:w` saves in raw. Each open defaults to rendered, while prompt drafts open raw. The artifacts browser opens folder entries and Markdown children through the same artifact opener; palette `CTRL-v` uses that opener for a split beside the centre. Each window toggles independently and renders at its own width. The client caches decorations by path, mtime, size and view width. Mermaid source and browser artifacts retain their existing open behaviour. See [Shared artifacts](../../nvim/README.md#shared-artifacts).

`open` launches `$VISUAL`, then `$EDITOR`, or `nvim`, on the saved file or a folder's entry. Editor settings may include quoted arguments. Saving edits those durable bytes directly; adding files to the folder needs no hub operation. `open --json` launches no editor and returns the resolved `path`, artifact metadata, `editable`, and the folder's on-demand `files` list. Old ids of absorbed files resolve to their current location. Agents can read protected human and Aide paths with `--json`, but cannot open them for editing; this includes a formerly agent-owned file absorbed into a protected folder. An Aide may edit for the human. The hub includes `editable` in single-artifact `artifact.list` results based on the caller and the containing folder's author.

`keep --release` clears the kept flag. `move` takes the source file id and destination folder id, with an optional single file name. `archive` changes the artifact's layer. These commands use the same hub frames, author protection and calling-session identity as the spoke tools. All accept `--json`; irrelevant options and extra arguments are refused. A refused lifecycle command returns an error without stopping the hub.

Directory sources are copied as a single folder artifact, with `folder: true` and a project-owned directory `path`. Its `entry` is a relative file name: supply it at creation or let the first `.md` in sorted relative-path order become the entry. `folder: true` without a source creates an entry file (`index.md` by default), optionally filled from `content`. A copied folder must contain its entry, and only regular files and directories are accepted; symlinks and special files are refused. Folder contents have no separate ids. The entry is used for prompt sending, attachments, launch briefs and opening the chip in the workbench.

`artifact.list` is also a spoke tool. With `artifact: "A-3"` it resolves that id and returns `{artifact, files}` for a folder (`files` is a sorted list of relative file names), or `{artifact}` for a file. Without an id it lists the project or a supplied topic. Files are discovered on request, so editing or adding them does not require reindexing.

Human clients can send `artifact.upload` with `topic`, `files: [{name, mime, data}]`,
optional `caption`, `to`, `kind` and `replyTo`. Socket `data` is strict base64,
within the existing 1 MiB frame cap. In-process edges pass `readonly Buffer[]`
as the fourth `Conversation.receive` argument; gateway `RemoteSend` accepts it
as the third argument after the optional ingress identity. Metadata follows the
same authority and audit path; audit keeps file count and caption length, never bytes.
The result is `{message, artifacts}`. One to ten files are validated before any
write, bounded individually by `[artifacts] max_upload_mb`. Names lose directory
components and control characters. A safe extension from the name wins; otherwise
known image/PDF/audio/text MIME types choose the extension, then `.bin`.
Invalid MIME types become `application/octet-stream`. Every MIME type is checked
for exact raw-byte matches against the shared registry of configured and rotated
secrets before file preparation and again before commit. A match refuses the
entire upload with `secret-in-upload` and a redacted filename, never a secret
value or its setting name. Accepted bytes are never rewritten. Files, their index entries
and the single human message commit under the shared artifact creation queue;
failed publication removes the prepared files. Artifact events still publish,
without a separate ▣ message. Empty captions are allowed with attachments.
Sessions cannot call this frame. Remote uploads obey General/reply authority and
record `via`; repeated trusted ingress ids return the original message and files.
Frame fields cannot choose that identity. No built-in client attachment UI or
platform media downloader is implied by this protocol seam.

The UI can send `artifact.create` and `artifact.list` frames; list returns `{artifacts: [...]}` for the project or a supplied `topic`. Drafts are included in lists and emit `artifact` events for subscribed clients. A human `prompt.send` frame (`artifact: "A-3"`, optional `attach: true`) reads the saved prompt and posts its text when it fits `[hygiene].max_text_bytes` (8 KiB by default). Above the cap, or with `attach`, it posts `Prompt A-3: <title>` with the artifact attached. The pointer is bounded to the byte cap on a complete UTF-8 character boundary; the full title remains in attachment metadata. The message and `sent` status commit together before publication: a failed post or status write leaves the draft and no delivery. A prompt already sent cannot be posted again through `prompt.send`.

The spoke's `send` accepts `artifacts: ["A-3", "A-4"]` alongside `text`, `to` and `topic`. Each id must exist in that topic, be unarchived, and have a readable file; unknown or foreign-topic ids refuse the whole send. Availability and caller permissions are checked again after asynchronous file preparation. Attached prompt drafts become `sent` with the post. Deliveries include an `artifacts` array of metadata and durable paths; `artifact_id` and `artifact_path` name the first attachment for compatibility. Attachment messages retain their text alongside chips in the workbench.

Artifact creation prepares and cleans up its files asynchronously, with serialized id reservation, indexed ownership checks, and measured request continuations. The shared permission gate reads the in-memory roles snapshot, and journal appends use an ordered asynchronous queue (T-75).
### Promote, archive and retention

The human can keep an artifact in the repository with `cland artifact promote A-3 docs/design/merge-flow.mmd`, or press `p` in the topic's artifact list and enter a project-relative path. An Aide can promote through the `artifact.promote` spoke tool or from its shell. The Coordinator can promote agent artifacts from its own shell through the `artifact.promote` grant; Implementer, Reviewer and QA cannot. The UI frame is `{"type":"artifact.promote","artifact":"A-3","path":"docs/design/merge-flow.mmd"}` and returns `{artifact}`. Promotion copies the bytes, creates missing parent directories, records `promoted` in the index, and stages or commits nothing. Existing destinations, absolute paths, `..` segments, paths under `.cland/` or `.git/` (including case variants), and symlinked parent directories are refused. After copying, a resolved path outside the project or under `.cland/` or `.git/` is removed and refused. Promotion confines paths against the project tree as it is, not against concurrent filesystem changes by other processes. The list and picker show `promoted: <path>`. Promoted artifacts keep their original source and are exempt from archive and retention.

Closing a topic, directly or by closing its bound item, marks its unkept agent artifacts `archived` and records `archivedAt`. A message reopens the topic and restores surviving automatically archived artifacts to `shared`; explicitly archived artifacts stay archived. Archived files are deleted in the background at hub start and daily after `[artifacts] retention_days` (default `30`; `0` makes them eligible immediately). Deleting a closed topic leaves its archived entries eligible for retention. The index entry remains with `fileDeleted: true`, shown as **file deleted** in the CLI, topic list and picker. Reopening a topic does not restore deleted artifacts. Artifact-change events update connected workbenches.

Artifacts record immutable author kind and role at creation. The human's and Aides' artifacts are never archived or deleted automatically, including after the author changes role. A manual archive only changes their layer. `artifact.keep {artifact: "A-3"}` sets `kept: true`, exempts an agent artifact from retention; `kept: false` releases it, archiving it if its topic is already closed. Keeping an archived artifact restores it to shared. A kept artifact is classified `watch` in the shared classifier (T-205). `artifact.archive {artifact: "A-3"}` explicitly archives it. Agents cannot mutate a human or Aide artifact through these tools, move, or promotion; an Aide may act for the human.

`artifact.move {artifact: "A-3", folder: "A-4", name: "notes.md"}` absorbs a file into a folder. `name` is optional and defaults to the original file name. Existing names, dot segments, folder-to-folder moves, moved sources and destinations the caller cannot edit are refused. A human or Aide file requires a human or Aide folder so absorption preserves its protected lifetime. The source index becomes `status: "moved"` with `movedTo: {folder, path}`; it disappears from ordinary lists and follows the destination folder's lifetime. The old id still resolves through `artifact.list`, history chips, attachments and launch briefs to its file inside the folder. Move publishes the redirect before removing the old hard link; a housekeeping failure returns success with `followUp`, and retention retries removal without deleting a different file recreated at the old path.

Folder retention uses a rename to a deterministic `.retained` directory until the index commits. Failed index writes or a concurrent keep/reopen restore the entire folder; interrupted cleanup recovers on the next sweep. Deletion or housekeeping failures remain retryable. Ordinary file retention keeps its existing hard-link recovery.

Each retention pass decodes one artifact-index snapshot for enumeration, including moved files. Pending moved-child deletion checks and folder deletion housekeeping use the destination index; checks after filesystem I/O still read the current artifact records. Artifacts added during a pass are enumerated on the next pass.

`artifact.delete {artifact: "A-3"}` is a human-only UI protocol frame, used by Neovim's confirmed `x` action. The web authority policy refuses deletion; desktop web Artifacts offers Keep (`k`) and Archive (`d`). Agent sessions, including session-attributed client frames, are refused; there is no agent tool or CLI command. It removes the artifact’s stored file or folder and retains `fileDeleted: true` in the index. A moved id deletes its file inside the owning folder. Artifact events update the browser and deleted chips in topic history. Promoted project copies are retained.

The built-in role tool lists now grant `artifact.keep`, `artifact.move` and `artifact.archive`. Existing explicit `roles.toml` lists need those grants added; `artifact.list` uses the existing history/read grant. No role clause changes are required.

Folder promotion copies the entire tree, including nested files, binary bytes and empty directories, into a new project-relative directory. The destination names that directory; it must not already exist, even if empty. Symlinks and special files added to an artifact after creation are refused, and the saved entry must still exist as a regular file. Promotion reserves the artifact across the copy and removes the entire partial destination on copy, permission or index failure. The source remains in the artifact workspace, and Git's index and commits are untouched. The same confined-path rules apply to folder promotion, including nested `.cland` or `.git` paths.

`cland init` writes `[artifacts]` with `retention_days = 30` and `max_upload_mb = 50`. The upload limit is a positive per-file MiB count and applies after a hub restart. `cland update` adds that section to managed configurations that lack it and keeps changed values, including zero. It leaves unmarked config files and existing `roles.toml` files alone; an existing explicit Coordinator tool list needs `"artifact.promote"` added by the human.

Promotion reserves its artifact across asynchronous I/O, rechecks permission and the latest index state after copying, and rolls back its exclusive destination if the index write fails. A notification failure after the index commit keeps both the copied file and its promoted mark, returning a successful result with a `followUp` warning; a retry sees the existing promotion. Subscriber and error-logger failures cannot reverse committed promotion, archive or reopen state. Retention retains a hard link until deletion and its index write finish, so a topic reopened during deletion or an index write failure restores the original bytes. Interrupted retention is recovered on the next sweep; failed housekeeping is retried. A concurrent promotion/cleanup of the same artifact is refused with `artifact-busy` and can be retried.

### Harness termination and orphan sweep

`cland session stop <name>` waits for the launched OpenCode server, Codex app-server or Claude Code process tree to exit. All termination callers reserve the captured PIDs in a shared machine registry (`/tmp/cland-termination-<uid>`), including late descendants, and retain their reservations through final verification and recovery thaw. Overlapping callers wait for the owner, reverify identities, and report completion only when they terminated the tree themselves; disjoint trees can finish in parallel. Reservations use crash-recoverable PID/start-time owner locks and do not depend on the caller’s project or TMPDIR. It verifies each PID’s recorded start time immediately before signalling that positive PID, sends SIGTERM, and escalates after the grace period (`CLAND_STOP_GRACE_MS`, default 5000 ms). Before SIGKILL, it freezes verified PIDs with SIGSTOP, walks the tree again to capture and stop late children, and confirms the entire captured tree is stopped. It then kills each verified PID and confirms that every captured identity is gone. It never signals an entire process group: new group members cannot inherit ownership from an earlier snapshot. Every exit path sends SIGCONT to the PIDs this call stopped unless their identities are confirmed gone, including when process inspection is unavailable. If death or PID reuse happens without being observed before inspection fails, this recovery SIGCONT can reach a replacement process; the policy accepts that tradeoff because CONT does not stop or terminate a running process, although it can invoke that process’s SIGCONT handler. A refused or unverifiable escalation reports incomplete termination. Relaunch waits for that same termination before starting the replacement. `harness-ended` in `.cland/journal.jsonl` names the server PID, captured descendants and whether killing was necessary. An unverifiable PID is never killed; stop/relaunch fails and retains its running row and supervision.

Production startup sweeps unless `CLAND_TEST_SKIP_ORPHAN_SWEEP=1` is set. The `startDaemon` test fixture sets it by default, logs `orphan-sweep-skipped`, and accepts `{ sweep: true }` as its fourth argument for sweep proofs (an explicit environment value wins). This changes only the startup sweep, not doctor or on-demand cleanup.

After opening its sockets, a new hub sweeps this project’s harness servers whose session is exited, stopped or offline, or whose process-table row is missing. Ownership requires a verified OS cwd under this project or descent from a PID/start-time-verified wrapper with a project cwd. When a process row exists, its recorded PID and start time must match; an unknown start time or reused PID is preserved even when socket or log hints match. A recorded launch, project-specific Codex socket/log or OpenCode `serve.log` identifies candidates but never proves ownership alone. This also covers a Codex socket placed under the temp directory because the project path is too long. Verified running roots and their descendant trees are preserved for resume. Pending launch and resume reservations also protect servers before their process-table rows are published; the sweep rechecks these protections immediately before every signal. A PID/start-time-verified lock under `.cland/run/orphan-sweep.lock` serializes startup and doctor sweeps per project; a contender reports “sweep busy”. Within one sweep, workers atomically claim each process they capture, and ancestor candidates settle before queued descendants are reassessed. Cleanup runs in parallel in the background with a shared 12-second deadline, so it cannot delay socket readiness. Startup points to `cland doctor`, which reports the PIDs ended since the latest hub start from the journal (`orphan-ended`). Ambiguous candidates are reported as `orphan-preserved` and left alive. Sweep diagnostics also reach stderr.

Hook bridges retry an unavailable hub for at most 60 seconds, rereading discovery
so a restart within that grace can reconnect. Missing discovery, a refused bridge,
and a socket that never completes the handshake share the same deadline. Successful
attachment resets the grace; stdout failure and parent changes also stop the bridge.
Expiry tells the Claude mod to stop restarting that bridge.

`cland doctor` also lists the calling user's hook bridges whose explicit hub file
is missing. `cland doctor --fix` safely ends these with PID/start-time revalidation
and a fresh absence check before each signal. Any existing hub file is preserved,
even if malformed or unreachable. Ambiguous flattened arguments (including paths
with whitespace), inaccessible files and unknown user identities are preserved.
This is the supported cleanup for future orphan bridges; manual process killing
is unnecessary.

Fixture clients, stdio stubs and explicitly test-launched hubs also hold a private
PID-bound ownership receipt open under the scratch root's private
`.fixture-sockets/owners/` directory. Disposable `roots` name only allocated
scratch directories; optional `sourceCheckout` records a non-disposable process
association separately. Fixture allocation grants the root in the allocating
process or its sealed child environment; receiving a caller's path grants nothing.
Headless QA carries its grant through an allocator-owned fixed-root Node preload,
with file bytes and identities checked before launch; the case environment has
no fixture grant keys. The shim/preload are removed with the joined QA run root.
An optional hub or stdio-stub receipt refusal emits a structured
`fixture-ownership-refused` stderr line and leaves the hub serving without receipt
authority for that root. The diagnostic retains the producer's reason, native
code and secondary cleanup codes; unavailable causes remain unknown. Startup and doctor discover these fixtures when a scratch
root has disappeared; `doctor --fix` requires the open
receipt, its private same-user file metadata, the process UID and fresh PID/start-time
checks before termination. Old fixtures without receipts appear as ambiguous
candidates and are preserved. Command lines and environments are never printed or
used alone to authorize signals. Task pruning, creation rollback and merge-batch
checkout removal stop receipt-bearing fixtures associated with that worktree and
observe completion before Git removes it; incomplete cleanup keeps the worktree.
When a deleted-project hub has both OS project ownership and a fixture receipt,
doctor reports it once as `orphan hub`; the hub classification takes precedence.
During authorized source-worktree removal, process selection reads
`sourceCheckout` and joins the receipt's PID/birth-bound fixture processes even
when their scratch roots lie elsewhere. The metadata is never a directory
traversal or removal target, nor an independent grant to remove that checkout.
Fresh observed cwd can also associate a receipt-bound fake-Claude process with
an authorized project removal. Its allocated home remains the disposable root;
the cwd observation grants no directory cleanup authority.
Previous version-1 local receipts without the optional field retain scratch-root
selection only; unsafe legacy global receipts are refused.
Source association takes effect when the running hub uses this reader; an older
running hub retains scratch-root selection until restarted onto it.

Neovim fixtures inherit the receipt as explicit child fd 3. Unix spawn clears
close-on-exec for this descriptor; the parent's copy then closes. Linux discovery
reads `/proc/<pid>/fd` symlinks, while macOS uses `lsof`. Receipt birth windows
include the second before the parent's spawn interval: Linux `ps lstart` adds
whole boot seconds to truncated start ticks, which can report that earlier second.
Open-file, UID, PID and fresh start-time checks remain required; the margin alone
never establishes ownership.

`cland doctor [dir]` reports orphan servers, names their recorded session and status, and recommends `cland doctor --fix`. The fix ends verified orphan harness servers while preserving running sessions and unverifiable identities. An unpublished server is preserved while another live hub holds the project lock, because doctor cannot see that hub’s in-flight launch reservations; stop that hub before retrying cleanup. Doctor also reports cland hub daemons whose project directories were deleted, using their OS cwd and open project files to prove ownership, and `--fix` ends those daemons. Doctor tests scope deleted-project discovery to their fixture root with `CLAND_TEST_ORPHAN_ROOT`, so parallel fixtures cannot end each other’s hubs. If the OS cannot supply ownership evidence, inspect the candidate manually. On Linux the sweep reads `/proc`; on macOS it uses bounded asynchronous `lsof` calls. Every session start-time probe and termination probe uses asynchronous `ps`, keeping process inspection off the hub’s synchronous request path. Concurrent start-time reads with the same timeout and timezone share one `ps -p a,b,c` per event-loop turn; callers for an already in-flight PID share that read. Results are removed before callers resume, so a later read still detects PID reuse.

### QA brief lint

`cland qa lint qa/briefs/T-957.md` checks a brief offline against the help and built-in role permissions in the executable build, and flags literal test/member/item totals. Aide verification rows share runtime report-grant and mode/occasion decisions: use an explicit report topic and session-name recipients; default Coordinator-role addressing, broadcasts, `all` mode and integrated occasions are refused. Report-free previews skip publication grants; live configured grants and topic/recipient existence remain hub checks. Named test files, declared titles, Node test patterns and simple literal selectors are checked against committed source (selectors under `web/src`). Run from the build repository root; `--commit <sha>` pins source instead of default HEAD, and uncommitted source is ignored. Keep the executable on that build for matching help/roles. It executes no brief commands, needs no hub and runs with development dependencies pruned. Static verification policy is shared with runtime admission through a dependency-free module; offline lint does not load hub transport or executor credential helpers. Exit 0 means no blocking findings, 1 lists one `file:line` blocking finding per line, and 2 means a usage, file-read or build-source read error. Derive test totals from generated cases and membership with `cland task plan show <item>`. See [QA brief lint](../agents/qa-brief-lint.md) for reference syntax and static-check limits. Run it at the build under test before requesting item or stage QA. The brief is complete only when qa lint passes at the build.

Commands in table command/method/action/note columns are checked for known subcommands and flags; check IDs must be unique across case/manual tables and surfaces must match the recorder: `headless-grid`, `tmux`, `web-terminal`, `hub-api` or `real-browser`. A `role` or `actor` column, `Role: Implementer`, or a heading naming a role assigns commands to that built-in role. Implementer verification reports cannot target General or Agents; `topic create` needs a nonempty `--item` binding for that role. Variable `rm` operands in commands and shell fences fail even behind a path guard. Use literal cleanup paths. This static check does not resolve shell helpers, claims, live topic ownership or custom grants; the hub remains authoritative. See [QA brief lint](../agents/qa-brief-lint.md).

Web briefs include local `real-browser` cases run by QA on Codex `gpt-6-astra` through computer use under a brief naming that surface. Open the `cland web` link in the dedicated cland QA browser profile; keep fixture commands in sealed disposable projects. Touch only the cland page and its browser permission prompts, save screenshots under `.cland/qa/<item>/<run>/`, close the opened tabs and record with `qa-record.sh note`. Implementers and Reviewers never launch the real browser or GUI on the human’s Mac. Never press Reset or change keychain, profile or system settings; Cancel unexpected dialogs and report any that cannot be cancelled, missing permissions/profile or harness refusal to the item lead as a blocker. See [review and QA](../review-and-qa.md#web-qa-in-the-real-browser) and the qa skill’s Web briefs procedure.

### The item’s review and QA loop

The Implementer’s claim makes it the item lead. After committing and pushing its branch to `origin`, it sets status `review` and sends kind `report` to `reviewer`, first line `review request T-<n>`, naming branch/head, criteria and scope. Reviewer and QA accept requests from that claimant, a supervising Lead within its subtree, or the Coordinator. For QA, the Coordinator writes and commits `qa/briefs/T-<n>.md` before launch; the lead names it in `qa request T-<n>`. Without a brief, the lead requests review only, unless QA is required: a missing brief or verifier is a blocker to report to the Coordinator.

Verifiers take `task.hold`, record their verdict and report with kind `report` to `lead T-<n>` in the request topic. The claimant fixes not-clear findings, pushes and requests another pass itself. The hub checks current verdicts and marks the item `ready`; that one status event starts the supervising Lead’s or Coordinator’s turn and stands for the lead’s ready report. The supervising Lead or Coordinator merges through the gate without relaying verdicts. Keep the claim until merge. For unclaimed items the lead address resolves to the Coordinator; a closed item has no lead and also resolves to the Coordinator, while an unknown item must be addressed to `coordinator` directly.

Routine updates use kind `progress` and wait for the next turn; requests, verdicts and blockers use `report` or `question`, decisions use `decision`. Coordinator reports to the human appear in Watch, while questions and decisions needing attention appear in Now. Default subscriptions handle the lead’s intermediate events; use `subscribe` for additional subjects and `subscriptions` instead of polling. See [review and QA](../review-and-qa.md).

### Event subscriptions

A session calls `subscribe({ subject: { session: "impl-3" }, events: ["session.state"] })`
or `subscribe({ subject: { item: "T-58" }, events: ["task"] })`. It gets a subscription
with an `id`, `subject`, `events` and `digest: "turn"`. Repeating the same request returns
the same id. `subscriptions()` lists only the caller's subscriptions;
`unsubscribe({ subscription: "<id>" })` removes one of its subscriptions. These tools
are available to the crew roles (Coordinator, Lead, Implementer, Reviewer and QA). Aides cannot subscribe; retained explicit subscriptions from a previous role do not deliver events while the session is an Aide. An Aide claimant receives its item's default subscriptions as direct lead deliveries. Existing projects can grant `subscribe`,
`unsubscribe` and `subscriptions` in each role's `permissions.tools` list.

The CLI uses the same subscriptions and the session identity of a launched shell:

```sh
cland subscribe session impl-3 --event session.state
cland subscribe item T-58 --event task
cland subscriptions --json
cland unsubscribe <subscription-id>
```

A known-session `--as <session>` claim requires that session's credential and is
checked against its hub-held permissions. A session can subscribe to a
session name before it launches. A rename moves session subjects to the new name;
subscriptions belong to the subscriber's stable session id, so its own rename keeps
them. Item and subtree subjects must name existing items; topic and role subjects
must exist. A subtree includes its root and all descendants, following the current
item tree. Item/subtree events also include sessions working on those items and
artifacts/topics bound to them. Role subjects follow sessions holding that role,
including their usage and artifacts. Session subjects support `session.state`,
`usage` and `artifact`; topic subjects support `topic` and `artifact`.

Session events are idle, busy, waiting for human, waiting for approval, launched,
stopped and died. Task events are status changed, claimed, verdict posted and closed.
Topic events report waiting for human, closed and deleted; artifact events report created
and shared (including a sent prompt). Usage subscriptions require exactly one
positive threshold, `{ cost: 3 }` (USD) or `{ tokens: 1000000 }` (total tokens).
A threshold crossing is remembered per subscription and session across hub restarts;
updates remaining above it do not repeat the event. Unknown cost does not mean zero.
Overlapping subscriptions deliver the same occurrence once per recipient.
Each is a one-line delivery from `hub`, for example
`event · session.state · impl-3 died · T-58`. Only the hub emits kind `event`;
a session's `send` cannot use it.

Events remain queued without starting a turn. They join progress notes, in recorded
order, in the ordinary recipient-specific digest with the next turn-starting delivery.
Subscriptions and queued events survive a hub restart. Every recipient row, including
mixed turn/now modes and coalesced counts, commits together before publication or
steering. Observer, transport and logger faults after commit are isolated and logged;
they leave the committed rows and artifact bytes intact. Events use the same delivery
stages, acknowledgement, injection, immutable retry batches, TTL, retention and
message-deletion rules as progress. Unsubscribe stops future matching events when
it returns; events already recorded remain queued or bound to their existing digest.
The UI's connection-scoped `subscribe` stream frame is unchanged: session tools use
`event.subscribe`, `event.unsubscribe` and `event.subscriptions` frames.

Use `digest: "now"` to deliver immediately through the same queue: Codex and OpenCode
steer a running turn or start one while idle; Claude Code and unmanaged sessions
fall back to the next-turn digest. The CLI accepts `--digest now`, `--cost 3` and
`--tokens 1000000`, with subjects `session`, `item`, `topic`, `role` and `subtree`.
For example:

```sh
cland subscribe subtree T-50 --event task --event topic
cland subscribe role implementer --event usage --cost 3 --digest now
cland hub subscriptions --json
```

Consecutive equal events on the same concrete subject coalesce while queued and unbound within
60 seconds of their first occurrence, with `×N` on the delivered line. A different
event for that subject breaks the run, preserving every lifecycle transition. A bound
recipient's batch never changes; another recipient can still coalesce its own
unbound row. A digest shows at most 10 event lines, prioritizing final subject facts
and then the oldest events, with `and N more` for overflow. Progress notes remain
uncapped. All underlying event rows move through acknowledgement and injection
with the batch, including the summarized rows.

Stopping or losing a subscriber ends its subscriptions. A session stop/death, an
item close/removal or a topic close/deletion sends a final event and ends subscriptions to
that exact subject, including a subtree's root. A role or subtree subscription
survives the death of a member. Removal uses the item's pre-removal ancestry;
reparenting sends a final membership fact to subtrees the item left. Startup
reconciles committed stops and persists their final-event checkpoint with cleanup,
so another restart does not repeat them. Reopening or relaunching an exact subject requires
a new subscription. Unsubscribe and lifecycle closure leave previously recorded
events in their existing queue/batch.

Events have a separate durable recipient limit under `[hygiene]`:
`event_limit_max = 120` and `event_limit_window_minutes = 10`. Each occurrence,
including a coalesced occurrence, uses that allowance; final subject events bypass
it so closure is reported. Events consume no message or pair-loop allowance.
The human's `cland hub subscriptions` lists all session owners and subscriptions;
sessions keep caller-only `subscriptions`. Subscriptions create no inbox entries.
The journal records event ids, subjects, kinds, recipients, counts and limiting,
never bodies.

Default subscriptions are derived from the current item claims. The Coordinator covers
open items without an active lead in their ancestry (an Implementer or Aide claimant, or a
container Lead on an epic or release node); each lead covers its claimed items and their
descendants, excluding subtrees with their own active lead. Ownership walks up to the nearest active lead using stable session
identities; anonymous hellos retain distinct provisional name identities. Both subscription listings include these rows with `default: true`, a stable
`default:<session-id>:<item-id>` id, `events: ["task", "session.state"]` and `digest: "turn"`.
They follow claims, handovers, renames and reconnects; `unsubscribe` removes only
explicit requests. Closing an item delivers its final event and removes its default.

Default task events cover status changes, verdicts and final close/removal events.
A transition to `ready` also reaches the item's supervising lead (the nearest node Lead above the item, else the Coordinator) with `digest: "now"`, even without an explicit subscription; it starts a turn through the ordinary queue on adapters without steering. Intermediate claimed-item events stay lead-only and digested. Explicit subscriptions may widen this traffic, and overlap still delivers once per recipient;
claim events require explicit subscriptions. Default session events cover death/stop, waiting for approval and idle beyond
`[inbox] idle_minutes` (30 minutes by default, zero disables idle events). Launched
item membership and current claims or Reviewer/QA holds identify which items a
session works on, including pooled verifiers. A lead's own death/stop or long idle
reaches the next active lead up the item tree, falling back to the Coordinator; a
disconnected lead still receives queued events. A verified stop ends ownership even
when its durable cleanup receipt remains pending. Ordinary
busy/idle, launch and waiting-for-human transitions require explicit subscriptions.
Explicit requests can also widen the event types or request `digest: "now"`; an
overlap still delivers an occurrence once per recipient. Verdicts, deaths and long
idles also create journal records shown in the events view. Harness approval prompts remain in the inbox
because they require the human to answer.

### Crew staffing

`.cland/crew.toml` is committed project staffing policy. Init and the first hub start write it once; init/update preserve existing files. `roles.toml` continues to hold role definitions, permissions and harness defaults.

The top-level `idle_from` is an ordered list of open category ids, default `[]` (never take category work). `cland crew set idle_from C-216` sets one; a TOML list sets several, and `'[]'` clears it. Any recognized kind prefix resolves by number and is saved as `C-<n>`. Setting it refuses unknown items, non-categories, closed categories and duplicates, including aliases of the same number. On hand reload, invalid category references stay in the file and are ignored individually; `cland crew show` and `--json` list each reason while the remaining staffing stays in force. The reload reads the tracker once, and later item changes are reflected on the next reload.

The top-level `leads` is a unique list of configured container kinds (empty for a flat crew). Additional root kinds, including category, are refused: the Coordinator leads them. Tables `[crew.<role>]` accept `policy` (`per-item`, `per-group`, `pool`, `singleton`), optional positive integer `size`, boolean `keep_context` and `subagents`, and `stop_after` (`merge` or `never`), plus `heartbeat` (see Role heartbeats below). Unknown roles and keys are refused. Missing roles/keys take built-in defaults: Coordinator singleton; Lead per-item; Implementer per-item stopping after merge; Reviewer pool of one with kept context; QA singleton; Aide per-item without a cap. Only Coordinator and Lead allow sub-agents by default. Pool size defaults to one; singleton size must be one. Per-item/per-group size may be omitted for no cap. `per-group` staffs one session per lane in an epic plan. The Coordinator or Lead gives it the ordered ids and keeps it alive until the lane finishes, switching to each next task worktree after merge. Stage order and reuse are role-clause instructions; the hub does not schedule stages.

`cland crew show [--json]` returns the effective policy and its summary. `cland crew set reviewer.size 2` validates and atomically saves a complete TOML file; values accept TOML booleans, integers and quoted strings, or bare policy names. `cland crew set leads '["epic"]'` changes lead levels. Set normalizes the file, including filling omitted defaults. The human, Coordinator, Lead and Aide may set it; other session shells may show it. No role-clause or permission-file changes are needed.

The hub reloads every 500 ms off the request path. A malformed, invalid or missing file emits an Agents refusal notice to the Coordinator and retains the last good crew (built-in defaults before the first valid load). Set refuses to overwrite an invalid file. `crew.show` returns `{config, summary}`; `crew.set` takes `{key, value}` and returns the same shape. `hub.status.crew` carries that snapshot, and a `crew` event carries `{config, summary}` when the effective policy changes. The sessions panel header follows both snapshots and events, for example `impl per item · rev pool 2 · qa 1 · leads: epic`.

`session.launch` enforces the role's cap, including launches still being prepared, live spokes and supervised failed-launch cleanup. A singleton admits one running session; a smaller cap after reload prevents new launches and leaves existing sessions running. Failed admission releases its slot. Role exclusivity from `roles.toml` still applies.

For `pool` with `keep_context = true`, an item launch returns an idle member before starting another harness. Read the returned `process.name`: it may differ from the requested name. Reuse preserves native identity and context, updates `process.item`, and delivers an optional text/artifact brief through the ordinary message pipeline. A member with a current claim/verification hold, pending ordinary delivery, in-flight injection or lifecycle operation is unavailable. With `keep_context = false`, verifiers launch fresh and the cap still applies; stop an existing verifier to make room. An Implementer pool instead restarts an idle member with a fresh conversation.

Retained Reviewer and QA pools launch at the project root; their brief names the item, branch, head and task worktree to inspect. Other roles reuse only when the working directory matches. An idle Implementer pool member moves to the next item's worktree by stopping its old harness and launching a replacement there, keeping its name and pool slot. With `keep_context = true`, Claude Code resumes the native conversation with `--resume`, Codex uses `thread/resume` with the new cwd, and OpenCode reloads the native session and moves its stored location with [`session.move`](https://github.com/anomalyco/opencode/blob/dev/packages/protocol/src/groups/session.ts), waiting for that location before delivering work. With `keep_context = false`, the replacement starts a new native conversation. A requested different harness selects a matching member or launches fresh within the cap.

Every replacement gets a fresh cland session id and launch token; native conversation history is the only identity carried over. The ordinary launch admission, failed-spawn supervision, role clause, brief delivery and claim path apply to the replacement. The next brief is validated before stopping the old harness; missing native conversation identity refuses a retained handoff. Current claims, pending deliveries and lifecycle work prevent selection, and overlapping stop/resume requests cannot interrupt a reserved handoff. The verified stop releases the previous worktree for ordinary merged-item cleanup. A failed restart reports a launch error and takes no next-item claim. Reuse is recorded as `session-reused` in the journal and an Agents notice; restart entries also name the previous cland identity and whether context was kept.

After a successful merge closes the item, the hub stops its launched sessions whose current policy is `per-item` with `stop_after = "merge"`, before worktree cleanup. `stop_after = "never"`, pools and per-group sessions stay running. A stop failure returns a merge follow-up failure, preserving the landed commit; retry the merge to finish that follow-up. Failed/refused merges stop no sessions.

Role delivery appends the current crew's sub-agent rule to every clause, both at native first-turn spawn and at assignment/reconnect. Sub-agents report to their parent, never use its hub connection, and count to its cost. The Coordinator also receives the configured `leads` levels, or the flat-crew instruction when empty, and the active `idle_from` categories in order with their titles (or the rule that category work is never taken). Its base clause takes the lowest-ranked open, unblocked task of the first named category with one when the current release has no unblocked task; an epic in a category waits for promotion. Crew reload delivers updated clauses to live holders. Existing projects need only the Coordinator staffing sentence in `.cland/roles.toml` updated; sub-agent and level values come from `crew.toml`.

### Drafting and approving an epic plan

The Coordinator or the epic's claimed Lead runs the shipped `plan-epic` skill before work starts. Its `draft.mjs` helper reads the tracker and crew and emits a dependency-ordered first draft; the skill chooses QA policy and criteria before setting it through `cland task plan set`. Leads may set only their own epic plan.

`[plan] approval = "none"` is the default. With `"human"`, item-bound Implementer launches under an epic are refused until its accepted plan is approved. `cland task plan approve T-<epic>` and MCP/frame `task.plan` with `op: "approve"` are for the human or an Aide only; even the Coordinator cannot approve. Approval starts no session itself: the Coordinator or Lead starts the first stage afterward. `task.plan show` and `task view` expose `approval` with `required`, `state` (`pending`, `approved`, `not required`) and, when approved, `by` and `at`.

The epic file persists `plan_approval` (accepted-plan hash, approver and time); normal writes and hub restart preserve it. Changing the accepted plan makes its prior approval stale; repeating approval on the same plan is idempotent. Broken plan saves retain the previously accepted plan, and a broken candidate cannot be approved. The workbench's `gp` plan card reads this state; `a` approves through the hub and refreshes the card. Neovim retains `gp` and `:Cland view plan <id>` navigation issued after connection until its initial `task.list` and `hub.status` tracker snapshots settle. It then opens the owning epic or reports a missing item/no epic; a failed snapshot reports its error. The latest plan request wins, another view cancels it, and disconnect clears it. A delayed initial `role.list` reply also fills empty launch defaults for a role already selected in the open launcher, preserving typed fields and a different harness. These are client-side reads; no launch or plan mutation is replayed.

Stage order guides launches through the role clause. Finish the current stage's merges and any after-stage QA before starting the next. Under `per-group`, keep one session for each lane, even across its item merges; `stop_after = "merge"` applies when the lane has finished. Other crew policies retain their rules.

### Stage QA verdicts

For a stage with non-none scope and `when: after-stage`, its items merge on review; their QA-marked criteria still require QA verification before merge. An after-stage item override also requires stage QA, even under a per-item or none stage default; stage progress reports the strongest required after-stage scope. After every stage task lands on dev or qualifies as evidence-only below, QA runs the committed `qa/briefs/T-<epic>-stage-<index>.md` on that build and records `task.comment` on the epic with `verdict: qa`, `stage` (the exact plan stage name), `result`, `run`, and `commit` (the full tested dev SHA). The CLI adds `--stage "<name>"` to `cland task comment`. Only a live QA session can supply stage evidence; a review, human shell or file-only header cannot close it.

The hub checks that stage tasks are closed with dev landing receipts or qualify as evidence-only: closed `done`, no branch, no landing receipt and no `Item:` trailer on dev. A task with a branch needs its landing receipt even when its branch has no commits. Evidence-only tasks count in the stage’s `merged` completion count, while `task.view.merged` still identifies actual dev landings. The history check runs in the background once per dev tip; an unknown or failed read keeps the stage open, with retries on later plan reads at most once every two seconds. Stage QA and platform-cover requirements still apply. The hub checks that dev contains the recorded merges and that the verdict commit equals the dev tip. It rereads the plan, files and build before publishing. `task.view` and `task.plan show` expose `stages`, each with name, policy, item ids, open/closed state and latest hub stage verdict. A clear current stage verdict closes only that stage; not-clear keeps it open. Its snapshot covers the stage's lanes, policy, item overrides and merge records. Later dev descendants preserve that closed stage. The hub checks build ancestry in the background; an unknown or failed check, a dev rollback, changes to the snapshot or reopening a member keep it open until its evidence qualifies again. The historical verdict remains visible. Without a saved closure checkpoint, cover selection checks paired Linux candidates newest first and waits for an unresolved newer candidate before considering older history. Trees without a macOS cover are checked only for the expected-tree Linux fallback. Saved closures retain their recorded pair while their existing snapshot and ancestry checks apply. A broken plan cannot receive a stage verdict. Altered or missing hub verdict headers invalidate closure.

Transient Git ancestry errors retry on the background tip schedule, at most once per two-second interval. Restoring Git can close a qualifying stage at the same dev SHA; no new commit or hub restart is needed. A completed negative ancestry check keeps it open.

The Coordinator or epic's Lead uses the qa skill's `STAGE-BRIEF.md`, commits the brief on dev and sends `qa request T-<epic> stage <name>` with the brief and dev SHA. QA uses a clean detached worktree, records every check under the epic id, and reports the stage result. After not-clear, the Lead adds finding items to the stage through a plan change, lands fixes, and requests a new run. Stage order continues through role clauses; no new launch scheduler is introduced. Stage verdicts do not mark epic criteria and cannot substitute for the separate final epic Definition of done QA run.

Plan-change notices in Agents expose `detail.item`, `by`, `previous` and `plan`, plus an optional `reason`. They are journalled and replayed with the same notice id after restart. `task.plan show` also returns ordered `history` entries (stable id, timestamp, author, previous/current plan or approval, and optional reason); `task.view` exposes them as `planHistory`. The tracker restores that history from the journal at startup, preserving publication order even at identical timestamps. Its history is independent of the Agents message retention window, so unrelated notices cannot hide unseen plan changes. `cland task plan set T-n --file plan.yaml --reason "why"` and the MCP/socket `task.plan set` field `reason` record that explanation only after successful publication. Refused plans create no change notice. Unchanged plans create a history entry when an explicit reason or large-task exception records a decision. Hand saves retain the `hand` author and do not invent a reason. Neovim keeps its per-machine last-look receipt in `ui.json`; it does not approve plans or alter tracker state to acknowledge a view.

Topic history accepts an optional `before` message id to page older retained messages in chronological order, including messages with equal timestamps. Each page retains the existing 200-message cap.

### Tracker id prefixes

An item's number is its identity. The hub returns the kind's canonical prefix (`R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec; `C-` category). Configured containers use their first letter, with collisions within the configured ladder refused. `task.view`, every task tool, item lead addresses, subscriptions and plan lanes accept any recognized prefix in either case, or a bare number. `T-107`, `R-107` and `107` resolve to the same epic `E-107`, even while its file is named `T-107-…md`. `A-12` is an artifact reference, not an item id.

Numeric resolution uses the indexed `tracker_items.n` column. The derived index and new ownership/evidence rows use a stable numeric lookup key spelled `T-<n>` internally; reads accept all kind prefixes and project canonical ids. Existing claims, holds, accepted plans, merge receipts, written verdicts, topic bindings, subscriptions and pending verification records are read by number without a startup rewrite. The process table projects its saved item reference through the same resolver. No journal, message, body, comment or branch is rewritten. Plans retain their reference spellings for approval hashing and compare lane membership by number.

New files and their frontmatter ids use the kind's prefix and one shared counter. Kind changes keep the number and slug and rename the file prefix. Duplicate numbers index once, prefer the file whose prefix matches its kind, log `task-duplicate-number` with both names and show a warning in `task.view`. The hub publishes the prefix table as `hub.status.tracker.prefixes` for Neovim.

### Task sizes and regression links

Tasks filed through CLI or MCP require `size` (XS, S, M or L), assigned ex ante by the author; other kinds refuse it. `task.create` without it returns `a task needs a size: XS, S, M or L`. Use `cland task create "Rework" --size S --regression-of T-321` with a landed target, and `cland task edit T-n --size L` to change a class; size cannot be cleared. `task.create` and `task.edit` refuse XL with instructions to split; existing XL and unsized files stay readable. Required size is checked only at the request layer, so GitHub import and internal `Tracker.create` callers stay compatible and sizeless.

Optional task `regression_of` names a closed task with a landing receipt on dev. Any recognized prefix or bare number resolves; reads show the target's canonical prefix. Create or `cland task link T-n --regression-of T-321` sets it, and `--regression-of none` (MCP null or none) clears it. Non-task, open, unlanded and self targets refuse with their reason. Both fields are file frontmatter and indexed columns used by `task.list`, `task.view` and task events, without list-time item reads. Every filed item carries a `## Summary` of one to three sentences; filing clauses and skills include the size and regression rules.

Offline `cland task migrate --sizes sizes.json --dry-run --json` previews a JSON id-to-size assignment map; omit `--dry-run` to apply. It fills only unsized open tasks, preserves existing sizes and closed tasks, and reports missing author decisions as unresolved. No size is guessed. It uses the existing migration startup lock and preflight safeguards. See `docs/agents/issue-tracker.md` for the backup, count review, idempotent rerun, suggested E-270 assignments and scratch-copy procedure. The Coordinator applies during the restart carrying T-331, then relaunches every role session including itself to refresh MCP schemas and clauses.


### Role heartbeats

Each `[crew.<role>]` in `.cland/crew.toml` accepts `heartbeat = "30m"` or
`heartbeat = "off"`. Durations use integer `s`, `m`, `h` or `d` units and must
be at least one minute. An omitted Coordinator setting defaults to `"1h"`;
other roles default to off. `cland init` writes the Coordinator's `"1h"`.
`cland crew show [--json]` lists each setting and marks inherited values
`(default)`; `cland crew set coordinator.heartbeat 30m` changes it live.
The next firing uses the new interval counted from the last firing.

Each session has a schedule in `hub.db`, keyed by its stable identity and
started at launch. Renaming and `session resume --relaunch` retain it. A fresh
launch starts a new schedule. Restarting the hub preserves due times; several
missed intervals produce one firing after restart.

At each firing the hub computes two sections, each capped at ten rows with
`and N more` for overflow. In flight lists claimed items with status and session,
running and queued verification runs, open asks, and live remote leases.
Stale lists ages for review items without a pending review request or verdict at
the current head, ready items not merged, sessions idle past `[inbox] idle_minutes`,
runs past their timeout or ended without a posted result, and unanswered asks.
Items and asks become stale only after one full heartbeat interval in that state.

Heartbeats need no subscription. An idle session starts a turn; a busy session
or one waiting for approval holds one heartbeat in its next turn's digest.
A newer firing replaces an undelivered older heartbeat. Heartbeats never steer
running turns, enter the inbox or count as needs-you. The events view keeps one
background row per firing, naming the session and the in-flight and stale counts;
`heartbeat` is the ninth event kind. The Coordinator's clause describes repairs
and escalation, and ends a clean heartbeat without a message.

Tests set `CLAND_HEARTBEAT_MS` in the **hub's** environment to shorten the interval.
The one-minute floor applies to `crew.toml`, not this override. Connection liveness
uses a separate keepalive (`KEEPALIVE_MS`, `CLAND_HUB_KEEPALIVE_MS`); its wire frame
remains `ping`.

Optional regression `found_by` records where the escape was caught: `review`, `cover`, `droplet`, `qa` or `human`. For example, `cland task create "Escaped regression" --size S --regression-of T-321 --found-by cover` stores `found_by: cover`; `cland task edit T-n --found-by qa` changes it and `--found-by none` clears it (MCP `task.create`/`task.edit`: `found_by`, null clears on edit). Values outside that vocabulary or attribution without `regression_of` refuse. Clearing `regression_of` or converting away from a task removes `found_by`. Frontmatter, the rebuilt index, task views/lists/events and the `task-written` journal record carry the field. Legacy regression items without attribution remain readable.

### Marketing publication

`cland publish <branch> --item T-n [--dry-run] [--json]` publishes a linear marketing branch before it merges into dev. The Coordinator or human previews the commits, paths and exact resulting tips, then obtains approval through an ask as described in the release skill. `[publish] allow_paths` in `.cland/config.toml` accepts exact paths and `directory/**` prefixes; defaults are site, brand docs, README, LICENSE and the Pages workflow. The command excludes inherited unreleased dev commits, refuses mixed-path commits, atomically fast-forwards GitHub's default branch and site, and merges both histories into dev without rebasing open lanes. It syncs the local territory, records a durable publication landing and comments the tips on the item. Publication leaves the item open and unversioned. Once the task is closed, that landing counts as merged for its epic's plan; after-stage policies still require their QA and Linux/macOS covers containing the published dev merge. The landing survives hub restart and is separate from pending merge recovery, so an open published item does not block push or sync. Preserve `publish.tmp` and retry the same branch/item after a failed follow-up. See [the agent procedure](../agents/issue-tracker.md#marketing-publication).


<!-- Implementation guidance moved from the implement skill. -->

For web artifact image previews, use the sealed Playwright seam in
`docs/agents/tests/web-test-artifacts.test.ts.md`: observe decoded natural width,
the inclusive size boundary, folder children and download fallbacks.

`artifact.url` is a web-only human client frame: test minting through an authenticated `/ws` connection, then request `/a/<capability>/<file>` without cookies. Use the disposable T2 fixture in `web-artifacts.test.ts` for confinement, sandbox headers and cookie-session lifetime; no agent permission or CLI command mints capabilities. Artifact iframes must never combine `allow-scripts` with `allow-same-origin`.

For artifact creation races and rollback, use the T1 concurrent-create seam in
`docs/agents/tests/hub-test-artifact-create-unit.test.ts.md`, including automatic
suite-log callers that bypass the dispatcher's tool queue. For nested artifact/post
rollback, use `docs/agents/tests/hub-test-artifact-lifecycle.test.ts.md`: refuse
a pre-commit record/admission write, preserving subscription/directory/id assertions.
Human-send diagnostic failures are post-commit operator `publication-failed`
records; separately prove the message and bytes remain stored with one publication
and delivery. A logger throw is not a pre-commit refusal seam.

For the web composer, use the sealed browser/peer-frame seam in `docs/agents/tests.md#web-phase`: fake Coordinator and second session, physical-code keys, same-topic available artifact chips, per-topic reload/disconnect drafts and a held real send/refusal. Keep pending state across mounted thread copies, preserve newer typing on either receipt, never replay writes on reconnect, and let the hub's successful send mark read through that message.

For hub memory investigations, use `hub/test/measure-memory.ts --plan` before a
Coordinator-granted local measurement slot. Follow
`docs/agents/tests/hub-test-measure-memory.test.ts.md`: sparse artifact bodies,
sealed child, independent swap supervisor, startup-only coarse allocation
sampling and per-stage counts. Report synthetic and copied live-scale evidence
separately. Name each checkpoint and any unexecuted later stages; require the IPC
stop outcome plus native close. Publish aggregate analysis only, distinguish
sampled allocation from retained size/RSS, and delete
any raw snapshots by literal path before review. For payload attribution without
a hub run, use `measure-history-storage.ts` on its fresh disposable backup and
publish only aggregate field/row sizes. Existing role clauses cover both flows;
add no permission lines.

Use prepareCopy before starting a copied-state measurement hub; its backup seal
must precede synthetic streaming job seeding. Preserve manifest.sealing row counts
and disclose excluded suite execution/recovery payloads in memory comparisons. A copied code-0 worker outcome is unavailable until reporting, cleanup and accounting have all completed.
Preparation also seals artifact-index paths and redirects. Fixture isolated verification validates final resolved evidence paths and requires stable native birth/owned cwd for live recovered PIDs, including a positively bound legacy ps-start receipt. An observed dead worker may recover its report without new signal authority; LocalExecutor still validates every live recovered tree/group signal target against native identity and owned cwd before signalling, including recovery SIGCONT (unknown proof retains/fails cleanup); outside files remain unavailable and are never read. The sealed fixture builder grants its scratch allocation alongside the project root; older environments grant only the project.
Never bypass that refusal to recover live jobs. Audit past effects from saved
outputs only and label absent file/signal traces unknown. Existing role clauses
cover this flow without new lines.

For a hub FakeClock with browser time windows, use the Date-only synchronization
in `web/test/harness.ts`; extra pages call `fixture.syncPageClock(page)` before
navigation, and release their Date writers with `releasePageClocks` before
native close. Native browser timers keep running. `advance` joins Date updates;
follow a `block` jump with `advance(0)` when its browser receipt is needed.
Use `pausePageClock` for explicit test-owned browser time. Record clock audits as item comments and hub artifacts; keep per-test guide
directories limited to their indexed test guides.

In users mode local human writes default to the first user. `--as <user>` on
`cland topic create`, `topic answer` and `artifact create` selects an existing
active user's exact name; display names are never selectors. The `topic.send`
and `approval.answer` frames use the same local `as.name` resolution (there are
no CLI verbs for these frames). Both the first user's and the selected user's
stored roles pass through `userAuthorityRefusal` before replay. Unknown or
invited-only users are refused with their name. Outcomes, posted messages,
artifacts and journal/audit records retain the selected user's id. The topic-created
journal receipt includes the user's name in `by` and the optional `userId`. Single mode
keeps the previous stand-in answer attribution and artifact shape. A shell with
`CLAND_SESSION_ID` or `CLAND_SESSION_NAME` set keeps its session identity despite
`--as`; authenticated web and gateway identities retain their transport rules.
Use `docs/agents/tests/hub-test-cli-as-user.test.ts.md` for this CLI/frame matrix.

### Inline admission and retry receipts

Inline `content` (including `--content-file`) has a 65,536-byte UTF-8 limit.
Use `path` / `--path` for larger material; file and folder copies keep their
existing behaviour. Admission checks run in both the spoke and hub before
preparation. MCP stdio still caps the entire JSON frame at 1 MiB; an oversized
frame is discarded while a bounded lexical scan recovers its top-level id,
including SDK id-after-params order. With no recoverable id (malformed or
incomplete envelope, or an id token above 8192 characters), the parse error
has a null id. A valid unfinished envelope without an id waits for its newline;
no tool runs on an oversized frame. CLI file/stdin inline sources read at most
the limit plus one byte and validate before transport. Keep metadata small.

For calls to a hub supporting retry receipts, supply `retryKey` (1–128 characters),
or CLI `--retry-key`. Reuse the key and identical arguments after a lost reply.
The receipt commits with the artifact index and chip and survives restart;
concurrent retries return the same artifact. Keys belong to the admitted session
identity (human calls use the active user id, or the legacy human identity).
Different arguments under the same key refuse. Path retries replay the original
copy; they do not recopy changed source bytes. New keys request new artifacts.
Requests without a key retain the previous wire shape and create independently.
Older running hubs do not promise retry receipts: upgrade/restart before relying
on this facility. Retention or archive does not make a used key publish again.
