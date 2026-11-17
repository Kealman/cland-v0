# Project rules
<!-- cland: rule high-water 43 -->

## 1 Briefs address the role
Scope: coordinator, lead, implementer, aide
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/brief-address-the-role.md
Reason: A report addressed to a session name stays with that session after a handover; addressing the responsible role keeps the thread with its current holder.

Briefs and requests identify the responsible role or item lead rather than the current holder’s session name, and specify role-based routing where the sender’s role permits it. Handover notes identify outstanding reports by their responsible role so that a change of holder does not strand a reply.

## 2 No long foreground commands as Coordinator
Scope: coordinator
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/coordinator-no-long-foreground.md
Reason: Long foreground commands block the event-driven Coordinator from handling hub deliveries and leave the crew waiting.

The Coordinator submits suites through cland verify and runs other commands that take more than a few seconds in the background, acting on their completion reports. Foreground commands are limited to quick checks so hub deliveries, verdicts and questions continue to be handled.

## 3 One full suite at a time
Scope: all
Date: 2026-10-31
Status: active
Origin: message:general/b11733e1-431a-4495-b4b7-fc73d4d3079c
Reason: Concurrent suites spawn enough hubs, spokes and hook processes to starve the event loop, disconnect sessions and leave orphan daemons. During the T-1478 slots a verify submission ran its host gate mid-measurement, and a guard described as "pressure level 0" was built on a transient counter and aborted a slot; rule batch 5 (A-14855) P3.

On each machine, at most one full suite runs at a time. Submit suites through cland verify and let the runners manage their queue and machine lock; never wrap a current runner in the old manual mkdir lock. Deliberate machine-wide stress load takes the same exclusive capacity, and QA load measurements require a quiet machine. A quiet slot also holds every `cland verify` submission from that machine, because its T0 host gate runs locally before a droplet takes over, and a machine-state gate names the exact OS metric and unit it reads (macOS: `kern.memorystatus_vm_pressure_level` 1/2/4, not `vm.memory_pressure`). Targeted single-file runs do not require the suite lock, subject to the project’s load restrictions; remote runs use the hub’s configured machine slots.

## 4 Verdicts go to the lead
Scope: all
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verdicts-go-to-lead.md
Reason: Verdicts route to the item’s lead, so waiting for a separate Coordinator delivery can strand a completed review or a required retry.

Reviewer and QA reports go to lead T-<n> in the request’s item topic, falling back to the Coordinator for closed or unknown items. The item’s lead requests review and QA, handles not-clear verdicts and retries, and reads the item topic or verdict list when checking evidence. The supervising Lead or Coordinator acts on the hub’s final ready event; a final clear verdict needs no manual relay.

## 5 No routing around refusals
Scope: all
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/no-route-around-refusals.md
Reason: A workaround such as signalling a worker after suite cancellation is refused defeats the hub’s permission boundary.

When a hub action is refused, stop that action and do not achieve the same outcome through another command, another session or another path. Wait, escalate through the authorized decision chain, or wait for the capability to become available through an authorized change. Distinguish an absent tool from an explicit refusal: once the tool refuses, that refusal governs.

## 6 The batch-merge rule
Scope: coordinator, lead
Date: 2026-11-02
Status: active
Origin: message:general/remote-fb6106b9cc01e746746dd95fcabf3a8cc6e996febc41f6441f32924e4d68f2ec
Reason: Serial full-suite waits delayed review-clear small changes for hours, while risky hub changes still exposed real regressions and repeated hot-file conflicts consumed additional reviews and suite runs. A docs-and-help-only conflict hid an auto-merged duplicate import that only the typecheck caught (T-1462, dd49d778); rule batch 5 (A-14855) P2. On 2026-11-01 one Coordinator `verify all` per 0.4 item (~40 min each, one at a time) became the bottleneck; the human chose T1–T3 merge batches as the pre-merge full suite (ask 31d43750, 09:01Z) and asked that throughput be measured. On 2026-11-02 the three-item batch became the bottleneck (8 ready items waiting); the human approved batches of five, T1+T3 batch tiers (each member's own verify covers T2 at its head; periodic dev T3 covers T2 on integrated dev) and remote_budget 8, to be measured (Discord 09:39Z).

Small or Neovim-side deltas may merge under the batch rule when review is clear, required QA is clear, targeted tests pass and the merge is clean against freshly fetched dev; a Neovim-only item needs its own green Neovim run. Batch at most five items (`merge.batch`), then run a full integrated dev cover before restarting the hub. Hub changes to launch, ownership, storage, routing or the merge gate require a pre-merge full suite: each member's exact-head mode-free verify (T0–T2 and Web) plus the hub merge-queue batch on the integrated tree (`merge.batch_tiers`, currently T1 and T3) together are that suite, and the periodic dev T3 run covers T2 on integrated dev. The Coordinator runs a separate `verify all` only for an item that needs T4 or that the batch cannot carry. An integrated run may be skipped only when every item is Neovim-side and each passed at a head containing the current dev tip; every hub-side change must be covered by the latest full integrated run before restart. Fix forward or revert a red integrated result within an hour, keeping dev unreleasable until green, and record batch coverage on the affected items. Serialize items that share hot files. Before waiving a full verify after conflict resolution, require `npm run typecheck` at the merged head, searches of both hub/test and nvim/test for all changed text and identifiers, and runs of every matching test file; otherwise require full verification.

## 7 Verify the head before merging
Scope: coordinator, lead
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verify-head-before-merge.md
Reason: A ready status or a matching remote branch can conceal stale criterion verification, missing suite evidence or unpushed commits on the local branch that the merge actually uses.

Before cland merge, compare the actual local task-branch head and freshly fetched origin head with the clear verdict and every criterion’s verification commit, rather than trusting ready status alone. Changed heads require fresh review and criterion verification. Inspect task view’s verify result and commit, and require passed evidence at the head wherever a suite is required, with any approved batch or temporary flake exception stated explicitly. Do not request follow-up commits on an already verified item without reopening its review.

## 8 Check the verify queue before committing on dev
Scope: coordinator, aide
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: A tracker commit after a QA request blocked E-1280's admission, and QA briefs check HEAD against dev (E-1444, E-1314). Rule batch 4 (A-14151) P2.

Check cland verify queue before a dev commit that changes hub code, and coordinate that commit with the Coordinator when integrated coverage is queued or running. Keep planning changes committed promptly through their authorized owner. Tracker, spec and glossary commits need no waiting when the cover runs from a separate clean copy at a fixed dev commit. Once item, stage or epic QA or a demo has admitted a pinned dev SHA, every dev commit, tracker-only included, waits until the requested verdicts are recorded; if dev moves anyway, the requester sends one replacement SHA for every pending run before QA resumes. Run integrated covers from a clean detached worktree and, before a hub restart, confirm that the hub code at the dev tip still matches the cover’s commit.

## 9 Wait for the durable receipt of the boundary you assert
Scope: implementer, reviewer
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: Rules 9 and 10 each covered one case of this. During the v0.1.4 build the same gap reappeared in 41 tickets: launch snapshots, presence, file receipts, UI frames after a resize, cleanup after a merge, fault injection after startup. Each flaked under load. Approved by the human with the v0.1.4 rule batch (A-7281); it absorbs rule 10.

A test waits, with a bound, for the durable receipt of the exact boundary it asserts, and keeps its final assertion. Examples of such receipts: a completion record, a pid on its job or session record, the anchored rendered row, the observed filesystem state, a readiness receipt published after persistence, the delivery receipt of the answer that won. These are not that receipt: a launch reply, presence or a hello, an attempt stamp, a title or status line, a pending-timer count, elapsed time, a negated predicate such as "no longer shows", a matching choice, the absence of a confirmation. Arm the observer before triggering the action. Bound setup separately from the behaviour under test. Start a latency bound only after completion is observed, unless the test measures end-to-end latency. A lifecycle acknowledgement can mark a different boundary: "not running" is not the OS having reaped the PID. When the receipt is missing or unusable, record an explicit incomplete outcome with the producer's native exit or signal and a bounded diagnostic tail. Worked examples: docs/agents/tests.md, "Waiting for an observable condition".

## 10 P2. Observe completion before timing the report
Scope: implementer, reviewer
Date: 2026-10-20
Status: retired 2026-10-20
Origin: session:aide-rules
Reason: permission to finish isn't observed completion. One deadline over both produced a false timeout (A-3099, A-3120).; Merged into rule 9 ("Wait for the durable receipt of the boundary you assert"): observing a worker's completion before timing its report is one case of that rule. Human approval of the v0.1.4 rule batch (A-7281).
Retired-origin: message:general/a055dbab-4b83-4b6a-a94b-3f5dd83c829a

A test that releases a worker barrier observes the worker's completion receipt before it starts a bounded wait for the worker's downstream report, unless it is measuring end-to-end latency. It bounds the completion and report assertions separately, and keeps the concurrency assertions before the release.

## 11 P3. Keep a reviewed head stable
Scope: implementer, reviewer, coordinator
Date: 2026-10-15
Status: active
Origin: session:aide-rules
Reason: a generic merge-dev-before-review habit discarded valid Linux receipts today.

After the first source review, the task head takes only shared fixes the Coordinator posts. It is not merged with dev unless the Coordinator asks or `cland merge` reports a conflict. Any change to the head needs a fresh source review before verification.

## 12 Stop writers and join owned work before releasing what they use
Scope: implementer, reviewer
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: A delayed-kill timer leaked past hub stop (T-1261); droplet reservation lock waits ignored hub shutdown (T-1154); hub.stop left the CLI alive on referenced native handles (T-1217); the ledger lock leaked in async cleanup (T-813). Rule batch 4 (A-14151) P5; the title also drops a stale "P4." prefix.

A test or cancellation path that deletes a fixture or run directory first stops every writer in it, drains its pending asynchronous writes, and observes that they're gone. Production owners follow the same order: an adapter, edge, reload, lock or acquisition joins its in-flight work, releases what it acquired and observes its children closed before it reports stopped, cancelled, timed out or applied, and before its storage closes. When process termination is handed to another owner, the root and its ownership metadata stay until that owner confirms the captured descendants are gone. If the assertion itself needs a live process with a deleted root, the test keeps that assertion and uses bounded removal retries, recording the bound and the reason.

## 13 No opencode CLI inside a session until T-296
Scope: all
Date: 2026-10-16
Status: retired 2026-10-16
Origin: message:general/9670ff36-30f0-4b97-a0e3-6c76f7d15738
Reason: OpenCode's background service resumes any mid-turn session it finds in the shared default database (upstream #51213), so two processes would then drive one cland session, the second without cland's spoke and with the user's global config (E-424, T-296).; Its own retirement condition is met. T-296 (OpenCode's own database) merged as 50c9f92c on 2026-10-16, and the hub restarted on green cover 1d78a0ff at about 07:22Z with T-296 live. No pre-T-296 OpenCode session is in the crew: every live role session runs on Codex or Claude Code.
Retired-origin: message:general/9670ff36-30f0-4b97-a0e3-6c76f7d15738

Never run the `opencode` CLI inside a cland session against the user's default OpenCode data directory or database until T-296 (OpenCode's own database) merges. Tests and probes that need the real binary set their own scratch HOME, XDG_DATA_HOME, config and OPENCODE_DB under a temp directory and start a standalone server. T-296's merge retires this rule.

## 14 Marketing pushes on cland-marketing's word
Scope: coordinator
Date: 2026-10-20
Status: retired 2026-10-20
Origin: message:general/96f55758-7a6f-4567-a884-47df25be611f
Reason: The human talks to cland-marketing about the site and should not have to repeat each push request in General; release-gated code must still never reach GitHub this way.; Superseded by the shipped `cland publish` flow (T-798): marketing commits reach GitHub through `cland publish` after an ask to the human, as the Coordinator clause and the release skill say. Retired by the human with the v0.1.4 rule batch (A-7281).
Retired-origin: message:general/a055dbab-4b83-4b6a-a94b-3f5dd83c829a

The human authorizes cland-marketing to tell the Coordinator when to publish marketing material to GitHub outside a release. On cland-marketing's request the Coordinator pushes the named commits to GitHub `site` and `main` without a fresh human confirmation, but only when:
- every changed path is in site/**, docs/brand/**, README.md, LICENSE or .github/workflows/pages.yml;
- the push fast-forwards main from its current GitHub tip;
- the diff carries no secret.
The Coordinator then merges the published tip into dev; it never runs `cland sync` for this. Anything outside those paths, or not a fast-forward, still needs the human's own confirmation.

## 15 Real-machine work runs sealed
Scope: all
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: A scratch HOME alone still inherited DIGITALOCEAN_TOKEN and harness account paths (T-651, T-646). `cland init` provisioned a real HOME on 2026-10-16. T-492 leaked a credential into argv. An inherited GIT_DIR plus an implicit `git init --bare` set core.bare=true in the live repository (T-973). Retired rule 13 was one case of this. A-7281 (24 proposals); GIT_* clause added with rule batch A-8634 (R2).

Any test, probe, demo or experiment that runs cland, Git, a harness or an installer uses a disposable root. It also uses its own HOME, XDG directories and Git configuration, and an environment with provider and account variables removed. It never runs against the live project, the human's HOME or inherited credentials. Child launch environments apply the shared credential filter and remove every inherited `GIT_*` repository and configuration variable after every overlay; a scratch HOME alone does not isolate Git. Every launcher, fixture helper and brief setup builds that environment through the shared builder (fixtureEnvironment with scratchGitEnvironment) after the final options or overlay spread, never a copied filter or a per-caller HOME overlay. Capture helpers redact token and bearer values as they write; an exported capture directory holds only its declared outputs, never HOME, environment files, cookies or one-use links; nothing is published until a secret scan finds no matches.

## 16 Docs, help, skills and clauses change in the same item
Scope: implementer, reviewer
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: Docs drift surfaced late, in the E-617 demo's C4 docs check and in the release's T-940, T-941 and T-943 work. Several skills still told the human to run a command the role could now run itself. 16 proposals in the v0.1.4 build (A-7281).

An item that changes a command, setting, policy, verification default or role permission updates the matching docs in the same item: its `--help`, the hub/README.md and docs/agents/ sections, the skills that describe the flow, and the role clause. It replaces the descriptions it supersedes and rereads each section it touches for stale future-tense or "until X lands" wording. Public feature and default claims name the conditions that change them (generated or inherited config, executor, auth, network). File-specific test guidance goes in docs/agents/tests/<test-path-with-hyphens>.md, and docs/agents/tests.md keeps shared procedures only. A kept upstream skill records the edit in `metadata.changes`. The review checks these against the shipped behaviour at the reviewed head.

## 17 Evidence states what actually ran
Scope: all
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: A missing reading showed as a 0% meter (T-1134); filtered counts implied global totals (T-1061, T-1177); unexecuted groups could start red covers (T-1211). Rule batch 4 (A-14151) P9.

A claim about tests, timing or coverage names what actually ran: the head or tree, the tiers or phases completed and those that did not run, the platform, executor and browser binary, what a measurement excludes, and whether a gate was in report or enforce mode. A partial run, a cache hit, a projection or a missing receipt is labelled as such. None of them ever counts as a pass, a wall time or zero. The product shows the same distinction: CLI summaries, meters, counts and verdict freshness render unknown, pending, unexecuted or loaded-only values as such, and totals come from the hub's aggregate over the complete index, never from the rows a client has loaded. Coverage names the required tests by their generated case names and checks the recorded facts apart from the exit status; exit 0 from a probe that caught its own step errors, a count of textual or drafting-time tests, or a zero-match scan without a positive control taken before the change is not coverage. A diagnosis quotes the actual failure output before it classifies the failure.

## 18 Crew sessions never drive the human's browser or desktop
Scope: all
Date: 2026-10-22
Status: active
Origin: message:general/a9509902-689c-41a5-bd4b-7275a1edab5b
Reason: On 2026-10-20 a crew session opened the human's real browser and default profile (A-7738); the ban was written only in QA brief templates and a fixture note that Implementers and Reviewers never load. Approved with rule batch A-8634 (R1), without the "after the Coordinator told the human" clause, since QA holds the human's standing grant.

Check browser behaviour only in an isolated testing browser (Chrome Headless Shell or Chrome for Testing) with its own user-data-dir, and start no GUI process on the human's machine unless the brief foresees it. Only QA opens the human's browser: under a brief that names real-browser computer use, in the dedicated cland QA profile, closing its tabs afterwards. When the browser provider, profile or access is missing or refused, report the exact blocker to the item lead and stop there.

## 19 Land a capability and restart before anything depends on it
Scope: coordinator, lead, implementer
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: T-991's tests needed a phase the live verifier lacked; a branch runner cannot prove the running hub's cloud-init template (T-993); compacted replies broke QA fixtures and completion observers (T-1027, T-1038); T-922 in A-7281 was the same lesson. Approved with rule batch A-8634 (R3). Row-membership sentence added with batch 2 (A-9063 R1): T-1027, T-1091 and T-1088 each broke QA count waits or the startup probe when the rows a reply carries changed.

When an item depends on something the running hub or a prepared executor lacks (a verifier tier or phase, a protocol field, an admission policy, a runtime library in the prepared image), land that capability first, then restart the hub or re-prepare the executor, and only then enqueue the item.

## 20 Inventory every consumer before changing a shared contract
Scope: coordinator, lead, implementer, reviewer
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: Import-only searches missed a deep-equal stored-shape test (T-1386, A-13273), raw socket readers (T-1362) and the droplet watchdog's persisted-pid path (T-1298). Rule batch 4 (A-14151) P4.

Before an item changes a shared contract (the shape of a reply, snapshot or list, or the rows it carries; a schema's validation; a refusal or outcome class; a delivery, credential or admission policy), it searches for every consumer and lists them in the item. The search covers production callers and clients, shipped skill examples, QA briefs and fixtures, startup probes, persisted-record readers, and tests in every tier, T3 and T4 included, and it searches for the contract's field, frame and function names as well as its importers, so deep-equal assertions, read-then-parse locals, raw positional socket readers and direct process.kill paths are found; selecting tests by changed file does not prove the list complete. The item migrates each consumer or records why it is unaffected, adds new fields while keeping the old ones until every consumer has moved, and keeps a client regression at the previous wire shape, because a new client can meet an older running hub.

## 21 Keyboard changes are proven with real key presses
Scope: implementer, reviewer, qa
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: T-1115's programmatic fill bypassed keydown and masked a palette regression; T-1143's artifact-open swallowed the Markdown source toggle; T-1120 and T-1127 relied on keymap or resolver evidence alone. Approved with rule batch 3 (A-11329 R7).

A change to a key binding, key context or keyboard-routed action is proven with real key presses on the actual focused targets: a rail item, a row, a text field holding characters the shell also binds, and each nested native control. The tests cover the handled and the unhandled path, and the views where the action must stay inert: the wrong view, nothing selected, and below the action's width boundary. A keymap entry, a resolver or help listing, or a programmatic fill is not that evidence; the other areas' existing key regressions and help labels stay unchanged.

## 22 Unrun briefs check their own preconditions
Scope: coordinator, lead, qa
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: E-416 DOD-03 assumed lane order where the product uses rank; the E-417 seed read message ids from a send result; E-419 S1 selectors were guessed before the code existed; E-417 key-encoding errors read as product results. Approved with rule batch 3 (A-11329 R8).

A brief written before it has run marks which selectors, test names and ids it verified and which it inferred from the criteria, and checks the inferred ones against the source at the final build. Each step asserts its own preconditions before the action it tests: it validates seeded identifiers, reads created ids from topic history (never from a `send` result), sets explicitly any order it relies on (rank, lane or close time), and states the tool-specific key syntax it uses, so a setup or encoding fault reads apart from a product failure.

## 23 Work over retained history stays bounded
Scope: implementer, reviewer
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: Unbounded reads of retained history ran the live hub out of heap at restart #22 (T-912), made a 13 MB status reply take 6.8 s (T-906), produced a 72 MB hub.status (T-1038), and decoded 3 M outbox rows for 500 Discord inputs (T-1436). Rule batch 4 (A-14151) P1.

Code that reads retained history (logs, the tracker, coverage maps, journals, Git ranges) streams or scans it incrementally, checkpoints what it derives, shares one in-flight computation between concurrent callers, keeps that work off startup and liveness replies, and is tested against a byte or work-count budget on a copy of the live project's data.

## 24 One source for each shared policy
Scope: implementer, reviewer
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: A copied production guard list broke on every new guard (T-1299), and the offline linter and runtime admission drifted on argument order and default recipients (T-1225); fifteen items reported the same defect. Rule batch 4 (A-14151) P3.

A policy, list, parser, default or computed fact that two paths use (admission and lint, startup and a settings command, doctor and setup, hub and client, production and a test fake) lives in one exported module that every path imports, and a settings write validates its candidate with the consumer's own parser; a copied allowlist, re-derived value or parallel parser is removed, not extended.

## 25 Uncertain outcomes stay fenced
Scope: implementer, reviewer
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: Cancelling an admitted event could confirm input nobody saw (T-1412); a pid exit alone could revoke a role before reconnect (T-1034); a harness acknowledgement was read as delivery (T-1256); a crash between reserving and sending could undercount Discord identifies (T-1403). Extends the remote outbox design in hub/README.md to executors, verification and harness delivery. Rule batch 4 (A-14151) P6.

Production state moves only on a positive receipt: an effect's durable identity, budget spend and rendered bytes are persisted before the native send, a terminal frame or notice follows its durable checkpoint, an accepted send whose outcome is unknown stays fenced until reconciled, and a retry, replay or ownership release happens only after positive non-delivery, a confirmed failure or an observed exit.

## 26 Authority comes from the identity captured at admission
Scope: implementer, reviewer
Date: 2026-10-31
Status: active
Origin: message:general/b11733e1-431a-4495-b4b7-fc73d4d3079c
Reason: A rename during native resume stranded the original reservation (T-1235); native request ids are unique only within one transport (T-1109); an approval key presented on an ask card must change nothing (T-1357). Rule batch 4 (A-14151) P7. The memory probe's copied hub could signal or reap from recovered state it never launched (T-1483, A-14612); rule batch 5 (A-14855) P4.

Authorization, ownership and settlement decisions key on the durable identity captured at admission (pairing id, reservation key, session-scoped native request id, paired message mapping, the pinned item, head and enqueue time), validated before permission classification, and never on a display name, button text, caller-supplied actor field or frame data. Process signals and cleanup take the same authority from an observed launch bound to the exact owner, lease and native birth, never from serialized flags or group numbers. Recovery proves each signal target independently, and a new native ownership fence ships with a paired fresh-cleanup and no-inherited-authority regression.

## 27 A gate goes from report to enforce in its own item
Scope: coordinator, lead, implementer, reviewer
Date: 2026-10-30
Status: active
Origin: message:general/5ac74bc5-8ea6-4a79-8bba-910c360358e8
Reason: Gate switches needed replay proof, and an advisory notice quietly became a gate (T-1207; also T-683, T-915, T-919, T-923). Rule batch 4 (A-14151) P11.

A new gate, budget or advisory check ships in report mode, where it feeds no exit status and blocks no operation; switching it to enforce is its own item, which replays every authorized platform and occasion log through the production checker and keeps the before-and-after failures and each bounded exception in one artifact.

## 28 A pinned clock is pinned everywhere it is read
Scope: implementer, reviewer
Date: 2026-10-31
Status: active
Origin: message:general/b11733e1-431a-4495-b4b7-fc73d4d3079c
Reason: The phone-asks fixture pinned 2026-10-23 while the browser computed a 7-day archive window from the real clock. At 12:00Z on 2026-10-30 every head went red with no code change, dev stayed red for 2.5 h, and a culprit search blamed an innocent landing (T-1485). Rule batch 5 (A-14855) P1.

A test that fixes a date gives the same clock to every reader of time in its scope (the hub, the browser page's Date, file stamps, retention windows and expiries), or leaves all of them real. It never combines a fixed date with a window computed from the real clock. A fixture date that must age is set relative to the run's clock, and native timers keep running.

## 29 Overlap epics
Scope: coordinator
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: v0.4.0 ran one epic at a time after its first three days, and landings fell from 1.26 to about 0.5 an hour, with about 9 h of ramps between epics (retro A-19803 §3.1, §7 #3; triage A-19813 P-1).

Cut the next epic and write its DoD brief at the predecessor's last-stage review. The successor's stage 1 may start on the predecessor's merged interfaces before the predecessor's DoD SHA.

## 30 Fewer, paired stage closes
Scope: coordinator
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: v0.4.0 had 32 stages and 9 demos. Stage-close sequences held dev frozen for about 122 h, of which about 62 h were beyond the green path (A-19803 §3.2, §7 #1; triage A-19813 P-2).

Plan epics with at most three after-stage gates. Pair stage QAs on one cover pair whenever all their items are landed.

## 31 Coordinator watch
Scope: coordinator
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: T-1795 sat ready and unqueued for 3.6 h while the Coordinator was silent, and an Implementer idled 90 min waiting for a cover-quiet release nobody sent (A-19803 §3.8; triage A-19813 P-3).

Keep a ready-and-landing watcher armed at all times, and post "quiet over" explicitly when a cover-quiet window ends. This applies until ready and landing events start a Coordinator turn by themselves (H-12).

## 32 Root commits during hub runs
Scope: all
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: A root fast-forward raced a soak's bundling and aborted it on "HEAD changed" (11-06), and a verify host gate wrote into a preservation slot's inventory (A-19803 §3.8, §7 #10; triage A-19813 P-4; interim until T-1652).

Make no root commit while a hub run is acquiring or bundling its tree. A preservation slot also pauses verify submissions from that machine.

## 33 Config commits search the tests
Scope: all
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: Two Coordinator config commits turned dev red through tests that pin the repository's config: e818d2dc on 2026-11-01 (T-1581) and 9ad12275c on 2026-11-13 (A-19803 §3.3; triage A-19813 P-5).

Before any commit that changes `.cland/config.toml` or another repository-pinned config, search hub/test and nvim/test for the changed key and run every matching test file.

## 34 Release preflight before covers
Scope: coordinator
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: v0.4.0's release found `gh` missing from the hub's PATH (T-1876), then saw the managed .gitignore header move the tree off its green covers (T-1877). Each cost a full suite or a restart after the demo (A-19803 §7 #8; triage A-19813 P-6).

Run `cland release --item <R> --dry-run` and a `gh` check on the hub's PATH right after the release epic's brief, before any release or stage cover. Restart the hub on the version-bumped build before the release covers. This applies until a release preflight mode exists (H-11).

## 35 Delivery retries
Scope: coordinator
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: T-1827's batch failed delivery ten times on droplets, plus twice locally, during the 20.4 h network outage of 11-12/13, with four hub restarts (A-19803 §5, §7 #7; triage A-19813 P-7).

An undelivered droplet run gets at most two resubmissions. After that, ask the human and switch the executor or region, instead of retrying.

## 36 Merge dev and lint before enqueue
Scope: coordinator, implementer
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: About half of v0.4.0's 49 red first batches were interactions that the item's mode-free verify could not see, such as whole-source lints beside a parallel landing (A-19803 §3.3, §7 #4; triage A-19813 P-8).

Before an item is enqueued, its head is checked merged with current dev: the whole-source lints and the closed-item wording lint run there. A finding goes back to the lead, not into the queue. This applies until the enqueue preflight does it itself (H-13).

## 37 Local load ceiling
Scope: all
Date: 2026-11-16
Status: active
Origin: message:general/e3828f89-2d4e-42f5-8823-2439e1ac27ba
Reason: The hub exited on "tracker storage stalled" at load 15–36 on 2026-11-05, and load-timing flakes dominated the red macOS covers (A-19803 §3.2, §5; triage A-19813 P-9).

Run at most one heavy local run (a full suite, a stress loop, a T3 or native file batch) per machine at a time, and start no new local run above a 1-minute load of 20.

## 38 Fake-only tests fake every native boundary they reach
Scope: all
Date: 2026-11-17
Status: active
Origin: message:general/160e8c63-9f29-40a8-8360-a2466908bbbe
Reason: On 2026-11-17 green runs still reached native code on four items: T-1848 (the promisify.custom route), T-1869 (lease and ledger lock), T-1915 (sealed identity not reaching cold start) and T-1626 (the fake-hosts gate enrolling an "executor" host). Rule batch A-20783 R1.

A fake-only test injects its fake at every native boundary the code under test reaches: both the callback and util.promisify.custom forms of exec and execFile, acquisition, ledger and lock ownership, and cleanup. It keeps a positively controlled launch guard that fails on any native spawn. A test-only gate selects exactly one thing and never enrols unrelated fixtures. Context captured before a fixture is sealed reaches every acquisition started inside it.

## 39 Outcomes come from the owner's structured receipt
Scope: all
Date: 2026-11-17
Status: active
Origin: message:general/160e8c63-9f29-40a8-8360-a2466908bbbe
Reason: 2026-11-17: T-1935 (a fixture's printed "suite ticket lost" became the cause of every green run), T-1662 (a refusal read as "does not answer"), T-1688 (/proc ENOENT treated as exit), T-1850 (a later identity read overwrote the outcome) and T-1848 (cleanup rejection dropped the metadata). Clarifies rules 9 and 25. Rule batch A-20783 R2.

An outcome or cause comes from the producing owner's structured receipt, never from parsing message or log text. Missing metadata stays unknown unless an independent absence receipt confirms it; for example, /proc ENOENT alone is not proof of exit. Once an outcome is selected, a later ancillary failure adds a secondary diagnostic and never overwrites it. New result metadata travels through every exit path, rejection and cleanup failure included.

## 40 Retries never manufacture proof
Scope: all
Date: 2026-11-17
Status: active
Origin: message:general/160e8c63-9f29-40a8-8360-a2466908bbbe
Reason: 2026-11-17: T-1633 (a green rerun after a hub restart held as inconclusive), T-1630 (re-enqueue identity) and T-1848 (inspection retries). Rule batch A-20783 R3.

A retry keeps its earlier proofs and never admits a failed round as proof. A later attempt supersedes an earlier one only through an ordered receipt bound to the same run, tree, command and step, and every superseded exit and duration stays reported. A same-head cancel and re-enqueue keeps its request identity and evidence.

## 41 The consumer census includes frozen fixtures and history
Scope: all
Date: 2026-11-17
Status: active
Origin: message:general/160e8c63-9f29-40a8-8360-a2466908bbbe
Reason: 2026-11-17: three items missed the frozen help fixture (T-1630, T-1931, T-1869), T-1626 missed a raw CLAND_SSH_BIN reader in provider bootstrap, T-1582 nearly reused T1 proof for T3 files, and T-1757's link parser grew form by form. Rule batch A-20783 R4.

Rule 20's consumer search also covers frozen fixtures that pin exact bytes, such as hub/test/fixtures/cli-usage/commands.json; direct raw readers of a variable or format, not only importers of the shared helper; and tier or classification history, so a file moving from T1 to T3 never borrows T1 proof. A reader of a text format defines its supported grammar once, or refuses unsupported forms loudly in a gate every verify runs.

## 42 Bounds hold while ingesting
Scope: all
Date: 2026-11-17
Status: active
Origin: message:general/160e8c63-9f29-40a8-8360-a2466908bbbe
Reason: 2026-11-17: T-1645 (output buffered before the 1 MiB cap refused it), T-1817 (an existsSync check standing in for the removal guard) and T-1936 (a whole-log split). Examples for rule 23. Rule batch A-20783 R5.

A size or memory bound is enforced while data is read, not checked after collection: count the bytes actually kept, then drain to the native close or an explicit incomplete boundary. Proof that a resource or root was kept uses separate receipts, exercised through the real guarded cleanup.

## 43 Claims name the exact object
Scope: all
Date: 2026-11-17
Status: active
Origin: message:general/160e8c63-9f29-40a8-8360-a2466908bbbe
Reason: 2026-11-17: T-1661 (directory versus socket mode in T-1625 C2) and T-1660 (a scoped compiler check). Example for rule 17. Rule batch A-20783 R6.

A criterion or claim names the exact object it asserts: which directory or file has the mode, and which files' diagnostics were checked. Selected checks are never presented as whole-project ones, and differently scoped timings are never compared as a speedup.
