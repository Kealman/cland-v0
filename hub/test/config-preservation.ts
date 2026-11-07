// Shared literal document for config writer preservation contracts.
export const preservedConfig = `
[hosts]
harnesses = { codex = "1.0.0", opencode = "1.2.3", claude-code = "2.0.1" }
[hosts.first]
provider = "fake"
size = "small"
region = "fake-1"
transport = "ssh"
[hosts.second]
provider = "fake"
size = "large"
region = "fake-2"
transport = "ssh"
[hosts.ssh]
provider = "ssh"
size = "existing"
region = "local"
transport = "ssh"
address = "user@example.invalid"
identity_file = "key"
[future]
values = [1, 2]
[[future.rows]]
name = "kept"
`;
