import { fileURLToPath } from 'node:url';

/** Installed Claude plugin; local launches retain the historical path verbatim. */
export const LOCAL_MOD_DIR = fileURLToPath(new URL('../../mod/cland', import.meta.url));
