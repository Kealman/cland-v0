/** Pool names deliberately use a subset of DigitalOcean's naming vocabulary.
 * https://docs.digitalocean.com/reference/api/reference/tags/ permits letters,
 * numbers, colons, dashes and underscores, at most 255 characters: our pool tag
 * is at most 75. Droplet names are hostnames (letters/digits/dashes/dots):
 * https://docs.digitalocean.com/reference/api/reference/droplets/ . Agent
 * droplets use cland-host-<UUID> (47), not the pool. Builder names use the
 * executor's projectName (40) plus an 8-character intent, at most 55.
 * Snapshot names embed project (40), pool (64), key hash (12) and separators,
 * at most 129; snapshots are display names, not droplet hostnames.
 * https://docs.digitalocean.com/reference/api/reference/ssh-keys/ describes
 * name as a display string without a published maximum or character restriction.
 * Our key is <projectTag>-pool-<pool>-host-<UUID>; projectTag is bounded at 20,
 * giving at most 132 ASCII characters. No undocumented API limit is assumed.
 */
export function parsePoolName(value: string): string {
  const match = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.exec(value);
  if (!match || match[0] !== value) throw new Error(`invalid host pool: ${value}; use 1–64 letters, digits and hyphens, starting with a letter or digit`);
  return value;
}
