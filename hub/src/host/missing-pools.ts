import type { HostPools } from './pools.ts';
import type { RolesConfig } from '../roles/config.ts';

/** Metadata-only repair guidance shared by setup and doctor. */
export function missingRolePools(hosts: HostPools, roles: RolesConfig): { name: string; detail: string; fix: string }[] {
  return [...roles.values()].filter(({ launch }) => launch.pool !== 'local' && !Object.hasOwn(hosts.pools, launch.pool))
    .map(({ role, launch: { pool } }) => ({
      name: `host ${role} placement`,
      detail: `role ${role}: pool ${pool} is not configured`,
      fix: `cland config set hosts.${pool}.provider digitalocean; cland hub reload OR cland role launch ${role} --pool local; cland hub reload`,
    }));
}
