// Shared release/doctor guidance; never include tool output or the environment.
export const releaseToolFix = (file: string): string => `restart the hub with ${file} installed on its PATH`;
export const missingReleaseTool = (file: string): string => `${file} is missing: the hub's own PATH was searched; ${releaseToolFix(file)}`;
