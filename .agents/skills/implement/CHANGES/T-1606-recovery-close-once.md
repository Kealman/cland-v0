# T-1606: failed-launch native cleanup has one owner

The merge batch exposed a duplicate Codex client close after verified deferred
recovery (`adapter-native-boundary`, `closedClients(): 2 !== 1`). The private
failed-launch settlement now delegates native close and live-row removal only
to the launch's captured cleanup callback. It records that phase independently
of unforward completion, so a rejected unforward can retry without repeating
native cleanup. Reconnect acquisition is still joined before unforward settles.

The existing native-boundary test remains unchanged. The recording-Host test
now fails after attachment and admits a deferred retry while cancellation is
held; it checks one close before, during and after settlement, alongside the
existing recovery-row and role ownership assertions. The generic settlement
timeout/concurrency test also counts close effects directly. Other adapters and
the shared settlement callback contract are unchanged.
