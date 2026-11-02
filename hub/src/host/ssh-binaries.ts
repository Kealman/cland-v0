/** Test binary overrides require both explicit fake-host controls. */
export function sshBinaries(env: NodeJS.ProcessEnv): { ssh: string; scp: string } {
  const fake = Boolean(env.CLAND_FAKE_HOSTS && env.CLAND_FAKE_HOST_ROOT);
  return { ssh: fake && env.CLAND_SSH_BIN || 'ssh', scp: fake && env.CLAND_SCP_BIN || 'scp' };
}
