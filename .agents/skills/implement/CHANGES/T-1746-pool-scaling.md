# T-1746 pool scaling

Pool startup and waiting launches create hosts through the existing leased,
watchdog-backed create path. Active creating/booting/connecting/cloning/ready
and destroying inventory fences max_hosts; destroying never takes placement.
Live max_hosts writes retry waiting placement. See docs/hub/pool-scaling.md and
docs/agents/tests/hub-test-pool-scale.test.ts.md for admission conditions and
injected/native evidence boundaries. No new role permissions or commands.


Review correction: reserve is side-effect-free; only validated durable waiting
ownership or startup minimum service demand creates hosts. All creates share
latest-config, receipt-aware occupied-capacity admission immediately before the
creating row. Positive non-acquisition kinds are shared with host spend.


Receipt parity correction: SQL only narrows failed-unreleased anomalies; shared
positiveNonAcquisition performs date validation in JS. Generic name, Lead item
and current-role checks guard durable demand and the pre-row checkpoint. Memory
refusal on a ready host with spare weight does not create another host.
