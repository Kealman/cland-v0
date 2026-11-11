/** command is the adapter's admitted environment, not inherited process.env.
 * The production Host owns final remote filtering. Only scratch fake knobs are added. */
export function nativeLoginEnvironment(command:NodeJS.ProcessEnv,fake:Record<string,string>):NodeJS.ProcessEnv {
 for(const key of Object.keys(fake))if(!key.startsWith('FAKE_'))throw Error('native login decoration accepts fake fields only');
 return {...command,...fake};
}
