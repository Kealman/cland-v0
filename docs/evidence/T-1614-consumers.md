# T-1614 consumer sweep

Search before implementation: `session.resume`, resume request validators/dispatch, lease function names and persisted lease/worktree fields across hub, web, nvim, shared, shipped skills, fixtures and docs (all tiers).

The request adds optional `host`; all existing fields stay accepted. requests.ts validates/dispatches it; Sessions owns lifecycle admission; TaskWorktrees prepares the destination; branch-leases owns the atomic transfer. No schema columns/indexes are added.

CLI, web, nvim and setup continue sending the previous wire shape, without host. Their usage/fixtures remain unchanged; session-resume.test.ts remains unedited as compatibility coverage. Spoke session tools use the shared session request schema; permission lists and web authority classify the operation name, unaffected by the optional field. No new CLI flag.

Lease readers (receive hook/git daemon and merge/batch snapshots) retain the tab-separated host/branch format. Existing grant/revoke callers retain behavior. Host-worktree listing/pruning/publication readers retain the single current owner record and phase semantics. Unknown destination preparation remains fenced as adding. Native old-generation obligations use the existing retention table.

Search hits (existing tests/fixtures remain previous-wire compatibility consumers unless explicitly changed in the item diff):

- `hub/src/remote/discord-socket.ts`
- `web/src/sessions/SessionActions.tsx`
- `docs/hub/web-edge.md`
- `hub/src/hub/store.ts`
- `hub/src/hub/merge.ts`
- `shared/wire/index.ts`
- `hub/src/hub/merge-batch-territory.ts`
- `hub/src/hub/dispatch.ts`
- `hub/src/hub/web-authority.ts`
- `nvim/lua/cland/sessions.lua`
- `docs/hub/roles.md`
- `hub/src/hub/worktrees.ts`
- `web/test/phone-sessions.test.ts`
- `docs/hub/declining-an-accepted-verifier-request-t-1494.md`
- `web/test/session-actions.test.ts`
- `hub/src/territory.ts`
- `.agents/skills/implement/CHANGES/T-1604-host-clone.md`
- `hub/src/adapters/requests.ts`
- `docs/agents/session-permissions.md`
- `hub/src/cli/session.ts`
- `docs/hub/adapters-and-sessions.md`
- `hub/src/host/task-worktrees.ts`
- `hub/src/host/branch-leases.ts`
- `hub/src/roles/default-roles.ts`
- `hub/src/roles/permissions.ts`
- `hub/src/roles/editor.ts`
- `docs/evidence/T-702-assertion-inventory.md`
- `hub/src/setup/hub.ts`
- `docs/spec/v0.1.4.md`
- `hub/test/launch-recovery.test.ts`
- `hub/test/verifier-routing-process.test.ts`
- `hub/test/durations.json`
- `hub/test/cli-session-credential.test.ts`
- `nvim/test/fixtures/protocol-frames.json`
- `hub/test/permissions.test.ts`
- `nvim/test/session-resume.test.ts`
- `hub/test/roles-session-refresh.test.ts`
- `nvim/test/stub-hub.ts`
- `docs/agents/tests/hub-test-claude-code-sessions.test.ts.md`
- `hub/test/subscription-hygiene.test.ts`
- `hub/test/session-resume-lifecycle.test.ts`
- `hub/test/codex-adapter.test.ts`
- `hub/test/claude-code-sessions-lifecycle.test.ts`
- `hub/test/cli-identity.test.ts`
- `hub/test/pid-identity.test.ts`
- `hub/test/session-resume-component.test.ts`
- `hub/test/opencode-adapter.test.ts`
- `hub/test/inject-stalled.test.ts`
- `hub/test/aide-migration.test.ts`
- `hub/test/session-credential-io.test.ts`
- `hub/test/session-archive.test.ts`
- `hub/test/session-usage.test.ts`
- `hub/test/lead-permissions-component.test.ts`
- `hub/test/request-guard.test.ts`
- `hub/test/subscriptions.test.ts`
- `hub/test/claude-code-adapter.test.ts`
- `hub/test/host-allow-list.test.ts`
- `hub/test/account-limited.test.ts`
- `hub/test/host-clone-integration.test.ts`
- `hub/test/aide-component.test.ts`
- `hub/test/claude-code-sessions.test.ts`
- `hub/test/role-integrity-component.test.ts`
- `hub/test/roles-editor.test.ts`
- `hub/test/roles-launch-permissions.test.ts`
- `hub/test/adapter-composition.test.ts`
- `hub/test/codex-remote.test.ts`
- `hub/test/host-push-on-ref-move.test.ts`
- `hub/test/session-host-placement.test.ts`
- `hub/test/tool-arguments.test.ts`
- `hub/test/accounts.test.ts`
- `hub/test/fake-harness.test.ts`
- `hub/test/host-lease-lock.test.ts`
- `hub/test/session-resume.test.ts`
- `hub/test/host-git-daemon.test.ts`
- `hub/test/claude-code-accounts.test.ts`
- `hub/test/session-native-lifecycle.test.ts`
- `hub/test/orphan-servers.test.ts`
- `hub/test/session-async-processes-lifecycle.test.ts`
- `hub/test/verifier-routing.test.ts`
- `hub/test/aide.test.ts`
- `hub/test/name-reservation.test.ts`
- `hub/test/host-flush-native.test.ts`
- `hub/test/web-authority-unit.test.ts`
- `hub/test/session-model.test.ts`

## Added persisted facts

`host-relaunch-intent:<sessionId>` pins source hostGenerationKey, source/destination,
item and cause, then tracks admitted/prepared/failed and the confirmed destination
record/failure. Sessions owns admission, failure, resume/delivery refusal and public
pending warnings. TaskWorktrees owns the short admission and later preparation
locks; adapter drain runs between those lock scopes. ProcessTable.put's optional
HostRelaunchCompletion publishes row, ready owner, warning and intent deletion in
one transaction on the shared database. All old put callers omit this optional
completion and keep their existing behavior; no columns/indexes or schema change.

`host-relaunch:<new hostGenerationKey>` stores the restart note for indexed
session-view warnings. Shared key/type definitions live in host/relaunch-state.ts.
No retained-history scan is introduced. Failed destinations remain adding and
owned; same-destination refresh/checkout identity and onward obligations are not
implemented here (Coordinator split them into T-1698).

The independent browser-safe SessionRequest declaration in shared/wire/index.ts
adds the optional host field; compile-time wire conformance remains the guard.
MCP session requests use the central SessionRequest validation path; permissions
and role clauses keep the same operation authority. No role grant is changed.

## Integrated handoff

After the Coordinator-authorized single dev merge (f68f696f0), the relaunch caller
uses Sessions.releaseUnreachableGeneration. Its shared generation validation and
captured carrier-owner/forward removal remain in that public owner; there is no
direct adapter-hook call or copied validation. Fake receipts add forwardIds.
The production Codex native case uses two carriers registered in one project
registry and the fake executable's durable input-consumption JSONL. It captures
scoped endpoint identities and checks that source restoration cannot recreate the
dropped forward. Existing session-resume tests remain unedited.
