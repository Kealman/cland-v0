// Shared literal document for config writer preservation contracts.
export const preservedConfig = `
[hosts]
daily_spend_usd = 3
lease = "12h"
harnesses = { codex = "1.0.0", opencode = "1.2.3", claude-code = "2.0.1" }
[hosts.first]
provider = "fake"
size = "small"
region = "fake-1"
transport = "ssh"
slots = 8
min_hosts = 0
max_hosts = 2
idle_stop = "20m"
spread = false
[hosts.second]
provider = "fake"
size = "large"
region = "fake-2"
transport = "ssh"
slots = 8
min_hosts = 0
max_hosts = 2
idle_stop = "20m"
spread = false
[hosts.ssh]
provider = "ssh"
size = "existing"
region = "local"
transport = "ssh"
slots = 8
min_hosts = 0
max_hosts = 2
idle_stop = "20m"
spread = false
address = "user@example.invalid"
identity_file = "key"
[future]
values = [1, 2]
[[future.rows]]
name = "kept"
`;
