# Project rules
<!-- cland: rule high-water 22 -->

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
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/one-suite-at-a-time.md
Reason: Concurrent suites spawn enough hubs, spokes and hook processes to starve the event loop, disconnect sessions and leave orphan daemons.

On each machine, at most one full suite runs at a time. Submit suites through cland verify and let the runners manage their queue and machine lock; never wrap a current runner in the old manual mkdir lock. Deliberate machine-wide stress load takes the same exclusive capacity, and QA load measurements require a quiet machine. Targeted single-file runs do not require the suite lock, subject to the project’s load restrictions; remote runs use the hub’s configured machine slots.

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
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/batch-merge-rule.md
Reason: Serial full-suite waits delayed review-clear small changes for hours, while risky hub changes still exposed real regressions and repeated hot-file conflicts consumed additional reviews and suite runs.

Small or Neovim-side deltas may merge under the batch rule when review is clear, required QA is clear, targeted tests pass and the merge is clean against freshly fetched dev; a Neovim-only item needs its own green Neovim run. Batch at most three items, then run a full integrated dev cover before restarting the hub. Hub changes to launch, ownership, storage, routing or the merge gate require their own pre-merge full suite. An integrated run may be skipped only when every item is Neovim-side and each passed at a head containing the current dev tip; every hub-side change must be covered by the latest full integrated run before restart. Fix forward or revert a red integrated result within an hour, keeping dev unreleasable until green, and record batch coverage on the affected items. Serialize items that share hot files. Before waiving a full verify after conflict resolution, require searches of both hub/test and nvim/test for all changed text and identifiers and runs of every matching test file; otherwise require full verification.

## 7 Verify the head before merging
Scope: coordinator, lead
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verify-head-before-merge.md
Reason: A ready status or a matching remote branch can conceal stale criterion verification, missing suite evidence or unpushed commits on the local branch that the merge actually uses.

Before cland merge, compare the actual local task-branch head and freshly fetched origin head with the clear verdict and every criterion’s verification commit, rather than trusting ready status alone. Changed heads require fresh review and criterion verification. Inspect task view’s verify result and commit, and require passed evidence at the head wherever a suite is required, with any approved batch or temporary flake exception stated explicitly. Do not request follow-up commits on an already verified item without reopening its review.

## 8 Check the verify queue before committing on dev
Scope: coordinator, aide
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/tracker-commits-cancel-dev-runs.md
Reason: Moving or dirtying the tree used by an integrated cover cancels valuable batch evidence and costs the crew a lengthy rerun; a fixed clean copy isolates planning changes while hub-code changes still need coverage.

Check cland verify queue before a dev commit that changes hub code, and coordinate that commit with the Coordinator when integrated coverage is queued or running. Keep planning changes committed promptly through their authorized owner. Tracker, spec and glossary commits need no waiting when the cover runs from a separate clean copy at a fixed dev commit. Run integrated covers from a clean detached worktree and, before a hub restart, confirm that the hub code at the dev tip still matches the cover’s commit.

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

## 12 P4. Stop fixture writers before deleting their directories
Scope: implementer, reviewer
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: Linux reports ENOTEMPTY when a live hub writes .cland/run during a recursive rm (T-498, T-508).

A test or cancellation path that deletes a fixture or run directory first stops every writer in it, drains its pending asynchronous writes, and observes that they're gone. When process termination is handed to another owner, the root and its ownership metadata stay until that owner confirms the captured descendants are gone. If the assertion itself needs a live process with a deleted root, the test keeps that assertion and uses bounded removal retries, recording the bound and the reason.

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
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: These failures happened in the v0.1.4 run: a release run was satisfied from a macOS stage cache (T-950); projections were judged as wall times; a T0–T2 receipt was described as an integration pass (T-713); missing receipts read as zero (T-681). 21 proposals in the v0.1.4 build (A-7281).

A claim about tests, timing or coverage names what actually ran: the head or tree, the tiers or phases completed and those that did not run, the platform, executor and browser binary, what a measurement excludes, and whether a gate was in report or enforce mode. A partial run, a cache hit, a projection or a missing receipt is labelled as such. None of them ever counts as a pass, a wall time or zero. Coverage names the required tests by their generated case names and checks the recorded facts apart from the exit status; exit 0 from a probe that caught its own step errors, a count of textual or drafting-time tests, or a zero-match scan without a positive control taken before the change is not coverage. A diagnosis quotes the actual failure output before it classifies the failure.

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
Date: 2026-10-24
Status: active
Origin: message:general/c41bb6da-8f8b-4a96-942a-5c2b09bbdaec
Reason: T-1117, T-1228 and T-1220 passed their own verification and broke tests they never selected; each cost a stage cover (T-1220's seven T3 failures at d41e7321, A-11286). Rule 19's shape and row sentences move here. Approved with rule batch 3 (A-11329 R1).

Before an item changes a shared contract (the shape of a reply, snapshot or list, or the rows it carries; a schema's validation; a refusal or outcome class; a delivery, credential or admission policy), it searches for every consumer and lists them in the item. The search covers production callers and clients, shipped skill examples, QA briefs and fixtures, startup probes, persisted-record readers, and tests in every tier, T3 and T4 included; selecting tests by changed file does not prove the list complete. The item migrates each consumer or records why it is unaffected, adds new fields while keeping the old ones until every consumer has moved, and keeps a client regression at the previous wire shape, because a new client can meet an older running hub.

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
