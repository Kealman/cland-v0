# Stage QA brief: E-415 stage 1 — the ground

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-415 (the web workspace and the shell, under R-377).
- Exact stage name: the ground.
- Items: T-990, T-1025, T-991. Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the three items. T-990: the `web/` workspace (React 19, Vite, strict TypeScript on the hub's flags), `npm install` building the ignored `web/dist`, the colour guard that keeps colour values in `web/src/tokens.css`, oxlint with the React hooks rules, the self-hosted fonts and the build. T-1025: the hub plans the Web phase (a `Web` tier outside T0-T3, the `web-only` selection, a Web command only when a Web file is classified, "Web unavailable on this machine" when the browser cannot launch). T-991: the web phase of the suite on `node:test` with `playwright-core` and Chrome Headless Shell (fixtures, the smoke test, the fixture-process census). The human's tier decision (Coordinator comment on E-415, 2026-10-20 16:54Z): a separate Web phase outside T0-T3, selected when a diff touches `web/**` or the protocol and edge files, run in a task's own `cland verify` and never in T1 merge batches, always in periodic dev T3, stage, release and integrated runs, with 4 s a test and 40 s for the phase. The crew browser rule (Coordinator comment, 2026-10-20 17:06Z): browser checks use only the suite's Chrome Headless Shell with its own profile, never the human's Chrome, Safari or default profile, and no GUI process starts unless a brief foresees it. This brief foresees none. Nothing else (the shell's rail, keys and areas are later stages).

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev (`git log --first-parent --grep "Item: T-990" dev`, likewise T-1025 and T-991). `web/test/smoke.test.ts` exists at the build only when T-991 has merged: if it is missing, the run is `BLOCKED`. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree. Worktrees share the root's `node_modules`; symlink it if the worktree has none. No real browser and no GUI: the only browser any check starts is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`.

## Setup (once, before M1)

Every check runs with a scratch HOME, XDG and Git config and with the credential and provider variables removed (rule 15), never the human's HOME or the live project. Keep `PATH`, `SHELL` and `TERM`, leave `TMPDIR` at the system default (on macOS `/var/folders/...`), never use `env -i` and never put `TMPDIR` under `/tmp`: Neovim frame fixtures break there (T-1030). Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
EV="$W/.cland/qa/E-415/$RUN"; mkdir -p "$EV"
Q=$(mktemp -d "${TMPDIR:-/tmp}/qa-e415-XXXXXX")   # scratch root under the system TMPDIR
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
for v in \$(env | cut -d= -f1 | grep -E '(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE)|^(ANTHROPIC|OPENAI|CODEX|CLAUDE|GEMINI|GOOGLE|GH|GITHUB|AWS|DIGITALOCEAN|DO|NPM|SSH|CLAND)_'); do unset "\$v"; done
unset SSH_AUTH_SOCK
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"; cd "$W"
echo "TMPDIR=$TMPDIR"; echo "$Q"                # the scratch root must sit under the system TMPDIR, not /tmp, on macOS
```

Every check below starts with `. "$Q/env.sh"; cd "$W"`. Cleanup at the end, after the evidence is recorded: print `$Q`, check it begins with the system TMPDIR and `qa-e415-`, and remove it by its literal path with a non-force `rm -r`.

## Cases

none. Every check below is a manual check against the worktree, a named test file or the typecheck.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-415 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, putting the capture in `$EV/<id>.txt` first. Test files run one at a time from `$W`, under cover-quiet admission (no cover is running, no other test run by this session; targeted runs take no suite lease). A skipped test is a failure, never a PASS.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `rm -rf web/dist; npm install; echo "exit $?"; ls web/dist/index.html web/dist/build-stamp.json; git check-ignore web/dist; git status --short` | `npm install` exits 0 and its `prepare` step rebuilds the bundle: `web/dist/index.html` and `web/dist/build-stamp.json` exist, `git check-ignore web/dist` prints `web/dist`, and `git status --short` prints nothing (the bundle is never committed). T-990 C1; proven in code by `hub/test/web-bundle.test.ts` "doctor compares the installed web stamp and diagnoses missing, changed and newer sources" and by `hub/test/lint-web-workspace.ts` (root `prepare` is `npm run build`, `build` is `npm run build --workspace web`) |
| M2 | hub-api | `node web/check-colours.ts; echo "exit $?"; printf 'a { color: #fff; }\n' > web/src/Planted.module.css; node web/check-colours.ts; echo "exit $?"; printf 'export const c = "rgb(1 2 3)";\n' > web/src/Planted.tsx; node web/check-colours.ts; echo "exit $?"; rm web/src/Planted.module.css web/src/Planted.tsx; git status --short` | the first run prints `web colours: token-only sources; colour fixtures passed` and exits 0. With the planted CSS the guard prints `Planted.module.css:1: use var(--token); colour values belong in tokens.css` and exits 1; with the planted `.tsx` added it lists `Planted.tsx:1: use var(--token); colour values belong in tokens.css` as well and exits 1. After the planted files are removed `git status --short` prints nothing. T-990 C2; the guard's own fixture loop (hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, a nested `tokens.css`) runs at load in `web/check-colours.ts`, and `hub/test/lint-web-workspace.ts` holds the workspace flags |
| M3 | hub-api | `node web/check-hooks.ts; echo "exit $?"; printf 'import { useState } from "react";\nexport function Planted({ on }: { on: boolean }) {\n  if (on) { useState(0); }\n  return null;\n}\n' > web/src/Planted.tsx; ( cd web && ../node_modules/.bin/oxlint -c .oxlintrc.json src ); echo "exit $?"; rm web/src/Planted.tsx; git status --short` | the first run prints `web hooks: conditional-hook fixture rejected by configured oxlint` and exits 0 (its own scratch fixture fails the real linter). The planted component in `web/src` makes oxlint exit 1 with a diagnostic naming `react-hooks(rules-of-hooks)`. After the planted file is removed `git status --short` prints nothing. T-990 C3; proven by `web/check-hooks.ts` and `web/.oxlintrc.json` (`react/rules-of-hooks` and `react/exhaustive-deps` as errors) |
| M4 | hub-api | `BEFORE=$(pgrep -f 'chrome-headles[s]-shell' \| wc -l); node --test --test-reporter=tap web/test/smoke.test.ts; echo "exit $?"; AFTER=$(pgrep -f 'chrome-headles[s]-shell' \| wc -l); echo "census $BEFORE $AFTER"` | exit 0, none skipped, no `not ok`. The tests "the web shell uses a one-time edge link, strict CSP and isolated browser fixtures" and its subtests "the rail has seven areas and every request stays on the origin", "a fresh context keeps CSP enabled and rejects an inline script" and "a failing case saves a trace and closes its context" pass; the tap output carries the diagnostic `# Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped`. The census line prints `census 0 0` under cover-quiet (the browser count is back to its starting value and that value is 0). `web/test-results/` (ignored) holds the trace of the planted failure and `git status --short` prints nothing. T-991 C1-C4, C7; proven by `web/test/smoke.test.ts` and `web/test/harness.ts` |
| M5 | hub-api | `node --test --test-name-pattern='web diffs select web-only' hub/test/web-phase.test.ts; echo "exit $?"; node --test --test-name-pattern='hub implementation changes select hub plus Neovim smoke' hub/test/suite-selection.test.ts; echo "exit $?"` | both exit 0 with one passing test each and none skipped: a diff wholly under `web/**` selects `web-only` (`chooseSuiteMode(['web/src/Shell.tsx', 'web/test/smoke.test.ts'])`, `web/package.json` and `web/tsconfig.tools.json` too), protocol, shared wire, web edge, web auth, web bundle and CLI web files force `full`, and a mixed web and hub diff forces `full`; `web/app.ts` selects `web-only` and the reduced hub run keeps the Neovim smoke. T-1025 C2, T-991 C5; proven by `hub/test/web-phase.test.ts` "web diffs select web-only and protocol, edge and mixed diffs force full" and `hub/test/suite-selection.test.ts` "hub implementation changes select hub plus Neovim smoke" |
| M6 | hub-api | `node --test hub/test/web-phase.test.ts; echo "exit $?"` | exit 0, all 8 tests pass, none skipped. The planner emits no Web command and no `Web` phase when nothing is classified Web, for task, batch, periodic and stage plans: "without Web files task, batch, periodic and stage commands and phases stay unchanged" (T-1025 C3, C4); with Web files it places a separate machine phase after the hub phase with two local and four droplet workers: "Web is a separate machine phase after hub with two local and four remote workers"; tasks keep Web, merge batches exclude it and periodic and occasion runs include it: "tasks keep Web through T0-T2 caps; batches exclude it and periodic and occasion runs include it" and "candidate Web capability pins one Web command and never adds it to batch plans"; "tier lint accepts Web and rejects an unknown classification" (T-1025 C1); "Web per-test budgets use four seconds in enforce mode" |
| M7 | hub-api | `node --test --test-name-pattern='missing browser libraries report Web not run' hub/test/web-phase.test.ts; echo "exit $?"` | exit 0, one passing test, none skipped. A machine that cannot launch the browser reports `Web unavailable on this machine` with the reason (`libnss3.so => not found` in the stubbed probe) in the result summary and a structured `suite web phase` receipt with `status: "not-run"`, runs the other phases, and a broken probe is an error. T-1025 C6; proven by `hub/test/web-phase.test.ts` "missing browser libraries report Web not run in durable evidence and result without failing other phases" |
| M8 | hub-api | `node hub/test/lint-web-workspace.ts; echo "exit $?"; node hub/test/lint-tiers.ts; echo "exit $?"; node --test hub/test/web-bundle.test.ts; echo "exit $?"` | each exits 0: the first prints `web workspace: strict flags, shared compiler and post-typecheck build plan`; the tier lint accepts the Web test files with the tier recorded for E-415 (T-991 C6); the doctor test passes, none skipped (T-990 C8). Documentation: `grep -n 'Web phase' docs/agents/tests.md` and `grep -n 'Browser tests' web/README.md` each match (T-1025 C5, T-991 C8) |
| M9 | hub-api | `npm run typecheck` | exit 0, no diagnostics. It runs the hub, Neovim, shared wire and web typechecks, the web colour guard, the token check and oxlint with the hooks rules (T-990 C2, C3) |

Re-check helper, file and test names with grep at the tested build, renames happen. The colour guard, hooks check and workspace lint are plain scripts (not `node --test` files). A test name matching zero tests passes with exit 0 and "tests 0": read the counts, never the exit code alone.

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick (`chrome-headles[s]-shell`) or exclude the probe's process tree.
- The browser census is meaningful only under cover-quiet: a Web phase running for the Coordinator makes `BEFORE` non-zero; wait and rerun, do not record a PASS on a moved baseline.
- File-change probes use isolation; `git status --short` after each planted fixture is the proof that the worktree is clean again.
- A planted file is removed by its literal path, never by a glob or variable.
- `npm install` with a missing or stale lock may try the network (the headless shell download); a failure there is INCONCLUSIVE with the reason, not a failure of the item.
- "No skip": the Web phase tests and `web/test/smoke.test.ts` need Chrome Headless Shell, which the Linux droplets cannot launch until T-993 (the Coordinator's stage covers report that as Web unavailable); this run is local and must run them, so a skipped or unavailable Web test is BLOCKED, never PASS.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

The shell's rail, keys, areas, split and drawer (later stages), the real browser and any GUI (no real Chrome or Safari, no computer use; T-1011 is a separate item), Linux droplet browser libraries (T-993), Linux/macOS stage covers (the Coordinator's business, not judged here), duration budget lines (report-only), and the E-412 edge beyond what `web/test/smoke.test.ts` uses.

## Grants

none.

## Verdict

Fix nothing. Clear only when every check M1-M9 and S0 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "the ground"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-415 stage the ground` or `qa not clear E-415 stage the ground` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
