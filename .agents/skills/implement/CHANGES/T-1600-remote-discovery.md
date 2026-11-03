# T-1600 remote discovery

Remote Host sessions use CLAND_HUB_FILE and their session launch credential. The canonical discovery is ~/.cland-host/run/hub.json; the clone copy is T-1604. Read docs/hub/remote-discovery.md. CLI/hook/mod-bridge admission retains session credentials; the host bearer grants no human authority. No role clause changes.

Source-review correction A-16288: differing discovery refuses before write until atomic replacement; readiness signal abort plus separate drain bound retains undrained carrier ownership and reports cleanup incomplete. Frozen help expectations migrated for HUB_USAGE and DOCTOR_USAGE only.

Failed evidence8bd43f2b/A-16294: doctor.test.ts explicitly passed an absent CLAND_HUB_FILE in its second run env overlay. Preserve process.env isolation and credential-refusal assertions; first check the missing override, then seed its scratch discovery copy0600 before credential admission. No production reader change.64 CLAND_HUB_FILE consumers re-audited.

Batch duration correction: split C2/C4/C5 with cheap fixture setup and injectable short carrier readiness/reconnect timings, production defaults unchanged. Preserve every assertion and require five alongside-phase repetitions with shared admission/leases before delta review; no allowance.
