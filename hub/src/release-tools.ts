// Shared release/doctor guidance; never include tool output or the environment.
export const releaseToolFix = (file: string): string => `restart the hub with ${file} installed on its PATH`;
export const missingReleaseTool = (file: string): string => `${file} is missing: the hub's own PATH was searched; ${releaseToolFix(file)}`;
/** Preflight has the same authority as publication, including early session CLI admission. */
export const releasePermissionTool = (type: string): string => type === 'release.preflight' ? 'release' : type;
