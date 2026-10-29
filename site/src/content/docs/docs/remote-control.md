---
title: Remote control
description: Pair a Telegram chat or Discord server channel with your project, follow General and answer away from the workbench.
---

A Telegram remote is your private chat with the project's bot. General goes both ways, and the inbox sends cards and notices from every topic. The hub connects out to Telegram: you need network access from the hub, but no tunnel, public address or open inbound port.

Use one bot per project and one paired human. Pairing uses your numeric Telegram user and chat ids; a username is only a display name. Approving a new pairing replaces the old one. Other people's messages are ignored; their presses on mapped cards are refused privately.

## Create and pair the bot

Start with an [initialised project and a running hub](/docs/quickstart/). Run these commands in your own terminal inside the project. Agent sessions cannot approve pairing or manage remotes.

### Through setup

Run `cland setup`. After the hub step, before the Aide, setup offers Telegram, then Discord, with a default of No, including when you pass `--yes`. It tells you how to create the bot, reads its token without echoing, enables it, and waits while you open the bot and press **Start**. Check the displayed name and numeric id before saying Yes to the pairing.

A paired rerun reports `ok`. Declining reports `skip` and is offered again next time. Without a terminal, an untouched remote reports `skip` with its setup commands; a partially configured or unpaired remote reports `open` with what remains. Setup never approves an identity without your confirmation.

After the messenger offers, setup offers an ElevenLabs key only when `[speech] provider` is `elevenlabs` and its resolved key is missing. It shows the same data-use line as `cland remote status` before a default-No offer, even with `--yes`, then reads the key at a hidden prompt. Accepted input is `done`, a decline is `skip`, and a present file or environment key is `ok`. Without a terminal, a missing key is `open` with `cland secret set speech.elevenlabs_key`. The `command` and empty providers print their data-use line and ask nothing. Setup only stores the key; reload a running hub with `cland hub reload` to use it.

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

## Create and pair Discord

Each project uses its own Discord application and bot, in a text channel of your own server. The paired guild, channel and user ids identify you; other members can read the channel but cannot act as you.

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications). Set **Install Link** to **None**, turn **Public Bot** off, enable **Message Content Intent**, and leave **Interactions Endpoint URL** empty.
2. Run `cland setup` in your terminal. After Telegram, accept the Discord offer and paste the bot token into its hidden prompt. Setup stores `discord.token` privately, reads the application settings and names each correction. Confirm a re-check after changing them; setup enables Discord only after the checks pass.
3. Open the invite printed for your application: `https://discord.com/oauth2/authorize?client_id=<application-id>&scope=bot&permissions=117824`. Add it to your server. Setup waits up to ten seconds for the gateway connection; if it stays open, check `cland remote status` and rerun setup.
4. In the server text channel you want to pair, run `/cland pair`. Press Enter in setup, compare “Pair Discord user <id> (<Name>)? code …” with your identity, and say Yes. Its private code lasts 15 minutes. A paired rerun reports `ok`; a declined offer reports `skip`.

To configure it by hand instead, use these commands in your own terminal. Paste the token only at the hidden prompt, then open the bot invite from status and run `/cland pair` in Discord.

```sh
cland secret set discord.token
cland config set remote.discord.enabled true
cland hub reload
cland remote status
```

Approve the waiting code from Neovim or replace `<code>` in your terminal:

```sh
cland remote approve discord <code>
cland remote status
```

Discord uses `/cland status`, `/cland inbox`, `/cland mute`, `/cland unmute`, `/cland decision`, `/cland question` and `/cland help`. General and cards go to the paired channel. Free answers and declines open a modal. Pairing approval stays local, and a new approved channel replaces the previous binding.

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

## Photos, files and voice

### Photos, documents and albums

Send a photo or document to the paired Telegram chat. It becomes your artifact on your message in General, with the caption as the message text. An album becomes one message with every attachment and the first non-empty caption. An audio album also stays one message with every file; its members are not transcribed.

Telegram downloads are limited to 20 MB per file. The hub also enforces `[artifacts] max_upload_mb` (`artifacts.max_upload_mb`), a per-file limit in MiB that defaults to 50. A file over either limit gets a reply saying so. Changing the hub's upload limit requires a hub restart. The hub downloads the original bytes itself; Telegram's token-bearing file URLs never reach sessions or a speech provider.

Artifacts attached to mirrored General messages go to Telegram as photos for images up to 10 MB, or as documents for files up to 50 MB. HTML and diagrams go as documents. Larger files arrive as a line naming the artifact and its path. Each artifact goes once ever per remote; attaching it again replies to the earlier file with **▣ A-n … (sent above)**. File captions are plain text and include the message header; a single artifact with short message text includes that text in its caption too.

### Voice and transcripts

Individual voice notes are sent for transcription. A voice note whose reported duration exceeds `speech.max_seconds` is refused before download and is not stored; the generated default is 600 seconds (10 minutes). Audio files and Telegram video notes are transcribed only when their reported duration is present and within that cap. Longer audio files and video notes, or ones without a reported duration, follow ordinary artifact upload without transcription, subject to the file-size limits. Videos, documents and audio albums are not transcribed. Telegram's 20 MB download cap also applies. Download and transcription share one 90-second deadline. Cloud attempts retry only rate-limited, unavailable and timeout failures, at most twice with backoff and Retry-After; the local command is not retried.

A successful note reaches General as your **🎤 transcript**, with the original audio attached as your artifact. The bot echoes the transcript into Telegram with the note's length, download and transcription times, and provider name. Correct a transcript by sending your next message; transcripts are never edited afterwards.

With no key or transcription turned off, General receives **🎤 not transcribed** with the audio and the chat gets one line explaining how to enable it or that it is off. A provider failure still posts the audio with **🎤 not transcribed: &lt;reason&gt;** and one chat line. An empty transcript becomes **🎤 nothing recognised**, with the audio attached.

A voice reply to an open ask card answers through its transcript and keeps no audio artifact on success. If the note cannot answer, the ask stays open and the note goes to General as an ordinary 🎤 message with its audio.

### Choose transcription

In `.cland/config.toml`, `[speech] provider` (`speech.provider`) selects `elevenlabs`, `command`, or `""` to turn transcription off. Generated projects use these defaults:

```toml
[speech]
provider = "elevenlabs"
model = "scribe_v2"
language = ""
max_seconds = 600
command = []
```

`speech.model` chooses the cloud model. `speech.language` is a lower-case ISO 639-1 language hint; empty detects the language. Store the ElevenLabs key from your own terminal through the hidden prompt, then reload:

```sh
cland secret set speech.elevenlabs_key
cland hub reload
```

`ELEVENLABS_API_KEY` in the hub's environment overrides the stored key. Never put a key in a command argument or a message to a session. Speech configuration changes made with `cland config set <section.key> <value>` apply live; after editing the file or changing secrets, run `cland hub reload`.

For a local recogniser, set `provider = "command"` and `speech.command` to an argv array, for example `command = ["/absolute/path/to/transcribe", "--plain"]`. No shell is used. The executable receives the original audio bytes on stdin, `CLAND_SPEECH_MIME` with the MIME type, and `CLAND_SPEECH_LANGUAGE` with the hint (empty for detection). It prints the transcript on stdout, trimmed and limited to 1 MiB. Remote tokens and speech keys are removed from its environment; keep secrets out of the argv array. A non-zero exit or signal reports `command-failed` with a bounded, redacted stderr tail; the deadline kills the command. No transcoding is performed.

Set `provider = ""` to keep audio without transcription. `cland doctor` makes no paid call: with an enabled remote it reports the ElevenLabs key's presence and fingerprint, or whether the command's argv[0] resolves. Missing keys and unresolved commands are `warn`; present keys and resolved commands are `ok`. With no remote enabled it reports `ok` with **speech unused until a remote is set up**; with an empty provider it reports `ok` with **transcription off**.

Plain `cland remote status` ends with the locally configured provider's data-use line (JSON status is unchanged):

- ElevenLabs may train on audio outside enterprise plans and stores transcripts; turn off "Improve the models for everyone" under Terms and privacy, Data use. Change provider in [speech].
- The local speech command handles the audio; its own configuration controls data use. Change command or provider in [speech].
- Transcription is off; no audio is sent to a speech provider. Change provider in [speech].

## Mute, outages and catch-up

Mute belongs to this remote and survives token rotation. The generated `remote.mute_default` setting is `false` and sets only a new pairing's initial state.

The [Remotes row](/docs/web-and-phone/#remotes) turns red as soon as a remote fails. After three minutes offline, General gets one offline line, then one on recovery. A wrong token, blocked bot or lasting token-consumer conflict stops Telegram and reports its fix immediately; the hub keeps serving.

On recovery, the hub handles the input Telegram kept first, marking late text with when it was written and when the hub returned. Late unthreaded text never answers an ask; an explicit reply targets only its own open card. Telegram retains messages for up to 24 hours and button presses for 150 seconds, so catch-up cannot recover everything.

If General messages were missed during an outage, the chat receives one gap line, **N General messages missed since …**, instead of replaying those messages. There is no line when the count is zero. Unknown send outcomes are kept as uncertain rather than blindly retransmitted.

After the gap line, missed open cards and pending outcome edits are delivered. If the outage lasts longer than 150 seconds, every open card is re-sent at the bottom with **a button pressed then may have been lost; press again**, and each old copy shows **↓ Re-sent below** without buttons. Outages of 150 seconds or less do not re-send cards already delivered.

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

### If a remote stops

Run `cland doctor` for local token presence, enabled state, connection, pairing and a stopped cause with its fix. Doctor makes no Telegram or Discord request; a stopped remote is a `warn`. Use `cland remote test telegram` when you want a platform check.

| Cause | Fix |
| --- | --- |
| Wrong or revoked token (401) | Obtain a new token, store it with `cland secret set telegram.token`, then run `cland hub reload`. |
| Discord wrong or revoked token (4004) | Obtain a new token in the Discord application, store it with `cland secret set discord.token`, then run `cland hub reload`. |
| Discord Message Content toggle disabled (4014) | Enable Message Content in the Discord application, then run `cland hub reload`. |
| Bot blocked (403) | Unblock the bot in Telegram, then run `cland hub reload`. |
| Another consumer of the token (lasting 409) | Stop your other token consumer, then run `cland hub reload`. cland waits up to 60 seconds for a conflict to clear and never kills another poller. |

Reload retries a failed enabled remote even when its configuration is unchanged. A deliberately disabled remote stays stopped; enable it with `cland config set remote.telegram.enabled true` when you want it back.

Doctor also names Discord startup refusals: clear the Interactions Endpoint URL, repair a refused gateway configuration, or wait until the UTC reset time for an exhausted Identify budget. Discord pairing output includes the numeric user, channel and guild ids. Doctor reads local presence and hub status only; use `cland remote test discord` for a platform check when Discord is enabled, a token resolves and network access is available.
