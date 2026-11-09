import { isAbsolute, join } from 'node:path';

export const fakeStorageDirectory = (root:string) => join(root,'.fixture-sockets');
export function validateFakeHost(root:string,name:string):void {
  if(!isAbsolute(root)||!/^[a-zA-Z0-9_-]+$/.test(name))throw new Error('invalid fake host root/name');
}
export function fakeMachineStorageDirectory(root:string,name:string):string {
  validateFakeHost(root,name);return join(fakeStorageDirectory(root),name);
}
