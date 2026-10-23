# Stage QA brief: E-419 stage 2 — asks, threads, the composer and install

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier, and aborts the sealed subshell's `env` count). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-419 (The phone and notifications, under R-377).
- Exact stage name: asks, threads, the composer and install.
- Items, in plan order: three lanes. Lane 1: T-1168 (the ask sheet), then T-1169 (approvals on the phone). Lane 2: T-1170 (a topic full screen), then T-1171 (the touch composer). Lane 3: T-1174 (the installable app). The run reads the stage's members, counts and state from `task plan show E-419` (E419S2-00 and E419S2-16), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- **The run starts only once every member is on dev.** At writing T-1168 had landed as `a2a90824`, T-1170 as `41a0a378` and T-1169 as `fab25fe3` (its tree identical to the reviewed merge head `2874c896`; its C2 amended at 17:18Z on 2026-10-23: the deny note is optional, per E-414's decision on ask 9a81a158); dev was `a84547b8`. T-1171 was in review at `54e38178` on `t/T-1171-the-touch-composer-two-rows-the-kind`; T-1174 was in progress at `0da55df8` on `t/T-1174-the-installable-app-manifest-icons-badge` (dev through T-1169 merged into it). E419S2-00 checks every landing through `task plan show E-419` and the first-parent log; a missing landing is BLOCKED, reported to the requester, with nothing else run.
- **Where the expectations come from.** Two kinds, kept apart in every row:
  - **Verified at writing** (T-1168, T-1170, T-1169 and the regression files): T-1168, T-1170 and the regression files read at dev `39a0a1bb` (the tracker commit after T-1170's landing), T-1169 at dev `a84547b8` (the tracker commit after its landing). Their named Web files ran clean there, and the QA probe's T-1168, T-1170, T-1169 and desktop facts were observed there.
  - **Read on the branch, grep at the build** (T-1171, T-1174): written from their acceptance criteria and their branch heads named above. Those heads can still change before landing. Every name, label, selector, test name and count of these three items in this brief must be grep-checked at the tested build (E419S2-02 prints them; the rows say how a changed name is judged).
- Scope: the combined changed behaviour of the five items at the tested build.
  - T-1168, the ask sheet (§3.6, P25, P36–P38): at phone width a tapped Inbox ask row opens `AskCard` inside the shared `BottomSheet` (`web/src/BottomSheet.tsx`: a native modal `dialog` labelled **Answer ask**, `data-bottom-sheet`, key context `sheet`, a **Close sheet** button, a scrim backdrop; `keymap.ts` `sheet: { Escape: 'sheet-close' }`, run by the shell's one dispatcher through `runBottomSheetShortcut`). The header carries the item (or topic), the sender, the age and **Open thread**; options are full-width numbered buttons at least 48 px tall; the free answer has its label row. Focusing the free answer follows the visual viewport, clamps the question to three lines and shrinks options to 44 px. **Decline** on the label row turns the field into **Reason** and Send into a red **Decline**, disabled until a nonblank reason. Escape, Close, a scrim tap and a swipe never answer. An answer from any client closes the sheet and folds the row to its outcome until the human leaves the Inbox. In a thread the phone ask card shows its question and an **Answer** button (`data-ask-open`) that opens the same sheet. Files: `AskCard.tsx`/`.module.css`, `BottomSheet.tsx`/`.module.css`, `InboxArea.tsx`, `MessageBlock.tsx`, `Shell.tsx`, `keymap.ts`, `web/test/phone-asks.test.ts`, `web/test/phone.test.ts` (one test renamed).
  - T-1169, approvals on the phone (§3.6, §3.8, P41; landed `fab25fe3`): a relayed (Codex, OpenCode) approval row opens `ApprovalCard` in the same `BottomSheet`, labelled **Command approval**, with the session, harness, since and the full command or file change, full-width **Approve once** and **Always for this command**, and **Deny** on the label row of an optional **Denial note** (all at least 44 px). The answer goes through `approval.answer`; the sheet closes and the row folds to the hub's outcome, the winner's included. A TUI-bound (Claude Code, or a payload-cap fallback) row shows its command marked **answer in Neovim**, has no answer controls and opens no sheet. Files: `ApprovalCard.tsx`/`.module.css`, `InboxArea.tsx`/`.module.css`, `web/test/phone-approvals.test.ts`, docs.
  - T-1170, a topic full screen (§3.6, P31, P32): at phone width a tapped topic opens `PhoneTopicThread` full screen: **Back to Topics**, the title, the topic id and status, and **Card** (`aria-label` `Item card <id>`), which opens the read-only item card full screen with **Back to thread**; browser Back does the same; the bar keeps Topics current. Folded runs show two lines (participants and count; latest kind, preview and age) and unfold in place. HTML artifacts are 44 px chips that open the sandboxed iframe (`allow-scripts` alone) full screen. Verdicts, long ids and fenced code fit 390 px. Files: `PhoneTopicThread.tsx`/`.module.css`, `Thread.tsx`/`.module.css`, `TopicsArea.tsx`/`.module.css`, `artifacts/InlineArtifact.tsx`/`.module.css`, `MessageBlock.module.css`, `Shell.tsx`/`.module.css`, `web/test/phone-thread.test.ts`.
  - T-1171, the touch composer (§3.6, P33–P35; from the branch): below 640 px the composer (`data-phone-composer`) docks above the bar in two rows: the kind chip (`button[aria-expanded]`) and the addressee chip (**Choose addressee**, the Coordinator by default in an item topic), then the field (**Message text**) and **Send**, each at least 44 px; a 44 px **Remove <name>** control beside the addressee clears explicit addressing (kept across a reload); no **Attach an artifact**. Return, Shift+Return and Command+Return insert a newline through the key map's composer context (`phoneComposerKeys` in `keymap.ts`; `composer-send`, `composer-send-always` and `composer-artifact` gated off at phone width by `actionAtWidth`); only Send sends. The kind chip opens an inline group **Send kind** with Message, Decision and Question, the current one checked, no scrim, the thread moving up. A queued message shows its stage and a 44 px **Withdraw** below its text. Drafts keep text and kind across a reload. Files: `Composer.tsx`/`.module.css`, `MessageBlock.tsx`/`.module.css`, `Palette.tsx`, `keyboard.ts`, `keymap.ts`, `web/test/phone-composer.test.ts`, docs.
  - T-1174, the installable app (§3.6, §3.7, P39; from the branch): the Vite build emits `manifest.webmanifest` (`id` and `scope` `/`, `display: standalone`, `start_url` `/?area=inbox`, theme and background colour from `--panel` in `web/src/tokens.css`, icons of 192, 512 and maskable 512) and a `theme-color` meta from the same token; the web edge (`hub/src/hub/web-edge.ts`) serves `/manifest.webmanifest` as `application/manifest+json` with the project's name added as `name` and `short_name` (`hub/src/hub/daemon.ts` passes `projectName`); `web/index.html` links the manifest and `/icons/apple-touch-icon.png`; PNGs under `web/public/icons/`; the shell opens Inbox on `?area=inbox` and replaces the URL with `/`; `navigator.setAppBadge` follows the needs-you count and `clearAppBadge` runs at 0. `cland web --qr` (already present before this stage) signs a fresh phone in; T-1174 proves it with `webFixture({ cliLink: 'qr' })`. Files also: `web/test/harness.ts`, `web/test/phone-install.test.ts`, `hub/test/web-auth.test.ts`, `hub/test/web-edge.test.ts`, `.agents/skills/implement/` (a guidance line). **It touches hub source, so hub tests apply** (E419S2-10).
- Affected regression: the phone frame, More and the phone Inbox (stage 1's files); E-417's ask card, approval card, composer, Withdraw, runs, inline artifacts and thread on the desktop at 1440 and 640 px (no lost desktop control, no sheet, no phone composer); the shell, split, key contexts and palette; the session drawer's approval card; the T1 keymap; the web edge and sign-in (T2); the typecheck with colour, contrast, HTML and hooks guards; the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1168 C1 (390×844: a tapped ask row opens a bottom sheet with the question, full-width numbered options ≥48 px and the free answer) | E419S2-06, E419S2-14 (`askSheet`), E419S2-02 (the sheet seam) |
| T-1168 C2 (focus and a shrunk viewport: the sheet stays on the visual viewport's bottom, question clamped to three lines, 44 px options) | E419S2-06, E419S2-14 (`askKeyboard`) |
| T-1168 C3 (Decline on the label row: a red Decline disabled until a reason; the asker receives `declined` with the reason) | E419S2-06, E419S2-14 (`askDecline`) |
| T-1168 C4 (Escape, Close, scrim and a swipe leave the ask open, as a frame client reads it) | E419S2-06, E419S2-14 (`askNoAnswer`), E419S2-02 (the `sheet` key context), E419S2-03 (no component-local key listener) |
| T-1168 C5 (an answer from another client closes the sheet and folds the row to the outcome until the human leaves the Inbox) | E419S2-06, E419S2-14 (`askPeer`) |
| T-1168 C6 (390×844: a thread ask card offers Answer, which opens the same sheet) | E419S2-06, E419S2-14 (`threadAsk`) |
| T-1169 C1 (a Codex approval sheet: the full command, Approve once, Always for this command and Deny ≥44 px; Approve once folds the row to its outcome as a frame client reads it) | E419S2-07, E419S2-14 (`approvalSheet`) |
| T-1169 C2 (Deny on the label row sends with or without a note, a typed note reaches the record; Escape, scrim and swipe leave it pending) | E419S2-07, E419S2-14 (`approvalDeny`, `approvalNoAnswer`) |
| T-1169 C3 (a Claude Code approval row marked "answer in Neovim", no buttons, no sheet) | E419S2-07, E419S2-14 (`approvalTui`) |
| T-1170 C1 (a tapped topic full screen with back, title, id, status and card button; both Backs return to Topics) | E419S2-08, E419S2-14 (`topicScreen`) |
| T-1170 C2 (the card button opens the read-only card full screen; back returns to the thread at the same message) | E419S2-08, E419S2-14 (`topicCard`) |
| T-1170 C3 (a folded run shows two lines; a tap unfolds it in place with the anchor on top) | E419S2-08, E419S2-14 (`topicRun`) |
| T-1170 C4 (an HTML artifact is a chip opening full screen in an iframe with `sandbox` `allow-scripts` alone, with a back control) | E419S2-08, E419S2-14 (`topicHtml`) |
| T-1170 C5 (a verdict, fenced code and long ids scroll only vertically at 390 px) | E419S2-08, E419S2-14 (`topicFit`) |
| T-1171 C1 (two rows above the bar, kind and addressee chips over the field and Send, each ≥44 px) | E419S2-09, E419S2-14 (`composerRows`) |
| T-1171 C2 (Return breaks the line and sends nothing; Send sends both lines as one message, as a frame client reads it) | E419S2-09, E419S2-14 (`composerReturn`), E419S2-02 (`phoneComposerKeys`) |
| T-1171 C3 (the kind sheet: Message, Decision, Question, the current one checked, no scrim; choosing Question sends a question) | E419S2-09, E419S2-14 (`composerKind`) |
| T-1171 C4 (a message to a busy fake session shows queued with a Withdraw ≥44 px; Withdraw returns its text to the composer) | E419S2-09, E419S2-14 (`composerWithdraw`) |
| T-1171 C5 (a draft typed at 390×844 survives a reload with its kind) | E419S2-09, E419S2-14 (`composerDraft`) |
| T-1171 C6 (`web/README.md` describes the composer on the phone) | E419S2-04 |
| T-1174 C1 (`/manifest.webmanifest` as `application/manifest+json` with the project's name, `standalone`, an inbox start URL, the panel token's colour, icons 192, 512 and maskable) | E419S2-10, E419S2-14 (`manifest`), E419S2-02 |
| T-1174 C2 (`index.html` links the manifest and an apple-touch-icon; every named icon is a PNG of its stated size; no colour outside the tokens) | E419S2-10, E419S2-14 (`manifest.html`, `manifest.files`), E419S2-15 (the colour guard) |
| T-1174 C3 (the start URL at 390×844 after a saved Sessions area opens the inbox) | E419S2-10, E419S2-14 (`startUrl`) |
| T-1174 C4 (with `setAppBadge`/`clearAppBadge` stubbed, the badge follows the needs-you count and clears at 0) | E419S2-10, E419S2-14 (`badge`) |
| T-1174 C5 (the `cland web --qr` link, opened on the loopback edge in a fresh 390×844 context, signs it in with the 30-day cookie and opens the inbox) | E419S2-10, E419S2-14 (`qr`) |
| Desktop regression at 1440 and 640 px (E-417's ask card, approval card, composer and thread; no sheet, no phone composer) | E419S2-11, E419S2-12, E419S2-13, E419S2-14 (`desktop`) |

Definition-of-done pointer (no marks): E-419's ask sheet, approvals, thread screen, touch composer and install sentences (§3.6, §3.7) are exercised by E419S2-06 to E419S2-10 and E419S2-14. Real installability, real notifications and a real app badge are the epic demo's job, not this run's.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-419` lists in stage `asks, threads, the composer and install`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1168 had landed as `a2a90824`, T-1170 as `41a0a378` and T-1169 as `fab25fe3`; T-1171 and T-1174 had not (see "Stage"). Dev may also carry work landed after these items that is outside this stage; it is not judged here beyond the regression files named. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E419S2-01's build before any Web file, hub web test or the probe, or the shell never renders and the manifest is missing. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`); every phone check uses the harness's phone context (`pageCase(…, { phone: true })`: 390×844, `hasTouch`, `isMobile`). No real browser, phone or other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E419S2-00 and E419S2-16. Every ask, approval, message, run, verdict, artifact and sign-in comes from sealed scratch hubs started from `$W`'s own source, with in-process fake spokes and the hub's fake Codex and Claude Code adapters as senders, never a real session, account or provider binary (see "Out of scope").

**The local test slot (cover-quiet).** No test may run while another session holds the live hub's local verify slot. The Coordinator's macOS stage cover for this stage (`verify all --occasion stage`, local) holds that slot for about 20 minutes, and it may still be running when this run starts. A wait for it is not BLOCKED: run the checks that need no slot first (E419S2-00 to E419S2-05: reads, greps, docs, the brief lint and the bundle build), then wait for the slot with `quiet` (it waits up to 45 minutes and prints the holder every 5 minutes) before E419S2-06. Only a slot still held after those 45 minutes with no change of holder is BLOCKED, reported to the requester with the holder line.

## Setup (once, before E419S2-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e419s2-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs, fake spokes as senders (a fake Coordinator asking and receiving, a fake Implementer and Reviewer making a run and a verdict), the hub's fake Codex and Claude Code adapters raising approvals and holding a busy session, seeded tracker items, the harness's stubbed `Notification` and the probe's stubbed Badging API; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
STAGE="asks, threads, the composer and install"
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-419; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e419s2-$RUN           # the clean detached build
EV=$R/.cland/qa/E-419/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e419s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e419s2-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const h=v.holder;console.log(h?`${h.session??h.kind} ${h.occasion??"-"} ${h.executor??"-"} since ${h.since??"-"} waiters ${(v.waiters??[]).length}`:"none waiters "+(v.waiters??[]).length)})'; }
# quiet: wait (up to 45 minutes, a line every 5) until no session holds the local verify slot; a stage cover holds it ~20 minutes
quiet() { for i in $(seq 1 45); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; [ $((i % 5)) -eq 1 ] && echo "waiting for the local slot ($i min): $h"; sleep 60; done; echo "BLOCKED: the local verify slot is still held after 45 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files or node --test flags…>: named tests from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# census <id>: the number of Web fixture census lines, then how many of them do not end cleanly
census() { grep -c -F 'Web fixture census' "$EV/$1.log"; grep -F 'Web fixture census' "$EV/$1.log" | grep -c -v 'after 0; scratch hub stopped'; }
# landed <id>: the full SHA of the commit that landed the item on dev (empty when it has not landed)
landed() { git -C "$W" log --first-parent --format=%H --grep "Item: $1" dev; }
# names <file>: the test and subtest names declared in a test file at the build
names() { grep -o -E "(^|[^.a-zA-Z])(test|t\.test)\((['\"\`])[^'\"\`]+" "$W/$1" | sed -E "s/^.*(test|t\.test)\(['\"\`]//"; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays; do not merely unset keys absent from it. Remove the broader credential prefixes last (including `GH_PAGER` and the fixture's synthetic `CLAND_EXECUTOR_STATE`). The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports.

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" > "$Q/env.sh" <<'JS'
const [m,root,worktree]=process.argv.slice(2);
const {fixtureEnvironment}=await import(m);
const env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root,
});
for(const k of Object.keys(env))if(/^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
ENV
: > "$Q/home/.gitconfig"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture`: `tempProject` under the system `TMPDIR`, `projectHub` with its fake adapters, the production socket and web edge serving `$W/web/dist`). Before the hub starts it seeds `T-1` `QA phone card` (a summary and criterion C1) and writes `.cland/config.toml` with `[project] name = "QA phone project"` and `[web] origin = "https://phone.example"` (a synthetic tunnel origin that only `web --qr` prints; nothing contacts it). Contexts, in order:
- **A** (phone; T-1174 C4), before any attention exists: the Badging API stubbed before navigation (`setAppBadge` and `clearAppBadge` record into `window.qaBadge`); `badge` reads the first call, has the fake Coordinator `coord` ask in General, reads the calls, answers through a frame client and reads them again.
- **B** (phone; T-1174 C1–C3): `manifest` fetches `/manifest.webmanifest`, `/` and every icon it names plus the apple-touch-icon, reading status, type, fields, PNG signature and IHDR size against the `--panel` value read from `$W/web/src/tokens.css`; `startUrl` taps Sessions, reloads, opens the manifest's `start_url`, reads the area and the address, and reloads again.
- **C** (a fresh phone context from the fixture's own browser; T-1174 C5): `qr` runs `cland web --qr` against the scratch hub, decodes the printed QR against the printed link, redeems the link's path and token on the scratch edge's loopback address in a new 390×844 touch context with no cookies, and reads the `Set-Cookie` of `/auth` (the cookie value masked), the cookie, the connection, the area and the address. The sign-in link and cookie are never written out.
- Then seeds through public frames and fake spokes (`impl`, `rev`): the item topic `QA phone topic` (on `T-1`) with a long session id, a 150-digit id and a fenced long code line, a three-message run `impl` → `rev`, a not-clear review verdict on `T-1` with a long note, and a `page` artifact `QA phone page`; then three asks from `coord` in General (a long question with three options and a free answer, `QA peer ask?`, `QA thread ask?`).
- **D** (phone; T-1168 C1–C6): `askSheet`, `askKeyboard` (focus, then a 390×500 viewport), `askNoAnswer` (physical Escape from the field and from an option, Close, a scrim tap at (10, 10), a CDP touch swipe; the ask's state read through `topic.history` after each; every `topic.answer` frame the page sends is counted), `askDecline`, `askPeer` (a frame client answers `QA peer ask?` while its sheet is open; then Topics and back to Inbox; then the archive), `threadAsk` (Topics → General → the card's Answer → option 3).
- Approvals: a fake Codex session `qa-codex` raises `qa-once` (a 1,500-character command with a cwd and a reason) and `qa-pending`; a fake Claude Code session `worker` raises the TUI-bound `qa-tui`.
- **E** (phone; T-1169 C1–C3): `approvalSheet` (Approve once, then the row's outcome, the archive record through a frame client and the fake adapter's answer), `approvalDeny` (raises `qa-deny-empty` and `qa-deny-note` in turn and denies each, without and with a note), `approvalNoAnswer` (on `qa-pending`: physical Escape from the note field, Close, scrim, swipe; the state through `inbox.list` after each), `approvalTui`.
- **F** (phone; T-1170 C1–C5): `topicScreen` (both Back paths), `topicCard` (both Back paths, the log's scroll position kept), `topicRun`, `topicHtml` (both Back paths), `topicFit`.
- Then the `worker` session's fake spoke attaches with its launch token and the fake adapter marks it busy.
- **G** (phone; T-1171 C1–C5) in `QA phone topic`: `composerRows`, `composerReturn` (physical Enter, Shift+Enter and Meta+Enter with the selection over the space, then Send; `topic.send` frames counted), `composerKind` (opens the kind group, chooses Question, sends `QA phone question`), `composerWithdraw` (resets the kind to Message, addresses `worker` through the palette, sends `QA queued text`, taps Withdraw), `composerDraft` (types two lines, chooses Decision, reloads).
- **H** (desktop 1440, then 640): `desktop` asks once more from `coord`, clicks the ask row (the in-place card), clicks `qa-pending` (the in-place approval card), opens `QA phone topic` (the list beside the thread, the one-line run, the 240 px inline HTML preview, the full composer) and resizes to 640.

It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line. **T-1171's and T-1174's steps were written from their criteria and branch heads before they landed** (T-1169's ran against its landed code at `a84547b8`, every fact as expected): they find things by role, label, visible text and data attributes read on those branches (`data-phone-composer`, `Choose addressee`, `Send kind`, `Message text`, `data-delivery-stage`, `Withdraw`, `/manifest.webmanifest`, `?area=inbox`, `setAppBadge`). E419S2-02 greps these at the build. If an item names a control differently, correct only that selector in `$Q/probe.test.mjs`, keep the uncorrected capture and its log, label the correction in the record, and rerun the probe once; a selector correction is not a product finding.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-419 stage 2 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, phone
// contexts (390x844, touch, mobile flag: `{ phone: true }`) and a desktop context (1440x900, resized to 640), fake spokes
// and fake harnesses as senders. It asserts nothing about the product: every fact goes to $QA_OUT as one JSON line
// {"fact": value}; a step that throws writes {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { seedItem } = await import(`${W}/web/test/items-fixture.ts`);
const { cland, connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const { decodeTerminalQr } = await import(`${W}/hub/test/qr-decode.ts`);
const { askHubFrame } = await import(`${W}/hub/src/cli/socket-client.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 3000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
const PHONE = { phone: true };
const PANEL = readFileSync(join(W, 'web/src/tokens.css'), 'utf8').match(/--panel:\s*([^;]+);/)?.[1]?.trim() ?? null;
const expect = (spoke, predicate) => { const event = spoke.waitForEvent(predicate, 5000); event.catch(() => {}); return event; }; // armed before the action, never an unhandled rejection
const physical = (page, code, modifiers = {}) => page.evaluate(({ code, modifiers }) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { code, key: 'ж', bubbles: true, cancelable: true, ...modifiers })), { code, modifiers });
const box = async locator => { const b = await locator.boundingBox(); return b && { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, width: Math.round(b.width * 10) / 10, height: Math.round(b.height * 10) / 10 }; };
const current = page => page.locator('main').getAttribute('aria-label');
const bar = page => page.getByRole('navigation', { name: 'Phone areas', exact: true });
const inboxRow = (page, id) => page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${id}"]`);
const askSheet = page => page.getByRole('dialog', { name: 'Answer ask', exact: true });
const approvalSheet = page => page.getByRole('dialog', { name: 'Command approval', exact: true });
const swipe = async (page, x, y) => { const cdp = await page.context().newCDPSession(page); try {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 70 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } finally { await cdp.detach(); } };
const tokenColour = (locator, token) => locator.evaluate((node, token) => { const probe = document.createElement('span'); probe.style.color = `var(${token})`; node.append(probe); const colour = getComputedStyle(probe).color; probe.remove(); return colour; }, token);
async function openTopic(page, topic, title) {
  await bar(page).getByRole('button', { name: 'Topics', exact: true }).tap();
  await page.getByRole('list', { name: 'Topics objects', exact: true }).locator(`[data-object-id="${topic}"]`).tap();
  const log = page.getByRole('log', { name: `${title} thread`, exact: true });
  await log.waitFor();
  return log;
}
test('E-419 stage 2 QA probe', { timeout: 420000 }, async t => {
  const fixture = await webFixture(t, {
    prepare: async root => {
      await seedItem(root, 'T-1', 'task', 'QA phone card', {}, '## Summary\n\nQA phone summary\n\n## Acceptance criteria\n\n- [ ] C1. QA criterion');
      await mkdir(join(root, '.cland'), { recursive: true });
      await writeFile(join(root, '.cland/config.toml'), '[project]\nname = "QA phone project"\n\n[web]\norigin = "https://phone.example"\n');
    },
  });
  const ui = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'qa-e419s2-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const inbox = async () => (await ui.request({ type: 'inbox.list' })).value;
  const archive = async () => (await ui.request({ type: 'inbox.list', archive: true })).value;
  const askState = async (topic, id) => (await ui.request({ type: 'topic.history', topic })).value?.messages?.find(m => m.id === id)?.ask?.state ?? null;
  // Context A (phone, before any attention seed; T-1174 C4): the Badging API stubbed before navigation.
  await fixture.pageCase(t, async page => {
    await step('badge', async () => {
      const calls = () => page.evaluate(() => window.qaBadge);
      const initial = await poll(calls, v => v.length > 0);
      const asked = await coord.call('ask', { topic: 'general', question: 'QA badge ask?', options: ['Yes', 'No'] });
      const one = await poll(calls, v => v.at(-1) === 1);
      const answered = await ui.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
      const cleared = await poll(calls, v => v.at(-1) === 'clear' && v.includes(1));
      out('badge', { initial: initial.at(-1) ?? null, afterAsk: one.at(-1) ?? null, answered: answered.ok, afterAnswer: cleared.at(-1) ?? null, calls: cleared, inboxCount: await bar(page).locator('[data-area="Inbox"] [data-count]').textContent() });
    });
  }, async page => { await page.addInitScript(() => { window.qaBadge = []; Object.defineProperties(navigator, {
    setAppBadge: { configurable: true, value: async count => { window.qaBadge.push(count); } },
    clearAppBadge: { configurable: true, value: async () => { window.qaBadge.push('clear'); } } }); }); }, PHONE);
  // Context B (phone; T-1174 C1–C3): the manifest, icons, HTML links and the installed start URL.
  await fixture.pageCase(t, async (page, origin) => {
    await step('manifest', async () => {
      const response = await page.request.get(`${origin}/manifest.webmanifest`);
      const result = { status: response.status(), type: response.headers()['content-type'] ?? null, panel: PANEL };
      if (response.ok()) {
        const m = await response.json();
        Object.assign(result, { name: m.name, short_name: m.short_name, display: m.display, id: m.id, scope: m.scope, start_url: m.start_url, theme: m.theme_color, background: m.background_color,
          icons: (m.icons ?? []).map(i => [i.src, i.sizes, i.type, i.purpose ?? 'any']) });
        const html = await (await page.request.get(`${origin}/`)).text();
        const apple = html.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/)?.[1] ?? null;
        result.html = { manifestLink: /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/.test(html), apple, themeColour: html.match(/name="theme-color"[^>]+content="([^"]+)"/)?.[1] ?? null };
        result.files = [];
        for (const icon of [...(m.icons ?? []), ...(apple ? [{ src: apple, sizes: '180x180' }] : [])]) {
          const png = await page.request.get(new URL(icon.src, origin).href);
          const bytes = await png.body();
          result.files.push({ src: icon.src, stated: icon.sizes, status: png.status(), type: png.headers()['content-type'] ?? null,
            png: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), actual: bytes.length >= 24 ? `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}` : null });
        }
      }
      out('manifest', result);
    });
    await step('startUrl', async () => {
      await bar(page).getByRole('button', { name: 'Sessions', exact: true }).tap();
      const saved = await poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.shell.v1') ?? 'null')?.area ?? null), v => v === 'Sessions');
      await page.reload();
      await bar(page).waitFor();
      const afterReload = await poll(() => current(page), v => v === 'Sessions');
      const manifest = await (await page.request.get(`${origin}/manifest.webmanifest`)).json();
      await page.goto(new URL(manifest.start_url, origin).href);
      await bar(page).waitFor();
      const launched = await poll(() => current(page), v => v === 'Inbox');
      const launchedUrl = page.url();
      await page.reload();
      await bar(page).waitFor();
      out('startUrl', { saved, afterReload, launched, url: launchedUrl === `${origin}/` ? 'origin/' : launchedUrl, afterSecondReload: await poll(() => current(page), v => v === 'Inbox'), urlAfterReload: page.url() === `${origin}/` ? 'origin/' : page.url() });
    });
  }, undefined, PHONE);
  // Context C (fresh phone context; T-1174 C5): `cland web --qr` signs it in with the 30-day cookie.
  await step('qr', async () => {
    const result = await cland(fixture.root, 'web', '--qr');
    const [printed, ...qr] = result.stdout.trimEnd().split('\n');
    let decoded = null; try { decoded = decodeTerminalQr(qr.join('\n')); } catch (error) { decoded = `error: ${error.message}`; }
    const facts = { code: result.code, link: /^https:\/\/phone\.example\/auth\?token=[a-f0-9]{64}$/.test(printed ?? ''), qrMatches: decoded === printed, qrLines: qr.length };
    const status = await askHubFrame(fixture.hub.discovery, { type: 'hub.status' }, 3000, {});
    const link = new URL(printed);
    const context = await fixture.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    context.setDefaultTimeout(3000);
    try {
      facts.cookiesBefore = (await context.cookies()).length;
      const page = await context.newPage();
      let header = null;
      page.on('response', response => { if (new URL(response.url()).pathname === '/auth') header = response.headerValue('set-cookie'); });
      const started = Date.now();
      const origin = `http://127.0.0.1:${status.web.port}`;
      await page.goto(`${origin}${link.pathname}${link.search}`);
      await bar(page).waitFor();
      facts.live = await poll(() => page.locator('[aria-label="Hub connection"]').textContent(), v => v?.trim() === 'Live');
      facts.area = await poll(() => current(page), v => v === 'Inbox');
      facts.url = page.url() === `${origin}/` ? 'origin/' : page.url();
      facts.viewport = page.viewportSize();
      facts.touch = await page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
      facts.setCookie = (await header)?.replace(/^[^=]+=[^;]+/, '<cookie>') ?? null;
      const cookies = await context.cookies();
      facts.cookies = cookies.map(c => ({ name: /^cland_[a-f0-9]{12}$/.test(c.name), httpOnly: c.httpOnly, sameSite: c.sameSite, days: Math.round((c.expires - started / 1000) / 86400 * 10) / 10 }));
    } finally { await context.close(); }
    out('qr', facts);
  });
  // Seeds for the rest: one item topic with long ids, fenced code, a run, a verdict and an HTML page; Inbox asks.
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', role: 'implementer', sessionId: 'qa-e419s2-impl' });
  const rev = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', role: 'reviewer', sessionId: 'qa-e419s2-rev' });
  t.after(() => impl.close()); t.after(() => rev.close());
  await impl.waitForPresence(['impl', 'rev']);
  const made = await ui.request({ type: 'topic.create', title: 'QA phone topic', item: 'T-1' });
  const topic = made.value?.topic?.id;
  const longText = 'qa-long-session-identity-'.repeat(12), longId = `T-${'7'.repeat(150)}`, code = 'const qaValue = "' + 'q'.repeat(220) + '";';
  const sentLong = await ui.request({ type: 'topic.send', topic, text: `QA layout\n\n${longText}\n\n${longId}\n\n\`\`\`js\n${code}\n\`\`\`` });
  for (let i = 1; i <= 3; i++) await impl.call('send', { topic, to: ['rev'], text: `QA run step ${i}\n\n${'QA run paragraph\n\n'.repeat(4)}` });
  await ui.request({ type: 'topic.send', topic, text: `QA after run\n\n${'QA paragraph\n\n'.repeat(12)}` });
  const verdict = await rev.call('task.comment', { id: 'T-1', text: 'QA layout verdict', verdict: 'review', scope: 'full', result: 'not clear', run: 'qa-red', failed: [{ criterion: 'C1', note: longText }] });
  const pageArtifact = (await ui.request({ type: 'artifact.create', topic, kind: 'page', title: 'QA phone page', content: '<h1>QA page receipt</h1>' })).value?.artifact;
  const history = (await ui.request({ type: 'topic.history', topic })).value;
  out('seeded', { topic: !!topic, long: sentLong.ok, verdict: verdict.ok, page: !!pageArtifact, runs: history?.runs?.length ?? 0, runFacts: history?.runs?.[0] ? { participants: history.runs[0].participants, messageCount: history.runs[0].messageCount, latestKind: history.runs[0].latest?.kind } : null });
  const longQuestion = 'QA phone choice that wraps across several lines on a narrow phone screen? '.repeat(6).trim();
  const askA = (await coord.call('ask', { topic: 'general', question: longQuestion, options: ['One', 'Two', 'Three'], free: true })).ask;
  const askC = (await coord.call('ask', { topic: 'general', question: 'QA peer ask?', options: ['One', 'Two'] })).ask;
  const askT = (await coord.call('ask', { topic: 'general', question: 'QA thread ask?', options: ['One', 'Two', 'Three'], free: true })).ask;
  await poll(inbox, v => [askA, askC, askT].every(id => v?.asks?.some(r => r.id === id)));
  // Context D (phone; T-1168 C1–C6): the ask sheet.
  const answerFrames = [];
  await fixture.pageCase(t, async page => {
    await step('askSheet', async () => {
      await inboxRow(page, askA).tap();
      const dialog = askSheet(page);
      await dialog.waitFor();
      const options = dialog.locator('[data-ask-option]');
      out('askSheet', { rowPressed: await inboxRow(page, askA).getAttribute('aria-pressed'), question: await dialog.locator('h3').count(), header: (await dialog.locator('header').innerText()).replace(/\s+/g, ' ').trim(),
        time: !!(await dialog.locator('header time').getAttribute('datetime')), openThread: await dialog.getByRole('link', { name: 'Open thread', exact: true }).count(), close: await dialog.getByRole('button', { name: 'Close sheet', exact: true }).count(),
        options: await options.allTextContents(), optionBoxes: await Promise.all((await options.all()).map(box)), free: await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).count(),
        sendDisabled: await dialog.getByRole('button', { name: 'Send answer', exact: true }).isDisabled(), scrim: await page.evaluate(() => !!document.querySelector('[data-bottom-sheet][open]') && getComputedStyle(document.querySelector('[data-bottom-sheet]'), '::backdrop').backgroundColor),
        bottom: await dialog.evaluate(node => Math.round((node.getBoundingClientRect().bottom - (visualViewport.offsetTop + visualViewport.height)) * 10) / 10) });
    });
    await step('askKeyboard', async () => {
      const dialog = askSheet(page);
      await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).focus();
      await page.setViewportSize({ width: 390, height: 500 });
      const offset = await poll(() => dialog.evaluate(node => visualViewport.height === 500 ? Math.round((node.getBoundingClientRect().bottom - (visualViewport.offsetTop + visualViewport.height)) * 10) / 10 : null), v => v !== null && Math.abs(v) < 1);
      const q = await dialog.locator('h3').evaluate(node => ({ height: node.getBoundingClientRect().height, line: parseFloat(getComputedStyle(node).lineHeight), full: node.scrollHeight }));
      out('askKeyboard', { offset, lines: Math.round(q.height / q.line * 10) / 10, clamped: q.full > q.height + 1, optionHeights: await dialog.locator('[data-ask-option]').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().height * 10) / 10)),
        sendInView: ((await box(dialog.getByRole('button', { name: 'Send answer', exact: true }))).y ?? 999) < 500 });
      await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap();
      await dialog.waitFor({ state: 'hidden' });
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await step('askNoAnswer', async () => {
      const result = {};
      for (const method of ['escapeField', 'escapeOption', 'close', 'scrim', 'swipe']) {
        await inboxRow(page, askA).tap();
        const dialog = askSheet(page);
        await dialog.waitFor();
        if (method === 'escapeField') { await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).fill('QA never sent'); await physical(page, 'Escape'); }
        else if (method === 'escapeOption') { await dialog.locator('[data-ask-option="1"]').focus(); await physical(page, 'Escape'); }
        else if (method === 'close') await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap();
        else if (method === 'scrim') await page.touchscreen.tap(10, 10);
        else { const q = await box(dialog.locator('h3')); await swipe(page, 190, q.y + 5); await sleep(300); }
        const closed = method === 'swipe' ? !(await dialog.isVisible()) : await poll(async () => !(await dialog.isVisible()), v => v);
        result[method] = { closed, state: await askState('general', askA) };
        if (method === 'swipe') { await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap(); await dialog.waitFor({ state: 'hidden' }); }
      }
      result.answerFrames = answerFrames.length;
      out('askNoAnswer', result);
    });
    await step('askDecline', async () => {
      await inboxRow(page, askA).tap();
      const dialog = askSheet(page);
      const toggle = dialog.getByRole('button', { name: 'Decline', exact: true });
      const label = await box(dialog.locator('label')), field = await box(dialog.getByRole('textbox', { name: 'Free answer', exact: true })), tbox = await box(toggle);
      await toggle.tap();
      const send = dialog.locator('[data-ask-send]');
      const result = { labelRow: tbox.y <= label.y && tbox.y + tbox.height >= label.y + label.height && tbox.y + tbox.height <= field.y, reasonField: await dialog.getByRole('textbox', { name: 'Reason', exact: true }).count(),
        sendText: await send.innerText(), disabledEmpty: await send.isDisabled() };
      await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('   ');
      result.disabledBlank = await send.isDisabled();
      result.red = (await send.evaluate(node => getComputedStyle(node).color)) === await tokenColour(send, '--failed');
      await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('QA decline reason');
      result.disabledTyped = await send.isDisabled();
      const delivered = expect(coord, event => event.params.meta?.answer_to === askA);
      await send.tap();
      result.delivered = (await delivered).params.content;
      await dialog.waitFor({ state: 'hidden' });
      const folded = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${askA}"] [data-ask-outcome]`);
      await folded.waitFor();
      result.outcome = (await folded.innerText()).trim();
      out('askDecline', result);
    });
    await step('askPeer', async () => {
      await inboxRow(page, askC).tap();
      const dialog = askSheet(page);
      await dialog.waitFor();
      const answered = await ui.request({ type: 'topic.answer', ask: askC, option: 2 });
      const holder = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${askC}"]`);
      await holder.locator('[data-ask-outcome]').waitFor();
      const result = { answered: answered.ok, sheetClosed: await poll(async () => !(await dialog.isVisible()), v => v), outcome: (await holder.innerText()).replace(/\s+/g, ' ').trim(), height: (await box(holder)).height };
      await sleep(1500);
      result.stillThere = await holder.count();
      await bar(page).getByRole('button', { name: 'Topics', exact: true }).tap();
      await poll(() => current(page), v => v === 'Topics');
      await bar(page).getByRole('button', { name: 'Inbox', exact: true }).tap();
      await page.getByRole('list', { name: 'Inbox objects', exact: true }).waitFor();
      result.afterLeave = await poll(() => holder.count(), v => v === 0);
      await page.locator('[data-inbox-archive-toggle]').tap();
      result.archived = await poll(() => page.getByRole('list', { name: 'Inbox archive', exact: true }).getByText('QA peer ask?', { exact: false }).count(), v => v > 0);
      await page.locator('[data-inbox-archive-toggle]').tap();
      out('askPeer', result);
    });
    await step('threadAsk', async () => {
      const log = await openTopic(page, 'general', 'General');
      const card = log.locator(`[data-ask-id="${askT}"]`);
      await card.waitFor();
      const answer = card.getByRole('button', { name: 'Answer', exact: true });
      const result = { inline: await card.locator('[data-ask-option], input, [data-ask-send]').count(), answerHeight: (await box(answer)).height };
      await answer.tap();
      const dialog = askSheet(page);
      await dialog.waitFor();
      result.options = await dialog.locator('[data-ask-option]').allTextContents();
      const delivered = expect(coord, event => event.params.meta?.answer_to === askT);
      await dialog.locator('[data-ask-option="3"]').tap();
      result.delivered = (await delivered).params.content;
      await dialog.waitFor({ state: 'hidden' });
      await card.locator('[data-ask-outcome]').waitFor();
      result.outcome = (await card.locator('[data-ask-outcome]').innerText()).trim();
      out('threadAsk', result);
    });
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.answer') answerFrames.push(frame.ask); })); }, PHONE);
  // Approvals: a fake Codex session (relayed to the hub) and a fake Claude Code session (TUI-bound).
  const launchedCodex = await ui.request({ type: 'session.launch', name: 'qa-codex', harness: 'codex' });
  const launchedWorker = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  const command = 'printf "' + 'complete QA phone command '.repeat(60) + '\\n"';
  const raise = native => fixture.fakes.codex.raiseApproval('qa-codex', { id: native, kind: 'command', subject: native === 'qa-once' ? { command, cwd: '/scratch/qa', reason: 'QA approval reason' } : { command: `echo ${native}` }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  const approvalId = async native => (await poll(inbox, v => v?.approvals?.some(r => r.id.endsWith(`:${native}`))))?.approvals?.find(r => r.id.endsWith(`:${native}`))?.id;
  raise('qa-once'); raise('qa-pending');
  fixture.fakes['claude-code'].raiseApproval('worker', { id: 'qa-tui', kind: 'command', subject: { command: 'echo QA TUI' }, choices: [], answerIn: 'tui' });
  const a1 = await approvalId('qa-once'), a4 = await approvalId('qa-pending'), tui = await approvalId('qa-tui');
  out('seededApprovals', { codex: launchedCodex.ok, worker: launchedWorker.ok, once: !!a1, pending: !!a4, tui: !!tui });
  // Context E (phone; T-1169 C1–C3): approvals in the sheet.
  await fixture.pageCase(t, async page => {
    await step('approvalSheet', async () => {
      await inboxRow(page, a1).tap();
      const dialog = approvalSheet(page);
      await dialog.waitFor();
      const text = await dialog.innerText();
      const result = { commandFull: await dialog.locator('pre').first().textContent() === command, session: /qa-codex/.test(text) && /codex/.test(text), cwdReason: /\/scratch\/qa/.test(text) && /QA approval reason/.test(text), since: !!(await dialog.locator('time').first().getAttribute('datetime')),
        once: await box(dialog.locator('[data-approval-choice="once"]')), always: await box(dialog.locator('[data-approval-choice="always"]')), deny: await box(dialog.getByRole('button', { name: 'Deny', exact: true })),
        labels: await dialog.getByRole('button').allInnerTexts() };
      await dialog.locator('[data-approval-choice="once"]').tap();
      result.closed = await poll(async () => !(await dialog.isVisible()), v => v);
      const outcome = inboxRow(page, a1).locator('..').locator('[data-approval-outcome]');
      await outcome.waitFor();
      result.outcome = (await outcome.innerText()).replace(/\s+/g, ' ').trim();
      result.frame = (await poll(archive, v => v?.archive?.some(r => r.id === a1)))?.archive?.find(r => r.id === a1)?.outcome ?? null;
      if (result.frame) result.frame = { choice: result.frame.choice, by: result.frame.by, via: result.frame.via };
      result.native = fixture.fakes.codex.approvalAnswers.at(-1)?.choice ?? null;
      out('approvalSheet', result);
    });
    await step('approvalDeny', async () => {
      const result = {};
      for (const note of ['', 'QA deny note']) {
        const native = note ? 'qa-deny-note' : 'qa-deny-empty';
        raise(native);
        const id = await approvalId(native);
        const row = inboxRow(page, id);
        await row.waitFor();
        await row.tap();
        const dialog = approvalSheet(page);
        const field = dialog.getByRole('textbox', { name: 'Denial note', exact: true });
        const deny = dialog.getByRole('button', { name: 'Deny', exact: true });
        const label = await box(dialog.locator('label')), fbox = await box(field), dbox = await box(deny);
        const facts = { labelRow: dbox.y <= label.y && dbox.y + dbox.height >= label.y + label.height && dbox.y + dbox.height <= fbox.y, denyHeight: dbox.height, enabledEmpty: !(await deny.isDisabled()) };
        await field.fill(note);
        await deny.tap();
        facts.closed = await poll(async () => !(await dialog.isVisible()), v => v);
        const outcome = row.locator('..').locator('[data-approval-outcome]');
        await outcome.waitFor();
        facts.outcome = (await outcome.innerText()).replace(/\s+/g, ' ').trim();
        const record = (await poll(archive, v => v?.archive?.some(r => r.id === id)))?.archive?.find(r => r.id === id)?.outcome;
        facts.frame = record ? { choice: record.choice, note: record.note ?? null } : null;
        facts.native = { choice: fixture.fakes.codex.approvalAnswers.at(-1)?.choice ?? null, note: fixture.fakes.codex.approvalAnswers.at(-1)?.note ?? null };
        result[note ? 'withNote' : 'withoutNote'] = facts;
      }
      out('approvalDeny', result);
    });
    await step('approvalNoAnswer', async () => {
      const result = {};
      const answers = fixture.fakes.codex.approvalAnswers.length;
      for (const method of ['escapeField', 'close', 'scrim', 'swipe']) {
        await inboxRow(page, a4).tap();
        const dialog = approvalSheet(page);
        await dialog.waitFor();
        if (method === 'escapeField') { await dialog.getByRole('textbox', { name: 'Denial note', exact: true }).fill('QA not sent'); await physical(page, 'Escape'); }
        else if (method === 'close') await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap();
        else if (method === 'scrim') await page.touchscreen.tap(10, 10);
        else { const p = await box(dialog.locator('pre').first()); await swipe(page, 190, p.y + 5); await sleep(300); }
        const closed = method === 'swipe' ? !(await dialog.isVisible()) : await poll(async () => !(await dialog.isVisible()), v => v);
        result[method] = { closed, state: (await inbox())?.approvals?.find(r => r.id === a4)?.state ?? null };
        if (method === 'swipe') { await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap(); await dialog.waitFor({ state: 'hidden' }); }
      }
      result.nativeAnswers = fixture.fakes.codex.approvalAnswers.length - answers;
      out('approvalNoAnswer', result);
    });
    await step('approvalTui', async () => {
      const row = inboxRow(page, tui);
      await row.waitFor();
      const text = (await row.innerText()).replace(/\s+/g, ' ');
      await row.tap();
      await sleep(300);
      out('approvalTui', { marked: /answer in Neovim/.test(text), command: /echo QA TUI/.test(text), sheet: await approvalSheet(page).count(), controls: await row.locator('..').locator('[data-approval-choice], [data-approval-deny], input').count(), native: fixture.fakes['claude-code'].approvalAnswers.length });
    });
  }, undefined, PHONE);
  // Context F (phone; T-1170 C1–C5): the topic full screen.
  await fixture.pageCase(t, async page => {
    await step('topicScreen', async () => {
      const result = {};
      for (const back of ['button', 'browser']) {
        const log = await openTopic(page, topic, 'QA phone topic');
        const screen = page.locator('[data-phone-thread]');
        result[back] = { list: await page.getByRole('list', { name: 'Topics objects', exact: true }).count(), title: await screen.getByRole('heading', { name: 'QA phone topic', exact: true }).count(),
          id: await screen.getByText(topic, { exact: true }).count(), status: await screen.getByText('open', { exact: true }).count(),
          card: await box(page.getByRole('button', { name: 'Item card T-1', exact: true })), back: await box(page.getByRole('button', { name: 'Back to Topics', exact: true })),
          topicsCurrent: await bar(page).getByRole('button', { name: 'Topics', exact: true }).getAttribute('aria-current'), log: await box(log) };
        if (back === 'button') await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap(); else await page.goBack();
        await page.getByRole('list', { name: 'Topics objects', exact: true }).waitFor();
        result[back].returned = { list: 1, log: await log.count(), area: await current(page) };
      }
      out('topicScreen', result);
    });
    await step('topicCard', async () => {
      const log = await openTopic(page, topic, 'QA phone topic');
      await log.locator('article').first().waitFor();
      await log.evaluate(node => { node.scrollTop = Math.floor(node.scrollHeight / 2); });
      await sleep(200);
      const result = {};
      for (const back of ['button', 'browser']) {
        const before = await log.evaluate(node => node.scrollTop);
        await page.getByRole('button', { name: 'Item card T-1', exact: true }).tap();
        const card = page.getByRole('region', { name: 'Item card', exact: true });
        await card.waitFor();
        result[back] = { item: await card.getAttribute('data-item-id'), width: (await box(card)).width, inputs: await card.locator('input, textarea, form').count(), actions: await card.getByRole('button', { name: /Save|Remove|Mark.*done|Message|Approve|Archive|Add criterion/ }).count(),
          logVisible: await log.isVisible(), topicsCurrent: await bar(page).getByRole('button', { name: 'Topics', exact: true }).getAttribute('aria-current'), backToThread: await page.getByRole('button', { name: 'Back to thread', exact: true }).count() };
        if (back === 'button') await page.getByRole('button', { name: 'Back to thread', exact: true }).tap(); else await page.goBack();
        await poll(() => log.isVisible(), v => v);
        result[back].scrollKept = Math.abs((await log.evaluate(node => node.scrollTop)) - before) < 2;
        result[back].cardGone = await card.count() === 0;
      }
      out('topicCard', result);
      await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap();
    });
    await step('topicRun', async () => {
      const log = await openTopic(page, topic, 'QA phone topic');
      const anchor = log.locator('[data-run-anchor]').first();
      await anchor.waitFor();
      const lines = await anchor.locator(':scope > span').evaluateAll(ns => ns.map(n => ({ text: n.textContent, top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom, height: n.getBoundingClientRect().height, line: parseFloat(getComputedStyle(n).lineHeight) })));
      await anchor.evaluate(node => { const l = node.closest('[role="log"]'); l.scrollTop += node.getBoundingClientRect().top - l.getBoundingClientRect().top; });
      const top = (await box(anchor)).y;
      await anchor.tap();
      const expanded = await poll(() => anchor.getAttribute('aria-expanded'), v => v === 'true');
      out('topicRun', { texts: lines.map(l => l.text), lines: lines.length, oneLineEach: lines.every(l => l.height <= l.line + 1), ordered: lines.length === 2 && lines[1].top >= lines[0].bottom, height: (await box(anchor)).height,
        expanded, anchorMoved: Math.round(Math.abs((await box(anchor)).y - top) * 10) / 10, messages: await log.locator(`[data-run-id] article`).count() });
      await anchor.tap();
      await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap();
    });
    await step('topicHtml', async () => {
      const log = await openTopic(page, topic, 'QA phone topic');
      const chip = log.locator(`[data-artifact-id="${pageArtifact.id}"]`);
      await chip.waitFor();
      const result = { inlineFrames: await log.locator('iframe').count(), chipHeight: (await box(chip)).height, chipTag: await chip.evaluate(n => n.tagName) };
      for (const back of ['button', 'browser']) {
        await chip.tap();
        const viewer = page.locator('[data-artifact-viewer]');
        const frame = viewer.locator('iframe');
        await frame.contentFrame().getByRole('heading', { name: 'QA page receipt' }).waitFor();
        result[back] = { sandbox: await frame.getAttribute('sandbox'), width: (await box(frame)).width, back: await box(page.getByRole('button', { name: 'Back to thread', exact: true })) };
        if (back === 'button') await page.getByRole('button', { name: 'Back to thread', exact: true }).tap(); else await page.goBack();
        await chip.waitFor();
        result[back].viewerGone = await viewer.count() === 0;
      }
      out('topicHtml', result);
    });
    await step('topicFit', async () => {
      const log = page.getByRole('log', { name: 'QA phone topic thread', exact: true });
      await log.locator('pre').first().waitFor();
      const pre = log.locator('pre').first();
      await pre.evaluate(node => { node.scrollLeft = node.scrollWidth; });
      out('topicFit', { log: await log.evaluate(n => ({ width: n.clientWidth, scroll: n.scrollWidth, left: n.scrollLeft })), document: await page.evaluate(() => document.documentElement.scrollWidth),
        criteria: await log.locator('[data-criterion="C1"]').count(), longId: await log.getByText(longId, { exact: false }).count(),
        preScrolls: await pre.evaluate(n => n.scrollWidth > n.clientWidth && n.scrollLeft > 0),
        outside: await log.locator('article, [data-criterion], [data-artifact-id]').evaluateAll(ns => ns.filter(n => { const b = n.getBoundingClientRect(); return b.width && (b.left < -0.5 || b.right > 390.5); }).length) });
    });
  }, undefined, PHONE);
  // A busy fake Claude Code worker for the queued message (its spoke attaches with the launch token).
  const fake = fixture.fakes['claude-code'];
  const worker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'worker', sessionId: launchedWorker.value?.process?.sessionId, launchToken: fake.spawns.find(s => s.name === 'worker')?.launchToken });
  t.after(() => worker.close());
  await worker.waitForPresence(['worker']);
  fake.busy('worker');
  // Context G (phone; T-1171 C1–C5): the touch composer in the item topic.
  const sends = [];
  await fixture.pageCase(t, async page => {
    const form = page.getByRole('form', { name: 'Composer', exact: true });
    await step('composerRows', async () => {
      await openTopic(page, topic, 'QA phone topic');
      await form.waitFor();
      const kind = form.locator('button[aria-expanded]'), address = form.getByRole('button', { name: 'Choose addressee', exact: true });
      const field = form.getByRole('textbox', { name: 'Message text', exact: true }), send = form.getByRole('button', { name: 'Send', exact: true });
      const [k, a, f, s] = await Promise.all([kind, address, field, send].map(box));
      const formBox = await box(form), barBox = await box(bar(page));
      out('composerRows', { phoneComposer: await form.getAttribute('data-phone-composer'), kind: await kind.innerText(), address: (await address.innerText()).replace(/\s+/g, ' ').trim(), boxes: { kind: k, address: a, field: f, send: s },
        rowOne: k && a ? k.y === a.y : null, rowTwo: f && s ? f.y === s.y : null, rowsOrdered: k && f ? k.y + k.height <= f.y : null, dock: formBox && barBox ? Math.round((barBox.y - formBox.y - formBox.height) * 10) / 10 : null,
        attach: await form.getByRole('button', { name: 'Attach an artifact', exact: true }).count(), document: await page.evaluate(() => document.documentElement.scrollWidth) });
    });
    await step('composerReturn', async () => {
      const field = form.getByRole('textbox', { name: 'Message text', exact: true });
      const values = {};
      for (const [name, modifiers] of [['Enter', {}], ['ShiftEnter', { shiftKey: true }], ['MetaEnter', { metaKey: true }]]) {
        await field.fill('QA-first QA-last');
        await field.evaluate(node => node.setSelectionRange(8, 9));
        await physical(page, 'Enter', modifiers);
        values[name] = await field.inputValue();
      }
      const before = sends.length;
      const delivered = expect(coord, event => event.params.content === 'QA-first\nQA-last');
      await form.getByRole('button', { name: 'Send', exact: true }).tap();
      const event = await delivered;
      const row = (await ui.request({ type: 'topic.history', topic })).value?.messages?.find(m => m.text === 'QA-first\nQA-last' && m.fromKind === 'human');
      out('composerReturn', { values, sendsBeforeTap: before, sends: sends.length, delivered: event.params.content, history: row ? { kind: row.kind, to: row.to } : null });
      await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    });
    await step('composerKind', async () => {
      const log = page.getByRole('log', { name: 'QA phone topic thread', exact: true });
      const before = await box(log);
      const chip = form.locator('button[aria-expanded]');
      await chip.tap();
      const sheet = form.getByRole('group', { name: 'Send kind', exact: true });
      await sheet.waitFor();
      const sbox = await box(sheet), after = await box(log);
      const result = { expanded: await chip.getAttribute('aria-expanded'), buttons: await sheet.getByRole('button').allTextContents(), pressed: await sheet.getByRole('button').evaluateAll(ns => ns.map(n => n.getAttribute('aria-pressed'))),
        heights: await sheet.getByRole('button').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().height * 10) / 10)), modal: await page.locator('dialog[open], [data-bottom-sheet], [aria-modal="true"], [data-scrim]').count(),
        threadShrank: Math.round((before.height - after.height) * 10) / 10, sheetHeight: sbox.height };
      await sheet.getByRole('button', { name: 'Question', exact: true }).tap();
      result.chipAfter = await chip.innerText();
      await form.getByRole('textbox', { name: 'Message text', exact: true }).fill('QA phone question');
      const delivered = expect(coord, event => event.params.content === 'QA phone question');
      await form.getByRole('button', { name: 'Send', exact: true }).tap();
      await delivered;
      result.kind = (await ui.request({ type: 'topic.history', topic })).value?.messages?.find(m => m.text === 'QA phone question')?.kind ?? null;
      await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
      out('composerKind', result);
    });
    await step('composerWithdraw', async () => {
      await form.getByRole('button', { name: 'Choose addressee', exact: true }).tap();
      await page.getByRole('combobox', { name: 'Search palette' }).fill('@worker');
      await page.getByRole('option').filter({ hasText: 'worker' }).first().tap();
      await form.locator('button[aria-expanded]').tap();
      await form.getByRole('group', { name: 'Send kind', exact: true }).getByRole('button', { name: 'Message', exact: true }).tap();
      const field = form.getByRole('textbox', { name: 'Message text', exact: true });
      await field.fill('QA queued text');
      await form.getByRole('button', { name: 'Send', exact: true }).tap();
      const message = (await poll(async () => (await ui.request({ type: 'topic.history', topic })).value?.messages?.find(m => m.text === 'QA queued text'), v => !!v));
      const row = page.locator(`[data-message-id="${message.id}"]`);
      const withdraw = row.getByRole('button', { name: 'Withdraw', exact: true });
      await withdraw.waitFor();
      const text = await box(row.getByText('QA queued text', { exact: true })), stage = await box(row.locator('[data-delivery-stage]')), wbox = await box(withdraw);
      const result = { to: message.to, stage: await row.locator('[data-delivery-stage]').innerText(), withdraw: wbox, below: stage.y >= text.y + text.height && wbox.y >= text.y + text.height };
      await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
      await withdraw.tap();
      result.restored = await poll(() => field.inputValue(), v => v.includes('QA queued text'));
      result.stageAfter = await poll(() => row.locator('[data-delivery-stage]').innerText(), v => v === 'withdrawn');
      result.injected = fake.injections.some(r => r.message.id === message.id);
      out('composerWithdraw', result);
    });
    await step('composerDraft', async () => {
      const field = form.getByRole('textbox', { name: 'Message text', exact: true });
      await field.fill('QA draft line one\nQA draft line two');
      await form.locator('button[aria-expanded]').tap();
      await form.getByRole('group', { name: 'Send kind', exact: true }).getByRole('button', { name: 'Decision', exact: true }).tap();
      await sleep(300);
      await page.reload();
      await form.waitFor();
      const humans = (await ui.request({ type: 'topic.history', topic })).value?.messages?.filter(m => m.fromKind === 'human' && m.text.startsWith('QA draft')).length;
      out('composerDraft', { text: await field.inputValue(), kind: await form.locator('button[aria-expanded]').innerText(), sentOnReload: humans });
    });
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.send') sends.push(frame.text); })); }, PHONE);
  // Context H (desktop 1440, then 640): E-417's ask card, approval card, composer and thread keep their desktop form.
  const askD = (await coord.call('ask', { topic: 'general', question: 'QA desktop ask?', options: ['One', 'Two', 'Three'], free: true })).ask;
  await poll(inbox, v => v?.asks?.some(r => r.id === askD));
  await fixture.pageCase(t, async page => {
    await step('desktop', async () => {
      const result = {};
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      await inboxRow(page, askD).click();
      const card = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${askD}"]`);
      await card.locator('[data-ask-option]').first().waitFor();
      result.ask = { options: await card.locator('[data-ask-option]').count(), decline: await card.locator('[data-ask-decline]').innerText(), free: await card.getByRole('textbox', { name: 'Free answer', exact: true }).count(), sheets: await page.locator('[data-bottom-sheet]').count() };
      await inboxRow(page, a4).click();
      const approval = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-approval-id="${a4}"]`);
      await approval.waitFor();
      result.approval = { buttons: await approval.getByRole('button').allInnerTexts(), command: await approval.locator('pre').first().textContent(), sheets: await page.locator('[data-bottom-sheet]').count() };
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      await page.getByRole('list', { name: 'Topics objects', exact: true }).locator(`[data-object-id="${topic}"]`).click();
      const log = page.getByRole('log', { name: 'QA phone topic thread', exact: true });
      await log.waitFor();
      const form = page.getByRole('form', { name: 'Composer', exact: true });
      const frame = log.locator(`[data-artifact-id="${pageArtifact.id}"] iframe`);
      await frame.waitFor().catch(() => {});
      result.thread = { list: await page.getByRole('list', { name: 'Topics objects', exact: true }).count(), phoneScreen: await page.locator('[data-phone-thread]').count(), backToTopics: await page.getByRole('button', { name: 'Back to Topics', exact: true }).count(),
        runSpans: await log.locator('[data-run-anchor] > span').count(), runText: (await log.locator('[data-run-anchor]').first().innerText()).trim(), foldLine: (await ui.request({ type: 'topic.history', topic })).value?.runs?.[0]?.foldLine ?? null, inlineFrame: (await box(frame))?.height ?? null };
      result.composer = { phoneComposer: await form.getAttribute('data-phone-composer'), kinds: await form.getByRole('group', { name: 'Send kind', exact: true }).getByRole('button').allTextContents(), attach: await form.getByRole('button', { name: 'Attach an artifact', exact: true }).count(), rail: await page.locator('nav[aria-label="Areas"]').count(), bar: await bar(page).count() };
      await page.setViewportSize({ width: 640, height: 900 });
      await page.locator('nav[aria-label="Areas"]').waitFor();
      result.at640 = { rail: await page.locator('nav[aria-label="Areas"]').count(), bar: await bar(page).count(), inlineFrame: (await box(frame))?.height ?? null, kinds: await form.getByRole('group', { name: 'Send kind', exact: true }).getByRole('button').count(), phoneComposer: await form.getAttribute('data-phone-composer') };
      out('desktop', result);
    });
  });
});
JS
node --check "$Q/probe.test.mjs" && echo "probe parses"
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says, writes its captures under `$EV` and prints the facts the `expected` column judges.

```sh
k00() {   # QA shell: build, merges, plan, the stage's files, paths outside web/ and docs/, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  readlink "$W/node_modules"
  (cd "$W" && node hub/bin/cland.ts task plan show E-419 --json) > "$EV/E419S2-00-plan.json"
  node -e 'const [f,n]=process.argv.slice(1);const v=JSON.parse(require("fs").readFileSync(f,"utf8"));const s=v.stages.find(x=>x.name===n);console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E419S2-00-plan.json" "$STAGE" | tee "$EV/E419S2-00-stage.txt"
  for i in $(node -e 'const [f,n]=process.argv.slice(1);console.log(JSON.parse(require("fs").readFileSync(f,"utf8")).stages.find(x=>x.name===n).items.join(" "))' "$EV/E419S2-00-plan.json" "$STAGE"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/BottomSheet.tsx" "$W/web/src/PhoneTopicThread.tsx" "$W/web/test/phone-asks.test.ts" "$W/web/test/phone-thread.test.ts" "$W/web/test/phone-approvals.test.ts" "$W/web/test/phone-composer.test.ts" "$W/web/test/phone-install.test.ts" "$W/web/test/harness.ts"
  for i in T-1168 T-1169 T-1170 T-1171 T-1174; do c=$(landed "$i"); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  for i in T-1169 T-1171 T-1174; do c=$(landed "$i"); echo "== $i files"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c"; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k02() {   # QA shell: the sheet seam, the thread screen, the approvals, the touch composer, install, the harness and the probe's selectors
  c() { printf '%s %s: %s\n' "$(cat "$W/$1" 2>/dev/null | grep -c -F -- "$2")" "$1" "$2"; }   # 0 also when the file is missing
  echo "-- verified at writing (T-1168, T-1170 at 39a0a1bb; T-1169 at a84547b8)"
  c web/src/BottomSheet.tsx 'export function BottomSheet({ label, header, children, close }'
  c web/src/BottomSheet.tsx 'data-bottom-sheet data-key-context="sheet"'
  c web/src/BottomSheet.tsx 'aria-label="Close sheet"'
  c web/src/keymap.ts "  sheet: { Escape: 'sheet-close' },"
  c web/src/Shell.tsx 'if (!overlay && runBottomSheetShortcut(action)) return;'
  c web/src/AskCard.tsx '<BottomSheet label="Answer ask"'
  c web/src/AskCard.tsx 'data-ask-open onClick={() => setOpened(true)}>Answer</button>'
  c web/src/PhoneTopicThread.tsx '<button onClick={back}>Back to Topics</button>'
  c web/src/PhoneTopicThread.tsx 'aria-label={`Item card ${facts.item}`}'
  c web/src/PhoneTopicThread.tsx 'Back to thread</button>'
  c web/src/Thread.tsx "run.messageCount === 1 ? 'message' : 'messages'"
  c web/src/artifacts/InlineArtifact.tsx 'if (phone && page && !reason) return <button data-artifact-id'
  c web/src/artifacts/SandboxedArtifactFrame.tsx 'sandbox="allow-scripts" />'
  c web/src/ApprovalCard.tsx '<BottomSheet label="Command approval"'
  c web/src/ApprovalCard.tsx '>Denial note</label>'
  c web/src/InboxArea.tsx 'answer in Neovim'
  echo "-- read on the branches (T-1171, T-1174): grep at the build"
  c web/src/Composer.tsx 'data-phone-composer={touch || undefined}'
  c web/src/Composer.tsx 'aria-label="Choose addressee"'
  c web/src/Composer.tsx 'aria-label="Send kind"'
  c web/src/keymap.ts "const phoneComposerKeys = { Enter: 'composer-newline', 'Shift+Enter': 'composer-newline', 'Meta+Enter': 'composer-newline' } as const;"
  c web/src/keymap.ts "'composer-send', 'composer-send-always', 'composer-artifact',"
  c web/src/MessageBlock.tsx 'className={s.delivery}'
  c web/vite.config.ts "start_url: '/?area=inbox', display: 'standalone',"
  c web/vite.config.ts "tokens.match(/--panel:\s*([^;]+);/)"
  c web/vite.config.ts "name: 'theme-color'"
  c hub/src/hub/web-edge.ts "if (path === '/manifest.webmanifest') {"
  c hub/src/hub/web-edge.ts "'.webmanifest': 'application/manifest+json'"
  c hub/src/hub/daemon.ts 'projectName: () => roles.config().name'
  c web/index.html '<link rel="manifest" href="/manifest.webmanifest" />'
  c web/index.html '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />'
  c web/src/Shell.tsx "get('area') === 'inbox'"
  c web/src/Shell.tsx "typeof navigator.setAppBadge !== 'function'"
  c web/test/harness.ts "cliLink?: boolean | 'qr'"
  ls "$W"/web/public/icons/
  for p in icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png; do f="$W/web/public/icons/$p"; [ -f "$f" ] && printf '%s %sx%s\n' "$p" "$(od -An -tu1 -j16 -N4 "$f" | awk '{print $1*16777216+$2*65536+$3*256+$4}')" "$(od -An -tu1 -j20 -N4 "$f" | awk '{print $1*16777216+$2*65536+$3*256+$4}')"; done
  echo "-- colour values outside tokens.css in the stage's sources"
  git -C "$W" grep -n -E "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" -- web/vite.config.ts web/index.html web/src/BottomSheet.module.css web/src/PhoneTopicThread.module.css web/src/Composer.module.css web/src/ApprovalCard.module.css web/src/AskCard.module.css web/src/Thread.module.css web/src/TopicsArea.module.css web/src/MessageBlock.module.css web/src/artifacts/InlineArtifact.module.css web/src/InboxArea.module.css
  echo "-- probe selectors (each count at least 1)"; for a in data-bottom-sheet data-ask-open data-ask-outcome data-ask-send data-ask-decline data-approval-choice data-approval-outcome data-phone-thread data-run-anchor data-artifact-viewer data-phone-composer data-delivery-stage data-inbox-archive-toggle; do printf '%s %s\n' "$(git -C "$W" grep -c -F -- "$a" -- web/src | awk -F: '{n+=$2} END {print n+0}')" "$a"; done
  echo "-- test names at the build"; for f in web/test/phone-asks.test.ts web/test/phone-approvals.test.ts web/test/phone-thread.test.ts web/test/phone-composer.test.ts web/test/phone-install.test.ts; do echo "== $f"; names "$f"; done
  echo "== hub/test/web-auth.test.ts (manifest)"; names hub/test/web-auth.test.ts | grep -i -E "manifest|qr"
}
k03() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  git -C "$W" grep -n -E "addEventListener\('(touch|pointer)(start|move|end)" -- web/src
  for i in T-1168 T-1169 T-1170 T-1171 T-1174; do c=$(landed "$i"); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k04() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    echo "-- headings"; grep -n -E '^#{2,3} (Phone|Phone topic thread|Phone composer|Phone ask sheet|Installable app|Inbox|Composer|Components and colours)$' web/README.md
    echo "-- T-1168 (verified at writing)"
    chk web/README.md 'A phone Inbox ask row opens `AskCard` in `BottomSheet`; the selected row stays'
    chk web/README.md 'label row, switches the field to Reason and needs nonblank text before sending.'
    chk web/README.md 'Close and scrim taps dismiss only; sheets have no swipe action.'
    chk docs/agents/tests.md '`web/test/phone-asks.test.ts` uses the existing sealed phone `webFixture`, public'
    echo "-- T-1170 (verified at writing)"
    chk web/README.md 'Tapping a topic below 640 px opens the shared `Thread` full screen. Its header'
    chk web/README.md '44 px chips on the phone; they open the existing capability-backed iframe full'
    chk web/README.md 'Runs use two lines from the existing hub facts: participants and message count,'
    chk docs/agents/tests.md '`web/test/phone-thread.test.ts` uses the sealed 390×844 touch/mobile context and'
    echo "-- T-1169 (verified at a84547b8)"
    chk web/README.md "A relayed approval's phone sheet reuses \`ApprovalCard\`: the full command or file"
    chk web/README.md 'marks its command **answer in Neovim**, offers no answer controls and opens no'
    chk hub/README.md 'Below 640 CSS px, tapping a relayed approval row opens that same card in the'
    chk docs/agents/tests.md '`web/test/phone-approvals.test.ts` owns phone approval presentation through the'
    echo "-- T-1171 C6 (read on the branch)"
    chk web/README.md '### Phone composer'
    chk web/README.md 'Below 640 px the shared composer docks above the bottom bar. Its first row'
    chk web/README.md 'The kind chip opens Message, Decision and Question as three large buttons with'
    chk web/README.md 'A queued message shows its status and a 44 px Withdraw below the text until'
    chk web/README.md 'Below 640 px all three Return chords insert newlines and only Send submits,'
    chk docs/agents/tests.md '`web/test/phone-composer.test.ts` uses the sealed phone `webFixture` at 390×844,'
    echo "-- T-1174 (read on the branch)"
    chk web/README.md '## Installable app'
    chk web/README.md 'The edge serves `/manifest.webmanifest` as `application/manifest+json`, adding the'
    chk web/README.md '`index.html` links the manifest and the 180 px Apple touch icon. Committed PNGs'
    chk web/README.md 'Where `navigator.setAppBadge` exists, the authoritative needs-you count sets the'
    chk web/README.md '`cland web --qr` prints the phone sign-in link and QR code. Redeeming the link'
    chk docs/agents/tests.md '`web/test/phone-install.test.ts` owns the install-entry, Badging API and QR sign-in'
    for i in T-1169 T-1171 T-1174; do c=$(landed "$i"); echo "== $i docs diff"; [ -n "$c" ] && git show --format= "$c" -- web/README.md docs/agents/tests.md hub/README.md | grep -E '^[+-][^+-]' | cut -c1-200; done
    echo "-- statements to read against the implementation (candidates for low findings)"
    grep -n -F -e 'Inline artifact navigation opens its page in the phone' -e 'keep their in-place cards' -e 'their phone home' -e 'On a coarse-pointer touch device' web/README.md | cut -c1-200
    grep -n -i -E 'stand-in|not yet|until (E-41[0-9]|T-11[0-9][0-9]) lands|next ticket|later ticket|later E-419' web/README.md | cut -c1-200 )
}
k14() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E419S2-14.jsonl)
  : > "$EV/E419S2-14.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E419S2-14.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E419S2-14.log" 2>&1; echo "exit $?" >> "$EV/E419S2-14.log" )
  tail -n 1 "$EV/E419S2-14.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E419S2-14.log"
  cat "$EV/E419S2-14.jsonl"
}
k15() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E419S2-15.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E419S2-15-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E419S2-15.log"
  grep -F -e '"web/test/phone-asks.test.ts": "Web"' -e '"web/test/phone-approvals.test.ts": "Web"' -e '"web/test/phone-thread.test.ts": "Web"' -e '"web/test/phone-composer.test.ts": "Web"' -e '"web/test/phone-install.test.ts": "Web"' -e '"hub/test/web-auth.test.ts": "T2"' -e '"hub/test/web-edge.test.ts": "T2"' "$QA_W/hub/test/tiers.json"
}
k17() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E419S2-0[6-9]*.log "$EV"/E419S2-1[0-4]*.log; do [ -e "$f" ] || continue; printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e419s2-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). A failed Web case writes a Playwright trace under `$W/web/test-results/` (ignored by Git; `phone-thread.test.ts` and `phone-composer.test.ts` also write a screenshot there); name a trace as evidence before removing the worktree. Sign-in links, tokens and cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web phone sheets, thread screen, touch composer or install; every check below is a manual check through named test files, the QA probe's Headless Shell pages, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, mobile flag) and a desktop context against signed-in sealed scratch hubs with fake senders (E419S2-06 to E419S2-14).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-419 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `( . "$Q/env.sh"; cd "$W" && <command> )`, after `quiet` when the row runs a test, the probe or the typecheck (E419S2-14, E419S2-15).
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself.
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E419S2-00 and E419S2-16 are the only checks that touch the live hub, and only to read.

Order: the setup and E419S2-00; then E419S2-01 to E419S2-05, which need no test slot (run them while a stage cover may still hold it); then `quiet` and E419S2-06 to E419S2-15 in id order (E419S2-01's bundle serves every Web file, the hub web tests and the probe); then E419S2-16 and E419S2-17.

**How a test row is judged.** Two separate things, never one:
1. **Clean**: the log shows `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0` (hub T1/T2 logs print `0 0`, which is expected).
2. **Required names**: every test named in the row's "required" list appears in `oks` (a name that appears on no `ok` line proves nothing; a name pattern matching zero tests passes with exit 0 and `# tests 0`).

TAP totals are not judged: they move with unrelated landings. The row gives the totals at writing for orientation only; a different `# tests` count is fine when the log is clean and every required name passes. Required names come in two kinds: **verified** (T-1168, T-1170 and the regression files read and run at `39a0a1bb`; T-1169 read and run at `a84547b8`) and **read on the branch** (T-1171 at `54e38178`, T-1174 at `0da55df8`: confirm each against `names` at the build in E419S2-02). A required name missing at the build is judged by the file's own names at the build: renamed with the same body is PASS with the rename recorded; removed is FAIL for the criterion it carried; for a read-on-the-branch name, a test at the build whose body (read there) asserts the same criterion at 390×844 replaces it, recorded as a mapping in `$EV/<id>-map.txt`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E419S2-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E419S2-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `bottom bar and inbox home`, `asks, threads, the composer and install`, `sessions and disconnected`, `notifications and the guide`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1168, T-1169, T-1170, T-1171, T-1174 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1168 `a2a90824`, T-1170 `41a0a378`, T-1169 `fab25fe3` at writing; the others the commits that landed them); a missing line is BLOCKED "<id> not on dev". All eight files listed. Paths outside `web/` and `docs/`: T-1168 `hub/test/durations.json`, `hub/test/tiers.json`; T-1170 `hub/test/tiers.json`; T-1169 at most `hub/README.md`, `hub/test/tiers.json`, `hub/test/durations.json`; T-1171 at most `hub/test/tiers.json`, `hub/test/durations.json`; T-1174 at most `hub/src/hub/web-edge.ts`, `hub/src/hub/daemon.ts`, `hub/README.md`, `hub/test/web-auth.test.ts`, `hub/test/web-edge.test.ts`, `hub/test/tiers.json`, `hub/test/durations.json`, `.agents/skills/implement/CHANGES`, `.agents/skills/implement/SKILL.md` (no finding). Any `shared/` or `nvim/` path, or another `hub/src/` path, is a scope finding to report, not judged here. Record the three file lists. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e419s2-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E419S2-17: unchanged (dev not moved) |
| E419S2-01 | hub-api | sealed $W | build | `npm run build --workspace web > "$EV/E419S2-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets web/dist/manifest.webmanifest web/dist/icons; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html`, the `assets` directory, `web/dist/manifest.webmanifest` and the `icons` directory with its four PNGs listed (a missing manifest or icon is FAIL for T-1174 C1/C2); `0` changed paths (`web/dist` is ignored). Needs no test slot |
| E419S2-02 | hub-api | QA shell | the sheet seam and `sheet` context (T-1168), the thread screen (T-1170), approvals (T-1169), the touch composer and its key map (T-1171), install (T-1174), the harness's `cliLink: 'qr'`, colours, the probe's selectors and every member's test names | `k02 \| tee "$EV/E419S2-02.txt"` | Under `-- verified at writing` every line starts with `1` or more. Under `-- read on the branches` every line starts with `1` or more; a `0` means the item landed with different code: read the file at the build and record what replaced it (same behaviour: no finding; behaviour missing: FAIL for the criterion it carries). The `icons` listing holds `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and the size lines read `apple-touch-icon.png 180x180`, `icon-192.png 192x192`, `icon-512.png 512x512`, `icon-maskable-512.png 512x512`. The colour grep prints nothing (AGENTS.md: colour values live only in `tokens.css`; `vite.config.ts` reads `--panel` from it). Every probe selector count is at least `1` (a `0` means a renamed attribute: correct the probe as "QA probe" says before E419S2-14). Record each file's test names: E419S2-06 to E419S2-10 judge them; the `web-auth` line lists `the project manifest and linked PNG icons share the built panel theme` and the existing `web --qr` tests |
| E419S2-03 | hub-api | QA shell | AGENTS.md `web/` rules | `k03 \| tee "$EV/E419S2-03.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local key listener in `BottomSheet.tsx`, `AskCard.tsx`, `ApprovalCard.tsx`, `Composer.tsx`, `PhoneTopicThread.tsx` or `Thread.tsx` (the sheet's Escape is the `sheet` context; the phone composer's Return is the `composer` context). Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard (drafts and the shell reach storage through `interface-state.ts`). The raw-HTML grep prints nothing. The touch-listener grep prints nothing (no swipe gesture: sheets have no swipe action). Under the five ids nothing: no dependency, devDependency or lockfile change |
| E419S2-04 | hub-api | docs | T-1171 C6; docs of T-1168, T-1169, T-1170, T-1174 | `k04 \| tee "$EV/E419S2-04.txt"` | The headings list holds `## Phone`, `### Phone topic thread`, `### Phone composer`, `## Phone ask sheet`, `## Installable app`, `## Inbox`, `## Composer`. Every `present` line starts with `1 ` (or more). **T-1171 C6**: a `0` under `-- T-1171 C6` is FAIL unless the same statement landed in other words: then read `web/README.md` at the build and confirm it describes the composer on the phone (the two rows of 44 px controls docked above the bar, the Coordinator by default, no attach, Return chords as newlines with only Send sending, the kind sheet without a scrim, the queued mark and 44 px Withdraw below the text, drafts with their kind across a reload); no such description is FAIL for C6, a missing detail a **low** finding. A `0` under any other group is a **low** docs finding (those items' criteria name no docs), recorded with the wording found. Then read `web/README.md`'s Phone (with its subsections), Phone ask sheet, Installable app, Inbox, Composer, Topics and threads, Artifacts and Browser tests sections, `hub/README.md`'s approval and web-edge paragraphs, and the `docs/agents/tests.md` paragraphs for `phone-asks`, `phone-approvals`, `phone-thread`, `phone-composer` and `phone-install`, and record any statement that contradicts E419S2-02 or E419S2-06 to E419S2-14 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). Candidates at writing, to confirm or dismiss at the build: the Phone section's "Inline artifact navigation opens its page in the phone's single pane" beside T-1170's full-screen viewer; the Inbox section's "Asks and harness approvals keep their in-place cards" if T-1169's change did not replace it; whether `## Installable app` (H2) landed between `## Phone` and `### Phone topic thread`, which would put the thread subsection under Installable app; the Accounts line "their phone home in More arrives in a later E-419 ticket" (stage 4: not a finding in this stage) |
| E419S2-05 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-419-stage-2.md; echo "exit $?"` | `qa/briefs/E-419-stage-2.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build). Needs no test slot |
| E419S2-06 | hub-api | test $W | T-1168 C1–C6 | `nt E419S2-06 web/test/phone-asks.test.ts; oks E419S2-06; census E419S2-06` | Clean. Required names (verified): "phone ask row opens a numbered touch sheet with header facts and a free answer" (C1), "focused phone free answer follows a resized visual viewport with three-line question and 44 px options" (C2), "phone Decline shares the label row, needs a reason and delivers the unchanged decline" (C3), "phone sheet Escape, close, scrim and a touch swipe never answer or decline an ask" (C4), "a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure" (C5), "phone thread asks offer Answer and open the same sheet for free answers" (C6). Totals at writing (not judged): `# tests 6`, census `6` and `0` |
| E419S2-07 | hub-api | test $W | T-1169 C1–C3 | `nt E419S2-07 web/test/phone-approvals.test.ts; oks E419S2-07; census E419S2-07` | Clean. Required names (verified at `a84547b8`): "phone approval opens the complete subject in a touch sheet and folds to the frame outcome" (C1), "phone Deny shares the note label row and sends with or without a note" (C2, the optional note), "phone approval Escape, close, scrim and swipe leave the native request pending" (C2, no answer), "phone TUI approvals mark the command and never open answer controls" (C3), "phone file approval preserves the complete change and a peer winner closes its sheet" and "a losing phone answer recovers the native winner and closes the approval sheet" (C1's outcome, including the winner's). Totals at writing (not judged): `# tests 6`, census `6` and `0` |
| E419S2-08 | hub-api | test $W | T-1170 C1–C5 | `nt E419S2-08 web/test/phone-thread.test.ts; oks E419S2-08; census E419S2-08` | Clean. Required names (verified): "phone topic opens full screen with its facts and both Back paths return to Topics" (C1), "phone topic item card is read-only and both Back paths retain the exact reading anchor" and "phone card retains the last message through covered live traffic and both Back paths" (C2), "phone run has two factual lines and a tap keeps its anchor in place" (C3), "phone HTML chips open the sandboxed full-screen viewer and return to the same thread" (C4; it also reads the 240 px preview back at 640), "phone verdicts long ids and fenced code fit 390 px with horizontal scrolling inside code only" (C5). Totals at writing (not judged): `# tests 6`, census `6` and `0` |
| E419S2-09 | hub-api | test $W | T-1171 C1–C5 | `nt E419S2-09 web/test/phone-composer.test.ts; oks E419S2-09; census E419S2-09` | Clean. Required names (read on the branch at `54e38178`; T-1171 was still in review, so names may change: judge by the rule above): "phone composer docks two rows of 44 px controls above the bar with the default Coordinator" (C1), "phone addressee can be cleared in row one and stays implicit after reload" (C1's addressee chip), "phone Return chords break the line and only Send delivers the multiline message" (C2), "phone kind chip opens a checked inline sheet that lifts history and sends Question" (C3), "phone queued messages show 44 px Withdraw below the text and restore only on receipt until the turn starts" (C4), "phone per-topic drafts survive navigation and reload with their chosen kind" (C5). Totals on the branch (not judged): `# tests 6` |
| E419S2-10 | hub-api | test $W | T-1174 C1–C5; the web edge and sign-in (hub T2, T1) | `nt E419S2-10a web/test/phone-install.test.ts; oks E419S2-10a; census E419S2-10a; nt E419S2-10b hub/test/web-auth.test.ts; oks E419S2-10b; nt E419S2-10c hub/test/web-edge.test.ts; oks E419S2-10c; nt E419S2-10d hub/test/web-auth-unit.test.ts` | Each clean (10b to 10d are hub tests: no census). Required names (read on the branch at `0da55df8`): phone-install "the installed start URL opens Inbox over a saved Sessions area and leaves a plain root URL" (C3), "web --qr signs a fresh phone into Inbox with a thirty-day cookie" (C5), "the app badge follows needs-you counts and clears when the last ask is answered" (C4), "phones without the Badging API keep live attention counts" (the no-API path); web-auth "the project manifest and linked PNG icons share the built panel theme" (C1, C2: the type, name, standalone, start URL, panel colours, icons and their PNG sizes, the HTML links, the 304 revalidation). Required (verified, regression): web-auth "cland web --no-open prints a single-use link; auth sets the cookie and redirects", "a persisted cookie opens /ws after two hub starts on one project", "web --qr prints a decodable tunnel link without opening the browser", "web --qr refuses loopback alone with a reason and never opens a browser", "tunnel Host and exact Origin admit a web client and set Secure without trusting forwarded headers"; web-edge "the bundle has strict headers, revalidation for entry files and immutable assets", "bundle path confinement with extensionless route fallback", "the web edge accepts only a loopback Host with its exact port". Totals (not judged): phone-install `4` on the branch |
| E419S2-11 | hub-api | test $W | phone regression: the frame, More and the phone Inbox with sheets on top | `nt E419S2-11a web/test/phone.test.ts; oks E419S2-11a; census E419S2-11a; nt E419S2-11b web/test/phone-more.test.ts; census E419S2-11b; nt E419S2-11c web/test/phone-inbox.test.ts; oks E419S2-11c; census E419S2-11c` | Each clean. Required names (verified): phone "five touch slots open the four areas and Inbox is home", "More has no scrim, closes on Escape, selection and outside taps, and frame controls fit touch", "phone selection and split chords leave the saved desktop split intact" and "phone Inbox selection keeps asks in a sheet and replies inline without a drawer" (T-1168 renamed it from "… keeps its cards inline …"); phone-inbox "phone Inbox keeps four touch folds and changes its empty title for a live ask", "phone message and request replies unfold inline, share topic drafts and reach the sender", "phone waiting plans show their counts without Plan actions and touch footers close the list". Totals at writing (not judged): phone `7` (3 top-level, 4 subtests), phone-more `5`, phone-inbox `3` |
| E419S2-12 | hub-api | test $W | E-417's ask card, approval card, composer, Withdraw, runs, inline artifacts and thread on the desktop | `nt E419S2-12a web/test/asks.test.ts; oks E419S2-12a; census E419S2-12a; nt E419S2-12b web/test/inbox.test.ts; oks E419S2-12b; census E419S2-12b; nt E419S2-12c web/test/composer.test.ts; oks E419S2-12c; census E419S2-12c; nt E419S2-12d web/test/withdraw.test.ts; oks E419S2-12d; census E419S2-12d; nt E419S2-12e web/test/thread-runs.test.ts; oks E419S2-12e; census E419S2-12e; nt E419S2-12f web/test/thread-artifacts.test.ts; oks E419S2-12f; census E419S2-12f; nt E419S2-12g web/test/topics.test.ts; census E419S2-12g; nt E419S2-12h web/test/messages.test.ts; census E419S2-12h` | Each clean. Required names (verified): asks "an ask shares its question and options in thread and Inbox and physical 2 delivers option 2", "Escape leaves an ask open and d requires a reason, allows Answer instead and delivers a decline", "an answer in one browser context folds a second context thread and Inbox to the hub outcome within one second"; inbox "approval card shows the complete command and session facts, then folds to the human once outcome", "Escape cancels a denial without answering and Deny accepts an optional note", "approval cards retain the complete file change and TUI-only records have no answer buttons", "asks and approvals share newest-first rows and the selected approval answers with Neovim keys", "selected request and message unfold, physical d declines to the sender or reads exactly that row"; composer "the composer sends Message, Decision and Question with their kinds in the thread and peer history", "composer physical Enter, Shift+Enter and Meta+Enter send or break lines and Meta+K keeps the draft", "tilde attaches an artifact chip and the received message carries the selected artifact", "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read"; withdraw "Withdraw restores a queued message before newer typing only after its receipt", "a queued message loses Withdraw when the fake session takes its next turn"; thread-runs "hub fold lines open and close in place by click Enter and za", "an open run keeps its anchor pinned while scrolling its messages"; thread-artifacts "HTML artifacts render their hub address inline at 240 px while files and folders stay chips", "artifact scripts cannot read the workbench document or navigate its top window". Totals at writing (not judged): asks `9`, inbox `23`, composer `8`, withdraw `5`, thread-runs `5`, thread-artifacts `5`, topics `9`, messages `5` |
| E419S2-13 | hub-api | test $W | shell, split, key contexts, palette, the session drawer's approval card and the T1 keymap at 1440 and 640 | `nt E419S2-13a web/test/shell.test.ts; oks E419S2-13a; census E419S2-13a; nt E419S2-13b web/test/key-contexts.test.ts; oks E419S2-13b; census E419S2-13b; nt E419S2-13c web/test/palette.test.ts; census E419S2-13c; nt E419S2-13d web/test/session-drawer.test.ts; oks E419S2-13d; census E419S2-13d; nt E419S2-13e hub/test/web-keymap.test.ts; oks E419S2-13e` | Each clean. Required names (verified): shell "split panes start at 2:1, drag, swap and close while restoring the rail choice", "selected hub rows open the drawer; close and Esc persist until selection moves; Split and command Enter open the other pane", "physical digit codes switch areas with Cyrillic key values and preserve field typing"; key-contexts "declared composer fields own their keys while ordinary fields retain native input"; session-drawer "the session drawer approves a fake Codex command and retains its folded outcome after Waiting", "a session drawer keeps TUI-only approvals read-only and prefers a new pending card over a closed one", "the drawer composer delivers to the selected fake Codex session in its item topic or General"; T1 web-keymap "focused contexts resolve before shell keys without changing Items or Plan chords" and "browser tab/window chords remain unbound and area shortcuts require exact modifiers" (census prints `0 0`, expected for T1). Totals at writing (not judged): shell `9` (1 top-level, 8 subtests), key-contexts `3`, palette `11` (its viewport loop), session-drawer `7`, web-keymap `2` |
| E419S2-14 | hub-api | sealed $W | T-1168 C1–C6, T-1169 C1–C3, T-1170 C1–C5, T-1171 C1–C5, T-1174 C1–C5, the desktop at 1440 and 640 (independent probe) | `k14` | **The TAP pass and the facts are judged separately.** TAP: `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line: this proves only that the probe ran to its end and cleaned up, nothing about the product. Facts, each judged on its own; a `step` line means that step's facts are missing: FAIL for the criterion it carries when the product lacks the thing, or a probe correction (see "QA probe") when only a selector changed. **T-1174** (read on the branch): `badge` (C4) `{initial: "clear", afterAsk: 1, answered: true, afterAnswer: "clear", inboxCount: "0"}` with `calls` starting `"clear"`, ending `"clear"` and holding no number but `1`. `manifest` (C1, C2): `status: 200`, `type: "application/manifest+json"`, `name` and `short_name` `"QA phone project"`, `display: "standalone"`, `id` and `scope` `"/"`, `start_url` `"/?area=inbox"` (another start URL is judged by `startUrl`), `theme` and `background` both equal to `panel` (`#10141b` at writing, read from `tokens.css` at the build), `icons` `[["/icons/icon-192.png","192x192","image/png","any"],["/icons/icon-512.png","512x512","image/png","any"],["/icons/icon-maskable-512.png","512x512","image/png","maskable"]]` (sizes and purposes judged; paths may differ); `html` `{manifestLink: true, apple: "/icons/apple-touch-icon.png", themeColour: <panel>}` (a missing or different `themeColour` is a **low** finding: "What to build", not C2); every `files` entry `{status: 200, type: "image/png", png: true}` with `actual` equal to `stated` (`180x180` for the apple icon). `startUrl` (C3): `{saved: "Sessions", afterReload: "Sessions", launched: "Inbox", url: "origin/", afterSecondReload: "Inbox", urlAfterReload: "origin/"}`. `qr` (C5): `{code: 0, link: true, qrMatches: true, cookiesBefore: 0, live: "Live", area: "Inbox", url: "origin/", viewport: {width: 390, height: 844}, touch: true}`, `setCookie` `"<cookie>; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000"`, `cookies` one entry `{name: true, httpOnly: true, sameSite: "Strict", days: 30}` (at writing the `qr` facts were already so at `39a0a1bb`: the QR sign-in predates T-1174, whose part is the test). `seeded` all `true`, `runs` at least `1`, `runFacts` `{participants: ["impl","rev"], messageCount: 3, latestKind: "report"}`. **T-1168** (verified): `askSheet` (C1) `rowPressed: "true"`, `question: 1`, `header` containing `General`, `coord` and `Open thread`, `time: true`, `openThread: 1`, `close: 1`, `options` `["1 One","2 Two","3 Three"]`, every `optionBoxes` entry `height` at least 48 and `width` at least 350 (48 and 364 at writing), `free: 1`, `sendDisabled: true`, `scrim` a colour that is not `rgba(0, 0, 0, 0)`, `bottom` within 1 of 0. `askKeyboard` (C2): `offset` within 1 of 0, `lines` at most 3, `clamped: true`, every `optionHeights` value 44, `sendInView: true`. `askNoAnswer` (C4): `escapeField`, `escapeOption`, `close` and `scrim` each `{closed: true, state: "open"}`; `swipe` `{closed: false, state: "open"}` (the sheet has no gesture: it stays and nothing answers); `answerFrames: 0`. `askDecline` (C3): `{labelRow: true, reasonField: 1, sendText: "Decline", disabledEmpty: true, disabledBlank: true, red: true, disabledTyped: false, delivered: "declined: QA decline reason", outcome: "Declined: QA decline reason"}`. `askPeer` (C5): `answered: true`, `sheetClosed: true`, `outcome` containing `2 Two` and `human`, `height` under 40 (one line), `stillThere: 1`, `afterLeave: 0`, `archived` at least 1. `threadAsk` (C6): `{inline: 0, answerHeight: ≥44, options: ["1 One","2 Two","3 Three"], delivered: "Three", outcome: "3 Three"}`. `seededApprovals` all `true`. **T-1169** (verified at `a84547b8`): `approvalSheet` (C1) `commandFull: true`, `session: true`, `cwdReason: true`, `since: true`, `once` and `always` each with `height` at least 44 and `width` at least 350, `deny.height` at least 44, `closed: true`, `outcome` matching `Approved once by the human … web`, `frame` `{choice: "once", by: "human", via: "web"}`, `native: "once"`. `approvalDeny` (C2): `withoutNote` and `withNote` each `{labelRow: true, denyHeight: ≥44, enabledEmpty: true, closed: true}` with `outcome` matching `Denied by the human … web`; `withoutNote.frame` `{choice: "deny", note: null}` and `withoutNote.native` `{choice: "deny", note: null}`; `withNote.frame` `{choice: "deny", note: "QA deny note"}` and `withNote.native` `{choice: "deny", note: "QA deny note"}` (the note is optional: E-414's decision on ask 9a81a158). `approvalNoAnswer` (C2): `escapeField`, `close` and `scrim` each `{closed: true, state: "pending"}`; `swipe` `{closed: false, state: "pending"}`; `nativeAnswers: 0`. `approvalTui` (C3): `{marked: true, command: true, sheet: 0, controls: 0, native: 0}` (`marked: false` at `39a0a1bb`, before T-1169; `true` at `a84547b8`). **T-1170** (verified): `topicScreen` (C1) for `button` and `browser` each `{list: 0, title: 1, id: 1, status: 1, topicsCurrent: "page"}`, `card.height` and `back.height` at least 44, `log` `{x: 0, width: 390}`, `returned` `{list: 1, log: 0, area: "Topics"}`. `topicCard` (C2): for both `{item: "T-1", width: 390, inputs: 0, actions: 0, logVisible: false, topicsCurrent: "page", backToThread: 1, scrollKept: true, cardGone: true}`. `topicRun` (C3): `texts[0]` `"impl, rev · 3 messages"`, `texts[1]` starting `report · QA run step 3` and ending ` ago` after an age, `lines: 2`, `oneLineEach: true`, `ordered: true`, `height` at least 44, `expanded: "true"`, `anchorMoved` under 1, `messages: 3`. `topicHtml` (C4): `inlineFrames: 0`, `chipHeight` at least 44, `chipTag: "BUTTON"`; for both `{sandbox: "allow-scripts", width: 390, viewerGone: true}` with `back.height` at least 44. `topicFit` (C5): `log` `{width: 390, scroll: 390, left: 0}`, `document: 390`, `criteria` at least 1, `longId: 1`, `preScrolls: true`, `outside: 0`. **T-1171** (read on the branch): `composerRows` (C1) `phoneComposer: "true"`, `kind: "Message"`, `address` containing `coord` and `Coordinator`, every `boxes` entry `height` and `width` at least 44, `rowOne: true`, `rowTwo: true`, `rowsOrdered: true`, `dock` within 1 of 0, `attach: 0`, `document: 390`. `composerReturn` (C2): every `values` entry `"QA-first\nQA-last"`, `sendsBeforeTap: 0`, `sends: 1`, `delivered: "QA-first\nQA-last"`, `history` `{kind: "message", to: ["coord"]}`. `composerKind` (C3): `expanded: "true"`, `buttons` `["Message✓","Decision","Question"]`, `pressed` `["true","false","false"]`, every `heights` value at least 44, `modal: 0`, `threadShrank` between `sheetHeight` and `sheetHeight` + 12 (the group plus its row gap), `chipAfter: "Question"`, `kind: "question"`. `composerWithdraw` (C4): `to: ["worker"]`, `stage: "queued"`, `withdraw` height and width at least 44, `below: true`, `restored` containing `QA queued text`, `stageAfter: "withdrawn"`, `injected: false`. `composerDraft` (C5): `{text: "QA draft line one\nQA draft line two", kind: "Decision", sentOnReload: 0}`. **Desktop** (verified at `39a0a1bb`): `desktop.ask` `{options: 3, decline: "d · Decline", free: 1, sheets: 0}`; `desktop.approval` `{buttons: ["1 · Approve once","2 · Always for this command","d · Deny"], command: "echo qa-pending", sheets: 0}`; `desktop.thread` `{list: 1, phoneScreen: 0, backToTopics: 0, runSpans: 0, inlineFrame: 240}` with `runText` equal to `foldLine` apart from the trailing age; `desktop.composer` `{phoneComposer: null, kinds: ["Message","Decision","Question"], attach: 1, rail: 1, bar: 0}`; `desktop.at640` `{rail: 1, bar: 0, inlineFrame: 240, kinds: 3, phoneComposer: null}` |
| E419S2-15 | hub-api | sealed $W | typecheck, colour, contrast, HTML and hooks guards; tiers | `k15` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `BottomSheet.module.css`, `PhoneTopicThread.module.css`, `Composer.module.css` and the other stage styles hold no colour value; secondary text keeps 4.5:1 on ground and selection: T-1174 C2's "the web typecheck finds no colour outside the tokens"); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the seven classification lines print (five `"Web"`, two `"T2"`) |
| E419S2-16 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-419) \| tee "$EV/E419S2-16.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (the droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. Any red cover is FAIL naming its failing tests. A cover still running when every other check is done: wait for its result in the epic topic (the macOS cover takes about 20 minutes; a wait is not BLOCKED); none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E419S2-17 | hub-api | QA shell | cleanup | `k17 \| tee "$EV/E419S2-17.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E419S2-06 to E419S2-09, E419S2-10a, E419S2-11a to E419S2-13d, E419S2-14; the hub logs E419S2-10b to E419S2-10d and E419S2-13e print `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e419s2-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission refusal or timeout while a cover holds the slot is not a product failure; run `quiet` and retry that row once.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included; the probe's fresh QR context is a context of that same owned browser, closed in the step.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe writes `.cland/config.toml` before the hub starts, as the items' own tests do; its frame client and fake spokes only read and send through public frames; the pages write their own preferences and drafts. The manifest, icons and `index.html` are served from E419S2-01's `web/dist`: a stale bundle shows stale facts, so build first.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds asks, approvals, messages, topics and artifacts by the ids their creating requests, `inbox.list` or `topic.history` returned, never by position; an answer's delivery is matched by `answer_to` equal to the ask id, a composer send by its exact text.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: every scratch project is a fresh Web harness project seeded before its hub starts.
- An accessibility-tree count does not prove visible reachability (A-9063 R6; T-1095, T-1097). Touch sizes, rows and fit are judged from each visible control's bounding box, never from a count; a run line's height is compared with its own computed line height.
- A probe's TAP pass is not a product verdict: the probe asserts nothing about the product, so `# pass 1` with a `step` line or a wrong fact is still a finding. Judge each fact; the TAP lines only prove the run ended and cleaned up.
- T-1171's and T-1174's probe steps and required names were read on their branches before they landed: grep their names at the build (E419S2-02), correct a renamed selector as "QA probe" says, and judge a criterion by its words, not by a guessed label.
- Touch is Headless Shell's emulation (`hasTouch`, `isMobile`, coarse pointer, `tap()`, a CDP touch swipe), as the items' tests use; a real phone, a real keyboard and the visual viewport of a real virtual keyboard are out of scope: the keyboard is simulated by shrinking the viewport, as T-1168's criterion says.
- Physical keys are dispatched as `KeyboardEvent`s with the code and a Cyrillic key value (`ж`), as the items' tests do, to prove the physical-code map; Playwright's `press` would send the Latin key value too.
- The badge is a stub installed before navigation (`setAppBadge`, `clearAppBadge`), and installability, the manifest's acceptance by a browser and a real badge are not observed here: Headless Shell does not install apps. The QR link's origin `https://phone.example` is synthetic: the probe redeems the link's path and token on the scratch edge's loopback address, exactly as the item's test does, and contacts no tunnel.
- The context A badge facts need a needs-you count of 0 at the start: the probe runs it before any ask or approval exists. A count that starts above 0 (for example a hub-made attention row) is a probe precondition failure to label, not a T-1174 finding.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; duration lines and E-880 allowances are report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E419S2-16, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome, a real phone and computer use: out of scope for this run, not BLOCKED, as in E-418's and this epic's stage 1: every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, the mobile flag) against signed-in sealed scratch hubs. Real installability (the browser's install prompt and standalone window), real notifications and a real app badge are the epic demo's job with the full Chromium build, not this run's; here the manifest, icons and links are read over HTTP and the Badging API is a stub. A real tunnel or LAN phone reaching the edge (the `--qr` link is redeemed on loopback). Also out of scope: the Sessions page and the disconnected state on the phone (stage 3), notifications, the service worker, More's notification controls and the guide (stage 4), beyond regression; the live hub and real Codex, OpenCode or Claude Code sessions (every sender is a fake spoke or a fake adapter of a sealed scratch hub); E-417's and E-418's Inbox, thread, composer, Items, Artifacts and Accounts behaviour beyond the named regression files (their own stages judged them); Neovim (the TUI-bound approval is only read as a marked row); work landed on dev after the stage's items, beyond the regression files named here; running a full suite, T3 or a stage cover (E419S2-16 cites the Coordinator's); T4; duration budget lines (report-only); the epic's Definition of done and its demo, a separate run; the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in to the live hub, no real notification permission, no tunnel. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E419S2-00 to E419S2-17 passes (docs contradictions in E419S2-04 beyond T-1171 C6, and the facts this brief marks **low**, are low findings and do not block clear). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "asks, threads, the composer and install"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-419 stage asks, threads, the composer and install` or `qa not clear E-419 stage asks, threads, the composer and install` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
