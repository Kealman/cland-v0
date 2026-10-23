---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "CHANGES"
---

Implement the work described by the user in the spec or tickets.

When editing a kept upstream skill, append the change and item as a new line in its sibling `CHANGES`; keep `metadata.changes: CHANGES` stable.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

For hub shutdown changes, use the real-process receipt tests described in `docs/agents/tests.md#implementer-test-selection`, including held fake-provider mutations and late-resource reconciliation; interpret `hub stop`'s released-lock/live-PID diagnostic and signal cleanup deadline through `hub/README.md`.

For remote watchdog changes, use the executor-fake guidance in `docs/agents/tests.md#implementer-test-selection`: observe mirrored byte progress, the terminal timeout receipt and released resource; preserve the admitted stall limit across restart.

Before writing or changing a test, read "Test levels" in `docs/agents/tests.md` and put each test at the lowest tier that proves its behaviour: no new real process without a lifecycle reason, and no wall-clock waits.

For `web/` changes in this repository, follow the root AGENTS.md web rule and `web/README.md`. The root check builds the ignored bundle after typechecking, including on local verification; no separate development bridge is used.

For message or notes Markdown, read `web/README.md#message-markdown` for the pure
token contract, configured item prefixes, per-message fences and raw-HTML source
guard; use the T1 parser seam named in `docs/agents/tests.md#web-phase`.

For browser tests, follow `docs/agents/tests.md#web-phase` and `web/README.md#browser-tests`: use the isolated Headless Shell fixture, keep CSP enabled and observe teardown. `npm install` prepares the pinned shell; targeted browser files require a current bundle. The hub web-auth file builds its bundle through the shared helper before standalone tests; suites build before any installation-bundle reader in `hub/test/run-suite.ts`’s `installedBundleReaders` list, including real doctor CLI tests on shards without Web or an available browser. Targeted standalone doctor CLI runs require a current build. Task verification includes Web outside T0–T2; merge batches exclude it. A machine-unavailable Web receipt is not passing browser evidence; see that section.

For network bind, tunnel and QR tests, follow `docs/agents/tests.md#browser-sign-in-fixtures`: bind only disposable loopback aliases or use scratch config; observe web and spoke addresses independently.

For missing droplet browser libraries, report to the item's lead: the human or Coordinator rebuilds the prepared snapshot after restarting the hub onto the provisioning change. See `docs/agents/tests.md#web-phase` for the root provisioning and lockfile-key boundary.

For browser sign-in probes, follow `docs/agents/tests.md#browser-sign-in-fixtures`: `cland web` is human-only; use a disposable project and test client, with scratch browser opener stubs. Cookie sessions persist for 30 days from creation; `web --sessions` and `web --revoke <id>` are also human-only Unix-socket commands. Test clients use those frames on disposable projects, never the live session actor. `web.session` reads only the sign-in bound to the authenticated web socket, with no cookie or identity selector; `session.history` is a bounded human-client read across topics, separate from spoke `history`. Web launches refuse every own `cwd` field; local launches keep it. Web authority changes update the explicit deny-by-default policy and its protocol conformance test; use the same section for T1 policy and T2 web/Unix fixtures.

`artifact.url` is a web-only human client frame: test minting through an authenticated `/ws` connection, then request `/a/<capability>/<file>` without cookies. Use the disposable T2 fixture in `web-artifacts.test.ts` for confinement, sandbox headers and cookie-session lifetime; no agent permission or CLI command mints capabilities. Artifact iframes must never combine `allow-scripts` with `allow-same-origin`.

For item clients, consume hub-computed summaries and roll-ups from snapshots and deltas. The first payload contains open rows and their ancestors. Fully closed containers and tasks load in bounded per-parent `task.list` summary pages; follow newly loaded containers and deduplicate retained ancestors by identity. Card-only dates/branch/relations/compact verification travel in snapshots and by-id pages; ordinary summary lists and parent pages omit these extras to protect the native first-payload budget. Closed card facts and a complete compact tree row are fetched in bounded by-id `task.list` summary pages; item links use the canonical id and parent to load and unfold missing ancestors without reading the body; fetch the body through `task.view` only when agents’ text or the criterion editor is opened; preserve the 1 MiB snapshot cap and Lua differential guard. See `hub/README.md` (summary projection) and `docs/agents/tests.md#connection-snapshots`.

For web card criterion edits, use `task.criterion` with the authenticated human and no `as` field. Keep one-line text separate from the `Ck.` id label, preserve ids and drafts, disable offline writes and never replay mutations after reconnect. Legacy criteria with null ids stay read-only until Add or a CLI write returns persisted ids; explain this in a tooltip and never guess an id. `e` is scoped to the criteria block through the shared key map. Labels, body and other item fields stay read-only in Items. Use the three Web/CLI seams in `docs/agents/tests.md#web-phase`; no protocol or role permission expansion is needed.

For Neovim recording refreshes, follow `docs/agents/tests.md#neovim-recorded-frames`: audit every reduced slice before changing its stored expectation. The named local-only summary/decoder checks are excluded from full discovery; every selected file retains the zero-frame guard.

For human marks changes, preserve the forward-only timestamp/plan-history ordering and the durable one-time import acknowledgement before removing `events.last_look` or `plan_seen` from `ui.json`. Use the real-frame and recorded-headless seams in `docs/agents/tests.md#human-marks-fixtures`; no role-clause expansion is needed for these human-only UI frames.

For human topic kinds and queued withdrawal, use the public-frame/fake-spoke seams in `docs/agents/tests.md#human-kinds-and-queued-withdrawal`. Only a human Question starts a wait; withdrawal succeeds before adapter submission and returns the text. Preserve the durable submission fence and held notes.

For approval records, use the sealed frame and recorded-client seams in `docs/agents/tests.md` (Approval record changes). Retain the existing inbox fields, the session-scoped native id, the 64 KiB subject allowlist and the explicit outcome; Claude Code's record stays TUI-only. For `approval.answer`, use the same doc's scripted fake adapter and authenticated web-cookie checks: only the human answers, Aides are refused, the first answer reserves `answering`, and delivery failure restores `pending` with a warning. Keep Deny intact and verify the native note or human message fallback; nothing answers by default.

For the Codex approval relay, use the scripted native frame seam and explicit fake-binary contract receipt in `docs/agents/tests.md` (Approval record changes). Prove native decisions and shared request ids, including replay, external resolution across readback/disconnect and malformed or oversized subject TUI fallback; file approval subjects come from the matching turn/item. The contract receipt must show that Deny continues without running the command.

For OpenCode relay changes, follow `docs/agents/tests.md` (The OpenCode relay) for scripted native reply, child/reconnect/shape checks and the targeted fake-binary Deny-with-note receipt, separate from mode-free task coverage.

For ask outcomes, a declined ask is a decision and never consent. Human `topic.answer {ask, declined: true, reason}` requires a non-empty reason, delivers `declined: <reason>` and leaves the topic open; return the unchanged decision down the lead chain with `ask.answer`. Use the public-frame and recorded-headless decline seams in `docs/agents/tests.md`; Neovim does not initiate declines in 0.2.0.

Run typechecking and targeted single test files while implementing. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

When changing dictionary membership or prototype checks in this repository's
`hub/src`, read the T0 dictionary guard scope and exemption rules in
`docs/agents/tests.md`.

Once done, request the hub Reviewer as described below; outside a hub session, use the "code-review" skill.

Commit your work to the current branch.

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

## Review/QA request procedure

Clause procedure (defaults implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build after the `qa` skill’s lint preflight; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

Clause procedure (project implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

## Verdict procedure

- On a not-clear verdict, fix the findings, commit and push a new head, then request review again before a new verification run and request affected QA again yourself. A clear source verdict starts verification; the Reviewer settles the final verdict on its same-head result. A final clear verdict needs no relay to the Coordinator: the hub checks freshness and sends the nearest supervising Lead (or the Coordinator) the one `ready` status event. Keep your claim until merge; report only if blocked.
