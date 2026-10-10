---
id: T-124
kind: task
title: "Focus and leaving a terminal: C-h/j/k/l in every mode, a lone C-\\ leaves Terminal mode, doctor's two key warnings, [keys] layouts with langmap, the kitty base-layout check recorded"
state: closed
status: done
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by: []
topic: topic-42
branch: t/T-124-focus-and-leaving-a-terminal-c-h-j-k-l
created: 2026-10-09T21:57:02.030Z
updated: 2026-10-10T00:58:17.996Z
---

## Parent

T-109 (Workbench basics), slice 1 of 5. Spec §3.12 (Focus and keys); research `research/free-keys` (`docs/research/free-keys.md`, T-85, with its probe kit).

## What to build

- **Focus.** `C-h`, `C-j`, `C-k` and `C-l` move focus between windows in every mode, Terminal mode included, so leaving an attached session is a focus move.
- **Leaving a terminal.** A lone `C-\` leaves Terminal mode, and `C-\ C-n` keeps working. Esc always reaches the harness, and no cland binding involves Esc or Meta chords.
- **Newlines.** Shift+Enter, through cland's `<S-CR>` mapping, and Alt+Enter still type a newline in the composer and in a harness, because `C-j` is taken.
- **Doctor.** `cland doctor` warns about a Ghostty `keybind = shift+enter=text:\n` line, which makes Shift+Enter the same code as `C-j`. It also warns about a tty erase character of `^H`. Each warning gives its fix.
- **Layouts.** `[keys] layouts = ["ru"]` in `config.toml` sets Neovim's `langmap` for each named layout, one option string per layout, so Normal-mode keys work in that layout. Typing in the composer and in a terminal is untouched. No Cyrillic duplicates of the Ctrl chords are mapped.
- **The kitty check.** Check once whether Neovim can take the kitty protocol's base-layout key for Ctrl chords. If it can, use it, so the four chords work in any layout. Otherwise they stay English-only, which is the human's accepted choice. Record the result, with the evidence, in `nvim/README.md`, and report it to the Coordinator; the decision is delegated to the Coordinator within §3.12.

## Acceptance criteria

- [ ] Headless tests: from Terminal, Insert and Normal mode, each chord moves focus to the expected window; a lone `C-\` leaves Terminal mode; `<S-CR>` in a terminal sends a newline, not `C-j`.
- [ ] Manual checks from the research's probe kit, recorded in the report: Ghostty in both encodings, and tmux with and without extended keys.
- [ ] `cland doctor` reports both local conditions with a fix line and stays quiet when they are absent, tested through the CLI with fixture config files.
- [ ] `[keys] layouts` sets `langmap`; a Normal-mode key typed in the Russian layout acts as its English counterpart; the composer receives Cyrillic text unchanged.
- [ ] The kitty base-layout result is recorded in `nvim/README.md`, with the probe.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. ADR 0005: Lua inside the standalone build, no plugins. Do not undo the terminal workarounds of `research/neovim-engine`. First in the Neovim lane, with no blockers. Defaults against instances: if a new `config.toml` default is added, list this project's line in the report.

## Comments

### impl-124 · 2026-10-09T22:00:09.956Z

Kitty probe A on the pinned 0.12.5 TUI decodes CSI 1088::104;5u as <C-р>, not <C-h>; Coordinator chose the English-only fallback, with Normal-mode Russian langmap. Evidence A-219 in topic-42. Implementing single-chord focus mappings and removing launcher Ctrl+H shadowing; terminal mitigations are preserved.

### impl-124 · 2026-10-09T22:06:29.327Z

Review head: 099802794581fabd8290e38adc3efaa90240faa4 (pushed to local origin; clean worktree). Targeted Neovim input, doctor CLI and init/config tests pass; typecheck passes. Full npm test is queued behind the machine suite lock. Kitty fallback evidence A-219; tmux default and extended replay A-222/A-223; tty erase replay A-224. Defaults: generated layouts = []; Coordinator will commit this project’s [keys] layouts = ["ru"].

### rev-6 · 2026-10-09T22:09:45.380Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-124-1
commit: 099802794581fabd8290e38adc3efaa90240faa4

Medium — hub/src/doctor/keys.ts:19: the matcher warns on an earlier Shift+Enter LF binding even after a later safe override/unbind, misses valid quoted keybind values, and accepts invalid uppercase KEYBIND. Production checkKeys memory probes reproduce all three. Track the effective binding using Ghostty's supported value syntax/precedence, and cover these CLI cases to meet the no-false-positives criterion.

No focus/input blocker: mode mappings, lone Ctrl-backslash/old pair, English-only kitty fallback, Russian Normal langmap, newline paths and ADR 0005 terminal workarounds look sound. daemon/protocol carry startup config in hub.status; no new synchronous filesystem read on serving request paths. Hub/Neovim typechecks and diff check pass; no reviewer native tests/full suite run. Physical Ghostty/tmux checks remain the human demo, as directed.

Separate Standards/Spec reports, pinned Ghostty primary-source links and exact memory probe: A-229, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-229-t-124-review-rev-6-124-1-at-0998027.md.

### impl-124 · 2026-10-09T22:12:21.169Z

Fix-round head bf909079bf945cd31669e17025b3168b7d799a03, pushed to local origin; clean worktree. Ghostty detection now follows case-sensitive keys, value quoting and final-binding precedence, including unbind/clear and pinned legacy-before-modern file order. Requested CLI cases and file precedence pass; typecheck and diff check pass. The 0998027 full suite was terminated and cleaned up at the Coordinator’s request; one replacement npm test is queued on bf90907.

### rev-6 · 2026-10-09T22:17:50.000Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-124-2
commit: bf909079bf945cd31669e17025b3168b7d799a03

Low — hub/src/doctor/keys.ts:36: removing only the final LF binding can reveal an earlier LF definition; recommend a safe final replacement or removal of all LF definitions. No high or medium remains.

The prior detector finding is fixed. Production memory probes confirm quoted values, case-sensitive keys, final override/unbind/clear and legacy→modern→macOS precedence. Focus/input paths unchanged by this delta. Hub typecheck and diff check pass; full suite not run by Reviewer, and physical Ghostty/tmux checks remain the human demo. Separate Standards/Spec reports and exact probes: A-233, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-233-t-124-resolution-review-rev-6-124-2-at-bf90907.md.

### impl-124 · 2026-10-09T22:28:59.585Z

Complete on bf909079bf945cd31669e17025b3168b7d799a03 (pushed to local origin; clean worktree). npm run typecheck and npm test pass: 638 hub + 112 Neovim tests, 750 total, zero failures/skips. Review clear rev-6-124-2 (A-233). Final report A-239 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-239-t-124-final-implementation-report-bf90907.md; passing full-suite log A-238 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-238-t-124-full-suite-on-bf90907-750-passing-tests.log. Kitty fallback and PTY/tmux evidence A-219/A-222/A-223/A-224/A-225. Physical Ghostty/tmux keyboard checks remain the human demo, as agreed. Generated default layouts = []; Coordinator owns this project’s layouts = ["ru"]. No merge performed.

### coord · 2026-10-09T22:29:06.816Z

Merged 22fa549c83d58d253a925405e791e24ffbcbc664 onto dev.

### coord · 2026-10-09T22:29:28.059Z

Merged by the Coordinator through `cland merge T-124`: squash 22fa549 on dev. Gate: review rev-6-124-2 clear on bf90907, after rev-6-124-1 (Ghostty effective-binding detection). Full suite on bf90907: 638 hub and 112 Neovim tests passed (A-238); report A-239.
Delegated decision, reported to the human's stand-in: the four Ctrl focus chords stay English-only, because Neovim 0.12.5 ignores kitty's base-layout alternate key. Normal-mode keys work in Russian through langmap. This project's config gets `[keys] layouts = ["ru"]` in a separate commit.
Open low from rev-6-124-2: removing the final LF line can expose an earlier one, so doctor's fix text should suggest a safe final replacement line. Wording only, accepted.
For the human's demo: live Ghostty and tmux keyboard checks. Through tmux defaults Shift+Enter arrives as Enter, and Alt+Enter is the fallback. impl-124 stopped.
