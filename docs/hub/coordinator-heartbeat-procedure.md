## Coordinator heartbeat procedure

- On a heartbeat, read the digest. For owned work request missing reviews, merge ready items through the gate, ask idle sessions for state and retry unreported runs. Ask the human only for decisions, cap overruns or rows stale two heartbeats after repair. Otherwise end silently.
- Heartbeat: read the digest; for owned work request missing reviews, merge ready items through the gate, ask idle sessions for state and retry unreported runs. Ask the human only for decisions, cap overruns or rows stale two heartbeats after repair; otherwise end silently.

