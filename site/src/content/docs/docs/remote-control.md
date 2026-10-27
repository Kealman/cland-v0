---
title: Remote control
description: Pair a private Telegram chat with your project, follow General and answer away from the workbench.
---

A Telegram remote is your private chat with the project's bot. General goes both ways, and the inbox sends cards and notices from every topic. The hub connects out to Telegram: you need network access from the hub, but no tunnel, public address or open inbound port.

Use one bot per project and one paired human. Pairing uses your numeric Telegram user and chat ids; a username is only a display name. Approving a new pairing replaces the old one. Other people's messages are ignored; their presses on mapped cards are refused privately.

## Create and pair the bot

Start with an [initialised project and a running hub](/docs/quickstart/). Run these commands in your own terminal inside the project. Agent sessions cannot approve pairing or manage remotes.

### Through setup

Run `cland setup`. After the hub step, before the Aide, setup offers Telegram with a default of No, including when you pass `--yes`. It tells you how to create the bot, reads its token without echoing, enables it, and waits while you open the bot and press **Start**. Check the displayed name and numeric id before saying Yes to the pairing.

A paired rerun reports `ok`. Declining reports `skip` and is offered again next time. Without a terminal, an untouched remote reports `skip` with its setup commands; a partially configured or unpaired remote reports `open` with what remains. Setup never approves an identity without your confirmation.

### By hand

1. In Telegram, open **@BotFather**, send `/newbot`, and follow its questions for the name and username. Keep the returned token private. Give each project its own bot: only one consumer may poll a token.
2. Store it through the hidden prompt below. Paste the token only at the prompt, never after the command or in a message to a session. Piped input on stdin also works.

```sh telegram-pairing
cland secret set telegram.token
```

3. Enable Telegram and reload the running hub. The generated setting `remote.telegram.enabled` defaults to `false`; a token must also be present before it connects.

```sh telegram-pairing
cland config set remote.telegram.enabled true
cland hub reload
cland remote status
```

4. Open the bot link printed by status and press **Start** in its private chat. The bot replies with an eight-character code, your numeric id and an approval command. A code lasts one hour. Compare that identity with the waiting row in the inbox's **asks and approvals** section.
5. Approve from Neovim's pairing card, or replace `<code>` below with the code from your chat in your own terminal. The web row says **approve in the terminal or Neovim** and has no approve action. The remote cannot approve itself.

```sh telegram-pairing
cland remote approve telegram <code>
cland remote status
```

Status now names the paired human and id. In an already paired chat, `/start` names the project instead of issuing a code.

## In the chat

Ordinary text goes to the Coordinator in General as your message, marked **via Telegram**. Mention a session or role to address it, or `@lead T-n` for an item's lead. Address an Aide by its session name. Telegram formatting is dropped on input.

| Command | What happens |
| --- | --- |
| `/status` | Hub version and uptime, Coordinator, needs-you count, up to six sessions, queues, open release and this chat's state. |
| `/inbox` | Re-send a live copy of every open ask, approval card and 📥 notice at the bottom, oldest first, or say **Nothing needs you**. |
| `/question <text>` | Send a question to General. |
| `/decision <text>` | Send a decision to General. |
| `/mute` | Silence this remote's General stream; cards and notices keep arriving. |
| `/unmute` | Restore General and report how many messages arrived while muted. |
| `/cancel` | Cancel the pending Other answer or Decline input, keeping the ask open. |
| `/help` | Show the commands and trust limits. |

Reply to a mirrored message to reply in its topic. A request or item-message notice routes your reply to its topic; a plan or harness-TUI notice sends it to General with a reference. Item threads and the Agents topic are not mirrored as streams.

Ask cards and relayed Codex/OpenCode approval cards have buttons. A burst of new cards arrives oldest first. After `/inbox`, older copies keep working: answering any copy turns every copy into the outcome. The first answer from any workbench or remote wins. **Other answer…** and **Decline…** open a separate reply prompt; the next text or a reply to it supplies the answer or reason. A reply to an open ask card answers that ask. Closed cards say **Already answered**.

Other needs-you rows arrive as 📥 notices. Approve plans in the workbench and answer Claude Code's own command approvals in its harness terminal. Remote access covers messages, answers, relayed approvals and status/inbox reads; local administration stays in the terminal or Neovim.

General messages use Rich Messages by default, with plain text and entities as fallback. Set `remote.telegram.format` to `entities` if you prefer that rendering. Progress notes and hub notices arrive silently. 👌 confirms the hub stored your input; 👀 confirms the addressed session received it.

## Mute, outages and catch-up

Mute belongs to this remote and survives token rotation. The generated `remote.mute_default` setting is `false` and sets only a new pairing's initial state.

The [Remotes row](/docs/web-and-phone/#remotes) turns red as soon as a remote fails. After three minutes offline, General gets one offline line, then one on recovery. A wrong token, blocked bot or lasting token-consumer conflict stops Telegram and reports its fix immediately; the hub keeps serving.

On recovery, the hub handles the input Telegram kept first, marking late text with when it was written and when the hub returned. Late unthreaded text never answers an ask; an explicit reply targets only its own open card. Telegram retains messages for up to 24 hours and button presses for 150 seconds, so catch-up cannot recover everything.

If General messages were missed during an outage, the chat receives one gap line, **N General messages missed since …**, instead of replaying those messages. There is no line when the count is zero. Unknown send outcomes are kept as uncertain rather than blindly retransmitted.

## Status and maintenance

| Command | What it does |
| --- | --- |
| `cland remote status` | Show token presence and fingerprint, pairing, connection, last inbound/outbound, outbox depth, mute and the bot link. Requires the running hub. |
| `cland remote test telegram` | Check the token with Telegram and send one test line when paired. Requires Telegram enabled, a resolved token and network access. |
| `cland remote unpair telegram` | Forget the pairing. Pair again by pressing Start and approving the new code locally. |
| `cland secret list` | List only the stored names and 12-character SHA-256 fingerprint prefixes. No running hub needed. |
| `cland secret unset telegram.token` | Remove the file's token; reload to apply it. No running hub needed to edit the file. |

The project-local `.cland/secrets.toml` is git-ignored and mode `600`; symlinks are refused. With a custom `.cland/.gitignore`, keep `/secrets.toml` as its last non-comment rule before setting or unsetting a secret. `CLAND_TELEGRAM_TOKEN` overrides the file in the hub's environment; changing or unsetting the file does not replace that override. Sessions do not inherit the token. Status and doctor show fingerprints, never values.

### Rotate the token

Use BotFather's `/token` to obtain a replacement, then run these in your terminal:

```sh
cland secret set telegram.token
cland hub reload
```

Enter the replacement at the hidden prompt. Change an environment override at its source if you use one. Pairing and mute survive rotation because they are stored by numeric ids in the hub, separately from the token.

### If Telegram stops

Run `cland doctor` for local token presence, enabled state, connection, pairing and a stopped cause with its fix. Doctor makes no Telegram request; a stopped remote is a `warn`. Use `cland remote test telegram` when you want a platform check.

| Cause | Fix |
| --- | --- |
| Wrong or revoked token (401) | Obtain a new token, store it with `cland secret set telegram.token`, then run `cland hub reload`. |
| Bot blocked (403) | Unblock the bot in Telegram, then run `cland hub reload`. |
| Another consumer of the token (lasting 409) | Stop your other token consumer, then run `cland hub reload`. cland waits up to 60 seconds for a conflict to clear and never kills another poller. |

Reload retries a failed enabled remote even when its configuration is unchanged. A deliberately disabled remote stays stopped; enable it with `cland config set remote.telegram.enabled true` when you want it back.
