# hub/test/telegram-voice-command.test.ts

T3 retains C5 through production ConfiguredGateway reload, public hub frames,
the loopback fake Telegram and a native Node speech command in a sealed disposable
root. The shared voice fixture owns hub lifetime, isolated environment, stores
and native connections. No real provider, credential or browser is used.

Start with speech disabled. Edit only speech settings, preserving the harness's
sealed lock paths, invoke hub.reload, and send a new voice note. The disposable
argv script compares original stdin bytes and prints a known transcript. Wait
for durable media completion before asserting one General transcript and one
native echo naming command. Keep this process case at T3 while the loopback-only
voice outcomes stay at T2. Run alone, subject to cover-quiet.

Generated empty/missing command cases retain the audio and `🎤 not transcribed`
with one command-setup line. An empty argv and an ENOENT executable must both
point to `[speech] command`, never the ElevenLabs secret.
