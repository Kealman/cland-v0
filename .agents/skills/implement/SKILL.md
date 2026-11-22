---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "CHANGES"
---

Implement the work described by the user in the spec or tickets.

Read the matching [subsystem reference](../../../hub/README.md) for implementation guidance. Follow [documentation placement](../../../docs/agents/documentation.md) when adding item documentation.

When adding item guidance, put subsystem instructions in the matching indexed reference and record skill provenance in `CHANGES/<item>-<topic>.md`. Deliberate workflow edits require a paragraph-scoped `<!-- cland-workflow-change: T-<n> <reason> -->` marker; see [documentation placement](../../../docs/agents/documentation.md).

Run typechecking and targeted single test files while implementing. In a hub session, run full verification after a clear source review through the procedure below; outside the hub, run the full suite once at the end.

<!-- cland-workflow-change: T-1890 point implementers to advisory condition-wait guidance -->
Condition-wait literal bounds have a report-only ratchet in test lint. Use a
named `behaviour` for a product deadline; setup waits use load headroom. New
advisory findings do not change admission or lint exit status. See
[test lint reports](../../../docs/agents/tests.md#test-lint-reports).

<!-- cland-workflow-change: T-2046 describe per-operation setup defaults and advisory census -->
Shared setup waits sample current load per operation; use `testDeadlineMs` for
fake defaults and retain injected-clock fault bounds. Browser fixtures refresh
action/locator defaults per operation; when its config setting is absent, the
Node timeout backstop scales once per runner launch. Explicit configured bounds
and admitted limits without default provenance stay exact. Test lint also lists remaining numeric timeout sites across test
helpers in report mode. That census never changes lint or admission exit status.
Repetition import watchdog defaults sample at each child admission from the
runner environment; pass an explicit startup budget only for a controlled bound.
Omit the startup helper's factor for shared sampling; converting an unset value
to NaN is refused.

<!-- cland-workflow-change: T-2051 document hub admission default provenance -->
Fresh hub admissions and queued config capture retain parser default provenance.
Generated config writes an explicit timeout. This runtime policy requires a hub
restart; legacy snapshots remain exact.

For evidence publication, use `publishSessionEvidence` from the shared
[scan-and-publish helper](../qa/EVIDENCE.md).
It scans the exact private snapshot and calls artifact.create only after a clean
receipt with a generated positive control. A refusal stops publication; redact
false positives in the export and invoke the helper again.

When working as a custom role, read `docs/agents/session-permissions.md#custom-roles` for the own-claim review/verification path and route completion to the Coordinator.

When editing a kept upstream skill, write the change and item in a new sibling `CHANGES/<item>-<topic>.md` file; keep `metadata.changes: CHANGES` stable.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

For task CLI syntax, use `cland task <subcommand> --help` (or `-h`)
immediately after the subcommand: it prints its forms and shared options without
requiring a hub or valid project configuration.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Before writing or changing a test, read "Test levels" in `docs/agents/tests.md` and put each test at the lowest tier that proves its behaviour: no new real process without a lifecycle reason, and no wall-clock waits. A `[t3-lifecycle]` refusal at line 1 of an existing T3/T4 file means its lifecycle header was lost: restore that first comment block before reading process-helper allowances.

Platform-conditional skips supply a nonblank prerequisite reason on the skipping
branch and `false` on the running branch. The report-only `skip-reason` census
detects direct boolean skip options; see `docs/agents/tests.md#test-lint-reports`
and the prerequisite receipt fixture in
`docs/agents/tests/hub-test-durations-runner.test.ts.md` for `5/5 skipped` evidence.

On `cover-quiet`, an authenticated refusal registers a durable one-shot
`test-slot-available` hub report. Do other work or end the turn until it arrives;
never poll with sleep or `cland verify queue`. Retry the targeted command after
the report; it checks admission again. If the running hub still says "wait for
it to finish", report the missing wake-up capability to the Coordinator and
end the turn until its release notice or authorized restart.

Before local tests or typechecking in cland, check `node --version` against
cland's root `package.json` engine range. For provisioned QA skills, use
`.agents/skills/qa/node-engines.json`, shipped from that same contract; the host
project's manifest is not cland's runtime authority. With nvm, source `"$NVM_DIR/nvm.sh"` (or
`"$HOME/.nvm/nvm.sh"` when NVM_DIR is unset), then `nvm use 24`; confirm the
selected version meets the full range, including its minimum patch. Otherwise
prepend an installed supported Node's `bin` directory to PATH for the command;
an absolute `node` alone does not select the runtime for its child commands.
Targeted admission prints one warning per admission on unsupported Node,
including standalone runs; treat that evidence as unsupported and rerun on the
supported version. This warning does not replace cover-quiet admission.

For README/docs edits, follow [documentation placement](../../../docs/agents/documentation.md).

For README/docs edits (including site MDX prose), run `node hub/test/lint-closed-item-wording.ts` against the
candidate tracker. Fix landed-work claims; document any historical or unrelated
runtime wording with the reason-required line exemption in
`docs/agents/tests.md` (closed-item wording guard).

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

In a hub session, set your claimed item to `review` and send `review request T-<n>` to `reviewer` in the item's topic with the committed branch/head and criteria. Inspect the send outcomes: `resolvedTo` names the selected Reviewer; a `queued` outcome waiting for the next free verifier means the hub will assign it automatically and send you an assignment or refusal notice. Wait for that notice instead of resending the same request. A refusal names the retry rule. When no verifier is live, report the staffing blocker to `lead T-<n>` so it can launch one; the queued request remains pending. For verifier routing or pending-marker changes, use `docs/agents/tests/hub-test-verifier-routing.test.ts.md`, including its ready-transition reservation and legacy `{item,kind}` restart recovery cases.

Before requesting review, fetch and merge `origin/dev`, then commit and push the head to review. After a clear source verdict, run `cland verify` at the exact reviewed head and wait for its hub result. A fix or later merge that changes the head needs a new review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. The Reviewer settles the final verdict when the same-head result arrives; see `docs/agents/tests.md`.

<!-- cland-workflow-change: T-1898 document Coordinator-only live executor switch -->
The Coordinator or human can switch the default and merge-batch executor live
with `cland verify executor local|droplet [--workers N]`. Implementers retain
their per-run override procedure; running runs keep their admitted policy.

Cache evidence names the original occasion and executor. Release reuse requires
full matching coverage on the effective executor/OS, including configured defaults;
a local macOS stage receipt cannot satisfy a droplet release request. See
`docs/agents/tests.md` for receipt identity and provenance.

<!-- cland-workflow-change: T-1891 document filed flaky rerun receipt ownership -->
The hub may excuse a filed flaky hub/nvim cover or batch identity only after five
same-tree passing reruns through normal executor admission. Keep the original
native failure in reports and name the green-with-receipt evidence. The hub
writes the quarantine manifest into durable run evidence; the Coordinator lands
tracked entries separately. Filed Web failures remain red after five passing
reruns (`Web identity outside quarantine scope`), without a manifest entry.
See [test policy](../../../docs/agents/tests.md).

## Verifier request procedure

- Inspect request outcomes: `resolvedTo` names the verifier; `queued` waiting for a free verifier means the hub will deliver automatically and notify you. Wait instead of resending. If no verifier is live, report the staffing blocker to your lead; a refusal notice names the retry rule.
- Text after the item on the request's first line is detail: `review request T-12 — branch, head, scope` resolves one verifier exactly like the bare form, so a detail placed after the id never turns the request into a role broadcast. A letter glued to the id (`review request T-12abc`) is no request at all.

## Review/QA request procedure

Clause procedure (defaults implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build after the `qa` skill’s lint preflight; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

Clause procedure (project implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

## Verdict procedure

<!-- cland-workflow-change: T-2050 document completed verification readiness -->
Automatic ready waits for a finished passed receipt at the exact task tip when
the running project config has a test or tier command; a same-tree cache hit
projected at that tip qualifies. A latest in-flight, red, cancelled or incomplete
receipt keeps review. No configured test command or an empty base diff retains
verdict-only readiness. A declined review/QA request grants no suite exemption.

- On a not-clear verdict, fix the findings, commit and push a new head, then request review again before a new verification run and request affected QA again yourself. A clear source verdict starts verification; the Reviewer settles the final verdict on its same-head result. A final clear verdict needs no relay to the Coordinator: the hub checks freshness and sends the nearest supervising Lead (or the Coordinator) the one `ready` status event. Keep your claim until merge; report only if blocked.
