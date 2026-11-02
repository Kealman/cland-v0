## Telegram voice transcripts

Both workbenches present the stored transcript prefix as a separate message-header
mark beside `via Telegram`: `🎤`, `🎤 not transcribed` or `🎤 nothing recognised`.
The transcript (or failure reason) stays in the body and the original recording
stays attached. This presentation uses remote human messages with the voice
prefix and a recording artifact (OGG/Opus, MP3, M4A, WAV, FLAC, AAC or WebM,
or a generated Telegram audio/video-note filename). Typed captions on other
attachments and ordinary text stay unchanged.

With Telegram enabled and paired, voice notes join its durable media FIFO.
Standalone audio files and video notes also transcribe when their declared duration
is within `[speech] max_seconds` (default 600, live on reload). Audio retains its
sender MIME and filename; video notes use `video/mp4` and
`video-note-<message id>.mp4`. Their caption follows the transcript on a second
line. Longer audio/video notes, videos and documents remain plain artifacts
with captions and make no speech request. Eligible album audio uses the
[album transcript format](additive-interaction-selection-t-1454.md#telegram-album-transcripts).
Voice notes exceeding the duration cap are refused before `getFile`, as are
recordings with a declared size above Telegram's 20 MiB download cap (or the
configured artifact limit if lower). The refusal is one chat line and posts
nothing in General.
The gateway downloads the original bytes and passes bytes, MIME type and a
matching `voice-<message id>.ogg`, `.mp3` or `.m4a` name to the speech provider.
The provider receives no Telegram URL. General receives one human message,
`🎤 <transcript>`, with the audio artifact. The chat receives a reply to the note
with the transcript, duration, download/transcription times and provider name;
the General message is excluded from the mirror back to Telegram.

A voice reply to an open ask card, or the next voice note after **Other answer…**
or **Decline…**, uses the transcript as the answer or decline reason via Telegram.
Options-only cards accept a number or option text ignoring case and trailing
punctuation. Successful answers keep no audio artifact and post no General
transcript; the note receives its transcript echo marked “answered” and the card
shows its outcome. Failed, empty or unmatched notes leave the ask open and retain
the ordinary audio message in General, with one explanatory reply in the chat.
Late voice notes never answer, including explicit replies to cards. Voice targets
are fixed when their updates are admitted, before any delay in the media FIFO.

An empty transcript becomes `🎤 nothing recognised`. Missing credentials or
`[speech] provider = ""` retain the audio as `🎤 not transcribed` and send one
setup/off line. Provider failures retain the audio and name the failure kind,
for example `🎤 not transcribed: quota`. Download and transcription share one
90-second deadline. `cland hub reload` rebuilds the provider from current speech
settings and resolved secrets, including a switch to the local command provider.
Long echoes use numbered replies within Telegram's 4096-code-point budget.
Echo delivery has its own durable worker: an unknown native receipt remains
fenced and records an incomplete outcome without blocking later inbound text
or media. A missing command points to `[speech] command`; the ElevenLabs key hint
is specific to ElevenLabs.
Corrections are new messages; transcript messages are never edited. Media and
upload ingress deduplication prevent a replay from posting another message.


<!-- Implementation guidance moved from the implement skill. -->

For project secret storage or CLI input, read `docs/agents/secrets.md` and use
the T1 stream, T2 startup/CLI and native Git seams in
`docs/agents/tests/hub-test-secrets.test.ts.md`. Share `resolveSecrets(root, env)`
for hub/provider values (environment overrides win);
use `readSecretsFile(root)` for file-only CLI reads and edits. Filter all four remote
secret environment names with `withoutExecutorCredentials` after child overlays,
including the speech command launcher. Keep values in stdin or the private file
and diagnostics limited to fixed reasons.
Preserve custom ignore bytes and require a final literal secrets rule before
input. For validation, rotation registration or remote/speech output, use
`docs/agents/tests/hub-test-gateway-secrets.test.ts.md`: one project-owned registry
and the shared validation/registration boundary before provider activation. Use
the fixture's registered close/output barrier before root removal.
Import credential code inside daemon startup and reuse its resolver closure on
reload, passing the daemon environment and registering before gateway activation.
Keep `project.ts` import-free; preserve the CLI import budget and startup receipts.

For the speech seam and ElevenLabs transport, use the T2 loopback/fake-clock
boundary in `docs/agents/tests/hub-test-speech.test.ts.md`. Pass the project-owned
redactor and resolved key to the provider and the same registry to `transcribeNote`;
keep the original bytes, one note deadline, bounded attempts and only transient
retries. The fake records key presence only. Existing role clauses cover this
boundary; add no permission lines.

For command speech or provider selection, use
`docs/agents/tests/hub-test-speech-command.test.ts.md`: sealed test-written Node
scripts, literal argv, original stdin, the final credential filter, bounded
redacted stderr and native close after deadline escalation. Use `speechProvider`
with resolved secrets and the project registry; commands opt out of retries and
receive the whole note deadline. Existing role clauses cover this boundary.

For remote/speech configuration or reload, use the template/writer and frame/CLI
seams in `docs/agents/tests/hub-test-config-set.test.ts.md`. Inject
`gatewayMessenger` with the test messenger, resolve secrets inside the daemon,
and observe start/stop completion before claiming reload applied. Keep the
legacy `gatewayRemotes` seam and CLI import budget unchanged.

For speech doctor and status output, use the sealed CLI/fake speech seams in
`docs/agents/tests/hub-test-doctor-remotes.test.ts.md` and
`docs/agents/tests/hub-test-remote-cli.test.ts.md`. Doctor resolves presence only when a remote is enabled; unused/off speech is
`ok` with its detail. Plain status computes data use from local config, keeping JSON/wire unchanged.
