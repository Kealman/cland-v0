# hub/test/login-host-pin.test.ts

T2: injected sign-in runner and in-memory host records with FakeClock. Tests prove
the host is pinned before the sign-in runner begins, stays pinned through its
completion, and releases on success, failure or disconnect. The lifecycle case
asserts a durable lease deadline extension while pinned, prevents idle-stop,
then observes destruction after unpinning. All filesystem state is disposable;
no native process, real host, browser or external provider runs.

Admission controls refuse invalid, empty and duplicate names before creation or
pinning. The creating row is reserved before asynchronous host preparation.
Fault controls change readiness after allocation, attachment, mount and config
publication, and replace the captured machine birth while keeping it ready;
none may publish a terminal plan or continue with new effects. Confirmed cleanup
releases only the admitted attempt's pin.

`login add creates a host while its only login is still creating` proves the
T-1784 C5 exemption through preparePoolLogin with injected creation and sign-in.
