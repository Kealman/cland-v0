/** Enforcement is advertised by the effect connection, independently of framing. */
export const PAID_TERMS_FEATURES = ['paidTermsAdmission'] as const;
export class HubFeatureUnavailable extends Error {
  constructor(feature: string) {
    super(`The hub does not advertise ${feature} (paid-terms admission); restart the hub before paid operations`);
  }
}
export function enforcedFeatures(welcome: Record<string, unknown>): string[] {
  return Array.isArray(welcome.enforcedFeatures) ? welcome.enforcedFeatures.filter((feature): feature is string => typeof feature === 'string') : [];
}
export function requireHubFeatures(welcome: Record<string, unknown>, required: readonly string[]): void {
  const features = enforcedFeatures(welcome);
  for (const feature of required) if (!features.includes(feature)) throw new HubFeatureUnavailable(feature);
}
export function paidTermsFeatures(terms?: { pool: Record<string, unknown> }): readonly string[] {
  return terms?.pool.provider === 'digitalocean' ? PAID_TERMS_FEATURES : [];
}
