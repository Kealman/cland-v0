# hub/test/transport-ssh.test.ts

T3 uses only the real SSH carrier with fake-ssh and disposable fake hosts. The
fixture installs a Node detached-spawn stand-in for setsid on macOS. It supplies
the agent's fake boot-id environment explicitly, keeps Unix paths under /tmp
for the macOS socket bound, and seals every child environment with the shared
builder after overlays. A planted-secret positive control precedes the argv scan.
A SIGKILL recovery receipt includes three reverse echo exchanges, the agent's
same authenticated PID and successful multiplex check, with a retained 10-second
bound. The unchanged supervisor PID proves bootstrap singleton reuse. Injected
clock cases cover retry deadlines/wake and periodic agent probing.

Teardown stops the carrier, closes every socket/server, captures and drains the
scratch-root process census, then removes storage. A failed setup uses the same
early directory owner. Native subprocesses are detached. No real SSH, network,
key or provider is used. Run this file singly through targeted admission.

A-16146 regressions independently launch and own a detached old fake master,
refuse its exit, and retain its exact socket inode through a fenced backoff.
Two distinct carriers start concurrently; only one is admitted. After native
old-master close is observed, a replacement must authenticate through agent.sock.
The trust-source positive control removes the global-disable option: a matching
scratch global key admits a mismatched private pin. The actual carrier must
refuse that combination before writing any secret, then connect successfully
with the correct private pin under a project path containing spaces. The fake
models both trust sources; its default global path is scratch-only and opt-in.
