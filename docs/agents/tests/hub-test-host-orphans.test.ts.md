# hub/test/host-orphans.test.ts

T3 starts a fake OpenCode server in a disposable project through the existing
native orphan fixture with fixtureEnvironment. A local running row positively
protects it; changing only its host removes that protection. The server's own
cwd and log establish native sweep ownership, and the test observes native exit.
Doctor and startup sweep share orphanSessions, which excludes every remote row
and reads pre-column databases without migration. Process cleanup owns the child
before the project root can be removed.

The final native spawn seals inherited and overlaid values through
fixtureEnvironment, then restores explicit contained profile/config inputs with
scratchAccountEnvironment. A synthetic native program reports only presence flags
for credential/Git sentinels and its declared scratch paths; its log is the receipt
that the final child received the expected environment. No secret values are captured.
