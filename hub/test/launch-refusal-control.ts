// A control is synchronous and succeeds only with a refusal issued by the guard.
const refusals = new WeakSet<object>();
let controlling = false;
export function nativeLaunchRefusal(): Error {
  const error = new Error('native launch forbidden in fake-only fixture');
  refusals.add(error);
  return error;
}
export function isNativeLaunchRefusal(error: unknown): boolean {
  return typeof error === 'object' && error !== null && refusals.has(error);
}
export function isLaunchRefusalControl(): boolean { return controlling; }
export function launchRefusalControl<T>(control: () => T): T {
  const previous = controlling;
  controlling = true;
  try { return control(); }
  finally { controlling = previous; }
}
