# Stage QA brief: E-789 stage 1 — panels on either side

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-789, Panels by choice in the Neovim workbench (under R-377).
- Exact stage name: panels on either side.
- Items: T-999, T-1000, T-1001, T-1002 (one lane, in this order). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: full/after-stage.
- Scope: full, which for this epic means its whole Definition of done (`cland task view E-789`) run as a QA stage. D1: Sessions on the left and Items on the right from the palette, both keeping their keys and live updates. D2: the layout survives a workbench restart and a reset command restores the default. D3: the existing layout, width and focus tests stay green and the new headless-grid cases cover both sides. The human's decisions (Coordinator comment on E-789, 2026-10-20 16:54Z, ask 310190bf): only Items, Inbox, Sessions and Topics are placeable; each panel has a home side the human chooses, each side shows one of the panels assigned to it, panel keys stay toggles on the panel's side; Events, Artifacts, Accounts and Verification do not gain side placement. Neovim only; the web is not touched.
- Verdict marks: a stage verdict carries no epic criterion marks. D1–D3 are marked by the epic's own Definition-of-done run; this stage run is the evidence for it, and the table in the Verdict section maps each check to D1, D2 or D3.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All four items must have merged onto dev (`git log --first-parent --grep "Item: T-999" dev`, likewise T-1000, T-1001 and T-1002). T-1002 delivers `qa/cases/PANELS-020.lua`: if that file is missing at the build, T-1002 is not merged and the run is `BLOCKED`. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree, with `npm install` done there (worktrees share the root's `node_modules`; symlink it if absent). Neovim comes from `node nvim/bin/nvim-path.ts` and must match `nvim/NVIM_VERSION`. No GUI, no real browser, no harness process.

## Setup (once, before the cases)

Every command runs with a scratch HOME, XDG and Git config (rule 15), never the human's HOME or the live project. The headless cases run on fixture projects the recorder builds itself; the scratch environment keeps `ui.json`, restart snapshots and Git state away from the real ones. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
Q=$(mktemp -d /tmp/qa-e789-XXXXXX)
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
unset CLAND_HUB_URL CLAND_HUB_SECRET CLAND_HUB_FILE CLAND_SESSION_ID CLAND_SESSION_NAME CLAND_ROLE
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"; cd "$W"
```

Every check below starts with `. "$Q/env.sh"; cd "$W"`. Cleanup at the end, after the evidence is recorded: print `$Q`, check it begins with `/tmp/qa-e789-` and remove it by its literal path with a non-force `rm -r`.

## Cases

Run each headless case from `$W` with the recorder; exit 0 is PASS, 1 FAIL, 2 INCONCLUSIVE or BLOCKED. Command for every row: `CLAND="$PWD/hub/bin/cland.ts" sh .agents/skills/qa/qa-record.sh run E-789 "$RUN" <CASE>`. Platform: local (Linux or macOS alike; the cases need only Neovim and the stub hub). Expected result of every row: PASS.

| case | surface | command and expected outcome |
| --- | --- | --- |
| PANELS-017 | headless-grid | D1. Sessions on the left and Items on the right from the palette; both headers and one live session-row change read from their physical grid columns. PASS |
| PANELS-018 | headless-grid | D1. `gm` moves Items right and the Inbox left; both read from the grid. PASS |
| PANELS-019 | headless-grid | D2. Sessions left and Items right are saved, the UI state reloaded in-process and the layout rebuilt; headers and rows are the same in the same columns. PASS |
| PANELS-020 | headless-grid | D3. Manual side widths survive swapped panels, views, presets and a preference reload, with Items right and Sessions left. PASS |
| PANELS-005 | headless-grid | D3. Existing: manual panel sizes survive views and presets, and the preferences read back (default layout). PASS, unchanged by the epic |
| PANELS-006 | headless-grid | D3. Existing: corrupt preferences and failed atomic writes leave a usable workbench (default layout). PASS |
| PANELS-007 | headless-grid | D3. Existing: the palette reaches actions and objects through prefixes and split opening. PASS |
| PANELS-008 | headless-grid | D3. Existing: a palette ask option reaches the hub and answered options disappear. PASS |
| PANELS-009 | headless-grid | D3. Existing: Sessions group by hub state and stopped sessions unfold with `za` (Sessions on its default right side). PASS |
| PANELS-010 | headless-grid | D3. Existing: only the selected session expands, including its pending approval. PASS |
| PANELS-011 | headless-grid | D3. Existing: board columns read hub status and the parent filter scopes the release. PASS |
| PANELS-012 | headless-grid | D3. Existing: in work includes unclaimed review and QA; done is current-release tasks. PASS |
| PANELS-013 | headless-grid | D3. Existing: vertical status sections and folds in Items (default left). PASS |
| PANELS-014 | headless-grid | D3. Existing: open configured containers cycle with `e`/`E` and persist through `ui.json`. PASS |
| PANELS-015 | headless-grid | D3. Existing: Aide launch keys use role defaults and attach in the centre. PASS |
| PANELS-016 | headless-grid | D3. Existing: Aides stay in yours above crew state groups. PASS |

Re-check the case ids with `ls qa/cases | grep PANELS` at the tested build; renames happen. A case that cannot find Neovim exits 2: record BLOCKED.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-789 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, saving the output under `.cland/qa/E-789/$RUN/<id>.txt` first. Test files run one at a time from `$W`, under cover-quiet admission (no cover is running; targeted runs take no suite lease). A skipped test (no Neovim) is BLOCKED, never PASS: read the skipped count and confirm the named tests ran.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test nvim/test/panel-placement-component.test.ts` | exit 0, none skipped. T2 on the stub hub, covering: any of the four panels on either side from the palette and `:Cland panel <kind> left\|right` ("palette and command place each of the four panels on either side"); a panel is never on both sides and moving it closes the old side ("moving a panel clears its old side; replacing one on a shared home keeps both homes"); live rows ("swapped Sessions and Items repaint their rows after session.state and task frames"); keys on the swapped sides (Sessions keys, Items filters/folds/Enter, Inbox digits, Topics `n`); native closes; `gm` and the panel keys as toggles on the home side; the chip clicks and `gp` opening the panel on its side ("top-bar chips reopen Inbox and Sessions…", "gp reopens Items on the right…"); `C-h`/`C-l` focus in Normal and Terminal mode; presets on the human's sides; the round trip of version-2 `ui.json` homes, legacy files, invalid assignments with one amber notice, restart snapshot and restore; reset ("reset command and palette restore default sides and widths immediately without changing open panels" and "reset keeps colliding visible panels and their dock open, then toggles use default homes"); T-1002's widths and dock ("manual widths belong to sides through moves, views, presets and preference reload", "Topics dock stays above the right Sessions panel with Inbox left and keeps its manual height without duplicates") |
| M2 | hub-api | `node --test nvim/test/explorer-component.test.ts` | exit 0, none skipped; includes "explorer card replaces any right occupant on a narrow screen and restores it on widening": a narrow centre lets the card take the right side's place whatever panel sits there, and the panel returns when there is room with the saved sides unchanged |
| M3 | hub-api | `node --test nvim/test/ui.test.ts` | exit 0, none skipped (T3, real Neovim). Includes "a cold Neovim restart restores Sessions left and Items right from version-2 preferences" and the resize and cold-restart cases for side widths. Layout, width and focus cases of the existing workbench stay green (D3) |
| M4 | hub-api | `node --test nvim/test/shell.test.ts` | exit 0, none skipped (T3, real Neovim, stub hub on stdio). Includes the real `:restart` that keeps the swapped layout ("swapped panels before restart") and re-attaches the session terminals. Existing panel keys, presets, palette and focus cases stay green (D3) |
| M5 | hub-api | `node --test nvim/test/qa-shipped.test.ts` | exit 0, none skipped (T4). Every shipped case, including PANELS-005 to PANELS-020 and ITEMS-002, passes through the headless QA runner; PANELS-019 and PANELS-020 are in its list. The cases ran by hand above are the same cases through the recorder |
| M6 | hub-api | `node --test nvim/test/shell-component.test.ts` | exit 0, none skipped. The existing T2 panel-key, preset and layout tests (default sides, General in the centre, Sessions open) pass unchanged (D3; T-999 C9). The panel-placement file in M1 is the new coverage |
| M7 | hub-api | `grep -n 'audit' nvim/test/panel-placement-component.test.ts` | at least one match: the panel-placement file (M1) asserts `actions.audit()` reports no drift with `gm` and the placement actions registered, so a pass of M1 covers `gm` having a title in `␣?` and the palette (T-1000 C5). No separate test file is run |
| M8 | hub-api | `grep -n 'gm\|panel reset\|Reset panel layout\|panel_homes\|left_kind\|CTRL-W' nvim/README.md` | the Keys, Commands and UI-preferences text describes `gm`, `:Cland panel <kind> left\|right`, `:Cland panel reset` and **Reset panel layout**, the optional version-2 fields (`panel_homes`, `panels.left_kind`), per-side widths, and says Neovim's `CTRL-W H/L/r/x` are not part of moving panels; reset keeps open panels, dock visibility and dock height and leaves colliding panels where they are |
| M9 | hub-api | `npm run typecheck` | exit 0, no diagnostics |

Mapping to the Definition of done: D1 is PANELS-017, PANELS-018, M1; D2 is PANELS-019, M1 (restart snapshot, reset), M3, M4; D3 is PANELS-005 to PANELS-016, PANELS-020, M2, M3, M4, M5, M6.

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file. The `ui.json` the cases read is in their fixture project or the scratch XDG, never the live `.cland/ui.json`.
- `qa.state().panels` keeps `left` as a visibility boolean and `right` as a kind; side-neutral checks use its additive `kinds.left` and `kinds.right`. A case written against `panels.left == true` meaning "Items" is stale.
- A "ran" marker grep excludes the configuration echo line; a name pattern that matches nothing exits 0 with no test run (M7): confirm the test count.
- The T3 files (`ui.test.ts`, `shell.test.ts`) and T4 `qa-shipped.test.ts` are outside the T1-only merge batches, so only this run and the Coordinator's covers exercise them; treat any red there as a finding, and a load flake as INCONCLUSIVE until a rerun on a quiet machine.
- "No skip": every case and test here needs Neovim and runs on Linux and macOS; where a platform skips one, name it in the note.
- Re-check case and test names with grep at the tested build; renames happen.

## Out of scope

Placement of Events, Artifacts, Accounts and Verification (moved to Ideas by the human), the web workbench's own rail and split design, E-413's one-time import of `events.last_look` and `plan_seen` beyond the file still being readable, the Linux and macOS stage covers (the Coordinator's business, not judged here), duration budget lines (report-only), and any check that touches the live project or the human's HOME.

## Grants

none.

## Verdict

Fix nothing. Clear only when every case, every check M1-M9 and S0 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "panels on either side"`, the full tested dev SHA, the unique run id and the case table, and say which of D1, D2 and D3 the run supports. Stage QA carries no epic criterion marks. Report `qa clear E-789 stage panels on either side` or `qa not clear E-789 stage panels on either side` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
