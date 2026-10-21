export const canonicalAddress = (address: string): string => address.includes(':') ? new URL(`http://[${address}]`).hostname.slice(1, -1) : address;
export const loopbackAddress = (address: string): boolean => {
  const canonical = canonicalAddress(address);
  return canonical === '::1' || /^127\./.test(canonical) || /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(canonical);
};
export const addressHost = (address: string): string => address.includes(':') ? `[${canonicalAddress(address)}]` : address;

// IPv6 link-local addresses (fe80::/10) need a zone chosen on the phone;
// the hub's scopeid is local to the hub and cannot make that URL shareable.
function phoneAddress(address: string): boolean {
  if (address.includes('%')) return false;
  const canonical = canonicalAddress(address);
  return !loopbackAddress(canonical) && canonical !== '::'
    && !/^fe[89ab][0-9a-f]:/.test(canonical) && !/^ff[0-9a-f]{2}:/.test(canonical)
    && !/^(?:0|22[4-9]|23[0-9]|255)\./.test(canonical);
}

/** Select the phone's public origin before minting a one-time token. */
export function phoneOrigin(bind: string, origin: string, port: number, addresses: readonly string[] = [bind]): string {
  if (origin) return origin;
  const address = addresses.find(phoneAddress);
  if (!address) throw new Error('no phone-reachable LAN address: a phone cannot reach loopback, unspecified/multicast destinations or unscoped IPv6 link-local addresses; set [web] origin to an HTTPS tunnel or [web] bind to a LAN address');
  return `http://${addressHost(address)}:${port}`;
}
