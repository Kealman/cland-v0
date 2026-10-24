---
title: Quickstart
description: Install cland, initialise a project, run setup and get your first crew working.
sidebar:
  order: 2
---

This page takes you from nothing to a crew working on your project. You run two cland commands. After that, sessions act for you and ask you for decisions.

You need macOS or Linux and at least one AI coding plan: a Claude plan for Claude Code, a ChatGPT plan for Codex, or a provider for OpenCode. OpenCode's free model needs no plan at all.

## 1. Install

```sh
# macOS
brew install cland

# Linux
curl -fsSL https://cland.app/install.sh | sh
```

The install script requires Node >=24.13.0 <25 and npm on your PATH. See [Install](/docs/install/) for the other prerequisites and custom prefixes.

Check it:

```sh
cland --version
```

Other methods, requirements and updates are on [Install](/docs/install/).

## 2. Initialise the project

Go to a project folder. It can be an existing repository or an empty folder.

```sh
cd my-project
cland init
```

`cland init` is deterministic and changes only cland's own files:

- In an empty folder, or a folder without Git, it runs `git init -b main`. A repository without commits gets a first commit that holds only cland's files. Your own files stay as they were.
- It creates `.cland/` with the tracker folder, `config.toml`, `roles.toml`, `crew.toml` and an empty rulebook.
- It copies the curated skill set into `.agents/skills/`, adds a managed block to `AGENTS.md` and installs Claude Code hooks in `.claude/settings.json`.
- It makes a local bare repository, `.cland/territory.git`, the new `origin`. An existing `origin` (your GitHub remote) is renamed `github`. Nothing is pushed anywhere.
- It creates the `dev` branch and four categories for loose work: Bugs, Tech debt, Follow-ups and Ideas.

It ends with one line:

```text
next: cland setup
```

:::note
A shallow clone is refused with `the territory needs the full history`. Fetch the full history first (`git fetch --unshallow`). cland also refuses to use your home folder as a project.
:::

## 3. Run setup

```sh
cland setup
```

Setup checks eight things in order. Each step prints one line: `ok`, `done`, `skip`, `open` or `fail`. A step that is already true prints `ok` and asks nothing, so running setup twice is safe.

1. **The project.** `.cland/` exists, or setup stops and tells you to run `cland init`.
2. **The harnesses.** It looks for Claude Code, Codex and OpenCode. For a missing one it shows the official installer and runs it on your yes. cland needs at least one.
3. **The logins.** For each installed harness a role uses that still needs a login, it offers to run the harness's own login in this terminal: `claude auth login`, `codex login` or `opencode auth login --standalone`. OpenCode's login is optional: its free model needs none.
4. **The accounts.** It lists the profiles you are signed in to and offers to name them in `~/.config/cland/accounts.toml`. The default answer is no. Say yes when you have several accounts on one harness. See [Accounts and limits](/docs/accounts/).
5. **Your favourite harness.** The one you want to talk to. Your Aide runs on it.
6. **Trust.** It grants project trust for installed Claude Code and Codex profiles, including profiles selected by roles; OpenCode has no trust gate.
7. **The hub.** It starts the project's hub, which keeps running after setup ends.
8. **The Aide.** It launches `aide-1` on your favourite harness and opens the workbench with the Aide's terminal in the centre.

:::tip
On a machine without a terminal UI, `cland setup --attach` runs the harness's own attach command in the same terminal instead of opening the workbench. Open the workbench later with `cland`.
:::

## 4. The onboarding

The Aide now leads a short conversation. It works in rounds: each question comes with a recommended answer, and "yes" accepts it. It says what it will change before it changes anything. It speaks your language; items and rules stay in English.

1. **Your role.** Developer-architect, designer, product owner, or a mix.
2. **What you decide.** Your answers become rules in the project's rulebook. A developer-architect usually keeps the stack, the architecture, the test strategy and releases. Whatever your role, the Aide recommends one rule: *sessions run commands for you; you are asked for a decision, never for a keystroke.* If you want to approve epic plans yourself, say so here.
3. **A first plan you can see.**
   - On an empty project: what to build first, a small version you can try soon. The Aide shows the first release as a table: its goal and three to six tasks in order, with sizes, blockers and acceptance criteria. You accept it, and the items appear in the workbench.
   - On an existing project: the Aide studies the code first and reports in a few lines. It offers to import your open GitHub issues. Then "what next" becomes the first release.
   - If what to build is still unclear, the Aide charts a map of open questions with research sub-agents instead.
4. **The categories** and what each holds.
5. **The stack and its checks.** For example: build with TypeScript; checks: `npm run typecheck`, `npm test`. The commands become your [verification](/docs/verification-and-release/) commands.
6. **The crew.** The Aide explains the roles, then proposes the crew as one table: harness, model, count and how each role works, from the harnesses you have. One harness is a valid crew. It also asks how Claude Code sessions handle permission prompts. See [Crew configuration](/docs/crew/).
7. **The welcome note.** A short note in General, in your language: who is who, your rules, the first release and how to reach the Aide.
8. **The commit.** The Aide commits everything `cland init` and the onboarding wrote, on `dev`.
9. **The start.** "Ready to start? When you say ok, I launch the Coordinator with this brief: Work release R-1." Say ok.

After that, the Aide offers a tour of cland in eight short stages tied to what is on your screen. You can stop after any stage.

## 5. Watch the crew

The Coordinator plans the first work and launches an Implementer once the plan and staffing allow it. In the workbench:

- **The centre** shows the explorer: the release, its epics and tasks, with the card of the row under the cursor.
- **`␣s`** (Space, then `s`) opens the sessions panel: each session with its role, harness, model, state and the item it works on.
- **`␣g`** opens General, your conversation with the Coordinator. Type a message and press Enter.
- **`␣n`** opens the inbox: only what needs you.
- **Enter on a session row** attaches its terminal in the centre, so you can watch the harness work and type into it. `C-\` leaves the terminal. See [Sessions and harness access](/docs/sessions/).

A task moves through `planned`, `in progress`, `review`, `ready` and `done`. You see each move as it happens. See [The workbench](/docs/workbench/) for every panel and key.

## 6. Answer an ask

When the Coordinator needs a decision, it sends an **ask**: a question with numbered options and room for a free answer. The top bar's "needs you" count goes up and the ask appears in the inbox.

- Open the inbox with `␣n`.
- Press `1` to `9` to pick an option, or `i` to type a free answer and press Enter.

The row leaves the inbox and the count drops. From a shell, set `ASK_ID` to the ask id printed by `cland inbox`, then answer it:

```sh
cland inbox                       # what needs you, with ask ids
cland topic answer "$ASK_ID" 2     # pick option 2
```

That is the whole loop: the crew works, you decide.

## Next

- See everything cland does: [Features](/docs/features/).
- Talk to the crew and answer its asks: [Topics and the inbox](/docs/topics/).
- Change the crew's harnesses and models: [Crew configuration](/docs/crew/).
- Follow the crew from your phone: [Web and phone](/docs/web-and-phone/).
- Learn how work reaches `dev` and GitHub: [Verification and release](/docs/verification-and-release/).
