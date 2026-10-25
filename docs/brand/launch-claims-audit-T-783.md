# T-783 launch documentation claim audit

Audited on 2026-10-24 against dev `86449530f6f292a3cad7e4debeeb56d45d9ec498`, newer than the public v0.2.0 tag. Changes are documentation only. All 15 pages under `site/src/content/docs/docs/`, README, the landing crew/features/FAQ/install sections, and the software-factory merge claim were read. This audit does not claim that the public installer or every provider/model is launch-qualified.

Later update (v0.2.1): the Homebrew tap now exists at `Kealman/homebrew-tap`, and the current install claims live in `install.md`, `quickstart.md`, the landing page and the READMEs. The tables below record what this audit read on 2026-10-24; a command block quoted there is not a current install command.

`ok` means the claim matches the named code or authoritative project instructions. `fixed` means the text was corrected. `gap` names missing or unqualified launch behavior, reported to the Coordinator; a gap is not a runtime pass. Paths are repository-relative; brace shorthand names the corresponding files in one directory. UI behavior was source-checked, without opening any browser.

## Launch exceptions to collect before publication

The Coordinator accepted this C2 evidence boundary in topic-953, decision `ae3f5d65-449a-4f30-8991-471619f1db20`: syntax/source contracts plus isolated local runtime receipts; the following live receipts belong to the E-778 launch check.

- Public Homebrew and Linux install/update/uninstall paths: T-779 / T-780.
- Provider logins and model availability: actual harness/account/provider authentication; free-model crews remain E-1216 qualification.
- Package installation: source `npm ci`/`npm link` and harness installers. No install was run by this session.
- GUI opens and phone/PWA installation: actual Neovim attach, browser, tunnel and device behavior.
- Cloud provisioning: DigitalOcean permissions, prepared images, running machines and spend receipts.
- GitHub publication: real release/publish/sync with the approved public refs and credentials.

Known policy/marketing gaps: generated vs compatibility Codex sandbox decision T-1222 and universal subcommand help T-1223 (reported in topic-953 and filed under E-778). The solo preset gap was resolved by T-1221 and custom roles were delivered by T-781 before the final conflict recovery below. The text describes what works at the audited baseline; those owners must refresh it when their behavior lands. No role clauses or product files were changed.

## Conflict recovery after first ready

The merge gate requested integration with current dev after T-1209 and T-1105 landed. On 2026-10-24 the Coordinator authorized that integration (topic-953, `91cdc03f-fa49-4c09-9bbe-f87d0e429132`). Latest fetch resolved to dev `ab77eae3fc7a9834390a8ca3b0a656a2e932fe31`; T-780 had not landed. The two T-783 documentation commits were replayed on that tip, preserving both sides, including T-1221's Smallest crew copy. The previously green head `5e16ec84` remains historical evidence; the replacement head requires fresh source review and mode-free verification.

A second Coordinator request (`a1464eb5-18f9-40c4-a927-3c94eef0982e`) required integration of dev `9f385c8c5d0f80ac63ee34deddf61fee895e01d7` after T-780 landed. The install.md conflict was the equivalent Node requirement sentence; the precise Node 24 wording was retained alongside all of T-780's installer prerequisites, paths, prefix/version examples and uninstall text. README and Quickstart now state the installer's Node/npm prerequisite too. T-780's installer is source-checked here; the public-site download and real release installation remain external launch receipts. The obsolete verification at `16c622dc` was cancelled (A-10794), not passed.

The final Coordinator request (`75811faf-1546-492a-bcf9-99a665406f79`) fixed dev at `956624130bbc3ba3ab80ade149a40c0b2c481cab` for T-781 integration. The crew.md conflict combined the command-edit boundary with T-781's custom-definition instruction; the entire new custom-role section and its examples were retained. Custom names, field defaults, manual staffing and grant limits were checked against roles/config.ts, roles/permissions.ts and names.ts. The earlier `4371f90b` green receipt is historical; the replacement head needs fresh review and verification.

## Claim checks

| Page | Claim checked | Source of truth | Result |
| --- | --- | --- | --- |
| index.md | macOS/Linux; Apache-2.0; local single-user project hubs | LICENSE; hub/src/project.ts; hub/src/hub/daemon.ts | ok |
| index.md | One hub per project, rather than one project per user | hub/src/project.ts; hub/src/hub/lock.ts | fixed |
| index.md | Six built-in roles, optional container Leads, custom worker definitions and role/model independence | hub/src/names.ts; hub/src/roles/config.ts; hub/src/crew.ts | ok |
| index.md | Real busy/idle/approval state from adapters | hub/src/adapters/contract.ts; hub/src/adapters/{claude-code,codex,opencode}.ts | ok |
| index.md | Tracker files, local territory, worktrees, ready criteria | hub/src/tracker/tracker.ts; hub/src/territory.ts; hub/src/tracker/gate-verdicts.ts | fixed |
| index.md | GitHub publication includes approved marketing publish | hub/src/cli/publish.ts; docs/agents/issue-tracker.md §Marketing publication | fixed |
| index.md | No automatic account rotation; no direct model-provider token use | hub/src/accounts/registry.ts; hub/src/accounts/poller.ts; hub/src/hub/core.ts; hub/src/accounts/limits.ts | ok |
| index.md | Fifteen-minute startup claim has no runtime bound | hub/src/setup/runner.ts; .agents/skills/onboarding/SKILL.md | fixed |
| install.md | brew install cland and curl install.sh public paths | T-779; T-780; site/public/install.sh (installer absent at original baseline, integrated below) | gap |
| install.md | Source clone/npm ci/npm link and Node >=24.13.0 <25 | package.json engines/bin/workspaces/scripts; package-lock.json | fixed |
| install.md | doctor reports ok/warn/fail, fails on failures, has --json and --fix | hub/src/cli/doctor.ts; hub/src/doctor/report.ts; hub/src/cli/usage.ts DOCTOR_USAGE | ok |
| install.md | gh needed for import/checks; publication uses Git authentication | hub/src/cli/task-import.ts; hub/src/doctor/toolchain.ts; hub/src/territory-release.ts | fixed |
| install.md | Harness discovery and declined installer persistence; --install is explicit noninteractive consent | hub/src/setup/steps/harnesses.ts; hub/src/cli/setup.ts | fixed |
| install.md | claude auth login, codex login, OpenCode --standalone with private DB | hub/src/setup/steps/logins.ts; hub/src/accounts/registry.ts clandOpenCodeDatabase | ok |
| install.md | Nonterminal setup exceptions: --yes, --harness, --install; --no-aide skips hub | hub/src/cli/usage.ts SETUP_USAGE; hub/src/setup/steps/{favourite,trust,hub,aide}.ts | fixed |
| install.md | Pinned Neovim SHA-256, own config, installation cache .cache/nvim/<tag> | nvim/bin/nvim-path.ts; nvim/bin/cland-nvim; nvim/NVIM_SHA256SUMS | fixed |
| install.md | update keeps edited skills, removes untouched dropped skills, respects managed files | hub/src/init/skills.ts; hub/src/init/provision.ts; hub/src/init/files.ts | ok |
| install.md | update preserves roles/crew; setup and hub have narrow role migrations | hub/src/init/provision.ts; hub/src/setup/steps/harnesses.ts; hub/src/hub/configuration.ts | fixed |
| install.md | Version mismatch warning and hub restart command | hub/src/doctor/project.ts; hub/src/cli/hub.ts | ok |
| install.md | Source unlink; territory-only init --undo with unreachable-ref refusal and --force | package.json bin; hub/src/cli/init.ts; hub/src/territory.ts | ok |
| install.md | Script install/uninstall payload paths: ~/.local/bin/cland and ~/.local/lib/cland, custom PREFIX, stable-tag selection and failure recovery | site/public/install.sh; T-780; site/src/content/docs/docs/install.md | fixed by T-780; public live receipt remains a launch exception |
| install.md | XDG accounts registry, shared spend ledger and OpenCode DB directories | hub/src/accounts/registry.ts; hub/src/executor/droplet/spend.ts | ok |
| quickstart.md | Public install commands | T-779; T-780 | gap |
| quickstart.md | init on empty or existing folder, first commit, shallow/home refusal | hub/src/init/provision.ts; hub/src/territory.ts; hub/src/cli/init.ts | ok |
| quickstart.md | Managed skills/hooks/docs; remotes; dev; four categories | hub/src/init/provision.ts; hub/src/territory.ts; hub/src/tracker/categories.ts; hub/src/init/provision.ts | ok |
| quickstart.md | Eight ordered setup steps and step verdicts; login offered only when needed | hub/src/setup/runner.ts; hub/src/setup/steps/logins.ts | fixed |
| quickstart.md | Trust applies to installed Claude/Codex profiles; OpenCode has no gate | hub/src/setup/steps/trust.ts | fixed |
| quickstart.md | Aide terminal handoff and setup --attach; needs terminal | hub/src/setup/steps/aide.ts; hub/src/setup/handover.ts | ok |
| quickstart.md | Onboarding rounds, rules, first release/map, categories, checks, crew, welcome, commit and start | .agents/skills/onboarding/SKILL.md | ok |
| quickstart.md | Session/General/Inbox keys, attach exit and status progression | nvim/lua/cland/actions.lua; hub/src/tracker/tracker.ts | ok |
| quickstart.md | No promised one-minute launch time | hub/src/setup/runner.ts; hub/src/crew.ts | fixed |
| quickstart.md | inbox + topic answer use a real ask id, not shell redirection placeholders | hub/src/cli/inbox.ts; hub/src/cli/usage.ts TOPIC_USAGE | fixed |
| concepts.md | Hub start/status/stop/reload and workbench-independent lifetime | hub/src/cli/hub.ts; hub/src/hub/configuration.ts | ok |
| concepts.md | Session name/account/state/worktree and fixed role responsibilities | hub/src/adapters/contract.ts; hub/src/roles/default-roles.ts | ok |
| concepts.md | Role handover note and role revocation; transcript stays with session | hub/src/roles/handover.ts; hub/src/roles/note.ts | ok |
| concepts.md | Aide speaks for human but does not send decision asks; onboarding still conversational | hub/src/roles/default-roles.ts; .agents/skills/onboarding/SKILL.md | fixed |
| concepts.md | Crew vs roles file ownership and launch settings | hub/src/crew.ts; hub/src/roles/config.ts | ok |
| concepts.md | Kinds/ids/status/size/rank/criteria and topic bound to any item | hub/src/tracker/kinds.ts; hub/src/tracker/prefixes.ts; hub/src/hub/topics.ts | fixed |
| concepts.md | Plan lanes/stages, scope none/affected/full, per-item vs after-stage, approval default none | hub/src/tracker/plan.ts; hub/src/init/config.ts; hub/src/tracker/gate-verdicts.ts | fixed |
| concepts.md | Current independent verdicts and done+verified gate | hub/src/tracker/gate-verdicts.ts; docs/review-and-qa.md | ok |
| concepts.md | Local territory, task branch/worktree naming and pruning | hub/src/territory.ts; hub/src/cli/worktree.ts | ok |
| concepts.md | Marketing publication is another authorized GitHub path | hub/src/cli/publish.ts; docs/agents/issue-tracker.md | fixed |
| concepts.md | Artifact kinds, ids, retention/keep and promotion | hub/src/hub/artifacts.ts; hub/src/hub/artifact-lifecycle.ts; hub/src/cli/artifact.ts | ok |
| concepts.md | Rulebook, scoped clause delivery and rule commands | hub/src/roles/clause.ts; hub/src/cli/rule.ts | ok |
| concepts.md | Coordinator 1h default heartbeat; no human inbox wake | hub/src/crew.ts; hub/src/hub/heartbeat.ts | ok |
| concepts.md | Committed vs ignored paths; account/spend/DB XDG roots; Neovim install cache | hub/src/project.ts; hub/src/accounts/registry.ts; hub/src/executor/droplet/spend.ts; nvim/bin/nvim-path.ts | fixed |
| crew.md | Roles.toml/crew.toml created from installed harnesses, kept on update, last-good reload | hub/src/init/provision.ts; hub/src/hub/configuration.ts; hub/src/crew.ts | ok |
| crew.md | Harness/model/account/effort fields; empty Codex model is native default | hub/src/roles/config.ts; hub/src/adapters/codex.ts thread/start; hub/src/adapters/claude-code.ts | ok |
| crew.md | Effort values passed to chosen harness/model, not universal levels | hub/src/roles/config.ts; hub/src/adapters/{claude-code,codex}.ts | fixed |
| crew.md | OpenCode provider/model#variant and conditional big-pickle/free-catalog preference | hub/src/adapters/opencode/client.ts parseModel/pickFreeModel; hub/src/adapters/opencode.ts #freeModel | fixed |
| crew.md | models cache 24h, aliases default/sonnet/opus/haiku, --account/--refresh | hub/src/models.ts; hub/src/cli/models.ts | ok |
| crew.md | role launch only edits harness/model/effort/account/permissions; sandbox needs file edit | hub/src/roles/launch.ts LAUNCH_FIELDS; hub/src/cli/role.ts | fixed |
| crew.md | Per-launch settings and launcher model completion | hub/src/cli/session.ts; nvim/lua/cland/launcher.lua | ok |
| crew.md | Claude auto/skip/empty policies; onboarding asks before skip | hub/src/adapters/claude-code.ts; hub/src/roles/template.ts; .agents/skills/onboarding/SKILL.md | ok |
| crew.md | Codex generated template vs inherited Implementer/Aide sandbox defaults | hub/src/roles/template.ts CODEX_SANDBOX; hub/src/roles/default-roles.ts; hub/src/roles/config.ts; .cland/roles.toml | fixed; gap |
| crew.md | Codex approval enum, roots/network constraints, local network policy | hub/src/adapters/contract.ts; hub/src/roles/config.ts sandboxOf; hub/src/adapters/codex.ts | ok |
| crew.md | OpenCode ignores Codex/Claude launch policy, uses own permissions | hub/src/roles/config.ts roleLaunchPolicy; hub/src/adapters/opencode.ts | ok |
| crew.md | Relayed approvals available in Neovim/web; TUI-only stays attach; deny and no default answer | nvim/lua/cland/inbox.lua; nvim/lua/cland/inbox.lua; web/src/ApprovalCard.tsx; hub/src/hub/inbox.ts | fixed |
| crew.md | Staffing policies/sizes/keep_context/subagents/heartbeats/leads/idle_from | hub/src/crew.ts; hub/src/hub/core.ts | ok |
| crew.md | Per-group stop_after merge applies at lane end; leads require explicit launches | hub/src/crew.ts; hub/src/adapters/sessions.ts; hub/src/hub/core.ts; hub/src/roles/default-roles.ts | fixed |
| crew.md | crew show/set examples and plan.approval/qa_default settings | hub/src/cli/crew.ts; hub/src/cli/config.ts; hub/src/init/config.ts | ok |
| crew.md | Mixed, single-Claude and minimal crews are configurations; minimal still needs verified criteria | hub/src/roles/config.ts; hub/src/tracker/gate-verdicts.ts | fixed |
| crew.md | OpenCode free crew examples need qualification, not just a listed model | E-1216; hub/src/adapters/opencode/client.ts | gap |
| crew.md | Six built-in roles retain their authority; custom worker roles, clause/skills/tools customization and role commands | hub/src/names.ts; hub/src/roles/config.ts; hub/src/cli/role.ts | ok |
| crew.md | Custom worker definitions: required clause/harness, reserved names, defaults, exclusivity, manual staffing and exact allowlisted grants without built-in verdict/merge authority | T-781; hub/src/roles/config.ts; hub/src/roles/permissions.ts CUSTOM_ROLE_GRANTS; hub/src/names.ts | fixed by T-781; retained during integration |
| accounts.md | Account names/paths only, registry schema and XDG_CONFIG_HOME | hub/src/accounts/registry.ts | ok |
| accounts.md | Per-role and per-launch account selection, harness conflict refusal and no live switching | hub/src/accounts/registry.ts; hub/src/adapters/sessions.ts; hub/src/hub/core.ts; hub/src/roles/launch.ts | ok |
| accounts.md | Official CLI auth; no direct provider calls; provider terms are user responsibility | hub/src/setup/account-identity.ts; hub/src/accounts/poller.ts; hub/src/adapters/{claude-code,codex,opencode}.ts | fixed |
| accounts.md | Only Claude/Codex supply usage windows; OpenCode has no limit data | hub/src/accounts/limits.ts; hub/src/accounts/poller.ts; nvim/lua/cland/accounts.lua | fixed |
| accounts.md | 75/90% colors, reset labels, reading age and 30m stale display | nvim/lua/cland/accounts.lua; web/src/sessions/AccountsStrip.tsx | ok |
| accounts.md | Statusline/app-server receipts and idle polling floor 15m with backoff | hub/src/accounts/poller.ts; hub/src/accounts/limits.ts; hub/src/adapters/codex.ts | ok |
| accounts.md | Hard limited mark, launch/relaunch/reuse refusal, one warning, reset/manual clear | hub/src/hub/core.ts; hub/src/accounts/limits.ts; hub/src/accounts/limits.ts; hub/src/cli/account.ts | ok |
| accounts.md | Coordinator asks before another account; no automatic rotation | hub/src/roles/default-roles.ts; hub/src/hub/core.ts; hub/src/accounts/limits.ts | ok |
| accounts.md | doctor free warning is heuristic; sandbox warning covers all OpenCode roles | hub/src/doctor/project.ts checkConfig | fixed |
| cli.md | No universal subcommand --help; supported help paths exit without hub | hub/bin/cland.ts; hub/src/cli/usage.ts; isolated help.json receipts | fixed; gap |
| cli.md | Normal inherited session actor checks; no per-session authentication guarantee is asserted | hub/src/cli/actor.ts; hub/src/cli/socket-client.ts; hub/src/roles/permissions.ts | fixed (review M2) |
| cli.md | Project/init/setup/open/update/doctor/config flags | hub/src/cli/{init,setup,open,doctor,config}.ts; hub/src/cli/usage.ts | fixed |
| cli.md | web human-only; --no-open/--qr/--sessions/--revoke | hub/src/cli/web.ts; hub/src/hub/web-authority.ts; hub/src/cli/usage.ts | fixed |
| cli.md | Hub start/stop/status/reload/journal/audit/subscriptions/unmute | hub/src/cli/hub.ts; hub/src/cli/usage.ts HUB_USAGE | ok |
| cli.md | Session launch/list/attach/stop/resume/archive/prune/retry flags | hub/src/cli/session.ts; hub/src/cli/usage.ts SESSION_USAGE | ok |
| cli.md | Role list/set/clear/launch and crew show/set/models | hub/src/cli/{role,crew,models}.ts; hub/src/roles/launch.ts | ok |
| cli.md | Account list/clear and actor permissions | hub/src/cli/account.ts; hub/src/roles/permissions.ts | ok |
| cli.md | Task create/view/list/edit/link/comment/close/claim/hold/criterion/rank/plan | hub/src/cli/task.ts; hub/src/cli/usage.ts TASK_USAGE | ok |
| cli.md | Import defaults github then origin, --repo/--all; XL refused | hub/src/cli/task-import.ts; hub/src/tracker/tracker.ts; hub/src/tracker/requests.ts; docs/agents/issue-tracker.md | fixed |
| cli.md | Inbox/topic answer/rule/artifact/subscription flags | hub/src/cli/{inbox,rule,artifact,subscriptions}.ts; hub/src/cli/usage.ts | ok |
| cli.md | Mode-free verify/report/queue/cancel; executor permissions | hub/src/cli/suite.ts; hub/src/cli/executor.ts; hub/src/roles/permissions.ts | ok |
| cli.md | Queued merge, push permission includes Aide, approved marketing publish, release/sync/worktree | hub/src/cli/{merge,push,publish,release,worktree}.ts; hub/src/cli/usage.ts | fixed |
| items.mdx | Markdown tracker and CLI writes; id/kind/prefix/frontmatter fields | hub/src/tracker/{item,prefixes,kinds,tracker}.ts | ok |
| items.mdx | Default ladder peers release/category then epic; version owner; custom constraints | hub/src/tracker/kinds.ts; hub/src/init/config.ts | ok |
| items.mdx | Ladder needs restart; update migrates only old default | hub/src/hub/configuration.ts; hub/src/init/config.ts provisionConfig | ok |
| items.mdx | Container close and epic QA on dev | hub/src/tracker/tracker.ts #checkEpicClose; hub/src/tracker/gate-verdicts.ts | ok |
| items.mdx | Four seed categories, filing/promotion and idle_from | hub/src/crew.ts; hub/src/roles/default-roles.ts; docs/agents/issue-tracker.md | ok |
| items.mdx | Task status transitions and human/Aide/Coordinator changes | hub/src/tracker/tracker.ts; docs/agents/issue-tracker.md | ok |
| items.mdx | Rank ordering and CLI/key controls | hub/src/cli/task.ts; nvim/lua/cland/actions.lua | ok |
| items.mdx | Required XS/S/M/L and XL refusal; L justification in plan | hub/src/tracker/tracker.ts; hub/src/tracker/requests.ts; hub/src/tracker/tracker.ts; docs/agents/issue-tracker.md | ok |
| items.mdx | Stable criteria ids, done/verified/failed authority, exact-head freshness | hub/src/tracker/criteria.ts; hub/src/tracker/gate-verdicts.ts; docs/review-and-qa.md | ok |
| items.mdx | Blocking/regression links and follow-up convention | hub/src/tracker/tracker.ts; docs/agents/issue-tracker.md | ok |
| items.mdx | Explorer/card facts, folded text and desktop web criterion edits | nvim/lua/cland/explorer.lua; web/src/ItemCriteria.tsx; web/src/ItemCard.tsx | fixed |
| items.mdx | Shell examples need existing ids; illustrative ids clarified | hub/src/cli/task.ts; isolated runtime.json receipts | fixed |
| items.mdx | gh import mappings/comments/PR exclusion/idempotence; github then origin; no two-way sync | hub/src/cli/task-import.ts; hub/src/tracker/import-github.ts | fixed |
| workbench.md | Leader keys and view/panel actions shown in the page | nvim/lua/cland/actions.lua; nvim/lua/cland/keys.lua | ok |
| sessions.mdx | Leader keys and view/panel actions shown in the page | nvim/lua/cland/actions.lua; nvim/lua/cland/keys.lua | ok |
| topics.mdx | Leader keys and view/panel actions shown in the page | nvim/lua/cland/actions.lua; nvim/lua/cland/keys.lua | ok |
| workbench.md | Explorer, item panel status/filters/rank, scope, folds, messages and card navigation | nvim/lua/cland/{explorer,panels,items,views,explorer_compose}.lua | ok |
| workbench.md | Session attach/split/launch/Aide/stop/resume/archive/capability keys | nvim/lua/cland/actions.lua; nvim/lua/cland/sessions.lua | ok |
| workbench.md | Inbox approval once/always/deny and detail vs TUI attach | nvim/lua/cland/inbox.lua; nvim/lua/cland/inbox.lua | fixed |
| workbench.md | Palette prefixes/actions/keys; composer; presets; saved ui; alternate layouts | nvim/lua/cland/{palette,composer,layout,keys}.lua; hub/src/init/config.ts | ok |
| workbench.md | Ghostty Shift+Enter and tty erase diagnostics | hub/src/doctor/toolchain.ts | ok |
| sessions.mdx | Real harness process/account/history; native attach; close attach does not stop session | hub/src/adapters/{claude-code,codex,opencode}.ts; nvim/lua/cland/views.lua | ok |
| sessions.mdx | Busy messages queued/withdrawn; phone stop/resume/archive confirm; browser has no harness terminal | web/src/sessions/SessionPage.tsx; web/src/sessions/SessionsArea.tsx; web/src/sessions/SessionPage.tsx | ok |
| sessions.mdx | Relayed approvals answered in Neovim/web, not solely native terminal | nvim/lua/cland/inbox.lua; web/src/ApprovalCard.tsx | fixed |
| sessions.mdx | Launch/item/cwd and resume --relaunch/--fresh account continuity | hub/src/cli/session.ts; hub/src/adapters/sessions.ts; hub/src/hub/core.ts | ok |
| sessions.mdx | Aide has no default size cap; no formal asks, but converses with human | hub/src/crew.ts; hub/src/roles/default-roles.ts; .agents/skills/onboarding/SKILL.md | fixed |
| topics.mdx | Bound item topic, statuses, Coordinator/default routing and mentions | hub/src/hub/topics.ts; hub/src/hub/core.ts; nvim/lua/cland/explorer_compose.lua | fixed |
| topics.mdx | General/Agents standing topics, agent folds and artifact chips | hub/src/hub/topics.ts; nvim/lua/cland/topic_view.lua; web/src/MessageBlock.tsx | ok |
| topics.mdx | Ask lead chain, option/free answer, first answer wins, decline requires reason | hub/src/cli/inbox.ts; hub/src/hub/core.ts; hub/src/hub/topics.ts; hub/src/roles/default-roles.ts | ok |
| topics.mdx | Request review/qa/handover and reply/decline departure; four inbox sections/seven-day archive | hub/src/hub/inbox.ts; nvim/lua/cland/inbox.lua | ok |
| topics.mdx | Relayed approval controls and event number keys differ across Neovim/browser | nvim/lua/cland/actions.lua; nvim/lua/cland/event_kinds.lua; web/src/keymap.ts | fixed |
| topics.mdx | Now/watch/background/archive rules; shared read/last-look and browser notification suppression | hub/src/hub/visibility.ts; hub/src/hub/human-marks.ts; web/src/notification-rules.ts | ok |
| web-and-phone.mdx | Human-only web link, --qr and --no-open; loopback refusal for phone | hub/src/cli/web.ts; hub/src/web-address.ts; hub/src/hub/web-auth.ts | fixed |
| web-and-phone.mdx | Five-minute one-use token; 30-day cookie from creation; sessions/revoke; Strict/HttpOnly/Secure | hub/src/hub/web-auth.ts; hub/src/hub/web-edge.ts; hub/src/cli/web.ts | fixed |
| web-and-phone.mdx | web.bind/web.origin/web.port defaults and restart; HTTPS origin constraints; tunnel is user-owned | hub/src/init/config.ts; hub/src/web-address.ts; hub/src/hub/web-edge.ts | fixed |
| web-and-phone.mdx | Host/Origin checks, cookie browser identity and explicit web authority | hub/src/hub/web-edge.ts; hub/src/hub/web-authority.ts | ok |
| web-and-phone.mdx | Desktop rail/top strip/drawer; Items tree/board/graph/plan; physical keys | web/src/Shell.tsx; web/src/ItemsView.tsx; web/src/keymap.ts | ok |
| web-and-phone.mdx | Threads/folds/sandboxed artifacts; shared asks/decline; queued messages/withdraw/drafts | web/src/MessageBlock.tsx; web/src/TopicsArea.tsx; hub/src/hub/web-artifacts.ts | ok |
| web-and-phone.mdx | PWA phone needs HTTPS, own cookie context; More read-only; asks/sessions/HTML | web/src/Shell.tsx; web/src/InboxArea.tsx; web/src/PhoneTopicThread.tsx; web/src/PhoneNotifications.tsx | fixed |
| web-and-phone.mdx | Offline last state, disabled mutations/no replay, reconnect catching up | web/src/connection.ts; web/src/Shell.tsx; web/src/connection.ts | ok |
| web-and-phone.mdx | Needs-you/finished switches; visible+focused suppression; live page notifications, not closed-app push | web/src/notification-rules.ts; web/src/browser-notifications.ts; web/src/PhoneNotifications.tsx; web/public/sw.js | fixed |
| web-and-phone.mdx | Claude TUI-only and terminal attach; relay controls in both clients; desktop plan approval; CLI authority | hub/src/hub/web-authority.ts; nvim/lua/cland/inbox.lua; web/src/ApprovalCard.tsx | fixed |
| web-and-phone.mdx | Shared hub read marks versus browser-local folds/layout/drafts | hub/src/hub/human-marks.ts; web/src/interface-state.ts | ok |
| verification-and-release.mdx | Empty default commands; /bin/sh -c, remote prepare only, idempotent/ignored outputs | hub/src/init/config.ts; hub/src/verification-commands.ts; hub/src/executor/droplet/{prepare,run}.ts | fixed |
| verification-and-release.mdx | check then test, committed head, topic/session --report and result artifact | hub/src/cli/suite.ts; hub/src/verification-plan.ts; hub/src/hub/suite-worker.ts | ok |
| verification-and-release.mdx | One local slot; arbitrary project test runners are not automatically intercepted | hub/src/executor/local.ts; hub/src/cli/suite.ts; hub/test/run-suite.ts | fixed |
| verification-and-release.mdx | Matching green cache default 24h and original executor/occasion evidence | hub/src/init/config.ts; hub/src/hub/suites.ts #cached; hub/src/cli/suite.ts | fixed |
| verification-and-release.mdx | Source-review then exact-head verification; fix repeats review/run | hub/src/roles/default-roles.ts; docs/review-and-qa.md | ok |
| verification-and-release.mdx | Local default; droplet override; host check precedes remote admission | hub/src/init/config.ts; hub/src/hub/suite-worker.ts; hub/src/executor/droplet/run.ts | fixed |
| verification-and-release.mdx | DIGITALOCEAN_TOKEN held only by hub/watchdog, filtered from children and remote delivery | shared/executor-credentials.ts; hub/src/executor/droplet/watchdog.ts; docs/agents/tests.md | ok |
| verification-and-release.mdx | Prepare image/currentness and prepare repeated after exact commit checkout | hub/src/executor/droplet/{prepare,run}.ts | fixed |
| verification-and-release.mdx | Defaults remote_budget 4, local_fallback true, daily_spend 5, lifetime 110m, run_timeout 75m | hub/src/init/config.ts defaultConfig | ok |
| verification-and-release.mdx | Defaults c-8; lon1/nyc1/sfo2; shared reserve ledger; machine lifetime/watchdog/orphans/cost | hub/src/init/config.ts; hub/src/executor/droplet/{spend,lease,cleanup,watchdog}.ts | ok |
| verification-and-release.mdx | Fallback can reclaim remote; provider-capacity unavailable has no executor/region/size fallback | hub/src/cli/usage.ts SUITE_USAGE; .agents/skills/implement/SKILL.md; docs/agents/tests.md | fixed |
| verification-and-release.mdx | Independent review/QA + done/current verified criteria and ready/not-clear status | hub/src/tracker/gate-verdicts.ts; hub/src/tracker/tracker.ts | ok |
| verification-and-release.mdx | Squash landing, conflict refusal, branch/worktree cleanup, queued batches, human docs override | hub/src/merge.ts; hub/src/cli/merge.ts; docs/agents/tests.md §Queued merge batches | fixed |
| verification-and-release.mdx | cland push is local territory fast-forward | hub/src/cli/push.ts; hub/src/territory.ts | ok |
| verification-and-release.mdx | Versioned release item, all children closed, Notes, annotated tag and atomic Git push | hub/src/cli/release.ts; hub/src/territory-release.ts | ok |
| verification-and-release.mdx | Release does not edit project version files or call GitHub API; sync replays dev | hub/src/territory-release.ts; hub/src/cli/release.ts | ok |
| verification-and-release.mdx | Approved marketing publish allowlist, branch-only commits, atomic main/site, local integrate | hub/src/cli/publish.ts; hub/src/init/config.ts; docs/agents/issue-tracker.md §Marketing publication | fixed |
| features.md | Features catalog tracker/categories/plans/topics/asks/layers/artifacts | Sources in corresponding pages above | ok |
| features.md | Features accounts do not have OpenCode windows | hub/src/accounts/limits.ts; hub/src/accounts/poller.ts | fixed |
| features.md | Features verification prepare is remote-only; remaining gate/release/client links | hub/src/init/config.ts; hub/src/verification-commands.ts; client sources above | fixed |
| faq.md | Harness auth and provider-term responsibility; no automatic account rotation | hub/src/setup/account-identity.ts; hub/src/accounts/registry.ts; hub/src/accounts/poller.ts | fixed |
| faq.md | Single/mixed harness plans use native auth; OpenCode free role qualification outstanding | hub/src/roles/config.ts; E-1216 | gap |
| faq.md | Local hub/territory, optional cloud code delivery, approved publish | hub/src/executor/droplet/run.ts; hub/src/cli/publish.ts | fixed |
| faq.md | No tool telemetry; website GoatCounter separately disclosed | site/src/layouts/SiteLayout.astro; site/astro.config.mjs; hub/src/adapters/*.ts | ok |
| faq.md | doctor free-model warning heuristic, not provider data-policy detection | hub/src/doctor/project.ts | fixed |
| faq.md | Pinned Neovim/no setup; browser and TUI-only attach differences | nvim/bin/nvim-path.ts; hub/src/hub/web-authority.ts | ok |
| faq.md | Free software; subscriptions plus optional cloud cost with one-minute estimate minimum | LICENSE; hub/src/executor/droplet/lease.ts; hub/src/executor/droplet/spend.ts | fixed |
| faq.md | Hub tool permissions versus native shell/sandbox enforcement | hub/src/roles/permissions.ts; hub/src/roles/config.ts; hub/src/adapters/contract.ts | fixed |
| faq.md | Import explicit repo/default remotes, no two-way sync, Windows unsupported, single-user crew per project | hub/src/cli/task-import.ts; hub/src/tracker/import-github.ts; hub/src/project.ts | fixed |
| README.md / landing / software-factory.md | Human plan approval is opt-in; generated default is none. Curated skills live in .agents/skills/; skills/ contains provisioning templates. | hub/src/init/config.ts defaultConfig.plan.approval; hub/src/init/skills.ts SKILLS_SOURCE; skills/README.md | fixed (review M1/M3) |
| README.md | Crew roles/mixed and single subscriptions; OpenCode legwork/free-model qualification | hub/src/roles/config.ts; hub/src/crew.ts; E-1216 | gap |
| README.md | Usage windows limited to Claude/Codex; QA conditional plus criteria; privacy/cloud/doctor heuristic | Account, gate and cloud sources above | fixed |
| README.md | Install commands public paths; source Node requirement | T-779; T-780; package.json | fixed; gap |
| README.md | Setup Aide flow; own Neovim config; check includes web build | hub/src/setup/runner.ts; nvim/bin/nvim-path.ts; package.json scripts | fixed |
| landing index.astro | Mixed/one-Claude/role counts are configurable example crews | hub/src/roles/config.ts; hub/src/crew.ts | ok |
| landing index.astro | Budget free OpenCode crew requires qualification | E-1216 | gap |
| landing index.astro | Smallest crew now shows a Coordinator and Implementer; decisions route through the Coordinator and the independent review gate remains in force | T-1221; site/src/pages/index.astro presets; hub/src/tracker/gate-verdicts.ts | fixed by T-1221, retained during integration |
| landing index.astro | Choose roles includes custom worker roles under [custom.name], within the built-in authority limits | T-781; hub/src/names.ts; hub/src/roles/config.ts; hub/src/roles/permissions.ts | fixed by T-781 |
| landing index.astro | Tracker/topics/harness/inbox/plans/artifacts/release feature slides | Sources in corresponding docs rows above | ok |
| landing index.astro | Subscription/account feature is conditional on reported windows; OpenCode has none | hub/src/accounts/limits.ts; hub/src/accounts/poller.ts | fixed |
| landing index.astro | FAQ privacy includes optional cloud verification; cloud machines can cost money | hub/src/executor/droplet/{run,spend,lease}.ts | fixed |
| landing index.astro | Install widgets public paths and source installation | T-779; T-780; package.json | gap |
| software-factory.md | Ordinary merge requires review; QA only when required; criteria done+verified | hub/src/tracker/gate-verdicts.ts | fixed |

## Command-block evidence

The original 60 shell blocks passed `/bin/sh -n`; after T-780 integration, all 62 then-current shell blocks passed; after T-781 integration, all 63 current blocks pass. This is syntax evidence, not execution evidence. Template ids (T-42, E-3, R-1), account names, handover.md and provider/repository names require the objects described on the page. Ask examples now use quoted `$ASK_ID`, assigned from a real inbox entry, rather than `<ask id>` shell redirections.

The credential-free disposable project has its own HOME, XDG paths and Git identity/configuration. Native environment inheritance was removed; hub/CLI probe children use the repository's sealed fixture environment. `projectHub` provided the real Unix/web edges with fake harness adapters and native Git facts. No live project, real provider, GUI process or remote executor was used. Init ran twice, update once and init --undo once after the fixture hub stopped (all exit 0). The hub-backed probe ran 44 commands: 43 successful receipts and one deliberately checked unsupported `task import-github --help` refusal. This was an ad hoc docs probe, not a full suite or a verification tier receipt.

The first probe stopped on `cland: config.toml has no managed by cland mark: it is the project's own; left unchanged`. The fixture helper had serialized away the init mark. Restoring the managed header in the disposable fixture made the second probe pass. This was fixture setup, not a product defect or suite failure.

| Page | Shell block | Source/validation |
| --- | --- | --- |
| accounts.md:56 | `CLAUDE_CONFIG_DIR=~/.claude-work claude auth login; CODEX_HOME=~/.codex-b codex login` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| accounts.md:65 | `cland account list` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| accounts.md:91 | `cland role launch implementer --harness codex --account codex-b` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| accounts.md:99 | `cland session launch impl-43 --role implementer --item T-43 --account codex-b` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| accounts.md:154 | `cland account clear claude-work` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| concepts.md:14 | `cland hub start     # usually automatic: cland and cland setup start it; cland hub status    # pid, uptime, version, connected sessions; cland hub stop; cland hub reload    # re-read config.toml and roles.toml without a restart` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| concepts.md:112 | `cland worktree list     # each worktree with its item, branch and sessions inside; cland worktree prune    # remove worktrees of closed items, after a y` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| concepts.md:125 | `cland rule add "Never push to GitHub outside a release" --scope all --reason "GitHub is public"; cland rule list` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:55 | `cland models claude-code; cland models codex --account codex-b; cland models opencode --refresh; cland role launch implementer --harness opencode --model openrouter/qwen3-coder; cland role launch reviewer --harness claude-code --model sonnet --effort high; cland role launch coordinator --permissions auto; cland role list` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:76 | `cland session launch impl-43 --role implementer --item T-43 --harness claude-code --model sonnet` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:158 | `cland crew show; cland crew set reviewer.size 2; cland crew set implementer.keep_context true; cland crew set coordinator.heartbeat 30m; cland crew set leads '["epic"]'; cland crew set idle_from C-2` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:171 | `cland crew set leads '["epic"]'` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:181 | `cland config set plan.approval human` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:396 | `cland session launch writer-1 --role docs-writer --item T-42; cland role launch docs-writer --model your-model-id` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:413 | `cland session launch rev-deep --role reviewer --harness claude-code --model opus` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| crew.md:421 | `cland session launch impl-42 --role implementer --item T-42 --brief "Implement T-42 and report to the Coordinator."; cland role set my-session reviewer      # give an existing session a role; cland role clear my-session             # take it away; cland role set session-2 coordinator --note-file handover.md   # move the Coordinator with a handover note` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| faq.md:79 | `cland task import-github --repo owner/name` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:14 | `brew install cland` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:20 | `curl -fsSL https://cland.app/install.sh &#124; sh` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:43 | `curl -fsSL https://cland.app/install.sh &#124; PREFIX="$HOME/tools" sh; curl -fsSL https://cland.app/install.sh &#124; CLAND_VERSION=v0.2.0 sh` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:56 | `git clone https://github.com/Kealman/cland-v0 cland; cd cland; npm ci; npm link` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:67 | `cland --version; cland doctor` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:105 | `cland setup --json            # the steps as JSON; cland setup --install codex   # run the Codex installer without another prompt; cland setup --no-accounts     # skip the accounts step; cland setup --no-aide         # skip hub start and the Aide; cland starts the hub later` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:118 | `brew upgrade cland; curl -fsSL https://cland.app/install.sh &#124; sh; cd cland && git pull && npm ci` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:131 | `cland hub stop && cland hub start` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:141 | `cland update` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:158 | `brew uninstall cland; npm unlink -g cland     # then delete the clone` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:169 | `rm ~/.local/bin/cland; rm -rf ~/.local/lib/cland` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| install.md:180 | `cland hub stop; cland init --undo      # restores the remotes: github becomes origin again` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| items.mdx:99 | `cland hub stop && cland hub start` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| items.mdx:120 | `cland task create "Docs" --kind category` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| items.mdx:170 | `cland task rank T-42 --top; cland task rank T-42 --before T-40` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| items.mdx:193 | `cland task criterion T-42 done C1; cland task criterion T-42 verify C1 --run rev-0117; cland task criterion T-42 fail C2 --note "The old settings are lost after a refusal"; cland task criterion T-42 add "The refusal names the file"` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| items.mdx:234 | `cland task list --under R-1                   # everything in a release; cland task view T-42                          # one item: body, criteria, plan, verdicts, claim; cland task create "Parse the config file" --size S --parent E-3; cland task link T-43 --blocked-by T-42; cland task comment T-42 "Use the TOML parser we already ship"` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| items.mdx:246 | `cland task import-github                 # open issues, through gh; cland task import-github --all           # closed ones too; cland task import-github --repo owner/name` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| quickstart.md:14 | `brew install cland; curl -fsSL https://cland.app/install.sh &#124; sh` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| quickstart.md:26 | `cland --version` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| quickstart.md:36 | `cd my-project; cland init` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| quickstart.md:61 | `cland setup` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| quickstart.md:120 | `cland inbox                       # what needs you, with ask ids; cland topic answer "$ASK_ID" 2     # pick option 2` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| sessions.mdx:61 | `cland session attach impl-42` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| sessions.mdx:77 | `cland session launch impl-43 --role implementer --item T-43; cland session launch rev-deep --role reviewer --harness claude-code --model opus` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| topics.mdx:78 | `cland inbox                      # what needs you, with ask ids; cland topic answer "$ASK_ID" 2    # pick option 2; cland topic answer "$ASK_ID" --text "Ship it without the export"` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:50 | `cland config set verification.test "pytest -q"` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:58 | `cland verify --report general` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:70 | `cland verify queue     # who runs, for how long, who waits, the admission estimate; cland verify cancel    # cancel your active run; cland verify --dry-run --report general   # show what would run, queue nothing` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:114 | `cland config set verification.executor droplet; cland verify --executor local --report general` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:161 | `cland executor status   # token present, live machines, today's spend against the cap; cland executor reap     # delete orphaned and expired cland machines` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:185 | `cland merge T-42` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:209 | `cland merge T-50 --override "typo fix in the README"` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:219 | `cland push` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:229 | `cland task create "First version" --kind release --version 0.1.0` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:237 | `cland release --item R-1 --dry-run   # preview the notes and refs; cland release --item R-1             # publish` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:292 | `cland release v0.1.1 --dry-run; cland release v0.1.1` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| verification-and-release.mdx:305 | `cland sync` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| web-and-phone.mdx:16 | `cland web` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| web-and-phone.mdx:69 | `cland web --qr` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| workbench.md:10 | `cland           # anywhere inside a project; cland open      # the same; also takes a directory` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| README.md:71 | `brew install cland` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| README.md:77 | `curl -fsSL https://cland.app/install.sh &#124; sh` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| README.md:85 | `git clone https://github.com/Kealman/cland-v0 cland; cd cland && npm ci && npm link` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| README.md:92 | `cd my-project; cland init && cland setup` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |
| README.md:119 | `npm ci; npm run check   # typecheck, web build and static/test lints; npm test        # the full suite` | Shell syntax 0; parser/implementation source checked; external operations listed above require live launch receipts. |

## Local validation

- macOS arm64, local executor: `npm run check` completed on the final documentation working tree based on dev `86449530f6f292a3cad7e4debeeb56d45d9ec498`; static guards enforced, test lint in **report-only** mode (133 findings in 60 files, zero refusals). This was not T0–T2 runtime verification.
- Site build completed using the Coordinator-prepared root `site/node_modules` linked into this worktree: 23 pages. Existing Starlight warnings: missing/empty i18n collection and missing docs/404 entry. No dependencies were installed here.
- The root check receipt above is from d843b1d8 (the pre-review head); M1–M3 change prose only, with the runtime source unchanged. The replacement site build and the mode-free hub verification receipt are recorded in the item review thread/artifacts. The Coordinator paused new verification submissions for a hub restart on 2026-10-24; no run is submitted while that pause remains in force.
