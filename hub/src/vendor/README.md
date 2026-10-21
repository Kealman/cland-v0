`qrcodegen.js` is Project Nayuki's MIT-licensed QR Code generator, pinned to
commit `3c6d0b3cefb4e049dc337e82237c9644399716a8`:
https://github.com/nayuki/QR-Code-generator/blob/3c6d0b3cefb4e049dc337e82237c9644399716a8/typescript-javascript/qrcodegen.ts

The upstream TypeScript was transpiled with TypeScript 5.9.3 (`target: ES2024`,
`module: ESNext`), then `export { qrcodegen }` was appended for Node's native ESM.
The MIT notice is retained at the top of the file. `qrcodegen.d.ts` describes only
the high-level API used here. No runtime package is installed.
