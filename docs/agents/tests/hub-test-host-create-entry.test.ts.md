# hub/test/host-create-entry.test.ts

T2 projectHub and a local UI socket client. The injected create function returns
an explicit synthetic id; host.create must return that id and pass the hub clock,
runtime owner, root and pool to the function. No native keygen, SSH or provider
acquisition runs. The fixture uses its normal sealed environment and shutdown.
This proves serveProject/Dispatcher injection without the native create fixture.

`host list accepts its JSON alias and refuses other extra arguments` seals the
C1 CLI boundary in a disposable projectHub: plain list and list --json return the
same JSON with an unreachable row, while --yaml fails with usage. No provider
resource or SSH process is created. The help/usage fixture names list [--json].
