---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "CHANGES"
---

Implement the work described by the user in the spec or tickets.

Claude Code's managed Bash `PreToolUse` guard refuses computed rm/rmdir targets
(command substitutions, named variables and xargs) before native approval stalls
the session. Read its reason, print the path if needed, and retry with every path
written literally. Init/update install it for hand-started sessions when `cland`
is on PATH; hub launches/relaunches inject it. Literal paths, `git rm` and heredoc
bodies pass; the guard needs no running hub.

When working as a custom role, read `docs/agents/session-permissions.md#custom-roles` for the own-claim review/verification path and route completion to the Coordinator.

When editing a kept upstream skill, append the change and item as a new line in its sibling `CHANGES`; keep `metadata.changes: CHANGES` stable.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

For hub shutdown changes, use the real-process receipt tests described in `docs/agents/tests.md#implementer-test-selection`, including held fake-provider mutations and late-resource reconciliation; interpret `hub stop`'s released-lock/live-PID diagnostic and signal cleanup deadline through `hub/README.md`.

For adapter shutdown, preserve both synchronous and promise-returning `close`
implementations. Drain transient native CLI callbacks before releasing storage;
use the scripted close/drain regression and held real-query resource check in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md` and
`docs/agents/tests/hub-test-scenarios-hook-bridge.test.ts.md`. Fence late resume
and identity-probe results before restarting supervision; use the held-result
matrix in `docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md`.

For local verification cancellation or compatibility recovery, use the sealed cancellation, recreated-root quarantine and blocked-queue seams in `docs/agents/tests.md`. Observe exact descendant death before root cleanup; retain the quarantine journal's old/new inodes and next-run admission receipt. Live machine locks are outside the fixture.

For startup lease recovery and phase timing, follow the sealed T2 fake-provider receipts in `docs/agents/tests.md#implementer-test-selection`. The T3 retained-history scale guard counts suite checkpoints, explorer batches and per-item native reads through the first completed status reply; retain CPU/wall/step diagnostics, the gross hang guard and red count-based historical controls as `docs/agents/tests.md#startup-reply-byte-budgets-t-1038` describes.

For remote watchdog changes, use the executor-fake guidance in `docs/agents/tests.md#implementer-test-selection`: observe mirrored byte progress, the terminal timeout receipt and released resource; preserve the admitted stall limit across restart.

Before writing or changing a test, read "Test levels" in `docs/agents/tests.md` and put each test at the lowest tier that proves its behaviour: no new real process without a lifecycle reason, and no wall-clock waits.

For role-clause skill inventory changes, use the production configuration and
T-1220 synchronous-filesystem guard described in
`docs/agents/tests/hub-test-session-credential-io.test.ts.md`; snapshot refresh
receipts are in `docs/agents/tests/hub-test-config-reload-component.test.ts.md`.

For `web/` changes in this repository, follow the root AGENTS.md web rule and `web/README.md`. The root check builds the ignored bundle after typechecking, including on local verification; no separate development bridge is used.

For message or notes Markdown, read `web/README.md#message-markdown` for the pure
token contract, configured item prefixes, per-message fences and raw-HTML source
guard; use the T1 parser seam named in `docs/agents/tests.md#web-phase`.

For browser tests, follow `docs/agents/tests.md#web-phase` and `web/README.md#browser-tests`: use the isolated Headless Shell fixture, keep CSP enabled and observe teardown. `npm install` prepares the pinned shell; targeted browser files require a current bundle. The hub web-auth file builds its bundle through the shared helper before standalone tests; suites build before any installation-bundle reader in `hub/test/run-suite.ts`’s `installedBundleReaders` list, including real doctor CLI tests on shards without Web or an available browser. Targeted standalone doctor CLI runs require a current build. Task verification adds changed T3/T4 files and tiers.json mapped T4 read-path guards once for duration sampling (shared duration procedure in docs/agents/tests.md), plus Web outside T0–T2; merge batches add it after T1 for web/ candidate diffs. A machine-unavailable Web receipt is not passing browser evidence; see that section.

For network bind, tunnel and QR tests, follow `docs/agents/tests.md#browser-sign-in-fixtures`: bind only disposable loopback aliases or use scratch config; observe web and spoke addresses independently.

`[web]` settings are startup-only: reload and role auto-refresh refuse a changed
parsed web table and retain the loaded config/roles pair; `config set web.*`
saves for the next hub start. Apply with `cland hub stop` then `cland hub start`.
Use the sealed CLI/projectHub regression described in
`docs/agents/tests/hub-test-config-reload-component.test.ts.md`.

For Web load-race checks, use `resizePage` and the positive receipt guidance in
`docs/agents/tests.md#web-load-race-guards`. New Web files have a separate
report-only ten-file-repetition check with two workers and owned CPU load after
ordinary Web timing, under the same machine lease. Verify retains the exact
count. Host admission carries `webRepetitionFiles` from the HEAD/fetched-dev
merge base; the runner does no Git lookup. An absent field is missing proof,
while `[]` means checked none new. Before restart #54 absent-field reports are
expected; the Coordinator records post-restart droplet counts as landing
evidence, not a pre-merge gate. Incomplete or skipped receipts are missing proof. Do not run this CPU
check as an unleased local probe. No role-clause expansion is needed.

For missing droplet browser libraries, report to the item's lead: the human or Coordinator rebuilds the prepared snapshot after restarting the hub onto the provisioning change. See `docs/agents/tests.md#web-phase` for the root provisioning and lockfile-key boundary.

For browser sign-in probes, follow `docs/agents/tests.md#browser-sign-in-fixtures`: `cland web` is human-only; use a disposable project and test client, with scratch browser opener stubs. Cookie sessions persist for 30 days from creation; `web --sessions` and `web --revoke <id>` are also human-only Unix-socket commands. Test clients use those frames on disposable projects, never the live session actor. `web.session` reads only the sign-in bound to the authenticated web socket, with no cookie or identity selector; `session.history` is a bounded human-client read across topics, separate from spoke `history`. Web launches refuse every own `cwd` field; local launches keep it. Web authority changes update the explicit deny-by-default policy and its protocol conformance test; use the same section for T1 policy and T2 web/Unix fixtures.

For install metadata, Inbox start URLs, app badges or phone QR sign-in, use the T2 edge and sealed phone seams in `docs/agents/tests.md#web-phase`; real installability and badges stay in QA's full-Chromium demo.

`artifact.url` is a web-only human client frame: test minting through an authenticated `/ws` connection, then request `/a/<capability>/<file>` without cookies. Use the disposable T2 fixture in `web-artifacts.test.ts` for confinement, sandbox headers and cookie-session lifetime; no agent permission or CLI command mints capabilities. Artifact iframes must never combine `allow-scripts` with `allow-same-origin`.

For item clients, consume hub-computed summaries and roll-ups from snapshots and deltas. The first payload contains open rows and their ancestors. Fully closed containers and tasks load in bounded per-parent `task.list` summary pages; follow newly loaded containers and deduplicate retained ancestors by identity. Card-only dates/branch/relations/compact verification travel in snapshots and by-id pages; ordinary summary lists and parent pages omit these extras to protect the native first-payload budget. Closed card facts and a complete compact tree row are fetched in bounded by-id `task.list` summary pages; item links use the canonical id and parent to load and unfold missing ancestors without reading the body; fetch the body through `task.view` only when agents’ text or the criterion editor is opened; preserve the 1 MiB snapshot cap and Lua differential guard. See `hub/README.md` (summary projection) and `docs/agents/tests.md#connection-snapshots`.

For web card criterion edits, use `task.criterion` with the authenticated human and no `as` field. Keep one-line text separate from the `Ck.` id label, preserve ids and drafts, disable offline writes and never replay mutations after reconnect. Legacy criteria with null ids stay read-only until Add or a CLI write returns persisted ids; explain this in a tooltip and never guess an id. `e` is scoped to the criteria block through the shared key map. Labels, body and other item fields stay read-only in Items. Use the three Web/CLI seams in `docs/agents/tests.md#web-phase`; no protocol or role permission expansion is needed.

For Neovim recording refreshes, follow `docs/agents/tests.md#neovim-recorded-frames`: audit every reduced slice before changing its stored expectation. The named local-only summary/decoder checks are excluded from full discovery; every selected file retains the zero-frame guard.

For human marks changes, preserve the forward-only timestamp/plan-history ordering and the durable one-time import acknowledgement before removing `events.last_look` or `plan_seen` from `ui.json`. Use the real-frame and recorded-headless seams in `docs/agents/tests.md#human-marks-fixtures`; no role-clause expansion is needed for these human-only UI frames.

For human topic kinds and queued withdrawal, use the public-frame/fake-spoke seams in `docs/agents/tests.md#human-kinds-and-queued-withdrawal`. Only a human Question starts a wait; withdrawal succeeds before adapter submission and returns the text. Preserve the durable submission fence and held notes.

For the web composer, use the sealed browser/peer-frame seam in `docs/agents/tests.md#web-phase`: fake Coordinator and second session, physical-code keys, same-topic available artifact chips, per-topic reload/disconnect drafts and a held real send/refusal. Keep pending state across mounted thread copies, preserve newer typing on either receipt, never replay writes on reconnect, and let the hub's successful send mark read through that message.

For web Withdraw, use the same sealed Web/public-frame seam with a busy fake session and a test-controlled idle step. Hold the receipt before asserting draft restoration; preserve newer typing and shared pending state through navigation. Prove refusal through the real hub after injection, with its tooltip reason and unchanged draft, then release the held delivery delta.

Withdrawal eligibility reads the optional authoritative `withdrawable` fact; preserve aggregate stages and queued-only fallback for older hubs. Test one injected broadcast recipient with another still queued through hub frames and Web. If a newer send is pending when older text returns, hold its actual success/refusal and uncertain reload to prove older/pending/newer draft order without losing the restored text.

For Web Events changes, use the sealed Events/public-frame seam in `docs/agents/tests.md#web-phase`: hub-side filters on subscription and pages, local-day folds, receipt-backed shared last look, live coalescing focus and gap-free older pages. Keep Inbox summaries unfiltered even beside Events in a split. Shared key routing changes also run the Sessions launch/archive and shell files with the actual focused rail target: rail digits navigate, other rail keys retain their active area and Events row digits filter.

For open-page browser notifications, use the pure rules/text seam and sealed Web Notification/visibility/focus stubs in `docs/agents/tests.md#web-phase`. Keep the Accounts Profile switches in the shared browser store unchanged, with no palette actions; test Finished off after reload and first-enable permission through stubbed Web controls. Request permission directly from an enabling gesture, seed snapshots without replay and use pre-transition task layers. Open the Inbox list explicitly in either pane and observe exact row-id focus, including from an open palette; hold browser animation time to prove row focus follows committed DOM rather than elapsed frames; retain receipt-based suppression; keep notifications stubbed. Phone worker changes use `docs/agents/tests.md#phone-notificationstestts`: opt-in worker contexts, real root registration, stubbed showNotification, worker click/no-fetch contract and T2 edge headers; real notifications stay in QA's demo.

For Inbox drawer, reply, visit and archive changes, use the sealed Web/fake-sender seam in `docs/agents/tests.md#web-phase`. Select action rows explicitly; observe the exact departure before asserting leave/re-entry, including focus into another area while Inbox remains mounted. Keep drawer history reads separate from exact-id recovery reads, and retain the fake sender's reply receipt while split remains open. Retained approval detail identities resolve current native authorization and recovery state. Archive reads consume hub departures without replacing live rows or counts.

For approval records, use the sealed frame and recorded-client seams in `docs/agents/tests.md` (Approval record changes). Retain the existing inbox fields, the session-scoped native id, the 64 KiB subject allowlist and the explicit outcome; Claude Code's record stays TUI-only. For `approval.answer`, use the same doc's scripted fake adapter and authenticated web-cookie checks: only the human answers, Aides are refused, the first answer reserves `answering`, and delivery failure restores `pending` with a warning. Keep Deny intact and verify the native note or human message fallback; nothing answers by default. Neovim approval keys use the recorded-headless inbox seam in the same section: assert the outbound choice/note, live delta, attributed fold, race archive lookup and TUI-only no-send/attachment boundary.

For Web approval cards, extend `web/src/ApprovalCard.tsx` for Inbox and drawer reuse. Use the sealed Web/native-record seam in `web/test/inbox.test.ts`: complete subjects and session facts, offered choices, optional denial notes, Escape without an answer, held delivery/failure, and the exact archived race winner. Keep TUI-only cards button-free and route reusable card keys through the shared map and shell dispatcher. The approval drawer reads bounded `session.history`; retain an exact rendered message receipt.

For the Codex approval relay, use the scripted native frame seam and explicit fake-binary contract receipt in `docs/agents/tests.md` (Approval record changes). Prove native decisions and shared request ids, including replay, external resolution across readback/disconnect and malformed or oversized subject TUI fallback; file approval subjects come from the matching turn/item. The contract receipt must show that Deny continues without running the command.

For OpenCode relay changes, follow `docs/agents/tests.md` (The OpenCode relay) for scripted native reply, child/reconnect/shape checks and the targeted fake-binary Deny-with-note receipt, separate from mode-free task coverage.

For approval race/restart changes, keep the existing native/frame seams and run `hub/test/approval-restart.test.ts` explicitly for the T3 scratch hub-process receipt. Codex's observable race boundary is resolution before its response-write receipt; its own echo follows delivery. OpenCode confirms through the HTTP result, not an equal choice in an event. Recover persisted OpenCode child owners before reconciliation, and wait for the exact `approval-rebuilt` native-validation receipt after a held recovery before answering in the restart test. Treat persisted authorization as display metadata until current native validation completes: hold/malformed replay tests must refuse without any endpoint call, and validated fields replace old subject/choices/routing while keeping id/since. Preserve allowlisted persisted ids/subjects and archive outcomes, and label unobserved off-stream choices `answered in the harness`. See `docs/agents/tests.md` (Approval races) and the protocol limitation in `hub/README.md`.

For ask outcomes, a declined ask is a decision and never consent. Human `topic.answer {ask, declined: true, reason}` requires a non-empty reason, delivers `declined: <reason>` and leaves the topic open; return the unchanged decision down the lead chain with `ask.answer`. Use the public-frame and recorded-headless decline seams in `docs/agents/tests.md`; Neovim does not initiate declines in 0.2.0.

For copied-tracker tests, derive live ids from the scratch copy; name the seeding
owner beside seeded literal ids with `cland-allow-tracker-id`. Read the T0 guard
scope in `docs/agents/tests.md` when adding copies or exceptions. Keep payload
caps above measured copied-state bytes with growth headroom, alongside synthetic
fixtures.

For native child launches in `hub/test`, use the complete `fixtureEnvironment`
or `accountFixtureEnvironment` result after explicit owned extras. Fresh runner
children use `runnerFixtureEnvironment` to filter inherited paths while keeping
execution/admission controls. Read the T0
child-environment guard scope in `docs/agents/tests.md`; intentional seams need a
nearby `cland-allow-child-env` comment naming the sealing owner or native contract.
Run the guard's `--inventory` when reviewing exemptions. It prints no environment
values.

For executor fixtures and partial environment overlays, follow the scratch-ledger
proof in `docs/agents/tests/hub-test-suite-accounting.test.ts.md`; publish the sealed
environment after the final options spread. Registration and missing-project
sweeps use `docs/agents/tests/hub-test-executor-spend.test.ts.md`.

Periodic dev T3 and nightly soak queue/heartbeat rows and artifacts name `hub`; ordinary human shell runs keep `human` ownership (automatic chips in read-only Agents remain hub notices). Attribution uses existing occasion facts after restart, with no new wire field or role permission. Periodic dev T3 uses the admitted commit's Git objects and checks remotely at that detached head; later root commits cannot invalidate it. Bundle/delivery failures before execution retain `outcome.notRun: "infrastructure"` and publish `result: "not-run"` with the cause. They supply no green/red cover, release evidence or culprit search, and retry the next eligible tip after the interval. Provider capacity refusals at size/spend admission or acquisition use `notRun: "provider-capacity"` and retain the original cause; periodic notices say "not run: provider capacity", task results say "unavailable: provider capacity" and latest verify result is `unavailable`. No executor/region/size fallback applies. Such a receipt is missing runtime evidence, not a criterion failure or passing proof; report the blocker to the item lead. For historical or Web culprit-search changes, use `docs/agents/tests/hub-test-dev-t3-search-component.test.ts.md`. Report boundary confirmation cost: at most two extra droplet probes per failing file, or one for an absent predecessor; only the boundary pair repeats. Historical probes log skipped hosting lint and retain candidate commands. Known platform exclusions remain partial evidence; use the component guidance for exact exclusion/platform comparisons and negative controls. Use the sealed bundling and fake-executor seams in `docs/agents/tests/hub-test-suite-soak-component.test.ts.md` and `docs/agents/tests/hub-test-suite-soak.test.ts.md`.

For coverage selection, pointer retention or shard merging changes, follow
`docs/agents/tests.md#coverage-ancestry-and-fallback`: prove parsed/retained map
counts and retained pointers at the loader seam, with named expiration events.

An explicit `--size` override absent from the provider catalog is invalid input:
submission exits 1 with an "unavailable" error and creates no job or droplet.
Listed unavailable sizes or sizes absent from configured regions retain the
provider-capacity outcome; configured catalog absence remains a capacity refusal.
For sharded cover outcomes, use the sealed scheduler and public-notice seams in
`docs/agents/tests.md`: preserve each unexecuted shard's cause, distinguish an
entirely unexecuted group from partial execution, and retain executed results.

Shell CLI calls claiming a session require its own credential: the adapter's `CLAND_LAUNCH_TOKEN`, otherwise the private session-id-bound fallback file provisioned by its own MCP spoke reconnect. An invalid environment token never falls back. A named credential refusal calls for reconnecting that session's own spoke or `session resume --relaunch`; legacy running shells migrate on reconnect without relaunch. Relaunch rotates the credential; archive removes its private directory. The hub uses its stored role. Keep credentials out of argv, logs and artifacts. See `hub/README.md` (Task CLI trust model).

Automatic run reports and verify/executor-prepare defaults go to Agents, addressed to the Coordinator; log chips follow the report topic. Item workers keep explicit `--report <item-topic>` and Reviewer/claimant recipients. General retains Coordinator exit/vacancy recovery notices for the human.

Run typechecking and targeted single test files while implementing. Merge batches run T0 before configured tiers and add Web after T1 for web/ diffs; use the receipt/bisection seams in `docs/agents/tests.md#queued-merge-batches` for changes there. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

For README/docs edits, run `node hub/test/lint-closed-item-wording.ts` against the
candidate tracker. Fix landed-work claims; document any historical or unrelated
runtime wording with the reason-required line exemption in
`docs/agents/tests.md` (closed-item wording guard).

When changing dictionary membership or prototype checks in this repository's
`hub/src`, read the T0 dictionary guard scope and exemption rules in
`docs/agents/tests.md`.

Once done, request the hub Reviewer as described below; outside a hub session, use the "code-review" skill.

Task claim/launch links absent worktree `node_modules` to the root install.
Read `worktree.warning` for stale own installs or links; never replace an install
under running readers. A host check's `dependencies out of date: run npm install`
means a locked package is missing: report it to the item lead so the Coordinator
can arrange a root install after shared readers stop.

Commit your work to the current branch.

On a tool result with `code: "invalid_argument"`, correct the named fields using its accepted values and retry. A `forbidden` result is a permission refusal: stop that action and follow the lead-chain escalation in your role clause. See `docs/agents/session-permissions.md`.

In a hub session, use the claimed item's existing topic; if it has none, open it with `cland topic create "<title>" --item T-<n> --json` or the `topic.create` tool. An Implementer may open only its own item's topic.

In a hub session, mark every acceptance criterion done with `cland task criterion T-<n> done C<n>` before requesting the final review. Read `task view` for the criterion ids. Done marks are separate from Reviewer/QA verification; ready needs both. If only done marks are missing, the hub notices the claimant in the item topic, repeating only when that claimant’s missing set changes. A replacement claimant receives its own first notice.

The `send` tool accepts `to` as one recipient string or an array of strings (`string | string[]`); for review, use `to: "reviewer"` or `to: ["reviewer"]`. Other shapes are validation errors; omitted `to` or `[]` addresses the human.

In a hub session, set your claimed item to `review` and send `review request T-<n>` to `reviewer` in the item's topic with the committed branch/head and criteria. Inspect the send outcomes: `resolvedTo` names the selected Reviewer; a `queued` outcome waiting for the next free verifier means the hub will assign it automatically and send you an assignment or refusal notice. Wait for that notice instead of resending the same request. A refusal names the retry rule. When no verifier is live, report the staffing blocker to `lead T-<n>` so it can launch one; the queued request remains pending.

Before requesting review, fetch and merge `origin/dev`, then commit and push the head to review. After a clear source verdict, run `cland verify` at the exact reviewed head and wait for its hub result. A fix or later merge that changes the head needs a new review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. The Reviewer settles the final verdict when the same-head result arrives; see `docs/agents/tests.md`.

A verify queued locally after a remote-budget fallback can reclaim a free remote slot in its original queue order, including after a hub restart; the hub reports the move in its topic. Wait for that request rather than resubmitting. Explicit `--executor local` stays local.

Cache evidence names the original occasion and executor. Release reuse requires
full matching coverage on the effective executor/OS, including configured defaults;
a local macOS stage receipt cannot satisfy a droplet release request. See
`docs/agents/tests.md` for receipt identity and provenance.

## Verifier request procedure

- Inspect request outcomes: `resolvedTo` names the verifier; `queued` waiting for a free verifier means the hub will deliver automatically and notify you. Wait instead of resending. If no verifier is live, report the staffing blocker to your lead; a refusal notice names the retry rule.
- Text after the item on the request's first line is detail: `review request T-12 — branch, head, scope` resolves one verifier exactly like the bare form, so a detail placed after the id never turns the request into a role broadcast. A letter glued to the id (`review request T-12abc`) is no request at all.

## Review/QA request procedure

Clause procedure (defaults implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build after the `qa` skill’s lint preflight; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

Clause procedure (project implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

## Verdict procedure

- On a not-clear verdict, fix the findings, commit and push a new head, then request review again before a new verification run and request affected QA again yourself. A clear source verdict starts verification; the Reviewer settles the final verdict on its same-head result. A final clear verdict needs no relay to the Coordinator: the hub checks freshness and sends the nearest supervising Lead (or the Coordinator) the one `ready` status event. Keep your claim until merge; report only if blocked.
