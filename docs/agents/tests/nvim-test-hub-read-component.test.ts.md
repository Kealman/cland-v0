# nvim/test/hub-read-component.test.ts

Workbench settling tests count outbound frames after completed startup and reconnect snapshots, advance
a client-local fake deadline clock ten minutes, and retain the final no-list-read assertion. Delayed-read
cases release the oldest original answer after its retry deadline and observe installed state, then verify
only the missing read retried with backoff. Waiting for a replacement request alone cannot prove recovery:
a late original reply must still complete startup. Rendered header and explorer-row assertions cover
independent session answers and local task-event updates. These use the T2 recorded stub, without crew
load or real-time latency claims.
