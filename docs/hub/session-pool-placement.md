# Session pool placement

At each `session.launch`, the hub refreshes roles and reads the role's launch
`pool` (default `local`). Local launches retain local behavior. For a configured
nonlocal pool, the hub uses registered, provisioned, ready Hosts of that pool
and the pure scheduler's integer milli-slot weights. Running process rows count
as used capacity; admitted launches promise capacity until publication or rollback.
Dense placement fills the fuller eligible Host; `spread = true` selects the
emptiest. Pool settings changed through `cland config set` apply immediately;
hand edits to config use `cland hub reload`. Role-file changes apply on launch.

A missing pool refuses with its name and the configured pools before role
reservation or spawn. If no ready Host has room, admission refuses with
`no host in pool <pool>`. This path does not create machines or queue launches.
An explicit `host` in the launch frame bypasses pool selection. A provisioned
pin still checks its pool's slot capacity and refuses when full; manually
registered Hosts have no declared pool capacity. Coordinator and Aide remain
local through `checkRoleHost`. Pool membership comes from provision records,
not caller-supplied labels. No login eligibility restriction is added: the
scheduler's default verdict remains `serves`.

Placement admission wraps item checkout preparation, so the worktree and harness
use the same selected Host. The scoped promise is released on every completion
or error. Existing resume/migration paths retain their captured Host semantics.
Remote process views add optional `host`; local views preserve the previous
shape. CLI session lines show the Host and treat an absent field from an older
hub as `local`. This requires no new role permission or command.

Proof uses provided fake Hosts/fake adapters at T2 and the existing scripted
host-create/OpenCode native case at T3. No real provider, auth or network
availability is claimed by these fixtures.

A placement captures the registered machine identity and rechecks its ready
provision/registration at the adapter's final native authorization boundary.
A host losing readiness during preparation refuses the captured launch rather
than moving an already prepared checkout. Failed accepted generations continue
to consume capacity through their durable pending-stop owner until native
closure is confirmed; running and pending copies of one generation count once.

Item handoff admission can reserve an exact idle crew-pool worker on its current
Host. Its running weight is credited against the promise, so a full Host can
reuse that worker. The promise remains across an Implementer stop/restart gap;
if the chosen worker changes before handoff, the launch refuses rather than
silently starting an extra process.

Unknown retained native generations also consume their source Host's capacity
after the current row moves elsewhere. The process table's indexed live
retirement iterator supplies them; confirmed native closure or reboot releases
that charge. These obligations are deduplicated against running and pending-stop
copies by their captured native generation.

Placement preserves existing local admission precedence: crew caps are checked
before role tickets, and item claim/worktree checks precede session-name admission.
CLI lines append Host facts after PID, preserving the earlier leading columns.

An omitted launch role is captured with its placement defaults. A change to that
preassignment during reads or preparation refuses the launch; a new role cannot
inherit the old role's pool/account selection. Early admission refuses a name
already owned by a crew handoff before changing any reservation.

Name ownership excludes both directions of overlap: reuse skips workers whose
name an early placement holds, and early placement refuses an already-selected
handoff worker before preparation/stop. Later item launches also respect an
earlier placement's new roleless name before native admission.
